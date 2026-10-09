namespace OrbitalSim.Application.DTOs;

/// <summary>Events reported during a simulation; the numeric values match the native ABI.</summary>
public enum SimulationEventKind
{
    Collision = 1,
    Periapsis = 2,
    Apoapsis = 3,
    Escape = 4,
    Maneuver = 5
}
