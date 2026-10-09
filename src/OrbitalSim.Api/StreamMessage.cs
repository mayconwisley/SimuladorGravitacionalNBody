using OrbitalSim.Application.DTOs;

namespace OrbitalSim.Api;

/// <summary>
/// One NDJSON line of /api/simulations/stream: "start" (metadata), "sample", "end" or "error".
/// </summary>
public sealed record StreamMessage(
    string Type,
    SampleResponse? Sample = null,
    IReadOnlyList<ParticleGroupInfo>? ParticleGroups = null,
    int? ParticleCount = null,
    int? ExpectedSamples = null,
    string? Error = null);
