namespace OrbitalSim.Application.DTOs;

/// <summary>Osculating orbit of a body around <see cref="Reference"/>; angles in radians.</summary>
public sealed record BodyOrbit(
    string Reference,
    double SemiMajorAxisMeters,
    double Eccentricity,
    double InclinationRadians,
    double AscendingNodeRadians,
    double ArgumentOfPeriapsisRadians,
    double TrueAnomalyRadians,
    double PeriodSeconds,
    double PeriapsisMeters,
    double ApoapsisMeters,
    double SpecificEnergyJoulesPerKg)
{
    public static BodyOrbit From(string reference, OrbitalElements elements) => new(reference,
        elements.SemiMajorAxisMeters, elements.Eccentricity, elements.InclinationRadians,
        elements.AscendingNodeRadians, elements.ArgumentOfPeriapsisRadians,
        elements.TrueAnomalyRadians, elements.PeriodSeconds, elements.PeriapsisMeters,
        elements.ApoapsisMeters, elements.SpecificEnergyJoulesPerKg);
}
