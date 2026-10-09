$ErrorActionPreference = 'Stop'
$workspace = Split-Path $PSScriptRoot -Parent
& (Join-Path $PSScriptRoot 'local-database.ps1')
$runtimeFile = Join-Path $workspace '.local\servers.json'
if (Test-Path $runtimeFile) {
    $old = Get-Content $runtimeFile -Raw | ConvertFrom-Json
    if (Get-Process -Id $old.api, $old.frontend -ErrorAction SilentlyContinue) { throw 'Servers may already be running. Use stop-local.ps1 first.' }
}
foreach ($port in @(8000, 5173)) {
    if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) { throw "Port $port is already occupied." }
}
$php = Join-Path $workspace '.tools\php\php.exe'
$apiProcess = Start-Process -FilePath $php -ArgumentList 'artisan', 'serve', '--host=127.0.0.1', '--port=8000' -WorkingDirectory (Join-Path $workspace 'backend') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $workspace '.local\api-output.log') -RedirectStandardError (Join-Path $workspace '.local\api-error.log')
$node = (Get-Command node.exe).Source
$frontendProcess = Start-Process -FilePath $node -ArgumentList 'node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173', '--strictPort' -WorkingDirectory (Join-Path $workspace 'frontend') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $workspace '.local\frontend-output.log') -RedirectStandardError (Join-Path $workspace '.local\frontend-error.log')
@{ api = $apiProcess.Id; frontend = $frontendProcess.Id; apiStarted = $apiProcess.StartTime.ToUniversalTime().ToString('o'); frontendStarted = $frontendProcess.StartTime.ToUniversalTime().ToString('o') } | ConvertTo-Json | Set-Content $runtimeFile
Write-Output 'DormFinder: http://127.0.0.1:5173'

