using Microsoft.Extensions.FileProviders;
using OrbitalSim.Api;
using OrbitalSim.Application;
using OrbitalSim.Application.DTOs;
using OrbitalSim.Application.UseCases;
using OrbitalSim.Infrastructure.Fortran;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 1_048_576);
builder.Services.AddApplication().AddFortranInfrastructure();
var app = builder.Build();

app.MapGet("/api/health", () => Results.Ok(new { status = "ready" }));
app.MapPost("/api/simulations", async (ScenarioInput request, RunSimulationUseCase simulation, CancellationToken cancellation) =>
{
    try
    {
        InteractiveScenarioLimits.Validate(request);
        var scenario = request.ToScenario();
        var samples = await Task.Run(() =>
        {
            var result = new List<SimulationSample>();
            foreach (var sample in simulation.Execute(scenario))
            {
                cancellation.ThrowIfCancellationRequested();
                result.Add(sample);
            }
            return result;
        }, cancellation);
        return Results.Ok(new SimulationResponse(samples));
    }
    catch (ArgumentException exception)
    {
        return Results.BadRequest(new { error = exception.Message });
    }
    catch (InvalidOperationException exception)
    {
        return Results.UnprocessableEntity(new { error = exception.Message });
    }
});

var webRoot = new[]
{
    Path.Combine(builder.Environment.ContentRootPath, "..", "..", "web", "dist"),
    Path.Combine(Directory.GetCurrentDirectory(), "web", "dist"),
    Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "web", "dist")
}.Select(Path.GetFullPath).FirstOrDefault(Directory.Exists);
if (webRoot is not null)
{
    var files = new PhysicalFileProvider(webRoot);
    app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = files });
    app.UseStaticFiles(new StaticFileOptions { FileProvider = files });
    app.MapFallback(() => Results.File(Path.Combine(webRoot, "index.html"), "text/html"));
}

app.Run();
