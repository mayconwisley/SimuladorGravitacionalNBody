using OrbitalSim.Domain;

namespace OrbitalSim.Application.DTOs;

/// <summary>
/// Mutable buffers exchanged with the native motor, in SI units and body-major xyz layout.
/// <see cref="AccelerationsReady"/> tells the motor that <see cref="Accelerations"/> already
/// matches the current state, so consecutive calls skip one force evaluation.
/// </summary>
public sealed class EngineState
{
    private EngineState(int count)
    {
        Count = count;
        Masses = new double[count];
        Radii = new double[count];
        DragAreaPerMass = new double[count];
        Active = new int[count];
        Positions = new double[checked(3 * count)];
        Velocities = new double[checked(3 * count)];
        Accelerations = new double[checked(3 * count)];
    }

    public int Count { get; }
    public double[] Masses { get; }
    public double[] Radii { get; }
    public double[] DragAreaPerMass { get; }
    public int[] Active { get; }
    public double[] Positions { get; }
    public double[] Velocities { get; }
    public double[] Accelerations { get; }
    public bool AccelerationsReady { get; set; }

    public static EngineState FromBodies(IReadOnlyList<BodyDefinition> bodies)
    {
        var state = new EngineState(bodies.Count);
        for (int i = 0; i < bodies.Count; i++)
        {
            BodyDefinition body = bodies[i];
            state.Masses[i] = body.MassKg;
            state.Radii[i] = body.RadiusMeters;
            state.DragAreaPerMass[i] = body.DragAreaPerMassSquareMetersPerKg;
            state.Active[i] = 1;
            state.SetPosition(i, body.PositionMeters);
            state.SetVelocity(i, body.VelocityMetersPerSecond);
        }
        return state;
    }

    public bool IsActive(int index) => Active[index] != 0;

    public Vector3d Position(int index) =>
        new(Positions[3 * index], Positions[3 * index + 1], Positions[3 * index + 2]);

    public Vector3d Velocity(int index) =>
        new(Velocities[3 * index], Velocities[3 * index + 1], Velocities[3 * index + 2]);

    public void SetPosition(int index, Vector3d value)
    {
        Positions[3 * index] = value.X;
        Positions[3 * index + 1] = value.Y;
        Positions[3 * index + 2] = value.Z;
    }

    public void SetVelocity(int index, Vector3d value)
    {
        Velocities[3 * index] = value.X;
        Velocities[3 * index + 1] = value.Y;
        Velocities[3 * index + 2] = value.Z;
    }
}
