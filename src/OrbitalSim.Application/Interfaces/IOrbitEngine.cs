using OrbitalSim.Application.DTOs;

namespace OrbitalSim.Application.Interfaces;

/// <summary>Port to the numerical motor. All quantities are SI; failures throw.</summary>
public interface IOrbitEngine
{
    /// <summary>Legacy Velocity Verlet step with positive masses and time step.</summary>
    void Step(int bodyCount, double[] masses, double[] positions, double[] velocities,
        double timeStepSeconds, double gravity, double softeningMeters, int steps);

    /// <summary>Legacy total energy, momentum and angular momentum of all bodies.</summary>
    DiagnosticValues GetDiagnostics(int bodyCount, double[] masses,
        double[] positions, double[] velocities, double gravity, double softeningMeters);

    /// <summary>
    /// Advances <paramref name="state"/> in place. The time step may be negative. Events beyond
    /// <paramref name="eventCapacity"/> are counted in the report as dropped.
    /// </summary>
    AdvanceResult Advance(EngineState state, double timeStepSeconds, double gravity,
        double softeningMeters, int steps, EngineOptions options, int eventCapacity);

    /// <summary>Kinetic, potential (with J2) and total energy plus momenta of active bodies.</summary>
    DiagnosticValues GetEnergy(EngineState state, double gravity, double softeningMeters,
        EngineOptions options);

    /// <summary>
    /// Elements of every active body relative to <paramref name="referenceIndex"/> (-1 selects
    /// the most massive active body); null where undefined.
    /// </summary>
    OrbitalElements?[] GetOrbitalElements(EngineState state, double gravity, int referenceIndex);

    /// <summary>State relative to the central body for the given elements.</summary>
    StateVector ElementsToState(double gravity, double centralMassKg, double bodyMassKg,
        OrbitalElements elements);
}
