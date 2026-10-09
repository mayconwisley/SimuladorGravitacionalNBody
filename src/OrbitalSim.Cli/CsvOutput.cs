using System.Globalization;
using System.Text;
using System.Text.Json;
using OrbitalSim.Application.DTOs;

namespace OrbitalSim.Cli;

internal static class CsvOutput
{
    private static readonly CultureInfo Invariant = CultureInfo.InvariantCulture;

    /// <summary>
    /// Writes trajectory.csv (named bodies), diagnostics.csv, events.csv, particles.csv (only
    /// with particle groups) and summary.json. New columns are appended after the original ones.
    /// </summary>
    public static void Write(string directory, BuiltScenario built, IEnumerable<SimulationSample> samples)
    {
        Directory.CreateDirectory(directory);
        var encoding = new UTF8Encoding(false);
        using var trajectory = new StreamWriter(Path.Combine(directory, "trajectory.csv"), false, encoding);
        using var diagnostics = new StreamWriter(Path.Combine(directory, "diagnostics.csv"), false, encoding);
        using var events = new StreamWriter(Path.Combine(directory, "events.csv"), false, encoding);
        using StreamWriter? particles = built.ParticleCount > 0
            ? new StreamWriter(Path.Combine(directory, "particles.csv"), false, encoding) : null;
        trajectory.WriteLine("step,time_s,body,mass_kg,x_m,y_m,z_m,vx_m_s,vy_m_s,vz_m_s,radius_m,active");
        diagnostics.WriteLine("step,time_s,energy_j,px_kg_m_s,py_kg_m_s,pz_kg_m_s,lx_kg_m2_s,ly_kg_m2_s,lz_kg_m2_s,kinetic_j,potential_j");
        events.WriteLine("step,time_s,kind,body,other,distance_m");
        particles?.WriteLine("step,time_s,group,particle,x_m,y_m,z_m");

        SimulationSample? initial = null;
        SimulationSample? final = null;
        int sampleCount = 0, eventCount = 0;
        EngineReport report = EngineReport.Empty;
        foreach (SimulationSample sample in samples)
        {
            initial ??= sample;
            final = sample;
            sampleCount++;
            report = report.Merge(sample.Report);
            foreach (BodyState body in sample.Bodies)
            {
                trajectory.WriteLine(string.Join(',',
                    sample.Step, F(sample.TimeSeconds), Escape(body.Name), F(body.MassKg),
                    F(body.PositionMeters.X), F(body.PositionMeters.Y), F(body.PositionMeters.Z),
                    F(body.VelocityMetersPerSecond.X), F(body.VelocityMetersPerSecond.Y),
                    F(body.VelocityMetersPerSecond.Z), F(body.RadiusMeters), body.Active ? 1 : 0));
            }
            DiagnosticValues d = sample.Diagnostics;
            diagnostics.WriteLine(string.Join(',',
                sample.Step, F(sample.TimeSeconds), F(d.EnergyJoules),
                F(d.MomentumKgMetersPerSecond.X), F(d.MomentumKgMetersPerSecond.Y),
                F(d.MomentumKgMetersPerSecond.Z),
                F(d.AngularMomentumKgSquareMetersPerSecond.X),
                F(d.AngularMomentumKgSquareMetersPerSecond.Y),
                F(d.AngularMomentumKgSquareMetersPerSecond.Z),
                F(d.KineticEnergyJoules), F(d.PotentialEnergyJoules)));
            foreach (SimulationEvent item in sample.Events ?? [])
            {
                eventCount++;
                events.WriteLine(string.Join(',', item.Step, F(item.TimeSeconds),
                    item.Kind.ToString().ToLowerInvariant(), Escape(item.Body), Escape(item.Other ?? ""),
                    item.DistanceMeters is { } distance ? F(distance) : ""));
            }
            if (particles is not null && sample.ParticlePositionsMeters is { } positions)
            {
                foreach (ParticleGroupInfo group in built.ParticleGroups)
                {
                    for (int k = 0; k < group.Count; k++)
                    {
                        int index = 3 * (group.Start + k);
                        if (float.IsNaN(positions[index])) continue;
                        particles.WriteLine(string.Join(',', sample.Step, F(sample.TimeSeconds),
                            Escape(group.Name), k + 1, F(positions[index]), F(positions[index + 1]),
                            F(positions[index + 2])));
                    }
                }
            }
        }
        if (initial is null || final is null)
            throw new InvalidOperationException("The simulation produced no samples.");

        double energyDrift = final.Diagnostics.EnergyJoules - initial.Diagnostics.EnergyJoules;
        double? relativeDrift = initial.Diagnostics.EnergyJoules == 0
            ? null : energyDrift / Math.Abs(initial.Diagnostics.EnergyJoules);
        var summary = new
        {
            bodies = final.Bodies.Count,
            particles = built.ParticleCount,
            integrator = built.Scenario.Config.Integrator.ToString(),
            steps = final.Step,
            samples = sampleCount,
            finalTimeSeconds = final.TimeSeconds,
            initialEnergyJoules = initial.Diagnostics.EnergyJoules,
            finalEnergyJoules = final.Diagnostics.EnergyJoules,
            energyDriftJoules = energyDrift,
            relativeEnergyDrift = relativeDrift,
            events = eventCount,
            eventsDropped = report.EventsDropped,
            collisions = report.Collisions,
            minSeparationMeters = report.MinSeparationMeters,
            suggestedTimeStepSeconds = report.SuggestedTimeStepSeconds,
            massiveSuggestedTimeStepSeconds = report.MassiveSuggestedTimeStepSeconds
        };
        File.WriteAllText(Path.Combine(directory, "summary.json"),
            JsonSerializer.Serialize(summary, new JsonSerializerOptions { WriteIndented = true }));
    }

    private static string F(double value) => value.ToString("G17", Invariant);

    private static string F(float value) => value.ToString("G9", Invariant);

    private static string Escape(string value) =>
        value.IndexOfAny([',', '"', '\r', '\n']) < 0
            ? value : '"' + value.Replace("\"", "\"\"") + '"';
}
