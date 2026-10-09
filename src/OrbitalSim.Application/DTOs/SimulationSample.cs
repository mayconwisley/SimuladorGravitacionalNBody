namespace OrbitalSim.Application.DTOs;

public sealed record SimulationSample(
    int Step,
    double TimeSeconds,
    DiagnosticValues Diagnostics,
    IReadOnlyList<BodyState> Bodies);
