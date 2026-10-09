using OrbitalSim.Application.DTOs;
using OrbitalSim.Application.Interfaces;
using OrbitalSim.Domain;

namespace OrbitalSim.Infrastructure.Fortran;

public sealed class FortranOrbitEngine : IOrbitEngine
{
    public unsafe void Step(int bodyCount, double[] masses, double[] positions,
        double[] velocities, double timeStepSeconds, double gravity,
        double softeningMeters, int steps)
    {
        ValidateBuffers(bodyCount, masses, positions, velocities);
        if (steps < 1 || !double.IsFinite(timeStepSeconds) || timeStepSeconds <= 0 ||
            !double.IsFinite(gravity) || gravity <= 0 ||
            !double.IsFinite(softeningMeters) || softeningMeters < 0)
            throw new ArgumentException("Invalid integration parameters.");

        fixed (double* mass = masses, pos = positions, vel = velocities)
        {
            int status = NativeMethods.Step(bodyCount, mass, pos, vel,
                timeStepSeconds, gravity, softeningMeters, steps);
            ThrowOnError(status);
        }
    }

    public unsafe DiagnosticValues GetDiagnostics(int bodyCount, double[] masses,
        double[] positions, double[] velocities, double gravity, double softeningMeters)
    {
        ValidateBuffers(bodyCount, masses, positions, velocities);
        if (!double.IsFinite(gravity) || gravity <= 0 ||
            !double.IsFinite(softeningMeters) || softeningMeters < 0)
            throw new ArgumentException("Invalid diagnostic parameters.");

        double energy = 0;
        var momentum = new double[3];
        var angular = new double[3];
        fixed (double* mass = masses, pos = positions, vel = velocities,
               p = momentum, l = angular)
        {
            int status = NativeMethods.Diagnostics(bodyCount, mass, pos, vel,
                gravity, softeningMeters, &energy, p, l);
            ThrowOnError(status);
        }
        return new DiagnosticValues(energy,
            new Vector3d(momentum[0], momentum[1], momentum[2]),
            new Vector3d(angular[0], angular[1], angular[2]));
    }

    public unsafe AdvanceResult Advance(EngineState state, double timeStepSeconds, double gravity,
        double softeningMeters, int steps, EngineOptions options, int eventCapacity)
    {
        ArgumentNullException.ThrowIfNull(state);
        if (steps < 1 || eventCapacity < 0)
            throw new ArgumentException("Steps must be positive and the event capacity nonnegative.");
        NativeOptions native = ToNative(options);
        NativeReport report = default;
        var events = new NativeEvent[eventCapacity];
        fixed (double* mass = state.Masses, radius = state.Radii, drag = state.DragAreaPerMass,
               pos = state.Positions, vel = state.Velocities, acc = state.Accelerations)
        fixed (int* active = state.Active)
        fixed (NativeEvent* buffer = events)
        {
            int status = NativeMethods.Advance(state.Count, mass, radius, drag, active, pos, vel, acc,
                state.AccelerationsReady ? 1 : 0, timeStepSeconds, gravity, softeningMeters, steps,
                &native, &report, eventCapacity > 0 ? buffer : null, eventCapacity);
            ThrowOnError(status);
        }
        state.AccelerationsReady = true;
        var found = new EngineEvent[report.EventCount];
        for (int i = 0; i < found.Length; i++)
        {
            NativeEvent item = events[i];
            found[i] = new EngineEvent((SimulationEventKind)item.Kind, item.Step, item.Body,
                item.Other, item.DistanceMeters);
        }
        return new AdvanceResult(new EngineReport(
            OrNull(report.MinSeparationMeters), OrNull(report.MinDynamicalTimeSeconds),
            OrNull(report.SuggestedTimeStepSeconds), OrNull(report.MassiveSuggestedTimeStepSeconds),
            report.Collisions, report.EventsDropped), found);
    }

    public unsafe DiagnosticValues GetEnergy(EngineState state, double gravity, double softeningMeters,
        EngineOptions options)
    {
        ArgumentNullException.ThrowIfNull(state);
        NativeOptions native = ToNative(options);
        double kinetic = 0, potential = 0;
        var momentum = new double[3];
        var angular = new double[3];
        fixed (double* mass = state.Masses, pos = state.Positions, vel = state.Velocities,
               p = momentum, l = angular)
        fixed (int* active = state.Active)
        {
            int status = NativeMethods.Energy(state.Count, mass, active, pos, vel, gravity,
                softeningMeters, &native, &kinetic, &potential, p, l);
            ThrowOnError(status);
        }
        return new DiagnosticValues(kinetic + potential,
            new Vector3d(momentum[0], momentum[1], momentum[2]),
            new Vector3d(angular[0], angular[1], angular[2]), kinetic, potential);
    }

    public unsafe OrbitalElements?[] GetOrbitalElements(EngineState state, double gravity, int referenceIndex)
    {
        ArgumentNullException.ThrowIfNull(state);
        var native = new NativeElements[state.Count];
        var valid = new int[state.Count];
        fixed (double* mass = state.Masses, pos = state.Positions, vel = state.Velocities)
        fixed (int* active = state.Active, isValid = valid)
        fixed (NativeElements* elements = native)
        {
            int status = NativeMethods.OrbitalElements(state.Count, mass, active, pos, vel, gravity,
                referenceIndex, elements, isValid);
            ThrowOnError(status);
        }
        var result = new OrbitalElements?[state.Count];
        for (int i = 0; i < result.Length; i++)
            if (valid[i] != 0) result[i] = FromNative(native[i]);
        return result;
    }

    public unsafe StateVector ElementsToState(double gravity, double centralMassKg, double bodyMassKg,
        OrbitalElements elements)
    {
        NativeElements native = ToNative(elements);
        var position = new double[3];
        var velocity = new double[3];
        fixed (double* pos = position, vel = velocity)
        {
            int status = NativeMethods.ElementsToState(gravity, centralMassKg, bodyMassKg, &native, pos, vel);
            ThrowOnError(status);
        }
        return new StateVector(new Vector3d(position[0], position[1], position[2]),
            new Vector3d(velocity[0], velocity[1], velocity[2]));
    }

    private static NativeOptions ToNative(EngineOptions options) => new()
    {
        Integrator = (int)options.Integrator,
        CentralIndex = options.CentralIndex,
        Collisions = options.Collisions ? 1 : 0,
        J2 = options.J2,
        CentralRadiusMeters = options.CentralRadiusMeters,
        AtmosphereDensityKgPerCubicMeter = options.AtmosphereDensityKgPerCubicMeter,
        AtmosphereScaleHeightMeters = options.AtmosphereScaleHeightMeters,
        LightSpeedMetersPerSecond = options.LightSpeedMetersPerSecond
    };

    private static NativeElements ToNative(OrbitalElements elements) => new()
    {
        SemiMajorAxisMeters = elements.SemiMajorAxisMeters,
        Eccentricity = elements.Eccentricity,
        InclinationRadians = elements.InclinationRadians,
        AscendingNodeRadians = elements.AscendingNodeRadians,
        ArgumentOfPeriapsisRadians = elements.ArgumentOfPeriapsisRadians,
        TrueAnomalyRadians = elements.TrueAnomalyRadians
    };

    private static OrbitalElements FromNative(NativeElements elements) => new(
        elements.SemiMajorAxisMeters, elements.Eccentricity, elements.InclinationRadians,
        elements.AscendingNodeRadians, elements.ArgumentOfPeriapsisRadians,
        elements.TrueAnomalyRadians, elements.PeriodSeconds, elements.PeriapsisMeters,
        elements.ApoapsisMeters, elements.SpecificEnergyJoulesPerKg);

    private static double? OrNull(double value) => value < 0 ? null : value;

    private static void ValidateBuffers(int count, double[] masses,
        double[] positions, double[] velocities)
    {
        ArgumentNullException.ThrowIfNull(masses);
        ArgumentNullException.ThrowIfNull(positions);
        ArgumentNullException.ThrowIfNull(velocities);
        if (count < 1 || masses.Length != count ||
            positions.Length != checked(3 * count) || velocities.Length != 3 * count)
            throw new ArgumentException("Buffers must contain N masses and 3N position/velocity values.");
    }

    private static void ThrowOnError(int status)
    {
        if (status == 0) return;
        throw new InvalidOperationException(status switch
        {
            1 => "Fortran motor: invalid input.",
            2 => "Fortran motor: coincident bodies with zero softening.",
            3 => "Fortran motor: non-finite numerical result.",
            4 => "Fortran motor: memory allocation failed.",
            _ => $"Fortran motor: unknown status {status}."
        });
    }
}
