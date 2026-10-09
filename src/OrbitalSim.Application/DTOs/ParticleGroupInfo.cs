namespace OrbitalSim.Application.DTOs;

/// <summary>Particles <see cref="Start"/> .. Start + Count - 1 of a sample belong to this group.</summary>
public sealed record ParticleGroupInfo(string Name, string Around, int Start, int Count);
