using OrbitalSim.Domain;

namespace OrbitalSim.Application.DTOs;

/// <summary>
/// State of a named body at one sample. Inactive bodies were merged into another body and
/// follow it; <see cref="Orbit"/> is null for the reference body and undefined orbits.
/// </summary>
public sealed record BodyState(
    string Name,
    double MassKg,
    Vector3d PositionMeters,
    Vector3d VelocityMetersPerSecond,
    double RadiusMeters = 0,
    bool Active = true,
    BodyOrbit? Orbit = null);
