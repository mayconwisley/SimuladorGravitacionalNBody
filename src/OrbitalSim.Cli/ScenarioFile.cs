using System.Text.Json;
using OrbitalSim.Domain;

namespace OrbitalSim.Cli;

internal sealed class ScenarioFile
{
    public double Gravity { get; set; }
    public double SofteningMeters { get; set; }
    public double TimeStepSeconds { get; set; }
    public int Steps { get; set; }
    public int SampleEverySteps { get; set; }
    public List<BodyFile?>? Bodies { get; set; } = [];

    public static SimulationScenario Load(string path)
    {
        using FileStream stream = File.OpenRead(path);
        var document = JsonSerializer.Deserialize<ScenarioFile>(stream,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
            ?? throw new ArgumentException("Scenario JSON is empty.");
        if (document.Bodies is null)
            throw new ArgumentException("Scenario must contain a bodies array.");
        var bodies = new List<BodyDefinition>(document.Bodies.Count);
        foreach (BodyFile? body in document.Bodies)
        {
            if (body is null)
                throw new ArgumentException("Scenario contains a null body.");
            if (body.PositionMeters is not { Length: 3 } ||
                body.VelocityMetersPerSecond is not { Length: 3 })
                throw new ArgumentException("Each body requires three position and velocity values.");
            bodies.Add(new BodyDefinition(body.Name ?? string.Empty, body.MassKg,
                new Vector3d(body.PositionMeters[0], body.PositionMeters[1], body.PositionMeters[2]),
                new Vector3d(body.VelocityMetersPerSecond[0], body.VelocityMetersPerSecond[1],
                    body.VelocityMetersPerSecond[2])));
        }
        var scenario = new SimulationScenario(
            new SimulationConfig(document.Gravity, document.SofteningMeters,
                document.TimeStepSeconds, document.Steps, document.SampleEverySteps),
            bodies);
        scenario.Validate();
        return scenario;
    }
}

internal sealed class BodyFile
{
    public string? Name { get; set; }
    public double MassKg { get; set; }
    public double[]? PositionMeters { get; set; }
    public double[]? VelocityMetersPerSecond { get; set; }
}
