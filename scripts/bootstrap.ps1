$ErrorActionPreference = 'Stop'
$workspace = Split-Path $PSScriptRoot -Parent
if (Get-NetTCPConnection -State Listen -LocalPort 5173 -ErrorAction SilentlyContinue) {
    throw 'Stop the local frontend before reinstalling dependencies; Windows locks its native build module while Vite is running.'
}
$toolsRoot = Join-Path $workspace '.tools'
New-Item -ItemType Directory -Force -Path $toolsRoot | Out-Null
$php = Join-Path $toolsRoot 'php\php.exe'
if (-not (Test-Path $php)) {
    $archive = Join-Path $toolsRoot 'php.zip'
    Invoke-WebRequest -UseBasicParsing 'https://windows.php.net/downloads/releases/php-8.4.26-nts-Win32-vs17-x64.zip' -OutFile $archive
    if ((Get-FileHash $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne 'da68394f9193b7f6b89d0c76861a4034ae10efee7fd55a7255d8118c2acf70d7') { throw 'PHP checksum mismatch.' }
    Expand-Archive -LiteralPath $archive -DestinationPath (Join-Path $toolsRoot 'php')
    $configuration = Get-Content (Join-Path $toolsRoot 'php\php.ini-development') -Raw
    $configuration = $configuration.Replace(';extension_dir = "ext"', ('extension_dir = "' + (Join-Path $toolsRoot 'php\ext') + '"'))
    foreach ($extension in @('curl', 'fileinfo', 'gd', 'mbstring', 'openssl', 'pdo_pgsql', 'pgsql', 'zip', 'intl', 'exif')) {
        $configuration = $configuration.Replace(';extension=' + $extension, 'extension=' + $extension)
    }
    $configuration = $configuration -replace '(?m)^memory_limit = .*$', 'memory_limit = 256M'
    $configuration = $configuration -replace '(?m)^upload_max_filesize = .*$', 'upload_max_filesize = 4M'
    [IO.File]::WriteAllText((Join-Path $toolsRoot 'php\php.ini'), $configuration)
}
$caFile = Join-Path $toolsRoot 'php\cacert.pem'
if (-not (Test-Path $caFile)) {
    Invoke-WebRequest -UseBasicParsing 'https://curl.se/ca/cacert.pem' -OutFile $caFile
    Add-Content (Join-Path $toolsRoot 'php\php.ini') -Value @('', ('curl.cainfo="' + $caFile + '"'), ('openssl.cafile="' + $caFile + '"'))
}
$composer = Join-Path $toolsRoot 'composer.phar'
if (-not (Test-Path $composer)) {
    Invoke-WebRequest -UseBasicParsing 'https://getcomposer.org/download/latest-stable/composer.phar' -OutFile $composer
}
$checksumFile = Join-Path $toolsRoot 'composer.phar.sha256'
if (-not (Test-Path $checksumFile)) {
    Invoke-WebRequest -UseBasicParsing 'https://getcomposer.org/download/latest-stable/composer.phar.sha256sum' -OutFile $checksumFile
}
$expected = [Regex]::Match((Get-Content $checksumFile -Raw), '[a-fA-F0-9]{64}').Value.ToLowerInvariant()
if (-not $expected -or (Get-FileHash $composer -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) { throw 'Composer checksum mismatch.' }
$pgBinary = Join-Path $toolsRoot 'postgresql\pgsql\bin\pg_ctl.exe'
if (-not (Test-Path $pgBinary)) {
    $pgArchive = Join-Path $toolsRoot 'postgresql.zip'
    Invoke-WebRequest -UseBasicParsing 'https://get.enterprisedb.com/postgresql/postgresql-17.11-5-windows-x64-binaries.zip' -OutFile $pgArchive
    Expand-Archive -LiteralPath $pgArchive -DestinationPath (Join-Path $toolsRoot 'postgresql')
}
$env:PATH = (Split-Path $php -Parent) + ';' + $env:PATH
Push-Location (Join-Path $workspace 'backend')
try {
    & $php $composer install --no-interaction --prefer-dist
    if ($LASTEXITCODE -ne 0) { throw 'Composer install failed.' }
} finally { Pop-Location }
& (Join-Path $PSScriptRoot 'local-database.ps1')
Push-Location (Join-Path $workspace 'backend')
try {
    if (-not ((Get-Content '.env' -Raw) -match '(?m)^APP_KEY=base64:')) { & $php artisan key:generate }
    & $php artisan migrate --no-interaction
    if ($LASTEXITCODE -ne 0) { throw 'Database migration failed.' }
    if (-not ((Get-Content '.env.testing' -Raw) -match '(?m)^APP_KEY=base64:')) { & $php artisan key:generate --env=testing }
} finally { Pop-Location }
Push-Location (Join-Path $workspace 'frontend')
try {
    & npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw 'Frontend install failed.' }
} finally { Pop-Location }
Write-Output 'Local setup is ready. No production credentials were used.'

