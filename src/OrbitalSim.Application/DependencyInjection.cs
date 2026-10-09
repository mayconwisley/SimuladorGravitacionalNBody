using Microsoft.Extensions.DependencyInjection;
using OrbitalSim.Application.UseCases;

namespace OrbitalSim.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services) =>
        services.AddTransient<RunSimulationUseCase>();
}
