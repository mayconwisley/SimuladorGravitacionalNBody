using OrbitalSim.Application.DTOs;

namespace OrbitalSim.Api;

public sealed record SimulationResponse(IReadOnlyList<SimulationSample> Samples);
