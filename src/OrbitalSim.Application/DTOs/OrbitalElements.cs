namespace OrbitalSim.Application.DTOs;

/// <summary>
/// Osculating Keplerian elements relative to a reference body (SI units, angles in radians).
/// Hyperbolic orbits have a negative semi-major axis; period and apoapsis are 0 when unbound.
/// </summary>
public readonly record struct OrbitalElements(
    double SemiMajorAxisMeters,
    double Eccentricity,
    double InclinationRadians,
    double AscendingNodeRadians,
    double ArgumentOfPeriapsisRadians,
    double TrueAnomalyRadians,
    double PeriodSeconds = 0,
    double PeriapsisMeters = 0,
    double ApoapsisMeters = 0,
    double SpecificEnergyJoulesPerKg = 0);
