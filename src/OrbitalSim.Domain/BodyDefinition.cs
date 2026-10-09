namespace OrbitalSim.Domain;

/// <summary>
/// Initial state of a body in SI units. A mass of 0 makes it a test particle that feels
/// gravity without exerting it. The radius is used only for collisions and the drag
/// coefficient (Cd A / m, in m^2/kg) only inside the central body's atmosphere.
/// </summary>
public sealed record BodyDefinition(
    string Name,
    double MassKg,
    Vector3d PositionMeters,
    Vector3d VelocityMetersPerSecond,
    double RadiusMeters = 0,
    double DragAreaPerMassSquareMetersPerKg = 0)
{
    public bool IsTestParticle => MassKg == 0;
}
