using System.Globalization;
using OrbitalSim.Application;
using OrbitalSim.Infrastructure.Fortran;

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
                    if (args.Length < 2) throw new ArgumentException("Provide a scenario JSON file.");
                    string output = Option(args, "--out") ?? "output";
                    var scenario = ScenarioFile.Load(args[1]);
                    CsvOutput.Write(output,
                        new SimulationRunner(new FortranOrbitEngine()).Run(scenario));
                    Console.WriteLine($"Completed {scenario.Config.Steps} steps; results in {Path.GetFullPath(output)}");
                    return 0;
                case "benchmark":
                    int[] bodies = (Option(args, "--bodies") ?? "2,100,1000")
                        .Split(',', StringSplitOptions.RemoveEmptyEntries)
                        .Select(s => int.Parse(s, CultureInfo.InvariantCulture)).ToArray();
                    int steps = int.Parse(Option(args, "--steps") ?? "100", CultureInfo.InvariantCulture);
                    int repeats = int.Parse(Option(args, "--repeats") ?? "3", CultureInfo.InvariantCulture);
                    int batch = int.Parse(Option(args, "--batch") ?? "10", CultureInfo.InvariantCulture);
                    BenchmarkCommand.Run(bodies, steps, repeats, batch, Option(args, "--out"));
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

    private static string? Option(string[] args, string name)
    {
        for (int i = 0; i < args.Length; i++)
        {
            if (args[i] != name) continue;
            if (i + 1 >= args.Length || args[i + 1].StartsWith("--", StringComparison.Ordinal))
                throw new ArgumentException($"Missing value for {name}.");
            return args[i + 1];
        }
        return null;
    }

    private static void Help()
    {
        Console.WriteLine("OrbitalSim - N-body simulation with Fortran and .NET 10");
        Console.WriteLine("  run <scenario.json> [--out directory]");
        Console.WriteLine("  benchmark [--bodies 2,100,1000] [--steps 100] [--repeats 3] [--batch 10] [--out results.csv]");
    }
}
