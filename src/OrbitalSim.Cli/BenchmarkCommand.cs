using OrbitalSim.Infrastructure.Fortran;
using System.Diagnostics;
using System.Globalization;

namespace OrbitalSim.Cli;

internal static class BenchmarkCommand
{
    public static void Run(int[] bodyCounts, int steps, int repeats, int batchSize,
        string? outputPath)
    {
        if (bodyCounts.Length == 0 || bodyCounts.Any(n => n < 2) ||
            steps < 1 || repeats < 1 || batchSize < 1)
            throw new ArgumentException("Benchmark counts, steps, repeats and batch must be positive.");

        var engine = new FortranOrbitEngine();
        const double gravity = 1.0;
        const double softening = 0.01;
        const double timeStep = 0.001;
        var rows = new List<string>();
        const string header = "bodies,steps,batch,repetition,elapsed_ms,steps_per_s,pair_evaluations_per_s,relative_energy_drift,allocated_bytes";
        Console.WriteLine(header);
        rows.Add(header);
        foreach (int n in bodyCounts)
        {
            var masses = Enumerable.Repeat(1.0 / n, n).ToArray();
            var initialPositions = new double[3 * n];
            var initialVelocities = new double[3 * n];
            for (int i = 0; i < n; i++)
            {
                double angle = 2 * Math.PI * i / n;
                initialPositions[3 * i] = Math.Cos(angle);
                initialPositions[3 * i + 1] = Math.Sin(angle);
                initialPositions[3 * i + 2] = 0.01 * Math.Sin(3 * angle);
            }
            engine.Step(n, masses, (double[])initialPositions.Clone(),
                (double[])initialVelocities.Clone(), timeStep, gravity, softening, 1);

            for (int repetition = 1; repetition <= repeats; repetition++)
            {
                var positions = (double[])initialPositions.Clone();
                var velocities = (double[])initialVelocities.Clone();
                double initialEnergy = engine.GetDiagnostics(n, masses, positions,
                    velocities, gravity, softening).EnergyJoules;
                long allocatedBefore = GC.GetAllocatedBytesForCurrentThread();
                var timer = Stopwatch.StartNew();
                for (int completed = 0; completed < steps;)
                {
                    int batch = Math.Min(batchSize, steps - completed);
                    engine.Step(n, masses, positions, velocities, timeStep,
                        gravity, softening, batch);
                    completed += batch;
                }
                timer.Stop();
                long allocated = GC.GetAllocatedBytesForCurrentThread() - allocatedBefore;
                double finalEnergy = engine.GetDiagnostics(n, masses, positions,
                    velocities, gravity, softening).EnergyJoules;
                double elapsedSeconds = timer.Elapsed.TotalSeconds;
                double pairEvaluations = (double)n * (n - 1) / 2 * steps * 2;
                double relativeDrift = (finalEnergy - initialEnergy) / Math.Abs(initialEnergy);
                string row = string.Join(',',
                    n, steps, batchSize, repetition,
                    timer.Elapsed.TotalMilliseconds.ToString("G17", CultureInfo.InvariantCulture),
                    (steps / elapsedSeconds).ToString("G17", CultureInfo.InvariantCulture),
                    (pairEvaluations / elapsedSeconds).ToString("G17", CultureInfo.InvariantCulture),
                    relativeDrift.ToString("G17", CultureInfo.InvariantCulture),
                    allocated);
                Console.WriteLine(row);
                rows.Add(row);
            }
        }
        if (outputPath is not null)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(outputPath))!);
            File.WriteAllLines(outputPath, rows);
        }
    }
}
