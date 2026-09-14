#Requires -Version 5.1
<#
  Prepara proyecto iOS de la app pública (Capacitor).
  El archive IPA requiere macOS + Xcode; este script sincroniza web build → ios/.

  Uso:
    .\scripts\build-ios-public.ps1
    .\scripts\build-ios-public.ps1 -ApiUrl "https://lachacra-api.duckdns.org"
#>
param(
    [string]$ApiUrl = ""
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$PublicDir = Join-Path $Root "apps\web-public"

function Ensure-IosPlatform {
    $iosDir = Join-Path $PublicDir "ios"
    if (-not (Test-Path $iosDir)) {
        Write-Host "Agregando plataforma iOS..." -ForegroundColor Yellow
        Push-Location $PublicDir
        try {
            & npx cap add ios
            if ($LASTEXITCODE -ne 0) { throw "cap add ios fallo." }
        }
        finally { Pop-Location }
    }
    return $iosDir
}

if (-not $ApiUrl) {
    if (Test-Path (Join-Path $Root ".env.production")) {
        Get-Content (Join-Path $Root ".env.production") | ForEach-Object {
            if ($_ -match '^\s*VITE_API_URL=(.+)$') { $ApiUrl = $Matches[1].Trim() }
        }
    }
}
if (-not $ApiUrl) {
    $ApiUrl = "https://lachacra-api.duckdns.org"
}
if ($ApiUrl -notmatch '^https://') {
    throw "Produccion requiere VITE_API_URL con HTTPS. Recibido: $ApiUrl"
}

Write-Host "=== Build iOS Public (Capacitor sync) ===" -ForegroundColor Cyan
Write-Host "API URL: $ApiUrl" -ForegroundColor Yellow

Push-Location $PublicDir
try {
    $env:VITE_API_URL = $ApiUrl
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "vite build fallo." }
}
finally { Pop-Location }

$iosDir = Ensure-IosPlatform

Push-Location $PublicDir
try {
    & npx cap sync ios
    if ($LASTEXITCODE -ne 0) { throw "cap sync ios fallo." }
}
finally { Pop-Location }

Write-Host ""
Write-Host "Proyecto iOS listo en: $iosDir" -ForegroundColor Green
Write-Host "Abrí Xcode con: npm run cap:open:ios --workspace=apps/web-public" -ForegroundColor Yellow
Write-Host "En macOS: Product > Archive para generar IPA (App Store)." -ForegroundColor Yellow
