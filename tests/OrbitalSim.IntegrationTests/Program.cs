using Microsoft.Extensions.DependencyInjection;
using OrbitalSim.Application;
using OrbitalSim.Application.DTOs;
using OrbitalSim.Application.UseCases;
using OrbitalSim.Domain;
using OrbitalSim.Infrastructure.Fortran;

var engine = new FortranOrbitEngine();
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
SimulationSample[] samples = new RunSimulationUseCase(engine).Execute(scenario).ToArray();
Check(samples.Length == 4 && samples[0].Step == 0 && samples[1].Step == 4 &&
      samples[2].Step == 8 && samples[3].Step == 10,
    "sample schedule includes initial and final state");
Check(samples[0].Bodies[0].PositionMeters.X == -0.5,
    "earlier sample remains unchanged");

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
var mappedScenario = input.ToScenario();
Check(mappedScenario.Config == scenario.Config && mappedScenario.Bodies.SequenceEqual(scenario.Bodies),
    "shared JSON input maps to domain scenario");
using (var provider = new ServiceCollection().AddApplication().AddFortranInfrastructure()
    .BuildServiceProvider(new ServiceProviderOptions { ValidateOnBuild = true }))
{
    Check(provider.GetRequiredService<RunSimulationUseCase>().Execute(input.ToScenario()).Count() == 4,
        "dependency injection composes simulation use case");
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

Console.WriteLine("All .NET integration tests passed.");

static void Check(bool condition, string label)
{
    if (!condition) throw new Exception($"FAILED: {label}");
}
