using OrbitalSim.Domain;

namespace OrbitalSim.Application.DTOs;

public sealed record BodyState(
    string Name,
    double MassKg,
    Vector3d PositionMeters,
    Vector3d VelocityMetersPerSecond);
