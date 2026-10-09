namespace OrbitalSim.Domain;

public readonly record struct Vector3d(double X, double Y, double Z)
{
    public bool IsFinite => double.IsFinite(X) && double.IsFinite(Y) && double.IsFinite(Z);
}
