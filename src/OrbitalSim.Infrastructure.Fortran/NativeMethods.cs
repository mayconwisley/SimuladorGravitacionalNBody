using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;

namespace OrbitalSim.Infrastructure.Fortran;

// Blittable mirrors of the structs in native/include/orbitalsim.h (same field order).
[StructLayout(LayoutKind.Sequential)]
internal struct NativeOptions
{
    public int Integrator;
    public int CentralIndex;
    public int Collisions;
    public int Reserved;
    public double J2;
    public double CentralRadiusMeters;
    public double AtmosphereDensityKgPerCubicMeter;
    public double AtmosphereScaleHeightMeters;
    public double LightSpeedMetersPerSecond;
}

[StructLayout(LayoutKind.Sequential)]
internal struct NativeReport
{
    public double MinSeparationMeters;
    public double MinDynamicalTimeSeconds;
    public double SuggestedTimeStepSeconds;
    public double MassiveSuggestedTimeStepSeconds;
    public int EventCount;
    public int EventsDropped;
    public int Collisions;
    public int Reserved;
}

[StructLayout(LayoutKind.Sequential)]
internal struct NativeEvent
{
    public int Kind;
    public int Step;
    public int Body;
    public int Other;
    public double DistanceMeters;
}

[StructLayout(LayoutKind.Sequential)]
internal struct NativeElements
{
    public double SemiMajorAxisMeters;
    public double Eccentricity;
    public double InclinationRadians;
    public double AscendingNodeRadians;
    public double ArgumentOfPeriapsisRadians;
    public double TrueAnomalyRadians;
    public double PeriodSeconds;
    public double PeriapsisMeters;
    public double ApoapsisMeters;
    public double SpecificEnergyJoulesPerKg;
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

    [LibraryImport("orbitalsim", EntryPoint = "os_advance")]
    [UnmanagedCallConv(CallConvs = [typeof(CallConvCdecl)])]
    internal static partial int Advance(int n, double* mass, double* radius, double* drag,
        int* active, double* pos, double* vel, double* acc, int accReady, double dt,
        double grav, double eps, int steps, NativeOptions* options, NativeReport* report,
        NativeEvent* events, int eventCapacity);

    [LibraryImport("orbitalsim", EntryPoint = "os_energy")]
    [UnmanagedCallConv(CallConvs = [typeof(CallConvCdecl)])]
    internal static partial int Energy(int n, double* mass, int* active, double* pos,
        double* vel, double grav, double eps, NativeOptions* options, double* kinetic,
        double* potential, double* momentum, double* angularMomentum);

    [LibraryImport("orbitalsim", EntryPoint = "os_orbital_elements")]
    [UnmanagedCallConv(CallConvs = [typeof(CallConvCdecl)])]
    internal static partial int OrbitalElements(int n, double* mass, int* active, double* pos,
        double* vel, double grav, int reference, NativeElements* elements, int* valid);

    [LibraryImport("orbitalsim", EntryPoint = "os_elements_to_state")]
    [UnmanagedCallConv(CallConvs = [typeof(CallConvCdecl)])]
    internal static partial int ElementsToState(double grav, double centralMass, double bodyMass,
        NativeElements* elements, double* pos, double* vel);
}
