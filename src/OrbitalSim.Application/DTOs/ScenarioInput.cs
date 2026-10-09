namespace OrbitalSim.Application.DTOs;

/// <summary>
/// JSON scenario shared by the CLI and the API (SI units). Optional sections default to the
/// classic setup: Velocity Verlet, no extra physics, no maneuvers and no particle groups.
/// </summary>
public sealed class ScenarioInput
{
    public double Gravity { get; set; }
    public double SofteningMeters { get; set; }
    public double TimeStepSeconds { get; set; }
    public int Steps { get; set; }
    public int SampleEverySteps { get; set; }

    /// <summary>"verlet" (default), "yoshida4" or "rk4".</summary>
    public string? Integrator { get; set; }

    public List<BodyInput?>? Bodies { get; set; }
    public PhysicsInput? Physics { get; set; }
    public List<ManeuverInput?>? Maneuvers { get; set; }
    public List<ParticleGroupInput?>? ParticleGroups { get; set; }
}
