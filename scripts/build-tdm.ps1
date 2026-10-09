param(
    [string]$Compiler = 'C:\Programas\TDM-GCC-64\bin\gfortran.exe'
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $Compiler -PathType Leaf)) {
    throw "GNU Fortran not found: $Compiler"
}

$project = Split-Path -Parent $PSScriptRoot
$output = Join-Path $project 'build\tdm-gcc'
$modules = Join-Path $output 'modules'
New-Item -ItemType Directory -Path $modules -Force | Out-Null
$sources = @(
    'native\src\orbital_types.f90'
    'native\src\orbital_forces.f90'
    'native\src\orbital_diagnostics.f90'
    'native\src\orbital_elements.f90'
    'native\src\orbital_integrator.f90'
    'native\src\orbital_c_api.f90'
) | ForEach-Object { Join-Path $project $_ }
$testSources = @(
    'tests\native\test_features.f90'
    'tests\native\test_orbital.f90'
) | ForEach-Object { Join-Path $project $_ }
$testExecutable = Join-Path $output 'orbital_native_tests.exe'
$library = Join-Path $output 'orbitalsim.dll'

$env:PATH = (Split-Path -Parent $Compiler) + ';' + $output + ';' + $env:PATH

& $Compiler -O0 -g -Wall -Wextra -fcheck=all "-J$modules" "-I$modules" `
    -o $testExecutable @sources @testSources
if ($LASTEXITCODE -ne 0) { throw 'Native test compilation failed.' }

& $testExecutable
if ($LASTEXITCODE -ne 0) { throw 'Native tests failed.' }

& $Compiler -O2 -Wall -Wextra -shared "-J$modules" "-I$modules" `
    -o $library @sources
if ($LASTEXITCODE -ne 0) { throw 'Native library compilation failed.' }

Write-Output "Built $library"
