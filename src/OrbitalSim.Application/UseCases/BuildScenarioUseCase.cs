using OrbitalSim.Application.DTOs;
using OrbitalSim.Application.Interfaces;
using OrbitalSim.Domain;

namespace OrbitalSim.Application.UseCases;

/// <summary>
/// Maps the shared JSON input to a validated domain scenario: resolves bodies given by orbital
/// elements (through the motor's element conversion), generates particle disks and maps the
/// optional physics and maneuvers.
/// </summary>
public sealed class BuildScenarioUseCase(IOrbitEngine engine)
{
    private static readonly double GoldenAngle = Math.PI * (3 - Math.Sqrt(5));

    public BuiltScenario Execute(ScenarioInput input)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (input.Bodies is null)
            throw new ArgumentException("O cenário deve conter a lista de corpos.");
        if (!double.IsFinite(input.Gravity) || input.Gravity <= 0)
            throw new ArgumentException("A constante gravitacional deve ser finita e positiva.");

        var bodies = new List<BodyDefinition>(input.Bodies.Count);
        var byName = new Dictionary<string, BodyDefinition>(StringComparer.OrdinalIgnoreCase);
        foreach (BodyInput? body in input.Bodies)
        {
            if (body is null)
                throw new ArgumentException("Cada corpo precisa de nome, massa e estado inicial.");
            string name = body.Name?.Trim() ?? string.Empty;
            BodyDefinition definition = body.Orbit is null
                ? FromVectors(body, name)
                : FromOrbit(body, name, body.Orbit, byName, input.Gravity);
            if (name.Length == 0 || !byName.TryAdd(name, definition))
                throw new ArgumentException("Cada corpo precisa de um nome único.");
            bodies.Add(definition);
        }

        int namedBodyCount = bodies.Count;
        var groups = new List<ParticleGroupInfo>();
        foreach (ParticleGroupInput? group in input.ParticleGroups ?? [])
            groups.Add(AddParticles(group, bodies, byName, input.Gravity, namedBodyCount));

        var scenario = new SimulationScenario(
            new SimulationConfig(input.Gravity, input.SofteningMeters, input.TimeStepSeconds,
                input.Steps, input.SampleEverySteps, ParseIntegrator(input.Integrator)),
            bodies, MapPhysics(input.Physics), MapManeuvers(input.Maneuvers));
        scenario.Validate();
        return new BuiltScenario(scenario, namedBodyCount, groups);
    }

    public static Integrator ParseIntegrator(string? value) => value?.Trim().ToLowerInvariant() switch
    {
        null or "" or "verlet" => Integrator.Verlet,
        "yoshida4" or "yoshida" => Integrator.Yoshida4,
        "rk4" or "rungekutta4" => Integrator.RungeKutta4,
        _ => throw new ArgumentException("Integrador desconhecido. Use verlet, yoshida4 ou rk4.")
    };

    private static BodyDefinition FromVectors(BodyInput body, string name)
    {
        if (body.PositionMeters is not { Length: 3 } || body.VelocityMetersPerSecond is not { Length: 3 })
            throw new ArgumentException(
                $"Informe posição XYZ e velocidade XYZ, ou uma órbita, para {(name.Length > 0 ? name : "cada corpo")}.");
        return new BodyDefinition(name, body.MassKg, ToVector(body.PositionMeters),
            ToVector(body.VelocityMetersPerSecond), body.RadiusMeters, body.DragAreaPerMassSquareMetersPerKg);
    }

    private BodyDefinition FromOrbit(BodyInput body, string name, OrbitInput orbit,
        Dictionary<string, BodyDefinition> byName, double gravity)
    {
        if (body.PositionMeters is not null || body.VelocityMetersPerSecond is not null)
            throw new ArgumentException($"Defina {name} por vetores ou por órbita, não pelos dois.");
        BodyDefinition around = Around(orbit.Around, byName, name);
        StateVector relative = Convert(gravity, around.MassKg, body.MassKg, new OrbitalElements(
            orbit.SemiMajorAxisMeters, orbit.Eccentricity, Radians(orbit.InclinationDegrees),
            Radians(orbit.AscendingNodeDegrees), Radians(orbit.ArgumentOfPeriapsisDegrees),
            Radians(orbit.TrueAnomalyDegrees)), name);
        return new BodyDefinition(name, body.MassKg,
            Add(around.PositionMeters, relative.PositionMeters),
            Add(around.VelocityMetersPerSecond, relative.VelocityMetersPerSecond),
            body.RadiusMeters, body.DragAreaPerMassSquareMetersPerKg);
    }

    private ParticleGroupInfo AddParticles(ParticleGroupInput? group, List<BodyDefinition> bodies,
        Dictionary<string, BodyDefinition> byName, double gravity, int namedBodyCount)
    {
        string name = group?.Name?.Trim() ?? string.Empty;
        if (group is null || name.Length == 0)
            throw new ArgumentException("Cada grupo de partículas precisa de um nome.");
        BodyDefinition around = Around(group.Around, byName, name);
        if (group.Count < 1)
            throw new ArgumentException($"O grupo {name} precisa de pelo menos uma partícula.");
        if (!double.IsFinite(group.InnerRadiusMeters) || !double.IsFinite(group.OuterRadiusMeters) ||
            group.InnerRadiusMeters <= 0 || group.OuterRadiusMeters < group.InnerRadiusMeters)
            throw new ArgumentException($"Use 0 < raio interno ≤ raio externo no grupo {name}.");
        if (!double.IsFinite(group.Eccentricity) || group.Eccentricity < 0 || group.Eccentricity >= 1)
            throw new ArgumentException($"A excentricidade do grupo {name} deve estar entre 0 e 1.");

        int start = bodies.Count - namedBodyCount;
        double inner2 = group.InnerRadiusMeters * group.InnerRadiusMeters;
        double outer2 = group.OuterRadiusMeters * group.OuterRadiusMeters;
        for (int k = 0; k < group.Count; k++)
        {
            double radius = Math.Sqrt(inner2 + (outer2 - inner2) * (k + 0.5) / group.Count);
            StateVector relative = Convert(gravity, around.MassKg, 0, new OrbitalElements(
                radius, group.Eccentricity, Radians(group.InclinationDegrees),
                Radians(group.AscendingNodeDegrees), 0,
                Math.IEEERemainder(k * GoldenAngle, 2 * Math.PI)), name);
            bodies.Add(new BodyDefinition($"{name} {k + 1}", 0,
                Add(around.PositionMeters, relative.PositionMeters),
                Add(around.VelocityMetersPerSecond, relative.VelocityMetersPerSecond)));
        }
        return new ParticleGroupInfo(name, around.Name, start, group.Count);
    }

    private static BodyDefinition Around(string? around, Dictionary<string, BodyDefinition> byName,
        string owner)
    {
        if (string.IsNullOrWhiteSpace(around) || !byName.TryGetValue(around.Trim(), out BodyDefinition? body))
            throw new ArgumentException($"A órbita de {owner} deve referenciar um corpo listado antes dele.");
        if (body.MassKg <= 0)
            throw new ArgumentException($"O corpo central de {owner} precisa ter massa positiva.");
        return body;
    }

    private StateVector Convert(double gravity, double centralMass, double bodyMass,
        OrbitalElements elements, string owner)
    {
        try
        {
            return engine.ElementsToState(gravity, centralMass, bodyMass, elements);
        }
        catch (InvalidOperationException)
        {
            throw new ArgumentException($"Elementos orbitais inválidos para {owner}. " +
                "Elipses usam a > 0 e 0 ≤ e < 1; hipérboles usam a < 0 e e > 1.");
        }
    }

    private static PhysicsOptions? MapPhysics(PhysicsInput? physics) => physics is null ? null :
        new PhysicsOptions(string.IsNullOrWhiteSpace(physics.CentralBody) ? null : physics.CentralBody.Trim(),
            physics.J2, physics.CentralRadiusMeters, physics.AtmosphereDensityKgPerCubicMeter,
            physics.AtmosphereScaleHeightMeters, physics.LightSpeedMetersPerSecond, physics.Collisions);

    private static List<Maneuver>? MapManeuvers(List<ManeuverInput?>? maneuvers) => maneuvers?.Select(item =>
    {
        if (item is null || string.IsNullOrWhiteSpace(item.Body) ||
            item.DeltaVelocityMetersPerSecond is not { Length: 3 } ||
            item.DeltaPositionMeters is not (null or { Length: 3 }))
            throw new ArgumentException("Cada manobra precisa do corpo, do passo e de Δv XYZ.");
        return new Maneuver(item.Body.Trim(), item.Step, ToVector(item.DeltaVelocityMetersPerSecond),
            item.DeltaPositionMeters is null ? default : ToVector(item.DeltaPositionMeters));
    }).ToList();

    private static double Radians(double degrees) => degrees * Math.PI / 180;

    private static Vector3d ToVector(double[] values) => new(values[0], values[1], values[2]);

    private static Vector3d Add(Vector3d a, Vector3d b) => new(a.X + b.X, a.Y + b.Y, a.Z + b.Z);
}
