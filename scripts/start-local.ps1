$ErrorActionPreference = 'Stop'
$workspace = Split-Path $PSScriptRoot -Parent
function Test-LocalPort([int]$Port) {
    $connection = New-Object Net.Sockets.TcpClient
    try { return $connection.ConnectAsync('127.0.0.1', $Port).Wait(500) -and $connection.Connected }
    catch { return $false }
    finally { $connection.Dispose() }
}
$runtimeFile = Join-Path $workspace '.local\servers.json'
if (Test-Path $runtimeFile) {
    $old = Get-Content $runtimeFile -Raw | ConvertFrom-Json
    if (Get-Process -Id $old.api, $old.frontend -ErrorAction SilentlyContinue) { throw 'Servers may already be running. Use stop-local.ps1 first.' }
}
foreach ($port in @(8000, 5173)) {
    if (Test-LocalPort $port) { throw "Port $port is already occupied. Existing servers were preserved." }
}
& (Join-Path $PSScriptRoot 'local-database.ps1')
$php = Join-Path $workspace '.tools\php\php.exe'
$node = (Get-Command node.exe).Source
$apiProcess = $null
$frontendProcess = $null
try {
    $apiProcess = Start-Process -FilePath $php -ArgumentList 'artisan', 'serve', '--host=127.0.0.1', '--port=8000', '--tries=1' -WorkingDirectory (Join-Path $workspace 'backend') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $workspace '.local\api-output.log') -RedirectStandardError (Join-Path $workspace '.local\api-error.log')
    $frontendProcess = Start-Process -FilePath $node -ArgumentList 'node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173', '--strictPort' -WorkingDirectory (Join-Path $workspace 'frontend') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $workspace '.local\frontend-output.log') -RedirectStandardError (Join-Path $workspace '.local\frontend-error.log')
    $ready = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        $apiProcess.Refresh(); $frontendProcess.Refresh()
        if ($apiProcess.HasExited -or $frontendProcess.HasExited) { throw 'A local server exited during startup. Inspect the private local logs.' }
        if ((Test-LocalPort 8000) -and (Test-LocalPort 5173)) { $ready = $true; break }
        Start-Sleep -Milliseconds 250
    }
    if (-not $ready) { throw 'Local servers did not become ready on the expected ports.' }
    @{ api = $apiProcess.Id; frontend = $frontendProcess.Id; apiStarted = $apiProcess.StartTime.ToUniversalTime().ToString('o'); frontendStarted = $frontendProcess.StartTime.ToUniversalTime().ToString('o') } | ConvertTo-Json | Set-Content $runtimeFile
} catch {
    foreach ($started in @($apiProcess, $frontendProcess)) {
        if ($null -ne $started) {
            $running = Get-Process -Id $started.Id -ErrorAction SilentlyContinue
            if ($running -and $running.StartTime.ToUniversalTime() -eq $started.StartTime.ToUniversalTime()) { & taskkill.exe /PID $started.Id /T /F | Out-Null }
        }
    }
    throw
}
Write-Output 'DormFinder: http://127.0.0.1:5173'
