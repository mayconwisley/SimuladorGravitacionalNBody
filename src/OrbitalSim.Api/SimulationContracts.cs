using OrbitalSim.Application;
using OrbitalSim.Domain;

namespace OrbitalSim.Api;

public sealed class ScenarioRequest
{
    public double Gravity { get; set; }
    public double SofteningMeters { get; set; }
    public double TimeStepSeconds { get; set; }
    public int Steps { get; set; }
    public int SampleEverySteps { get; set; }
    public List<BodyRequest?>? Bodies { get; set; }

    public SimulationScenario ToScenario()
    {
        if (Bodies is null || Bodies.Count is < 1 or > 32)
            throw new ArgumentException("Use entre 1 e 32 corpos.");
        if (Steps is < 1 or > 20_000 || SampleEverySteps < 1)
            throw new ArgumentException("Use entre 1 e 20.000 passos e um intervalo de amostragem positivo.");
        int sampleCount = 2 + (Steps - 1) / SampleEverySteps;
        if (sampleCount > 1_001)
            throw new ArgumentException("Limite de 1.001 amostras por execução. Aumente o intervalo de amostragem.");

        var bodies = new List<BodyDefinition>(Bodies.Count);
        foreach (var body in Bodies)
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

public sealed class BodyRequest
{
    public string? Name { get; set; }
    public double MassKg { get; set; }
    public double[]? PositionMeters { get; set; }
    public double[]? VelocityMetersPerSecond { get; set; }
}

public sealed record SimulationResponse(IReadOnlyList<SimulationSample> Samples);
