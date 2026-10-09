namespace OrbitalSim.Domain;

public readonly record struct Vector3d(double X, double Y, double Z)
{
    public bool IsFinite => double.IsFinite(X) && double.IsFinite(Y) && double.IsFinite(Z);
}

public sealed record BodyDefinition(
    string Name,
    double MassKg,
    Vector3d PositionMeters,
    Vector3d VelocityMetersPerSecond);

public sealed record SimulationConfig(
    double Gravity,
    double SofteningMeters,
    double TimeStepSeconds,
    int Steps,
    int SampleEverySteps);

public sealed record SimulationScenario(
    SimulationConfig Config,
    IReadOnlyList<BodyDefinition> Bodies)
{
    public void Validate()
    {
        ArgumentNullException.ThrowIfNull(Config);
        ArgumentNullException.ThrowIfNull(Bodies);
        if (!double.IsFinite(Config.Gravity) || Config.Gravity <= 0)
            throw new ArgumentException("Gravity must be finite and positive.");
        if (!double.IsFinite(Config.SofteningMeters) || Config.SofteningMeters < 0)
            throw new ArgumentException("SofteningMeters must be finite and nonnegative.");
        if (!double.IsFinite(Config.TimeStepSeconds) || Config.TimeStepSeconds <= 0)
            throw new ArgumentException("TimeStepSeconds must be finite and positive.");
        if (Config.Steps < 1 || Config.SampleEverySteps < 1)
            throw new ArgumentException("Steps and SampleEverySteps must be positive.");
        if (!double.IsFinite(Config.TimeStepSeconds * Config.Steps))
            throw new ArgumentException("The final simulation time is not finite.");
        if (Bodies.Count < 1)
            throw new ArgumentException("At least one body is required.");

        var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (BodyDefinition body in Bodies)
        {
            if (string.IsNullOrWhiteSpace(body.Name) || !names.Add(body.Name))
                throw new ArgumentException("Body names must be nonempty and unique.");
            if (!double.IsFinite(body.MassKg) || body.MassKg <= 0 ||
                !body.PositionMeters.IsFinite || !body.VelocityMetersPerSecond.IsFinite)
                throw new ArgumentException($"Invalid mass, position, or velocity for {body.Name}.");
        }
    }
}
