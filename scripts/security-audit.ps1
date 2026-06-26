# Auditoría de seguridad — Sistema Stock LCH
# Uso: npm run security:audit

$ErrorActionPreference = "Continue"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (Test-Path (Join-Path $PSScriptRoot "..\package.json")) {
    $root = Resolve-Path (Join-Path $PSScriptRoot "..")
}
Set-Location $root

function Write-Section($title) {
    Write-Host ""
    Write-Host ("=" * 62) -ForegroundColor Cyan
    Write-Host "  $title" -ForegroundColor Cyan
    Write-Host ("=" * 62) -ForegroundColor Cyan
}

function Write-Pass($msg) { Write-Host "[PASS] $msg" -ForegroundColor Green }
function Write-Fail($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red }
function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Yellow }

$failures = 0
$started = Get-Date

Write-Section "AUDITORIA DE SEGURIDAD - Sistema Stock LCH"
Write-Host "Fecha: $($started.ToString('yyyy-MM-dd HH:mm:ss'))"
Write-Host "Directorio: $root"

# 1. npm audit (all)
Write-Section "1/7 npm audit (todas las dependencias)"
$auditAll = npm audit 2>&1 | Out-String
Write-Host $auditAll
if ($auditAll -match "found 0 vulnerabilities") {
    Write-Pass "0 vulnerabilidades en dependencias (dev + prod)"
} else {
    Write-Fail "Se detectaron vulnerabilidades en npm audit"
    $failures++
}

# 2. npm audit production only
Write-Section "2/7 npm audit --omit=dev (solo produccion / Docker)"
$auditProd = npm audit --omit=dev 2>&1 | Out-String
Write-Host $auditProd
if ($auditProd -match "found 0 vulnerabilities") {
    Write-Pass "0 vulnerabilidades en dependencias de produccion"
} else {
    Write-Fail "Vulnerabilidades en dependencias de produccion"
    $failures++
}

# 3. Critical package versions
Write-Section "3/7 Versiones de paquetes criticos parcheados"
$pkgCheck = @(
    @{ Name = "multer";       Min = "2.2.0";  Workspace = "apps/api" },
    @{ Name = "react-router"; Min = "7.18.0"; Workspace = "apps/web-admin" },
    @{ Name = "@nestjs/core"; Min = "11.1.0"; Workspace = "apps/api" },
    @{ Name = "sharp";        Min = "0.34.0"; Workspace = "apps/api" }
)
foreach ($p in $pkgCheck) {
    $ls = npm ls $p.Name --workspace=$p.Workspace --depth=0 2>&1 | Out-String
    if ($ls -match "$($p.Name)@([\d\.]+)") {
        $ver = $Matches[1]
        Write-Host "  $($p.Name): $ver (minimo $($p.Min))"
        $cmp = [version]$ver -ge [version]$p.Min
        if ($cmp) { Write-Pass "$($p.Name) @$ver OK" } else { Write-Fail "$($p.Name) @$ver por debajo de $($p.Min)"; $failures++ }
    } else {
        Write-Info "$($p.Name) no encontrado directamente (puede ser override transitivo)"
    }
}

# xlsx fork
$xlsxLs = npm ls xlsx --workspace=apps/web-admin --depth=0 2>&1 | Out-String
Write-Host $xlsxLs
if ($xlsxLs -match "@stackline/xlsx" -or $xlsxLs -match "stackline") {
    Write-Pass "xlsx reemplazado por fork seguro @stackline/xlsx"
} elseif ($xlsxLs -match "xlsx@0\.18") {
    Write-Fail "xlsx legacy vulnerable (SheetJS 0.18.x)"
    $failures++
} else {
    Write-Info "xlsx: verificar manualmente en lockfile"
}

# 4. Security unit tests
Write-Section "4/7 Tests automatizados de seguridad (API)"
$testOut = npm run test:api -- --reporter=dot 2>&1 | Out-String
$testLines = $testOut -split "`n" | Where-Object { $_ -match "security|Tests|passed|failed|FAIL" }
$testLines | ForEach-Object { Write-Host $_ }
if ($testOut -match "(\d+) passed" -and $testOut -notmatch "failed") {
    Write-Pass "Tests API de seguridad pasaron"
} else {
    Write-Fail "Algun test de API fallo"
    $failures++
}

# 5. Production builds
Write-Section "5/7 Build de produccion (API + Admin)"
$apiBuild = npm run build:api 2>&1 | Out-String
if ($LASTEXITCODE -eq 0 -and $apiBuild -notmatch "error TS") {
    Write-Pass "Build API exitoso"
} else {
    Write-Fail "Build API fallo"
    Write-Host ($apiBuild | Select-String -Pattern "error" | Out-String)
    $failures++
}

$adminBuild = npm run build:admin 2>&1 | Out-String
if ($LASTEXITCODE -eq 0 -and $adminBuild -match "built in") {
    Write-Pass "Build Admin exitoso"
} else {
    Write-Fail "Build Admin fallo"
    $failures++
}

# 6. Security controls checklist (static)
Write-Section "6/7 Controles de seguridad en codigo (checklist)"
$checks = @(
    @{ File = "apps/api/src/main.ts"; Pattern = "helmet"; Label = "Helmet (security headers)" },
    @{ File = "apps/api/src/main.ts"; Pattern = "rateLimit"; Label = "Rate limiting" },
    @{ File = "apps/api/src/main.ts"; Pattern = "forbidNonWhitelisted"; Label = "ValidationPipe estricto" },
    @{ File = "apps/api/src/main.ts"; Pattern = "isDev.*Swagger|NODE_ENV.*production"; Label = "Swagger solo en dev" },
    @{ File = "docker-compose.prod.yml"; Pattern = "127\.0\.0\.1"; Label = "Puertos Docker en localhost" },
    @{ File = "apps/api/src/auth/auth.module.ts"; Pattern = "MIN_SECRET_LENGTH"; Label = "Validacion JWT_SECRET" },
    @{ File = "package.json"; Pattern = '"overrides"'; Label = "npm overrides de seguridad" }
)
foreach ($c in $checks) {
    $path = Join-Path $root $c.File
    if (Test-Path $path) {
        $content = Get-Content $path -Raw
        if ($content -match $c.Pattern) {
            Write-Pass $c.Label
        } else {
            Write-Fail "$($c.Label) - no encontrado en $($c.File)"
            $failures++
        }
    } else {
        Write-Fail "Archivo no encontrado: $($c.File)"
        $failures++
    }
}

# 7. Overrides summary
Write-Section "7/7 npm overrides activos (root package.json)"
$pkg = Get-Content (Join-Path $root "package.json") -Raw | ConvertFrom-Json
$overrideCount = ($pkg.overrides.PSObject.Properties | Measure-Object).Count
Write-Host "Total overrides: $overrideCount"
$pkg.overrides.PSObject.Properties | ForEach-Object {
    Write-Host "  - $($_.Name): $($_.Value)"
}

# Final summary
Write-Section "RESUMEN FINAL"
$elapsed = (Get-Date) - $started
if ($failures -eq 0) {
    Write-Host ""
    Write-Pass "SISTEMA SEGURO: 0 vulnerabilidades npm + controles verificados"
    Write-Host "  Duracion: $([math]::Round($elapsed.TotalSeconds, 1))s" -ForegroundColor Gray
    Write-Host ""
    exit 0
} else {
    Write-Host ""
    Write-Fail "SE ENCONTRARON $failures PROBLEMA(S) - revisar arriba"
    Write-Host ""
    exit 1
}
