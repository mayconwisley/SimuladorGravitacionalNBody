using OrbitalSim.Application.DTOs;
using OrbitalSim.Application.Interfaces;
using OrbitalSim.Domain;

namespace OrbitalSim.Application.UseCases;

/// <summary>
/// Runs a scenario through the motor and yields the initial state, every
/// <see cref="SimulationConfig.SampleEverySteps"/>-th step and the final step. Advance calls are
/// split at maneuver steps; accelerations are reused between calls unless a maneuver changes
/// the state.
/// </summary>
public sealed class RunSimulationUseCase(IOrbitEngine engine)
{
    public const int EventCapacityPerCall = 512;

    public IEnumerable<SimulationSample> Execute(SimulationScenario scenario) =>
        Execute(BuiltScenario.Of(scenario));

    public IEnumerable<SimulationSample> Execute(BuiltScenario built)
    {
        ArgumentNullException.ThrowIfNull(built);
        built.Scenario.Validate();
        return Run(built);
    }

    private IEnumerable<SimulationSample> Run(BuiltScenario built)
    {
        SimulationScenario scenario = built.Scenario;
        SimulationConfig config = scenario.Config;
        EngineState state = EngineState.FromBodies(scenario.Bodies);
        EngineOptions options = EngineOptions.From(scenario);
        string[] names = scenario.Bodies.Select(body => body.Name).ToArray();
        var indexByName = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        for (int i = 0; i < names.Length; i++) indexByName[names[i]] = i;
        List<Maneuver> maneuvers = scenario.EffectiveManeuvers.OrderBy(item => item.Step).ToList();
        int nextManeuver = 0;
        var events = new List<SimulationEvent>();
        EngineReport report = EngineReport.Empty;
        int step = 0;

        ApplyManeuvers();
        yield return Capture();
        events = [];
        while (step < config.Steps)
        {
            int nextSample = Math.Min(config.Steps, (step / config.SampleEverySteps + 1) * config.SampleEverySteps);
            int target = nextManeuver < maneuvers.Count ? Math.Min(nextSample, maneuvers[nextManeuver].Step) : nextSample;
            AdvanceResult result = engine.Advance(state, config.TimeStepSeconds, config.Gravity,
                config.SofteningMeters, target - step, options, EventCapacityPerCall);
            foreach (EngineEvent item in result.Events)
            {
                int absolute = step + item.Step;
                events.Add(new SimulationEvent(item.Kind, absolute, absolute * config.TimeStepSeconds,
                    names[item.Body], item.Other >= 0 ? names[item.Other] : null, item.DistanceMeters));
            }
            report = report.Merge(result.Report);
            step = target;
            ApplyManeuvers();
            if (step == nextSample)
            {
                yield return Capture();
                events = [];
                report = EngineReport.Empty;
            }
        }

        void ApplyManeuvers()
        {
            while (nextManeuver < maneuvers.Count && maneuvers[nextManeuver].Step == step)
            {
                Maneuver maneuver = maneuvers[nextManeuver++];
                int index = indexByName[maneuver.Body];
                if (!state.IsActive(index)) continue;
                Vector3d velocity = state.Velocity(index);
                Vector3d delta = maneuver.DeltaVelocityMetersPerSecond;
                state.SetVelocity(index, new Vector3d(velocity.X + delta.X, velocity.Y + delta.Y, velocity.Z + delta.Z));
                Vector3d position = state.Position(index);
                Vector3d shift = maneuver.DeltaPositionMeters;
                state.SetPosition(index, new Vector3d(position.X + shift.X, position.Y + shift.Y, position.Z + shift.Z));
                state.AccelerationsReady = false;
                events.Add(new SimulationEvent(SimulationEventKind.Maneuver, step,
                    step * config.TimeStepSeconds, names[index], null, null));
            }
        }

        SimulationSample Capture()
        {
            DiagnosticValues diagnostics = engine.GetEnergy(state, config.Gravity,
                config.SofteningMeters, options);
            int reference = ReferenceBody(state, options);
            OrbitalElements?[] elements = reference >= 0 && built.NamedBodyCount > 1
                ? engine.GetOrbitalElements(state, config.Gravity, reference)
                : new OrbitalElements?[state.Count];
            var bodies = new BodyState[built.NamedBodyCount];
            for (int i = 0; i < bodies.Length; i++)
            {
                BodyOrbit? orbit = elements[i] is { } value ? BodyOrbit.From(names[reference], value) : null;
                bodies[i] = new BodyState(names[i], state.Masses[i], state.Position(i),
                    state.Velocity(i), state.Radii[i], state.IsActive(i), orbit);
            }
            // Snapshot: the event list keeps growing after this sample is yielded.
            return new SimulationSample(step, step * config.TimeStepSeconds, diagnostics, bodies,
                ParticlePositions(state, built), events.ToArray(), report);
        }
    }

    // Mirrors the motor's choice: the active central body, else the most massive active body.
    private static int ReferenceBody(EngineState state, EngineOptions options)
    {
        if (options.CentralIndex >= 0 && state.IsActive(options.CentralIndex) &&
            state.Masses[options.CentralIndex] > 0)
            return options.CentralIndex;
        int reference = -1;
        for (int i = 0; i < state.Count; i++)
        {
            if (!state.IsActive(i) || state.Masses[i] <= 0) continue;
            if (reference < 0 || state.Masses[i] > state.Masses[reference]) reference = i;
        }
        return reference;
    }

    private static float[]? ParticlePositions(EngineState state, BuiltScenario built)
    {
        if (built.ParticleCount == 0) return null;
        var positions = new float[3 * built.ParticleCount];
        for (int j = 0; j < built.ParticleCount; j++)
        {
            int index = built.NamedBodyCount + j;
            bool active = state.IsActive(index);
            for (int axis = 0; axis < 3; axis++)
                positions[3 * j + axis] = active ? (float)state.Positions[3 * index + axis] : float.NaN;
        }
        return positions;
    }
}
