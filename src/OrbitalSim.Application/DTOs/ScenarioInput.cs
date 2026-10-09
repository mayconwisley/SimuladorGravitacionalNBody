using OrbitalSim.Domain;

namespace OrbitalSim.Application.DTOs;

public sealed class ScenarioInput
{
    public double Gravity { get; set; }
    public double SofteningMeters { get; set; }
    public double TimeStepSeconds { get; set; }
    public int Steps { get; set; }
    public int SampleEverySteps { get; set; }
    public List<BodyInput?>? Bodies { get; set; }

    public SimulationScenario ToScenario()
    {
        if (Bodies is null)
            throw new ArgumentException("O cenário deve conter a lista de corpos.");

        var bodies = new List<BodyDefinition>(Bodies.Count);
        foreach (BodyInput? body in Bodies)
        {
            if (body is null || body.PositionMeters is not { Length: 3 } ||
                body.VelocityMetersPerSecond is not { Length: 3 })
                throw new ArgumentException("Cada corpo precisa de nome, massa, posição XYZ e velocidade XYZ.");
            bodies.Add(new BodyDefinition(body.Name ?? string.Empty, body.MassKg,
                new Vector3d(body.PositionMeters[0], body.PositionMeters[1], body.PositionMeters[2]),
                new Vector3d(body.VelocityMetersPerSecond[0], body.VelocityMetersPerSecond[1],
                    body.VelocityMetersPerSecond[2])));
        }

        var scenario = new SimulationScenario(
            new SimulationConfig(Gravity, SofteningMeters, TimeStepSeconds, Steps,
                SampleEverySteps), bodies);
        scenario.Validate();
        return scenario;
    }
}
