namespace OrbitalSim.Domain;

public sealed record BodyDefinition(
    string Name,
    double MassKg,
    Vector3d PositionMeters,
    Vector3d VelocityMetersPerSecond);
