using OrbitalSim.Domain;

namespace OrbitalSim.Application.DTOs;

public readonly record struct DiagnosticValues(
    double EnergyJoules,
    Vector3d MomentumKgMetersPerSecond,
    Vector3d AngularMomentumKgSquareMetersPerSecond);
