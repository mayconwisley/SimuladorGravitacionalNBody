param([int]$Port = 5081)

$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$assembly = Join-Path $project 'src/OrbitalSim.Api/bin/Release/net10.0/OrbitalSim.Api.dll'
if (-not (Test-Path $assembly)) { throw 'Build OrbitalSim.Api in Release first.' }

Push-Location $project
$server = $null
try {
    $server = Start-Process -FilePath 'dotnet' -ArgumentList @($assembly, '--urls', "http://127.0.0.1:$Port") -PassThru -WindowStyle Hidden
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Milliseconds 300
        try {
            $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/health" -TimeoutSec 2
            if ($health.status -eq 'ready') { $ready = $true; break }
        } catch { }
    }
    if (-not $ready) { throw 'API did not become ready.' }

    $scenario = Get-Content 'examples/earth-satellite.json' -Raw
    $result = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/simulations" -Method Post -ContentType 'application/json' -Body $scenario
    if ($result.samples.Count -ne 61 -or $result.samples[0].bodies.Count -ne 2) {
        throw 'Unexpected simulation response.'
    }
    $invalid = $scenario | ConvertFrom-Json
    $invalid.bodies[1].massKg = -1
    try {
        Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/simulations" -Method Post -ContentType 'application/json' -Body ($invalid | ConvertTo-Json -Depth 8) | Out-Null
        throw 'Invalid scenario was accepted.'
    } catch {
        if ([int]$_.Exception.Response.StatusCode -ne 400) { throw }
    }
    $page = curl.exe --fail --silent "http://127.0.0.1:$Port/"
    if ($LASTEXITCODE -ne 0 -or ($page -join "`n") -notmatch 'OrbitalSim') {
        throw 'React page was not served.'
    }
    Write-Host 'API, validation, and React page smoke tests passed.'
}
finally {
    if ($server -and -not $server.HasExited) { Stop-Process -Id $server.Id -Force }
    Pop-Location
}
