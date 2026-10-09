using System.Globalization;
using System.Text;
using System.Text.Json;
using OrbitalSim.Application;

namespace OrbitalSim.Cli;

internal static class CsvOutput
{
    private static readonly CultureInfo Invariant = CultureInfo.InvariantCulture;

    public static void Write(string directory, IEnumerable<SimulationSample> samples)
    {
        Directory.CreateDirectory(directory);
        using var trajectory = new StreamWriter(Path.Combine(directory, "trajectory.csv"),
            false, new UTF8Encoding(false));
        using var diagnostics = new StreamWriter(Path.Combine(directory, "diagnostics.csv"),
            false, new UTF8Encoding(false));
        trajectory.WriteLine("step,time_s,body,mass_kg,x_m,y_m,z_m,vx_m_s,vy_m_s,vz_m_s");
        diagnostics.WriteLine("step,time_s,energy_j,px_kg_m_s,py_kg_m_s,pz_kg_m_s,lx_kg_m2_s,ly_kg_m2_s,lz_kg_m2_s");

        SimulationSample? initial = null;
        SimulationSample? final = null;
        int sampleCount = 0;
        foreach (SimulationSample sample in samples)
        {
            initial ??= sample;
            final = sample;
            sampleCount++;
            foreach (BodyState body in sample.Bodies)
            {
                trajectory.WriteLine(string.Join(',',
                    sample.Step, F(sample.TimeSeconds), Escape(body.Name), F(body.MassKg),
                    F(body.PositionMeters.X), F(body.PositionMeters.Y), F(body.PositionMeters.Z),
                    F(body.VelocityMetersPerSecond.X), F(body.VelocityMetersPerSecond.Y),
                    F(body.VelocityMetersPerSecond.Z)));
            }
            DiagnosticValues d = sample.Diagnostics;
            diagnostics.WriteLine(string.Join(',',
                sample.Step, F(sample.TimeSeconds), F(d.EnergyJoules),
                F(d.MomentumKgMetersPerSecond.X), F(d.MomentumKgMetersPerSecond.Y),
                F(d.MomentumKgMetersPerSecond.Z),
                F(d.AngularMomentumKgSquareMetersPerSecond.X),
                F(d.AngularMomentumKgSquareMetersPerSecond.Y),
                F(d.AngularMomentumKgSquareMetersPerSecond.Z)));
        }
        if (initial is null || final is null)
            throw new InvalidOperationException("The simulation produced no samples.");

        double energyDrift = final.Diagnostics.EnergyJoules - initial.Diagnostics.EnergyJoules;
        double? relativeDrift = initial.Diagnostics.EnergyJoules == 0
            ? null : energyDrift / Math.Abs(initial.Diagnostics.EnergyJoules);
        var summary = new
        {
            bodies = final.Bodies.Count,
            steps = final.Step,
            samples = sampleCount,
            finalTimeSeconds = final.TimeSeconds,
            initialEnergyJoules = initial.Diagnostics.EnergyJoules,
            finalEnergyJoules = final.Diagnostics.EnergyJoules,
            energyDriftJoules = energyDrift,
            relativeEnergyDrift = relativeDrift
        };
        File.WriteAllText(Path.Combine(directory, "summary.json"),
            JsonSerializer.Serialize(summary, new JsonSerializerOptions { WriteIndented = true }));
    }

    private static string F(double value) => value.ToString("G17", Invariant);

    private static string Escape(string value) =>
        value.IndexOfAny([',', '"', '\r', '\n']) < 0
            ? value : '"' + value.Replace("\"", "\"\"") + '"';
}
