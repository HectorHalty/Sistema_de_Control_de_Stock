#Requires -Version 5.1
param(
    [switch]$Setup,
    [switch]$Infra,
    [switch]$All
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Write-Step([string]$Message) {
    Write-Host ""
    Write-Host ">> $Message" -ForegroundColor Cyan
}

function Test-DockerRunning {
    docker info 2>$null | Out-Null
    return $LASTEXITCODE -eq 0
}

function Get-DatabaseUrl {
    $envFile = Join-Path $Root "apps\api\.env"
    if (-not (Test-Path $envFile)) { return $null }
    foreach ($line in Get-Content $envFile) {
        if ($line -match '^\s*DATABASE_URL\s*=\s*(.+)\s*$') {
            return $Matches[1].Trim().Trim('"').Trim("'")
        }
    }
    return $null
}

function Test-UsesSupabase([string]$Url) {
    return $Url -and ($Url -match 'supabase\.co' -or $Url -match 'pooler\.supabase')
}

function Test-UsesLocalDb([string]$Url) {
    return $Url -and ($Url -match 'localhost' -or $Url -match '127\.0\.0\.1')
}

Write-Host "=== Sistema LCH - Desarrollo ===" -ForegroundColor Cyan
Write-Host "Directorio: $Root"

$envFile = Join-Path $Root "apps\api\.env"
$envExample = Join-Path $Root "apps\api\.env.example"
if (-not (Test-Path $envFile)) {
    Copy-Item $envExample $envFile
    Write-Host "Creado apps/api/.env desde .env.example - configura DATABASE_URL si usas Supabase." -ForegroundColor Yellow
}

$dbUrl = Get-DatabaseUrl
$usesSupabase = Test-UsesSupabase $dbUrl
$usesLocalDb = Test-UsesLocalDb $dbUrl

if ($usesSupabase) {
    Write-Host "Base de datos: Supabase (sin Docker local)." -ForegroundColor DarkGray
} elseif ($usesLocalDb) {
    Write-Host "Base de datos: PostgreSQL local." -ForegroundColor DarkGray
} else {
    Write-Host "Base de datos: revisa DATABASE_URL en apps/api/.env" -ForegroundColor Yellow
}

$needInfra = $Infra -or ($usesLocalDb -and -not $usesSupabase)
if ($needInfra) {
    Write-Step "Levantando infraestructura Docker"
    if (-not (Test-DockerRunning)) {
        throw "Docker no esta corriendo. Abri Docker Desktop o usa Supabase en apps/api/.env"
    }
    docker compose up -d postgres redis minio minio-init
    if ($LASTEXITCODE -ne 0) {
        throw "No se pudo levantar Docker Compose."
    }
    Write-Host "Esperando PostgreSQL..." -ForegroundColor DarkGray
    for ($i = 1; $i -le 30; $i++) {
        docker compose exec -T postgres pg_isready -U lch -d lch_stock 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { break }
        Start-Sleep -Seconds 2
    }

    Write-Step "Sincronizando esquema de base de datos"
    Push-Location (Join-Path $Root "apps\api")
    try {
        npx prisma db push
        if ($LASTEXITCODE -ne 0) { throw "prisma db push fallo." }
    }
    finally {
        Pop-Location
    }
}

if (-not (Test-Path (Join-Path $Root "node_modules"))) {
    Write-Step "Instalando dependencias (primera vez)"
    npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install fallo." }
}

if ($Setup) {
    Write-Step "Preparando base de datos (prisma db push + seed)"
    Push-Location (Join-Path $Root "apps\api")
    try {
        npx prisma generate
        if ($LASTEXITCODE -ne 0) { throw "prisma generate fallo." }
        npx prisma db push
        if ($LASTEXITCODE -ne 0) { throw "prisma db push fallo." }
        npm run prisma:seed
        if ($LASTEXITCODE -ne 0) { throw "prisma:seed fallo." }
    }
    finally {
        Pop-Location
    }
}

Write-Host ""
Write-Host "=== URLs ===" -ForegroundColor Green
Write-Host "  Admin:  http://localhost:5173"
Write-Host "  API:    http://localhost:3001"
Write-Host "  Docs:   http://localhost:3001/api/docs"
if ($All) { Write-Host "  Public: http://localhost:5174" }
Write-Host "  Login:  admin / admin123"
Write-Host ""
Write-Host "Ctrl+C para detener todo." -ForegroundColor DarkGray
Write-Host ""

if ($All) {
    npx concurrently -n api,admin,public -c magenta,green,blue "npm run dev:api" "npm run dev:admin" "npm run dev:public"
} else {
    npx concurrently -n api,admin -c magenta,green "npm run dev:api" "npm run dev:admin"
}
