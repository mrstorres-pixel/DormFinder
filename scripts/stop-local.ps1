$ErrorActionPreference = 'Stop'
$workspace = Split-Path $PSScriptRoot -Parent
$runtimeFile = Join-Path $workspace '.local\servers.json'
if (Test-Path $runtimeFile) {
    $runtime = Get-Content $runtimeFile -Raw | ConvertFrom-Json
    foreach ($service in @('api', 'frontend')) {
        $processId = $runtime.$service
        $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
        $expectedStart = $runtime.($service + 'Started')
        if ($process -and $process.StartTime.ToUniversalTime().ToString('o') -eq $expectedStart) {
            & taskkill.exe /PID $processId /T /F | Out-Null
            if ($LASTEXITCODE -ne 0) { throw 'Could not stop a tracked server. Runtime tracking was preserved; retry from an authorized PowerShell session.' }
        }
    }
    Remove-Item -LiteralPath $runtimeFile
}
Write-Output 'Tracked local application servers stopped. Database retained.'

