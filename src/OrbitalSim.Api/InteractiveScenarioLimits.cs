using OrbitalSim.Application.DTOs;

namespace OrbitalSim.Api;

internal static class InteractiveScenarioLimits
{
    public static void Validate(ScenarioInput input)
    {
        if (input.Bodies is null || input.Bodies.Count is < 1 or > 32)
            throw new ArgumentException("Use entre 1 e 32 corpos.");
        if (input.Steps is < 1 or > 20_000 || input.SampleEverySteps < 1)
            throw new ArgumentException("Use entre 1 e 20.000 passos e um intervalo de amostragem positivo.");
        int sampleCount = 2 + (input.Steps - 1) / input.SampleEverySteps;
        if (sampleCount > 1_001)
            throw new ArgumentException("Limite de 1.001 amostras por execução. Aumente o intervalo de amostragem.");
    }
}
