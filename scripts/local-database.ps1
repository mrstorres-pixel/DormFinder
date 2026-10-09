param([switch]$Stop)
$ErrorActionPreference = 'Stop'
$workspace = Split-Path $PSScriptRoot -Parent
$pgBin = Join-Path $workspace '.tools\postgresql\pgsql\bin'
$env:PGDATA = Join-Path $workspace '.local\postgres-data'
$pgPort = '54329'
if (-not (Test-Path (Join-Path $pgBin 'pg_ctl.exe'))) { throw 'Run scripts/bootstrap.ps1 first.' }
if ($Stop) {
    & (Join-Path $pgBin 'pg_ctl.exe') stop -m fast
    exit $LASTEXITCODE
}
if (-not (Test-Path (Join-Path $env:PGDATA 'PG_VERSION'))) {
    $environmentFile = Join-Path $workspace 'backend\.env'
    if ((Test-Path $environmentFile) -and ((Get-Content $environmentFile -Raw) -match '(?m)^DB_DATABASE=dormfinder$')) {
        throw 'Existing configured environment found. Keep it and configure the new local database deliberately.'
    }
    $secretBytes = New-Object byte[] 32
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($secretBytes)
    $databasePassword = [Convert]::ToBase64String($secretBytes)
    $rng.Dispose()
    New-Item -ItemType Directory -Force -Path (Join-Path $workspace '.local') | Out-Null
    $passwordFile = Join-Path $workspace '.local\postgres-init-password'
    [IO.File]::WriteAllText($passwordFile, $databasePassword)
    & (Join-Path $pgBin 'initdb.exe') -U dormfinder --auth=scram-sha-256 --encoding=UTF8 --locale=C "--pwfile=$passwordFile"
    if ($LASTEXITCODE -ne 0) { throw 'Database initialization failed.' }
    Remove-Item -LiteralPath $passwordFile
    Add-Content -LiteralPath (Join-Path $env:PGDATA 'postgresql.conf') -Value @('', "listen_addresses = '127.0.0.1'", 'port = 54329')
    $template = Get-Content -LiteralPath (Join-Path $workspace 'backend\.env.example') -Raw
    $template = $template -replace '(?m)^DB_PASSWORD=.*$', ('DB_PASSWORD=' + $databasePassword)
    [IO.File]::WriteAllText($environmentFile, $template)
}
& (Join-Path $pgBin 'pg_ctl.exe') status *> $null
if ($LASTEXITCODE -ne 0) {
    & (Join-Path $pgBin 'pg_ctl.exe') start -l (Join-Path $workspace '.local\postgres.log') -w
    if ($LASTEXITCODE -ne 0) { throw 'Database failed to start.' }
}
$environmentText = Get-Content -LiteralPath (Join-Path $workspace 'backend\.env') -Raw
if ($environmentText -notmatch '(?m)^DB_HOST=127\.0\.0\.1$' -or $environmentText -notmatch '(?m)^DB_PORT=54329$') {
    throw 'Refusing local setup with a nonlocal backend environment.'
}
$env:PGPASSWORD = [regex]::Match($environmentText, '(?m)^DB_PASSWORD=(.*)$').Groups[1].Value.Trim()
try {
    foreach ($databaseName in @('dormfinder','dormfinder_test')) {
        $exists = & (Join-Path $pgBin 'psql.exe') -h 127.0.0.1 -p $pgPort -U dormfinder -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$databaseName'"
        if ($LASTEXITCODE -ne 0) { throw 'Local PostgreSQL connection failed.' }
        if ($exists -ne '1') {
            & (Join-Path $pgBin 'createdb.exe') -h 127.0.0.1 -p $pgPort -U dormfinder $databaseName
            if ($LASTEXITCODE -ne 0) { throw 'Database creation failed.' }
        }
        & (Join-Path $pgBin 'psql.exe') -h 127.0.0.1 -p $pgPort -U dormfinder -d $databaseName -v ON_ERROR_STOP=1 -c 'CREATE SCHEMA IF NOT EXISTS dormfinder AUTHORIZATION dormfinder'
        if ($LASTEXITCODE -ne 0) { throw 'Schema creation failed.' }
    }
    $testingText = $environmentText -replace '(?m)^APP_ENV=.*$', 'APP_ENV=testing' -replace '(?m)^DB_DATABASE=.*$', 'DB_DATABASE=dormfinder_test'
    [IO.File]::WriteAllText((Join-Path $workspace 'backend\.env.testing'), $testingText)
} finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}
Write-Output 'Local PostgreSQL is ready on 127.0.0.1:54329. Credentials remain in ignored environment files.'

