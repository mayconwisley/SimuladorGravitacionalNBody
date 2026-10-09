namespace OrbitalSim.Application.DTOs;

public sealed record AdvanceResult(EngineReport Report, IReadOnlyList<EngineEvent> Events);
