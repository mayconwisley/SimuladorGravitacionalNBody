using OrbitalSim.Domain;

namespace OrbitalSim.Application.DTOs;

/// <summary>Native motor settings; <see cref="CentralIndex"/> is -1 when no central body is used.</summary>
public readonly record struct EngineOptions(
    Integrator Integrator,
    int CentralIndex,
    bool Collisions,
    double J2,
    double CentralRadiusMeters,
    double AtmosphereDensityKgPerCubicMeter,
    double AtmosphereScaleHeightMeters,
    double LightSpeedMetersPerSecond)
{
    public static EngineOptions Default { get; } = new(Integrator.Verlet, -1, false, 0, 0, 0, 0, 0);

    public static EngineOptions From(SimulationScenario scenario)
    {
        PhysicsOptions physics = scenario.EffectivePhysics;
        int central = -1;
        if (physics.CentralBody is not null)
        {
            for (int i = 0; i < scenario.Bodies.Count; i++)
            {
                if (string.Equals(scenario.Bodies[i].Name, physics.CentralBody,
                        StringComparison.OrdinalIgnoreCase))
                {
                    central = i;
                    break;
                }
            }
        }
        return new EngineOptions(scenario.Config.Integrator, central, physics.Collisions,
            physics.J2, physics.CentralRadiusMeters, physics.AtmosphereDensityKgPerCubicMeter,
            physics.AtmosphereScaleHeightMeters, physics.LightSpeedMetersPerSecond);
    }
}
