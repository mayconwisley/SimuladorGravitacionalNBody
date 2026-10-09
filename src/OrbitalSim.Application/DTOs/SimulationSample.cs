namespace OrbitalSim.Application.DTOs;

/// <summary>
/// State at <see cref="Step"/>. <see cref="ParticlePositionsMeters"/> holds x, y, z of every
/// group particle in single precision (NaN once absorbed), or is null without particles.
/// <see cref="Events"/> and <see cref="Report"/> cover the steps since the previous sample.
/// </summary>
public sealed record SimulationSample(
    int Step,
    double TimeSeconds,
    DiagnosticValues Diagnostics,
    IReadOnlyList<BodyState> Bodies,
    float[]? ParticlePositionsMeters = null,
    IReadOnlyList<SimulationEvent>? Events = null,
    EngineReport Report = default);
