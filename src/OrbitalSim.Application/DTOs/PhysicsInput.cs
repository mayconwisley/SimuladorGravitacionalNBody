namespace OrbitalSim.Application.DTOs;

/// <summary>Optional physics in SI units; see <see cref="OrbitalSim.Domain.PhysicsOptions"/>.</summary>
public sealed class PhysicsInput
{
    public string? CentralBody { get; set; }
    public double J2 { get; set; }
    public double CentralRadiusMeters { get; set; }
    public double AtmosphereDensityKgPerCubicMeter { get; set; }
    public double AtmosphereScaleHeightMeters { get; set; }
    public double LightSpeedMetersPerSecond { get; set; }
    public bool Collisions { get; set; }
}
