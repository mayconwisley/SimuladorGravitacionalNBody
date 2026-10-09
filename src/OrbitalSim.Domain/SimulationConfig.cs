namespace OrbitalSim.Domain;

public sealed record SimulationConfig(
    double Gravity,
    double SofteningMeters,
    double TimeStepSeconds,
    int Steps,
    int SampleEverySteps);
