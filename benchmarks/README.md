# Benchmarks

Run the release CLI after building the native library:

```powershell
dotnet run --project src/OrbitalSim.Cli -c Release --no-build -- benchmark --bodies 2,100,1000 --steps 100 --repeats 5 --batch 10 --out benchmarks/results.csv
```

The benchmark warms up the native call, then starts each repetition from the
same deterministic ring of bodies. It reports wall-clock time, steps per second,
pair evaluations per second (two acceleration evaluations per Verlet step),
managed allocations on the executing thread, and final relative energy drift.
The reported energy drift is a correctness indicator, not a performance metric.
Run on an idle machine and record CPU, OS, compiler, .NET version, build mode,
body count, step count, repeat count and batch size when publishing results.

The benchmark measures the full .NET-to-Fortran execution path. It does not
measure CSV writing. For realistic cases, use enough steps for each repetition
to last at least a few hundred milliseconds and compare medians. The `--batch`
option controls how many integration steps are sent through each native call.
