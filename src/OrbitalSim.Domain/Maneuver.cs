namespace OrbitalSim.Domain;

/// <summary>
/// Instantaneous change applied to <see cref="Body"/> once the simulation reaches
/// <see cref="Step"/> (0 applies it to the initial state): a velocity impulse in m/s and an
/// optional displacement in m.
/// </summary>
public sealed record Maneuver(
    string Body,
    int Step,
    Vector3d DeltaVelocityMetersPerSecond,
    Vector3d DeltaPositionMeters = default);
