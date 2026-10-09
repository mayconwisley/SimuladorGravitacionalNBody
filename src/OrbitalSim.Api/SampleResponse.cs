using System.Runtime.InteropServices;
using OrbitalSim.Application.DTOs;

namespace OrbitalSim.Api;

/// <summary>
/// HTTP form of a sample. <see cref="Particles"/> is the little-endian float32 array
/// [x0, y0, z0, x1, ...] in meters, serialized as base64 (NaN marks absorbed particles).
/// </summary>
public sealed record SampleResponse(
    int Step,
    double TimeSeconds,
    DiagnosticValues Diagnostics,
    IReadOnlyList<BodyState> Bodies,
    byte[]? Particles,
    IReadOnlyList<SimulationEvent> Events,
    EngineReport Report)
{
    public static SampleResponse From(SimulationSample sample) => new(sample.Step, sample.TimeSeconds,
        sample.Diagnostics, sample.Bodies,
        sample.ParticlePositionsMeters is { } positions
            ? MemoryMarshal.AsBytes(positions.AsSpan()).ToArray() : null,
        sample.Events ?? [], sample.Report);
}
