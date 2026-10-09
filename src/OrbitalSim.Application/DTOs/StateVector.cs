using OrbitalSim.Domain;

namespace OrbitalSim.Application.DTOs;

public readonly record struct StateVector(Vector3d PositionMeters, Vector3d VelocityMetersPerSecond);
