using OrbitalSim.Application.DTOs;
using OrbitalSim.Domain;

namespace OrbitalSim.Api;

/// <summary>
/// Limits that keep one interactive request fast and its response small. The CLI has none.
/// </summary>
internal static class InteractiveScenarioLimits
{
    public const int MaxBodies = 32;
    public const int MaxParticles = 2_000;
    public const int MaxParticleGroups = 8;
    public const int MaxManeuvers = 100;
    public const int MaxSteps = 20_000;
    public const int MaxSamples = 1_001;
    // Particle positions sent to the browser: samples x particles (12 bytes each in float32).
    public const long MaxParticleSamples = 400_000;
    // Pair interactions evaluated: steps x force evaluations per step x (M^2 / 2 + M P).
    // About 10^8 pairs/s on a desktop CPU, so the budget keeps a request under ~10 s.
    public const double MaxPairEvaluations = 6e8;

    public static void Validate(ScenarioInput input)
    {
        if (input.Bodies is null || input.Bodies.Count is < 1 or > MaxBodies)
            throw new ArgumentException($"Use entre 1 e {MaxBodies} corpos.");
        if (input.Steps is < 1 or > MaxSteps || input.SampleEverySteps < 1)
            throw new ArgumentException($"Use entre 1 e {MaxSteps:N0} passos e um intervalo de amostragem positivo.");
        if (SampleCount(input.Steps, input.SampleEverySteps) > MaxSamples)
            throw new ArgumentException($"Limite de {MaxSamples:N0} amostras por execução. Aumente o intervalo de amostragem.");
        if ((input.ParticleGroups?.Count ?? 0) > MaxParticleGroups)
            throw new ArgumentException($"Use no máximo {MaxParticleGroups} grupos de partículas.");
        long particles = input.ParticleGroups?.Sum(group => (long)Math.Max(0, group?.Count ?? 0)) ?? 0;
        if (particles > MaxParticles)
            throw new ArgumentException($"Use no máximo {MaxParticles:N0} partículas no total.");
        if (particles * SampleCount(input.Steps, input.SampleEverySteps) > MaxParticleSamples)
            throw new ArgumentException("Partículas demais para tantas amostras. Aumente o intervalo de amostragem.");
        if ((input.Maneuvers?.Count ?? 0) > MaxManeuvers)
            throw new ArgumentException($"Use no máximo {MaxManeuvers} manobras.");
    }

    public static void ValidateWork(BuiltScenario built)
    {
        SimulationConfig config = built.Scenario.Config;
        double massive = built.Scenario.Bodies.Count(body => body.MassKg > 0);
        double light = built.Scenario.Bodies.Count - massive;
        double evaluations = config.Integrator switch
        {
            Integrator.Yoshida4 => 3,
            Integrator.RungeKutta4 => 4,
            _ => 1
        };
        if (built.Scenario.EffectivePhysics.AtmosphereDensityKgPerCubicMeter > 0 ||
            built.Scenario.EffectivePhysics.LightSpeedMetersPerSecond > 0)
            evaluations *= 2;
        double pairs = config.Steps * evaluations * (massive * massive / 2 + massive * light);
        if (pairs > MaxPairEvaluations)
            throw new ArgumentException("Cenário pesado demais para a execução interativa. " +
                "Reduza passos, partículas ou corpos com massa, ou use a CLI.");
    }

    public static int SampleCount(int steps, int sampleEverySteps) => 2 + (steps - 1) / sampleEverySteps;
}
