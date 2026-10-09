namespace OrbitalSim.Application.DTOs;

/// <summary>
/// Disk of massless test particles around a named body: semi-major axes spread between the
/// inner and outer radius with uniform surface density, true anomalies on a golden-angle
/// spiral, and a common eccentricity, inclination and ascending node (meters and degrees).
/// </summary>
public sealed class ParticleGroupInput
{
    public string? Name { get; set; }
    public string? Around { get; set; }
    public int Count { get; set; }
    public double InnerRadiusMeters { get; set; }
    public double OuterRadiusMeters { get; set; }
    public double Eccentricity { get; set; }
    public double InclinationDegrees { get; set; }
    public double AscendingNodeDegrees { get; set; }
}
