using OrbitalSim.Application.DTOs;
using System.Text.Json;

namespace OrbitalSim.Cli;

internal static class ScenarioFile
{
    public static ScenarioInput Load(string path)
    {
        using FileStream stream = File.OpenRead(path);
        return JsonSerializer.Deserialize<ScenarioInput>(stream,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
            ?? throw new ArgumentException("O arquivo JSON do cenário está vazio.");
    }
}
