namespace OrbitalSim.Domain;

/// <summary>Numerical integrator used by the native motor.</summary>
public enum Integrator
{
    /// <summary>Velocity Verlet: 2nd order, symplectic, one force evaluation per step.</summary>
    Verlet = 0,

    /// <summary>Yoshida composition of Verlet: 4th order, symplectic, three evaluations per step.</summary>
    Yoshida4 = 1,

    /// <summary>Classic Runge-Kutta: 4th order, not symplectic, four evaluations per step.</summary>
    RungeKutta4 = 2
}
