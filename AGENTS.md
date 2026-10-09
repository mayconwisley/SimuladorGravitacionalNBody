# Repository Guidelines

## Architecture and layout

OrbitalSim is an N-body simulator. Keep numerical physics in `native/src/` and
its stable C ABI in `native/src/orbital_c_api.f90` and
`native/include/orbitalsim.h`. Native tests live in `tests/native/`. The .NET
10 projects live in `src/` (Domain, Application, Infrastructure.Fortran, CLI,
API). The React/Vite interface lives in `web/`. Keep HTTP limits in the API,
JSON file I/O in the CLI, shared input mapping and use cases in Application,
scenario validation in Domain, and numerical work in Fortran. Put interfaces in
`Application/Interfaces`, DTOs in `Application/DTOs`, and use cases in
`Application/UseCases`. Use `AddApplication` and `AddFortranInfrastructure` at
composition roots; centralize NuGet versions in `Directory.Packages.props`.
Do not
introduce UI or file I/O into the Fortran motor. Update `README.md` when the
layout or workflow changes.
Ready-to-run educational scenarios live in `web/src/presets.mjs`; keep them in
SI units and within the API's body, step, and sample limits.

## Build and test

From the repository root, with CMake 3.20+, Ninja, and a Fortran 2008 compiler,
the following commands build and test the native motor:

```sh
cmake -S . -B build/cmake -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build/cmake
ctest --test-dir build/cmake --output-on-failure
```

On Windows, use the MSYS2 UCRT64 shell and the prerequisite installation
commands documented in `README.md`.
With the TDM-GCC compiler at `C:\Programas\TDM-GCC-64\bin\gfortran.exe`,
`powershell -ExecutionPolicy Bypass -File .\scripts\build-tdm.ps1` builds the
native test executable, runs it, and creates `build/tdm-gcc/orbitalsim.dll`.
`powershell -ExecutionPolicy Bypass -File .\scripts\build-all.ps1` also builds
the .NET 10 solution and runs the integration test executable. The CLI is run
with `dotnet run --project src/OrbitalSim.Cli -c Release --no-build -- run
examples/earth-satellite.json --out output/earth-satellite`.
Use `powershell -ExecutionPolicy Bypass -File .\scripts\start-web.ps1` to build
and run the local React app and API. Run `npm test --prefix web` to check form
and CSV parsing, and `powershell -ExecutionPolicy Bypass -File
.\scripts\smoke-api.ps1` after building Release to check HTTP execution. CI
runs native, .NET integration, example, web, and API checks on Linux.
Run `node scripts/verify-presets.mjs` against a running local API after changing
the scenario gallery; it checks every preset through the Fortran motor.

Do not report these commands as passing unless they were run successfully.
If the toolchain is unavailable, state that explicitly and keep test sources
reviewable. Do not commit generated `build/`, `output/`, `web/dist/`, or
benchmark result contents.

## Numerical rules

Use `real(c_double)` for externally visible floating-point values and
`integer(c_int)` for ABI integers. Public units are SI; name or document units
for every physical quantity. Pairwise gravity, the Velocity Verlet update, and
the softened potential must use the same `eps` convention. Report numerical
failures with status codes; never expose Fortran exceptions through the ABI.
Keep exported routines free of mutable global state. Preserve caller buffers
when `os_step` returns an error. Any ABI change requires updating the C header,
README, .NET import declarations, and interop tests together.

## Testing

Add deterministic tests for each numerical change. Prioritize two-body orbital
closure, convergence order, force symmetry, momentum and angular-momentum
conservation, bounded energy drift, and zero-separation behavior. State the
scenario, step size and tolerance in tests. Compare conservation errors using
a physically meaningful scale, especially when the initial invariant is zero.
Use benchmarks only after correctness checks pass; report toolchain, build mode,
body count, steps, time per step, memory and numerical error.

## Coding and review

Use two-space indentation in Fortran and descriptive physical names. Keep the
C ABI small, with explicit types and contiguous body-major xyz arrays. Favor
small, focused changes. Use one public C# type per file and file-scoped
namespaces. Keep React forms, diagnostics, and orchestration in separate
modules. In change summaries, list verification commands and
results, plus numerical assumptions and any tolerance changes.
