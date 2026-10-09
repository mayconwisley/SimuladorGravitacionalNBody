namespace OrbitalSim.Application.DTOs;

/// <summary>Native event: <see cref="Step"/> is 1-based inside one advance call; indices are 0-based.</summary>
public readonly record struct EngineEvent(
    SimulationEventKind Kind,
    int Step,
    int Body,
    int Other,
    double DistanceMeters);
