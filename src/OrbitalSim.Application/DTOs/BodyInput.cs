namespace OrbitalSim.Application.DTOs;

public sealed class BodyInput
{
    public string? Name { get; set; }
    public double MassKg { get; set; }
    public double[]? PositionMeters { get; set; }
    public double[]? VelocityMetersPerSecond { get; set; }
}
