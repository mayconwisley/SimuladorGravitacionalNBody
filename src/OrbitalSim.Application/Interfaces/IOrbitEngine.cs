using OrbitalSim.Application.DTOs;

namespace OrbitalSim.Application.Interfaces;

public interface IOrbitEngine
{
    void Step(int bodyCount, double[] masses, double[] positions, double[] velocities,
        double timeStepSeconds, double gravity, double softeningMeters, int steps);

    DiagnosticValues GetDiagnostics(int bodyCount, double[] masses,
        double[] positions, double[] velocities, double gravity, double softeningMeters);
}
