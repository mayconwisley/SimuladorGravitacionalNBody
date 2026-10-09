using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Channels;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Options;
using OrbitalSim.Api;
using OrbitalSim.Application;
using OrbitalSim.Application.DTOs;
using OrbitalSim.Application.UseCases;
using OrbitalSim.Infrastructure.Fortran;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 1_048_576);
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase)));
builder.Services.AddApplication().AddFortranInfrastructure();
var app = builder.Build();

app.MapGet("/api/health", () => Results.Ok(new { status = "ready" }));

app.MapPost("/api/simulations", async (ScenarioInput request, BuildScenarioUseCase scenarios,
    RunSimulationUseCase simulation, CancellationToken cancellation) =>
{
    try
    {
        BuiltScenario built = Prepare(request, scenarios);
        var samples = await Task.Run(() =>
        {
            var result = new List<SampleResponse>();
            foreach (SimulationSample sample in simulation.Execute(built))
            {
                cancellation.ThrowIfCancellationRequested();
                result.Add(SampleResponse.From(sample));
            }
            return result;
        }, cancellation);
        return Results.Ok(new SimulationResponse(samples, built.ParticleGroups, built.ParticleCount));
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

// NDJSON: a "start" line with metadata, one "sample" line per sample as soon as the motor
// produces it, then "end" (or "error" if the motor fails midway).
app.MapPost("/api/simulations/stream", (HttpContext context, ScenarioInput request,
    BuildScenarioUseCase scenarios, RunSimulationUseCase simulation, IOptions<JsonOptions> json) =>
{
    BuiltScenario built;
    try
    {
        built = Prepare(request, scenarios);
    }
    catch (ArgumentException exception)
    {
        return Results.BadRequest(new { error = exception.Message });
    }
    catch (InvalidOperationException exception)
    {
        return Results.UnprocessableEntity(new { error = exception.Message });
    }

    JsonSerializerOptions options = json.Value.SerializerOptions;
    CancellationToken cancellation = context.RequestAborted;
    return Results.Stream(async stream =>
    {
        var channel = Channel.CreateBounded<StreamMessage>(new BoundedChannelOptions(32)
        {
            SingleReader = true,
            SingleWriter = true
        });
        Task producer = Task.Run(async () =>
        {
            try
            {
                foreach (SimulationSample sample in simulation.Execute(built))
                    await channel.Writer.WriteAsync(new StreamMessage("sample", SampleResponse.From(sample)), cancellation);
                await channel.Writer.WriteAsync(new StreamMessage("end"), cancellation);
            }
            catch (OperationCanceledException)
            {
            }
            catch (Exception exception) when (exception is ArgumentException or InvalidOperationException)
            {
                await channel.Writer.WriteAsync(new StreamMessage("error", Error: exception.Message), cancellation);
            }
            finally
            {
                channel.Writer.TryComplete();
            }
        }, cancellation);

        await WriteLine(stream, new StreamMessage("start", ParticleGroups: built.ParticleGroups,
            ParticleCount: built.ParticleCount,
            ExpectedSamples: InteractiveScenarioLimits.SampleCount(built.Scenario.Config.Steps,
                built.Scenario.Config.SampleEverySteps)), options, cancellation);
        await foreach (StreamMessage message in channel.Reader.ReadAllAsync(cancellation))
            await WriteLine(stream, message, options, cancellation);
        await producer;
    }, "application/x-ndjson");
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

static BuiltScenario Prepare(ScenarioInput request, BuildScenarioUseCase scenarios)
{
    InteractiveScenarioLimits.Validate(request);
    BuiltScenario built = scenarios.Execute(request);
    InteractiveScenarioLimits.ValidateWork(built);
    return built;
}

static async Task WriteLine(Stream stream, StreamMessage message, JsonSerializerOptions options,
    CancellationToken cancellation)
{
    await JsonSerializer.SerializeAsync(stream, message, options, cancellation);
    await stream.WriteAsync("\n"u8.ToArray(), cancellation);
    await stream.FlushAsync(cancellation);
}
