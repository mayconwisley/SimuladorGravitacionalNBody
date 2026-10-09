param(
    [string]$Compiler = 'C:\Programas\TDM-GCC-64\bin\gfortran.exe',
    [int]$Port = 5080
)

$ErrorActionPreference = 'Stop'
if ($Port -lt 1 -or $Port -gt 65535) { throw 'Port must be between 1 and 65535.' }
$project = Split-Path -Parent $PSScriptRoot

Push-Location $project
try {
    & (Join-Path $PSScriptRoot 'build-all.ps1') -Compiler $Compiler
    if ($LASTEXITCODE -ne 0) { throw 'Core build and tests failed.' }
    npm ci --prefix web
    if ($LASTEXITCODE -ne 0) { throw 'Web dependency installation failed.' }
    npm test --prefix web
    if ($LASTEXITCODE -ne 0) { throw 'Web tests failed.' }
    npm run build --prefix web
    if ($LASTEXITCODE -ne 0) { throw 'Web build failed.' }
    Write-Host "Open http://127.0.0.1:$Port"
    dotnet run --project src/OrbitalSim.Api -c Release --no-build --no-launch-profile --urls "http://127.0.0.1:$Port"
}
finally {
    Pop-Location
}
