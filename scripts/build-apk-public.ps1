#Requires -Version 5.1
<#
  Build APK de la app pública La Chacra Fútbol (com.lch.public).

  Uso:
    .\scripts\build-apk-public.ps1
    .\scripts\build-apk-public.ps1 -ApiUrl "https://lachacra-api.duckdns.org"
#>
param(
    [string]$ApiUrl = "",
    [ValidateSet("debug", "release")]
    [string]$Variant = "debug"
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$PublicDir = Join-Path $Root "apps\web-public"
$OutDir = Join-Path $Root "release\apk-public"

function Ensure-AndroidPlatform {
    $androidDir = Join-Path $PublicDir "android"
    if (-not (Test-Path $androidDir)) {
        Write-Host "Agregando plataforma Android..." -ForegroundColor Yellow
        Push-Location $PublicDir
        try {
            & npx cap add android
            if ($LASTEXITCODE -ne 0) { throw "cap add android fallo." }
        }
        finally { Pop-Location }
    }
    return $androidDir
}

$sdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
if (-not (Test-Path $sdk)) {
    throw "No se encontro Android SDK. Instala Android Studio."
}
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk

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

Write-Host "=== Build APK Public - La Chacra Futbol ===" -ForegroundColor Cyan
Write-Host "API URL: $ApiUrl" -ForegroundColor Yellow

Push-Location $PublicDir
try {
    $env:VITE_API_URL = $ApiUrl
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "vite build fallo." }
}
finally { Pop-Location }

$androidDir = Ensure-AndroidPlatform

Push-Location $PublicDir
try {
    & npx cap sync android
    if ($LASTEXITCODE -ne 0) { throw "cap sync fallo." }
}
finally { Pop-Location }

$gradleTask = if ($Variant -eq "release") { "assembleRelease" } else { "assembleDebug" }
Push-Location (Join-Path $androidDir "app")
try {
    Push-Location ..
    & .\gradlew.bat $gradleTask
    if ($LASTEXITCODE -ne 0) { throw "gradlew $gradleTask fallo." }
    Pop-Location
}
finally { Pop-Location }

$apkSub = if ($Variant -eq "release") { "release" } else { "debug" }
$apkName = if ($Variant -eq "release") { "app-release-unsigned.apk" } else { "app-debug.apk" }
$apkPath = Join-Path $androidDir "app\build\outputs\apk\$apkSub\$apkName"

if (-not (Test-Path $apkPath)) {
    throw "APK no encontrado en $apkPath"
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$dest = Join-Path $OutDir "lch-public-$Variant.apk"
Copy-Item $apkPath $dest -Force

Write-Host ""
Write-Host "APK generado: $dest" -ForegroundColor Green
