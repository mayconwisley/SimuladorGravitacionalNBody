using System.Runtime.InteropServices;
using Microsoft.Extensions.DependencyInjection;
using OrbitalSim.Application;
using OrbitalSim.Application.DTOs;
using OrbitalSim.Application.UseCases;
using OrbitalSim.Domain;
using OrbitalSim.Infrastructure.Fortran;

var engine = new FortranOrbitEngine();
var builder = new BuildScenarioUseCase(engine);
var runner = new RunSimulationUseCase(engine);

// Legacy ABI: equal-mass circular binary (G = 1, separation 1), one orbit in 10,000 steps.
var mass = new[] { 1.0, 1.0 };
var position = new[] { -0.5, 0.0, 0.0, 0.5, 0.0, 0.0 };
var velocity = new[] { 0.0, -Math.Sqrt(0.5), 0.0, 0.0, Math.Sqrt(0.5), 0.0 };
DiagnosticValues initial = engine.GetDiagnostics(2, mass, position, velocity, 1, 0);
double period = 2 * Math.PI / Math.Sqrt(2);
engine.Step(2, mass, position, velocity, period / 10_000, 1, 0, 10_000);
DiagnosticValues final = engine.GetDiagnostics(2, mass, position, velocity, 1, 0);
Check(Math.Abs(position[0] + 0.5) < 1e-5, "P/Invoke two-body orbital closure");
Check(Math.Abs(final.EnergyJoules - initial.EnergyJoules) < 1e-8,
    "P/Invoke energy conservation");
Check(Math.Abs(final.MomentumKgMetersPerSecond.X) < 1e-12 &&
      Math.Abs(final.MomentumKgMetersPerSecond.Y) < 1e-12,
    "P/Invoke momentum conservation");

var scenario = new SimulationScenario(
    new SimulationConfig(1, 0, period / 10_000, 10, 4),
    [new BodyDefinition("A", 1, new Vector3d(-0.5, 0, 0),
         new Vector3d(0, -Math.Sqrt(0.5), 0)),
     new BodyDefinition("B", 1, new Vector3d(0.5, 0, 0),
         new Vector3d(0, Math.Sqrt(0.5), 0))]);
SimulationSample[] samples = runner.Execute(scenario).ToArray();
Check(samples.Length == 4 && samples[0].Step == 0 && samples[1].Step == 4 &&
      samples[2].Step == 8 && samples[3].Step == 10,
    "sample schedule includes initial and final state");
Check(samples[0].Bodies[0].PositionMeters.X == -0.5,
    "earlier sample remains unchanged");

// Struct layouts must match native/include/orbitalsim.h.
Check(Marshal.SizeOf<NativeOptions>() == 56 && Marshal.SizeOf<NativeReport>() == 48 &&
      Marshal.SizeOf<NativeEvent>() == 24 && Marshal.SizeOf<NativeElements>() == 80 &&
      Marshal.OffsetOf<NativeOptions>(nameof(NativeOptions.J2)) == 16 &&
      Marshal.OffsetOf<NativeReport>(nameof(NativeReport.EventCount)) == 32 &&
      Marshal.OffsetOf<NativeEvent>(nameof(NativeEvent.DistanceMeters)) == 16,
    "interop struct sizes match the C header");

// Energy split for the circular binary: K = 0.5 J, U = -1 J (tol 1e-14).
EngineState binary = EngineState.FromBodies(scenario.Bodies);
DiagnosticValues split = engine.GetEnergy(binary, 1, 0, EngineOptions.Default);
Check(Math.Abs(split.KineticEnergyJoules - 0.5) < 1e-14 && Math.Abs(split.PotentialEnergyJoules + 1) < 1e-14 &&
      Math.Abs(split.AngularMomentumKgSquareMetersPerSecond.Z - Math.Sqrt(0.5)) < 1e-14,
    "P/Invoke kinetic, potential and angular momentum");

// Elements through P/Invoke: relative circular orbit a = 1, period 2 pi / sqrt(2) (tol 1e-12),
// and an elements -> state -> elements round trip for an inclined ellipse (tol 1e-11).
OrbitalElements?[] binaryElements = engine.GetOrbitalElements(binary, 1, 0);
Check(binaryElements[0] is null && binaryElements[1] is { } relative &&
      Math.Abs(relative.SemiMajorAxisMeters - 1) < 1e-12 && Math.Abs(relative.PeriodSeconds - period) < 1e-12,
    "P/Invoke orbital elements of the binary");
var ellipse = new OrbitalElements(2, 0.3, 0.7, 1.1, 2.2, 0.4);
StateVector ellipseState = engine.ElementsToState(1, 1, 0, ellipse);
var probe = EngineState.FromBodies([
    new BodyDefinition("M", 1, default, default),
    new BodyDefinition("p", 0, ellipseState.PositionMeters, ellipseState.VelocityMetersPerSecond)]);
OrbitalElements back = engine.GetOrbitalElements(probe, 1, 0)[1]!.Value;
Check(Math.Abs(back.SemiMajorAxisMeters - 2) < 1e-11 && Math.Abs(back.Eccentricity - 0.3) < 1e-11 &&
      Math.Abs(back.InclinationRadians - 0.7) < 1e-11 && Math.Abs(back.ArgumentOfPeriapsisRadians - 2.2) < 1e-11,
    "P/Invoke elements round trip");
Throws<InvalidOperationException>(() => engine.ElementsToState(1, 1, 0, ellipse with { Eccentricity = 1 }),
    "parabola rejected through P/Invoke");

// Advance with events: m = 1e-9 on a = 1, e = 0.5 from apoapsis, 1000 steps per orbit, 2.75
// orbits -> 3 periapsis (r = 0.5, tol 1e-4) and 2 apoapsis events; report min separation 0.5.
StateVector apo = engine.ElementsToState(1, 1, 1e-9, new OrbitalElements(1, 0.5, 0, 0, 0, Math.PI));
EngineState eccentric = EngineState.FromBodies([
    new BodyDefinition("Star", 1, default, default),
    new BodyDefinition("Comet", 1e-9, apo.PositionMeters, apo.VelocityMetersPerSecond)]);
AdvanceResult advance = engine.Advance(eccentric, 2 * Math.PI / Math.Sqrt(1 + 1e-9) / 1000, 1, 0, 2750,
    EngineOptions.Default, 16);
Check(advance.Events.Count(item => item.Kind == SimulationEventKind.Periapsis) == 3 &&
      advance.Events.Count(item => item.Kind == SimulationEventKind.Apoapsis) == 2 &&
      advance.Events.Where(item => item.Kind == SimulationEventKind.Periapsis)
          .All(item => Math.Abs(item.DistanceMeters - 0.5) < 1e-4 && item.Body == 1 && item.Other == 0),
    "P/Invoke turning point events");
Check(advance.Report.MinSeparationMeters is { } minimum && Math.Abs(minimum - 0.5) < 1e-4 &&
      advance.Report.SuggestedTimeStepSeconds > 0 &&
      advance.Report.MassiveSuggestedTimeStepSeconds == advance.Report.SuggestedTimeStepSeconds,
    "P/Invoke encounter report");

// Acceleration cache: the use case with 4-step samples equals one 1000-step advance bit for bit.
EngineState single = EngineState.FromBodies(scenario.Bodies);
engine.Advance(single, period / 10_000, 1, 0, 1000, EngineOptions.Default, 0);
SimulationSample last = runner.Execute(scenario with { Config = scenario.Config with { Steps = 1000 } }).Last();
Check(last.Bodies[0].PositionMeters == single.Position(0) && last.Bodies[1].VelocityMetersPerSecond == single.Velocity(1),
    "sampled run reuses accelerations without changing the trajectory");

// Shared JSON input, including the optional sections.
var input = new ScenarioInput
{
    Gravity = 1,
    TimeStepSeconds = period / 10_000,
    Steps = 10,
    SampleEverySteps = 4,
    Bodies =
    [
        new BodyInput { Name = "A", MassKg = 1, PositionMeters = [-0.5, 0, 0],
            VelocityMetersPerSecond = [0, -Math.Sqrt(0.5), 0] },
        new BodyInput { Name = "B", MassKg = 1, PositionMeters = [0.5, 0, 0],
            VelocityMetersPerSecond = [0, Math.Sqrt(0.5), 0] }
    ]
};
BuiltScenario mapped = builder.Execute(input);
Check(mapped.Scenario.Config == scenario.Config && mapped.Scenario.Bodies.SequenceEqual(scenario.Bodies) &&
      mapped.ParticleCount == 0,
    "shared JSON input maps to domain scenario");

// Orbit-defined body: circular a = 2 around A (at rest, M = 1, G = 1) -> speed sqrt(1/2).
BuiltScenario orbiting = builder.Execute(new ScenarioInput
{
    Gravity = 1, TimeStepSeconds = 0.01, Steps = 10, SampleEverySteps = 5, Integrator = "yoshida4",
    Bodies =
    [
        new BodyInput { Name = "A", MassKg = 1, PositionMeters = [1, 2, 3], VelocityMetersPerSecond = [0, 0, 0] },
        new BodyInput { Name = "Moon", MassKg = 0, Orbit = new OrbitInput { Around = "A", SemiMajorAxisMeters = 2 } }
    ],
    ParticleGroups = [new ParticleGroupInput { Name = "Ring", Around = "A", Count = 50,
        InnerRadiusMeters = 3, OuterRadiusMeters = 4 }],
    Maneuvers = [new ManeuverInput { Body = "Moon", Step = 5, DeltaVelocityMetersPerSecond = [0, 0, 0.1] }]
});
BodyDefinition moon = orbiting.Scenario.Bodies[1];
Check(orbiting.Scenario.Config.Integrator == Integrator.Yoshida4 &&
      Math.Abs(moon.PositionMeters.X - 3) < 1e-12 && Math.Abs(moon.PositionMeters.Y - 2) < 1e-12 &&
      Math.Abs(moon.VelocityMetersPerSecond.Y - Math.Sqrt(0.5)) < 1e-12,
    "orbit input resolves to state vectors around its body");
Check(orbiting.NamedBodyCount == 2 && orbiting.ParticleCount == 50 &&
      orbiting.ParticleGroups.Single() is { Name: "Ring", Start: 0, Count: 50 } &&
      orbiting.Scenario.Bodies.Skip(2).All(body => body.MassKg == 0),
    "particle group generates massless bodies");
SimulationSample[] withManeuver = runner.Execute(orbiting).ToArray();
Check(withManeuver[1].Events!.Any(item => item.Kind == SimulationEventKind.Maneuver && item.Step == 5 && item.Body == "Moon") &&
      Math.Abs(withManeuver[1].Bodies[1].VelocityMetersPerSecond.Z - 0.1) < 1e-12 &&
      withManeuver[0].ParticlePositionsMeters is { Length: 150 } &&
      withManeuver[0].Bodies[1].Orbit is { Reference: "A" } moonOrbit && Math.Abs(moonOrbit.SemiMajorAxisMeters - 2) < 1e-9,
    "maneuver, particle positions and body orbit in samples");
Check(withManeuver[0].Events!.Count == 0 && withManeuver.Sum(sample => sample.Events!.Count) == 1,
    "each event appears in exactly one sample");

// Physics through the use case: circular binary with collisions (radii 0.6) merges at once.
SimulationSample[] merged = runner.Execute(scenario with
{
    Bodies = [scenario.Bodies[0] with { RadiusMeters = 0.6 }, scenario.Bodies[1] with { RadiusMeters = 0.6 }],
    Physics = new PhysicsOptions(Collisions: true)
}).ToArray();
Check(merged[1].Bodies.Count(body => body.Active) == 1 &&
      merged[1].Events!.Single(item => item.Kind == SimulationEventKind.Collision).Step == 1 &&
      Math.Abs(merged[1].Bodies[0].MassKg - 2) < 1e-14, "collision merges bodies");

// Reverse time: forward 10 steps, then the final state backwards returns to the start (tol 1e-12).
SimulationSample forward = runner.Execute(scenario).Last();
SimulationSample backward = runner.Execute(new SimulationScenario(
    scenario.Config with { TimeStepSeconds = -scenario.Config.TimeStepSeconds },
    forward.Bodies.Select(body => new BodyDefinition(body.Name, body.MassKg, body.PositionMeters,
        body.VelocityMetersPerSecond)).ToList())).Last();
Check(Math.Abs(backward.Bodies[0].PositionMeters.X + 0.5) < 1e-12 && backward.TimeSeconds < 0,
    "negative time step integrates backwards");

// Invalid input reaches the user as an argument error in Portuguese.
Throws<ArgumentException>(() => builder.Execute(new ScenarioInput { Gravity = 1, TimeStepSeconds = 1,
    Steps = 1, SampleEverySteps = 1, Integrator = "euler", Bodies = input.Bodies }), "unknown integrator");
Throws<ArgumentException>(() => builder.Execute(new ScenarioInput { Gravity = 1, TimeStepSeconds = 1,
    Steps = 1, SampleEverySteps = 1, Bodies = [new BodyInput { Name = "X", MassKg = 1,
        Orbit = new OrbitInput { Around = "Nobody", SemiMajorAxisMeters = 1 } }] }), "orbit around unknown body");
Throws<ArgumentException>(() => runner.Execute(scenario with
{
    Physics = new PhysicsOptions(J2: 1e-3)
}).ToArray(), "J2 without central body");

using (var provider = new ServiceCollection().AddApplication().AddFortranInfrastructure()
    .BuildServiceProvider(new ServiceProviderOptions { ValidateOnBuild = true }))
{
    BuiltScenario composed = provider.GetRequiredService<BuildScenarioUseCase>().Execute(input);
    Check(provider.GetRequiredService<RunSimulationUseCase>().Execute(composed).Count() == 4,
        "dependency injection composes simulation use cases");
}
Check(!typeof(SimulationScenario).Assembly.GetReferencedAssemblies()
    .Any(reference => reference.Name?.StartsWith("OrbitalSim.") == true),
    "domain has no outer-layer reference");
Check(!typeof(RunSimulationUseCase).Assembly.GetReferencedAssemblies()
    .Any(reference => reference.Name is "OrbitalSim.Infrastructure.Fortran" or "OrbitalSim.Api"),
    "application has no infrastructure or API reference");

position = new double[6];
velocity = new double[6];
try
{
    engine.Step(2, mass, position, velocity, 0.01, 1, 0, 1);
    throw new Exception("Expected a coincident-body error.");
}
catch (InvalidOperationException)
{
    Check(position.All(x => x == 0) && velocity.All(x => x == 0),
        "native failure preserves caller buffers");
}

EngineState coincident = EngineState.FromBodies([
    new BodyDefinition("A", 1, default, default), new BodyDefinition("B", 1, default, default)]);
try
{
    engine.Advance(coincident, 0.01, 1, 0, 1, EngineOptions.Default, 4);
    throw new Exception("Expected a coincident-body error.");
}
catch (InvalidOperationException)
{
    Check(!coincident.AccelerationsReady && coincident.Positions.All(x => x == 0) &&
          coincident.Active.All(flag => flag == 1), "advance failure preserves state");
}

Console.WriteLine("All .NET integration tests passed.");

static void Check(bool condition, string label)
{
    if (!condition) throw new Exception($"FAILED: {label}");
}

static void Throws<T>(Action action, string label) where T : Exception
{
    try
    {
        action();
    }
    catch (T)
    {
        return;
    }
    throw new Exception($"FAILED: {label} did not throw {typeof(T).Name}");
}
