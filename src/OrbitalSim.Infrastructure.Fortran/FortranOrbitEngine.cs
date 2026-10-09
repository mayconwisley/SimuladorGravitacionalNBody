using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
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

internal static unsafe partial class NativeMethods
{
    [LibraryImport("orbitalsim", EntryPoint = "os_step")]
    [UnmanagedCallConv(CallConvs = [typeof(CallConvCdecl)])]
    internal static partial int Step(int n, double* mass, double* pos, double* vel,
        double dt, double grav, double eps, int steps);

    [LibraryImport("orbitalsim", EntryPoint = "os_diagnostics")]
    [UnmanagedCallConv(CallConvs = [typeof(CallConvCdecl)])]
    internal static partial int Diagnostics(int n, double* mass, double* pos,
        double* vel, double grav, double eps, double* energy, double* momentum,
        double* angularMomentum);
}
