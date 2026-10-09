namespace OrbitalSim.Domain;

/// <summary>
/// Integration settings. <see cref="TimeStepSeconds"/> may be negative to integrate backwards.
/// </summary>
public sealed record SimulationConfig(
    double Gravity,
    double SofteningMeters,
    double TimeStepSeconds,
    int Steps,
    int SampleEverySteps,
    Integrator Integrator = Integrator.Verlet);
