namespace OrbitalSim.Domain;

public sealed record SimulationScenario(
    SimulationConfig Config,
    IReadOnlyList<BodyDefinition> Bodies,
    PhysicsOptions? Physics = null,
    IReadOnlyList<Maneuver>? Maneuvers = null)
{
    public PhysicsOptions EffectivePhysics => Physics ?? PhysicsOptions.None;

    public IReadOnlyList<Maneuver> EffectiveManeuvers => Maneuvers ?? [];

    public void Validate()
    {
        ArgumentNullException.ThrowIfNull(Config);
        ArgumentNullException.ThrowIfNull(Bodies);
        if (!double.IsFinite(Config.Gravity) || Config.Gravity <= 0)
            throw new ArgumentException("Gravity must be finite and positive.");
        if (!double.IsFinite(Config.SofteningMeters) || Config.SofteningMeters < 0)
            throw new ArgumentException("SofteningMeters must be finite and nonnegative.");
        if (!double.IsFinite(Config.TimeStepSeconds) || Config.TimeStepSeconds == 0)
            throw new ArgumentException("TimeStepSeconds must be finite and nonzero.");
        if (Config.Steps < 1 || Config.SampleEverySteps < 1)
            throw new ArgumentException("Steps and SampleEverySteps must be positive.");
        if (!double.IsFinite(Config.TimeStepSeconds * Config.Steps))
            throw new ArgumentException("The final simulation time is not finite.");
        if (!Enum.IsDefined(Config.Integrator))
            throw new ArgumentException("Unknown integrator.");
        if (Bodies.Count < 1)
            throw new ArgumentException("At least one body is required.");

        var names = new Dictionary<string, BodyDefinition>(StringComparer.OrdinalIgnoreCase);
        foreach (BodyDefinition body in Bodies)
        {
            if (body is null || string.IsNullOrWhiteSpace(body.Name) || !names.TryAdd(body.Name, body))
                throw new ArgumentException("Body names must be nonempty and unique.");
            if (!double.IsFinite(body.MassKg) || body.MassKg < 0 ||
                !body.PositionMeters.IsFinite() || !body.VelocityMetersPerSecond.IsFinite())
                throw new ArgumentException($"Invalid mass, position, or velocity for {body.Name}.");
            if (!double.IsFinite(body.RadiusMeters) || body.RadiusMeters < 0 ||
                !double.IsFinite(body.DragAreaPerMassSquareMetersPerKg) ||
                body.DragAreaPerMassSquareMetersPerKg < 0)
                throw new ArgumentException($"Invalid radius or drag coefficient for {body.Name}.");
        }
        if (!Bodies.Any(body => body.MassKg > 0))
            throw new ArgumentException("At least one body must have positive mass.");

        ValidatePhysics(EffectivePhysics, names);
        foreach (Maneuver maneuver in EffectiveManeuvers)
        {
            if (maneuver is null || !names.ContainsKey(maneuver.Body ?? string.Empty))
                throw new ArgumentException("Each maneuver must name an existing body.");
            if (maneuver.Step < 0 || maneuver.Step >= Config.Steps)
                throw new ArgumentException(
                    $"Maneuver step for {maneuver.Body} must be between 0 and {Config.Steps - 1}.");
            if (!maneuver.DeltaVelocityMetersPerSecond.IsFinite() || !maneuver.DeltaPositionMeters.IsFinite())
                throw new ArgumentException($"Invalid maneuver for {maneuver.Body}.");
        }
    }

    private static void ValidatePhysics(PhysicsOptions physics,
        Dictionary<string, BodyDefinition> bodies)
    {
        if (!double.IsFinite(physics.J2) || !double.IsFinite(physics.CentralRadiusMeters) ||
            !double.IsFinite(physics.AtmosphereDensityKgPerCubicMeter) ||
            !double.IsFinite(physics.AtmosphereScaleHeightMeters) ||
            !double.IsFinite(physics.LightSpeedMetersPerSecond) ||
            physics.CentralRadiusMeters < 0 || physics.AtmosphereDensityKgPerCubicMeter < 0 ||
            physics.AtmosphereScaleHeightMeters < 0 || physics.LightSpeedMetersPerSecond < 0)
            throw new ArgumentException("Physics options must be finite and nonnegative (J2 may be negative).");
        if (physics.CentralBody is null)
        {
            if (physics.UsesCentralBody)
                throw new ArgumentException("J2, drag and relativity need a central body.");
            return;
        }
        if (!bodies.TryGetValue(physics.CentralBody, out BodyDefinition? central) || central.MassKg <= 0)
            throw new ArgumentException("The central body must exist and have positive mass.");
        if (physics.J2 != 0 && physics.CentralRadiusMeters <= 0)
            throw new ArgumentException("J2 needs the central body's equatorial radius.");
        if (physics.AtmosphereDensityKgPerCubicMeter > 0 &&
            (physics.CentralRadiusMeters <= 0 || physics.AtmosphereScaleHeightMeters <= 0))
            throw new ArgumentException("Drag needs the central radius and a positive scale height.");
    }
}
