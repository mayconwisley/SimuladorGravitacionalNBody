namespace OrbitalSim.Application.DTOs;

/// <summary>
/// A body defined either by state vectors (positionMeters and velocityMetersPerSecond) or by
/// an <see cref="Orbit"/> around a body listed earlier. Mass 0 makes it a test particle.
/// </summary>
public sealed class BodyInput
{
    public string? Name { get; set; }
    public double MassKg { get; set; }
    public double[]? PositionMeters { get; set; }
    public double[]? VelocityMetersPerSecond { get; set; }
    public OrbitInput? Orbit { get; set; }

    /// <summary>Collision radius; 0 disables collisions for this body.</summary>
    public double RadiusMeters { get; set; }

    /// <summary>Ballistic coefficient Cd A / m in m^2/kg used by atmospheric drag.</summary>
    public double DragAreaPerMassSquareMetersPerKg { get; set; }
}
