namespace OrbitalSim.Application.DTOs;

/// <summary>Impulse (m/s) and optional displacement (m) applied to a body at a step.</summary>
public sealed class ManeuverInput
{
    public string? Body { get; set; }
    public int Step { get; set; }
    public double[]? DeltaVelocityMetersPerSecond { get; set; }
    public double[]? DeltaPositionMeters { get; set; }
}
