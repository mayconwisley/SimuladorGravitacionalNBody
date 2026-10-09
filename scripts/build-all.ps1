param(
    [string]$Compiler = 'C:\Programas\TDM-GCC-64\bin\gfortran.exe'
)

$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
& (Join-Path $PSScriptRoot 'build-tdm.ps1') -Compiler $Compiler
if ($LASTEXITCODE -ne 0) { throw 'Native build failed.' }

Push-Location $project
try {
    $env:MSBUILDDISABLENODEREUSE = '1'
    dotnet restore OrbitalSim.sln -m:1 -p:NuGetAudit=false
    if ($LASTEXITCODE -ne 0) { throw 'Restore failed.' }
    dotnet build OrbitalSim.sln -c Release --no-restore -m:1
    if ($LASTEXITCODE -ne 0) { throw '.NET build failed.' }
    dotnet run --project tests/OrbitalSim.IntegrationTests -c Release --no-build
    if ($LASTEXITCODE -ne 0) { throw '.NET integration tests failed.' }
}
finally {
    Pop-Location
}
