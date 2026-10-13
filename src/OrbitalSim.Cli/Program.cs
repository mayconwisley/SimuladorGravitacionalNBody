using Microsoft.Extensions.DependencyInjection;
using OrbitalSim.Application;
using OrbitalSim.Application.UseCases;
using OrbitalSim.Infrastructure.Fortran;
using System.Globalization;

namespace OrbitalSim.Cli;

internal static class Program
{
    private static int Main(string[] args)
    {
        try
        {
            if (args.Length == 0 || args[0] is "help" or "--help" or "-h")
            {
                Help();
                return 0;
            }
            switch (args[0])
            {
                case "run":
                    {
                        if (args.Length < 2 || args[1].StartsWith("--", StringComparison.Ordinal))
                            throw new ArgumentException("Provide a scenario JSON file.");
                        var runOptions = ParseOptions(args, 2, "--out");
                        string output = runOptions.GetValueOrDefault("--out") ?? "output";
                        var input = ScenarioFile.Load(args[1]);
                        using var services = new ServiceCollection()
                            .AddApplication()
                            .AddFortranInfrastructure()
                            .BuildServiceProvider();
                        var built = services.GetRequiredService<BuildScenarioUseCase>().Execute(input);
                        CsvOutput.Write(output, built,
                            services.GetRequiredService<RunSimulationUseCase>().Execute(built));
                        Console.WriteLine($"Completed {built.Scenario.Config.Steps} steps; results in {Path.GetFullPath(output)}");
                        return 0;
                    }
                case "benchmark":
                    var benchmarkOptions = ParseOptions(args, 1,
                        "--bodies", "--steps", "--repeats", "--batch", "--out");
                    int[] bodies = (benchmarkOptions.GetValueOrDefault("--bodies") ?? "2,100,1000")
                        .Split(',', StringSplitOptions.RemoveEmptyEntries)
                        .Select(s => int.Parse(s, CultureInfo.InvariantCulture)).ToArray();
                    int steps = int.Parse(benchmarkOptions.GetValueOrDefault("--steps") ?? "100", CultureInfo.InvariantCulture);
                    int repeats = int.Parse(benchmarkOptions.GetValueOrDefault("--repeats") ?? "3", CultureInfo.InvariantCulture);
                    int batch = int.Parse(benchmarkOptions.GetValueOrDefault("--batch") ?? "10", CultureInfo.InvariantCulture);
                    BenchmarkCommand.Run(bodies, steps, repeats, batch,
                        benchmarkOptions.GetValueOrDefault("--out"));
                    return 0;
                default:
                    throw new ArgumentException($"Unknown command: {args[0]}");
            }
        }
        catch (Exception exception) when (exception is not OutOfMemoryException)
        {
            Console.Error.WriteLine($"Error: {exception.Message}");
            return 1;
        }
    }

    private static Dictionary<string, string> ParseOptions(string[] args, int first,
        params string[] allowed)
    {
        var options = new Dictionary<string, string>(StringComparer.Ordinal);
        for (int i = first; i < args.Length; i += 2)
        {
            string name = args[i];
            if (!allowed.Contains(name, StringComparer.Ordinal))
                throw new ArgumentException($"Unknown option: {name}.");
            if (i + 1 >= args.Length || string.IsNullOrWhiteSpace(args[i + 1]) ||
                args[i + 1].StartsWith("--", StringComparison.Ordinal))
                throw new ArgumentException($"Missing value for {name}.");
            if (!options.TryAdd(name, args[i + 1]))
                throw new ArgumentException($"Option repeated: {name}.");
        }
        return options;
    }

    private static void Help()
    {
        Console.WriteLine("OrbitalSim - N-body simulation with Fortran and .NET 10");
        Console.WriteLine("  run <scenario.json> [--out directory]");
        Console.WriteLine("  benchmark [--bodies 2,100,1000] [--steps 100] [--repeats 3] [--batch 10] [--out results.csv]");
    }
}
