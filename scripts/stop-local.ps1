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
        }
    }
    Remove-Item -LiteralPath $runtimeFile
}
Write-Output 'Tracked local application servers stopped. Database retained.'

