using OrbitalSim.Application.DTOs;
using OrbitalSim.Application.Interfaces;
using OrbitalSim.Domain;

namespace OrbitalSim.Application.UseCases;

public sealed class RunSimulationUseCase(IOrbitEngine engine)
{
    public IEnumerable<SimulationSample> Execute(SimulationScenario scenario)
    {
        scenario.Validate();
        int count = scenario.Bodies.Count;
        var masses = new double[count];
        var positions = new double[checked(3 * count)];
        var velocities = new double[checked(3 * count)];
        for (int i = 0; i < count; i++)
        {
            BodyDefinition body = scenario.Bodies[i];
            masses[i] = body.MassKg;
            positions[3 * i] = body.PositionMeters.X;
            positions[3 * i + 1] = body.PositionMeters.Y;
            positions[3 * i + 2] = body.PositionMeters.Z;
            velocities[3 * i] = body.VelocityMetersPerSecond.X;
            velocities[3 * i + 1] = body.VelocityMetersPerSecond.Y;
            velocities[3 * i + 2] = body.VelocityMetersPerSecond.Z;
        }

        SimulationConfig config = scenario.Config;
        int step = 0;
        yield return Capture();
        while (step < config.Steps)
        {
            int batch = Math.Min(config.SampleEverySteps, config.Steps - step);
            engine.Step(count, masses, positions, velocities, config.TimeStepSeconds,
                config.Gravity, config.SofteningMeters, batch);
            step += batch;
            yield return Capture();
        }

        SimulationSample Capture()
        {
            DiagnosticValues diagnostics = engine.GetDiagnostics(count, masses,
                positions, velocities, config.Gravity, config.SofteningMeters);
            var states = new BodyState[count];
            for (int i = 0; i < count; i++)
            {
                states[i] = new BodyState(scenario.Bodies[i].Name, masses[i],
                    new Vector3d(positions[3 * i], positions[3 * i + 1], positions[3 * i + 2]),
                    new Vector3d(velocities[3 * i], velocities[3 * i + 1], velocities[3 * i + 2]));
            }
            return new SimulationSample(step, step * config.TimeStepSeconds, diagnostics, states);
        }
    }
}
