namespace OrbitalSim.Application.DTOs;

/// <summary>
/// Event at an absolute step. <see cref="Other"/> is the survivor of a collision or the
/// reference body of a turning point or escape; particles are named by their group.
/// </summary>
public sealed record SimulationEvent(
    SimulationEventKind Kind,
    int Step,
    double TimeSeconds,
    string Body,
    string? Other,
    double? DistanceMeters);
