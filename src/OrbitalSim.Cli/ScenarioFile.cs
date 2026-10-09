using System.Text.Json;
using OrbitalSim.Application.DTOs;
using OrbitalSim.Domain;

namespace OrbitalSim.Cli;

internal static class ScenarioFile
{
    public static SimulationScenario Load(string path)
    {
        using FileStream stream = File.OpenRead(path);
        var input = JsonSerializer.Deserialize<ScenarioInput>(stream,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
            ?? throw new ArgumentException("O arquivo JSON do cenário está vazio.");
        return input.ToScenario();
    }
}
