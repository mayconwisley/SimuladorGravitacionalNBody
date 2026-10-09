namespace OrbitalSim.Application.DTOs;

/// <summary>
/// Close-approach summary of one or more advance calls. Null values mean that no pair of
/// bodies (with at least one massive) existed. The suggested step resolves the shortest
/// dynamical time with about 200 steps per orbit; the massive variant ignores test particles,
/// which cannot change the motion of the massive bodies.
/// </summary>
public readonly record struct EngineReport(
    double? MinSeparationMeters,
    double? MinDynamicalTimeSeconds,
    double? SuggestedTimeStepSeconds,
    double? MassiveSuggestedTimeStepSeconds,
    int Collisions,
    int EventsDropped)
{
    public static EngineReport Empty { get; } = new(null, null, null, null, 0, 0);

    public EngineReport Merge(EngineReport other) => new(
        Min(MinSeparationMeters, other.MinSeparationMeters),
        Min(MinDynamicalTimeSeconds, other.MinDynamicalTimeSeconds),
        Min(SuggestedTimeStepSeconds, other.SuggestedTimeStepSeconds),
        Min(MassiveSuggestedTimeStepSeconds, other.MassiveSuggestedTimeStepSeconds),
        Collisions + other.Collisions,
        EventsDropped + other.EventsDropped);

    private static double? Min(double? a, double? b) =>
        a is null ? b : b is null ? a : Math.Min(a.Value, b.Value);
}
