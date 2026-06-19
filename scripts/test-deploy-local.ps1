#Requires -Version 5.1
<#
  Prueba local del stack de producción (Docker Compose).
  Genera .env.production.local con secretos de prueba y ejecuta build + smoke test.
#>
param(
    [switch]$KeepRunning
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function New-RandomBase64([int]$Bytes = 32) {
    $buf = New-Object byte[] $Bytes
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
    return [Convert]::ToBase64String($buf)
}

function New-RandomHex([int]$Bytes = 24) {
    $buf = New-Object byte[] $Bytes
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
    return ([BitConverter]::ToString($buf) -replace '-', '').ToLower()
}

$envFile = Join-Path $Root ".env.production.local"
$jwt = New-RandomBase64 48
$pg = New-RandomHex 24
$redis = New-RandomHex 24
$minioUser = "lchminio$(New-RandomHex 4)"
$minioSecret = New-RandomHex 24

@"
POSTGRES_USER=lch
POSTGRES_PASSWORD=$pg
POSTGRES_DB=lch_stock
JWT_SECRET=$jwt
JWT_EXPIRES_IN=1h
ALLOWED_ORIGINS=http://127.0.0.1:8080,https://localhost,capacitor://localhost
REDIS_PASSWORD=$redis
MINIO_ACCESS_KEY=$minioUser
MINIO_SECRET_KEY=$minioSecret
VITE_API_URL=http://127.0.0.1:3001
API_PORT=3001
ADMIN_PORT=8080
"@ | Set-Content -Path $envFile -Encoding UTF8

Write-Host "=== Test deploy local ===" -ForegroundColor Cyan
Write-Host "Env: $envFile"

$compose = "docker compose -f docker-compose.prod.yml --env-file .env.production.local"

Write-Host ">> Build..." -ForegroundColor Yellow
Invoke-Expression "$compose build"
if ($LASTEXITCODE -ne 0) { throw "docker build fallo" }

Write-Host ">> Limpiando stack previo (volumenes de prueba)..." -ForegroundColor DarkGray
Invoke-Expression "$compose down -v --remove-orphans" | Out-Null

Write-Host ">> Up..." -ForegroundColor Yellow
Invoke-Expression "$compose up -d"
if ($LASTEXITCODE -ne 0) { throw "docker up fallo" }

Write-Host ">> Esperando API..." -ForegroundColor Yellow
$ok = $false
for ($i = 1; $i -le 45; $i++) {
    Start-Sleep -Seconds 2
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:3001/health" -UseBasicParsing -TimeoutSec 5
        if ($r.StatusCode -eq 200) { $ok = $true; break }
    } catch { }
}
if (-not $ok) {
    Invoke-Expression "$compose logs api --tail 40"
    throw "API no respondio a /health"
}

Write-Host ">> Smoke tests..." -ForegroundColor Yellow
$health = (Invoke-WebRequest -Uri "http://127.0.0.1:3001/health" -UseBasicParsing).StatusCode
$admin = (Invoke-WebRequest -Uri "http://127.0.0.1:8080/" -UseBasicParsing).StatusCode
Write-Host "  API /health: $health"
Write-Host "  Admin /:     $admin"

if ($health -ne 200 -or $admin -ne 200) {
    throw "Smoke test fallo"
}

Write-Host ""
Write-Host "=== Test deploy OK ===" -ForegroundColor Green
Write-Host "  Admin: http://127.0.0.1:8080"
Write-Host "  API:   http://127.0.0.1:3001/health"

if (-not $KeepRunning) {
    Write-Host ">> Deteniendo contenedores..." -ForegroundColor DarkGray
    Invoke-Expression "$compose down"
}
