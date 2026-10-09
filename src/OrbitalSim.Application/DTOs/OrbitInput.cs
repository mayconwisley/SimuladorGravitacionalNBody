namespace OrbitalSim.Application.DTOs;

/// <summary>
/// Keplerian elements relative to <see cref="Around"/> (meters and degrees). Ellipses need a
/// positive semi-major axis and 0 &lt;= e &lt; 1; hyperbolas a negative one and e &gt; 1.
/// </summary>
public sealed class OrbitInput
{
    public string? Around { get; set; }
    public double SemiMajorAxisMeters { get; set; }
    public double Eccentricity { get; set; }
    public double InclinationDegrees { get; set; }
    public double AscendingNodeDegrees { get; set; }
    public double ArgumentOfPeriapsisDegrees { get; set; }
    public double TrueAnomalyDegrees { get; set; }
}
