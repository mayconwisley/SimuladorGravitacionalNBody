namespace OrbitalSim.Domain;

/// <summary>
/// Optional physics applied by <see cref="CentralBody"/> to every other body, in SI units:
/// J2 oblateness about the inertial z axis, drag in an exponential atmosphere
/// rho0 exp(-(r - R) / H) and the 1PN (Schwarzschild) correction when the speed of light is set.
/// Collisions merge massive bodies whose radii overlap and absorb test particles.
/// </summary>
public sealed record PhysicsOptions(
    string? CentralBody = null,
    double J2 = 0,
    double CentralRadiusMeters = 0,
    double AtmosphereDensityKgPerCubicMeter = 0,
    double AtmosphereScaleHeightMeters = 0,
    double LightSpeedMetersPerSecond = 0,
    bool Collisions = false)
{
    public static PhysicsOptions None { get; } = new();

    public bool UsesCentralBody =>
        J2 != 0 || AtmosphereDensityKgPerCubicMeter > 0 || LightSpeedMetersPerSecond > 0;
}
