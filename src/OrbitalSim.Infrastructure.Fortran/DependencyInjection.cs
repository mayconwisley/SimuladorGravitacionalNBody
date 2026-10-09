using Microsoft.Extensions.DependencyInjection;
using OrbitalSim.Application.Interfaces;

namespace OrbitalSim.Infrastructure.Fortran;

public static class DependencyInjection
{
    public static IServiceCollection AddFortranInfrastructure(this IServiceCollection services) =>
        services.AddSingleton<IOrbitEngine, FortranOrbitEngine>();
}
