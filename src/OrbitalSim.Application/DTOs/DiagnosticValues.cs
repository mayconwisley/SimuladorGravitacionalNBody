using OrbitalSim.Domain;

namespace OrbitalSim.Application.DTOs;

/// <summary>
/// Conserved quantities of the active bodies. The potential includes the central J2 term;
/// drag and the 1PN correction change the energy by design.
/// </summary>
public readonly record struct DiagnosticValues(
    double EnergyJoules,
    Vector3d MomentumKgMetersPerSecond,
    Vector3d AngularMomentumKgSquareMetersPerSecond,
    double KineticEnergyJoules = 0,
    double PotentialEnergyJoules = 0);
