using OrbitalSim.Application.DTOs;

namespace OrbitalSim.Api;

public sealed record SimulationResponse(
    IReadOnlyList<SampleResponse> Samples,
    IReadOnlyList<ParticleGroupInfo> ParticleGroups,
    int ParticleCount);
