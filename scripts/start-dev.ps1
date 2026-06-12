#Requires -Version 5.1
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

function Start-DockerDesktop {
    $paths = @(
        "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
        "${env:ProgramFiles(x86)}\Docker\Docker\Docker Desktop.exe"
    )
    foreach ($path in $paths) {
        if (Test-Path $path) {
            Write-Host "Iniciando Docker Desktop..." -ForegroundColor Yellow
            Start-Process $path
            return $true
        }
    }
    return $false
}

function Wait-Docker([int]$MaxAttempts = 40) {
    for ($i = 1; $i -le $MaxAttempts; $i++) {
        if (Test-DockerRunning) {
            Write-Host "Docker listo." -ForegroundColor Green
            return
        }
        Write-Host "Esperando Docker... ($i/$MaxAttempts)"
        Start-Sleep -Seconds 3
    }
    throw "Docker no respondio a tiempo. Abrilo manualmente y volve a ejecutar el script."
}

function Wait-Postgres([int]$MaxAttempts = 30) {
    for ($i = 1; $i -le $MaxAttempts; $i++) {
        docker compose exec -T postgres pg_isready -U lch -d lch_stock 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "PostgreSQL listo." -ForegroundColor Green
            return
        }
        Start-Sleep -Seconds 2
    }
    throw "PostgreSQL no respondio a tiempo."
}

Write-Host "=== Sistema LCH - Inicio de desarrollo ===" -ForegroundColor Cyan
Write-Host "Directorio: $Root"

Write-Step "Verificando Docker"
if (-not (Test-DockerRunning)) {
    if (-not (Start-DockerDesktop)) {
        throw "Docker Desktop no esta instalado. Instalalo desde https://www.docker.com/products/docker-desktop/"
    }
    Wait-Docker
}

Write-Step "Levantando infraestructura (PostgreSQL, Redis, MinIO)"
docker compose up -d postgres redis minio minio-init
if ($LASTEXITCODE -ne 0) {
    throw "No se pudo levantar la infraestructura con Docker Compose."
}
Wait-Postgres

$envFile = Join-Path $Root "apps\api\.env"
$envExample = Join-Path $Root "apps\api\.env.example"
if (-not (Test-Path $envFile)) {
    Copy-Item $envExample $envFile
    Write-Host "Creado apps/api/.env desde .env.example" -ForegroundColor Yellow
}

if (-not (Test-Path (Join-Path $Root "node_modules"))) {
    Write-Step "Instalando dependencias (primera vez, puede tardar)"
    npm install
    if ($LASTEXITCODE -ne 0) {
        throw "npm install fallo."
    }
}

Write-Step "Preparando base de datos"
Push-Location (Join-Path $Root "apps\api")
try {
    npx prisma db push
    if ($LASTEXITCODE -ne 0) {
        throw "prisma db push fallo."
    }

    npm run prisma:seed
    if ($LASTEXITCODE -ne 0) {
        throw "prisma:seed fallo."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "=== Servicios listos ===" -ForegroundColor Green
Write-Host "  API:    http://localhost:3001"
Write-Host "  Admin:  http://localhost:5173"
Write-Host "  Public: http://localhost:5174"
Write-Host "  Docs:   http://localhost:3001/api/docs"
Write-Host "  Login:  admin / admin123"
Write-Host ""
Write-Host "Iniciando API + Admin + Public (Ctrl+C para detener todo)..." -ForegroundColor DarkGray
Write-Host ""

npx concurrently -n api,admin,public -c magenta,green,blue `
    "npm run dev:api" `
    "npm run dev:admin" `
    "npm run dev:public"
