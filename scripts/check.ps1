$ErrorActionPreference = 'Stop'
$workspace = Split-Path $PSScriptRoot -Parent
$php = Join-Path $workspace '.tools\php\php.exe'
Push-Location (Join-Path $workspace 'backend')
try {
    & $php vendor/bin/pint --dirty --format agent
    if ($LASTEXITCODE -ne 0) { throw 'PHP formatting failed.' }
    & $php artisan test --compact
    if ($LASTEXITCODE -ne 0) { throw 'Backend tests failed.' }
} finally { Pop-Location }
Push-Location (Join-Path $workspace 'frontend')
try {
    foreach ($task in @('lint', 'test', 'build', 'test:e2e')) {
        & npm.cmd run $task
        if ($LASTEXITCODE -ne 0) { throw "Frontend $task failed." }
    }
} finally { Pop-Location }

