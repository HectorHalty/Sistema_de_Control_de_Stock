#Requires -Version 5.1
<#
  Build APK del panel admin para PRODUCCIÓN (HTTPS, sin cleartext).

  Uso:
    .\scripts\build-apk-release.ps1
    .\scripts\build-apk-release.ps1 -ApiUrl "https://api.lachacra.com"
#>
param(
    [string]$ApiUrl = "",
    [ValidateSet("debug", "release")]
    [string]$Variant = "debug"
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$AdminDir = Join-Path $Root "apps\web-admin"
$OutDir = Join-Path $Root "release\apk"

function Ensure-AndroidPlatform {
    $androidDir = Join-Path $AdminDir "android"
    if (-not (Test-Path $androidDir)) {
        Write-Host "Agregando plataforma Android..." -ForegroundColor Yellow
        Push-Location $AdminDir
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
    $ApiUrl = "https://api.lachacra.com"
}
if ($ApiUrl -notmatch '^https://') {
    throw "Produccion requiere VITE_API_URL con HTTPS. Recibido: $ApiUrl"
}

Write-Host "=== Build APK Release - LCH Admin ===" -ForegroundColor Cyan
Write-Host "API URL: $ApiUrl" -ForegroundColor Yellow

Push-Location $AdminDir
try {
    $env:VITE_API_URL = $ApiUrl
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "vite build fallo." }
}
finally { Pop-Location }

$androidDir = Ensure-AndroidPlatform

Push-Location $AdminDir
try {
    & npx cap sync android
    if ($LASTEXITCODE -ne 0) { throw "cap sync fallo." }
}
finally { Pop-Location }

$gradleTask = if ($Variant -eq "release") { "assembleRelease" } else { "assembleDebug" }
Write-Host ">> Gradle $gradleTask..." -ForegroundColor Cyan
Push-Location $androidDir
try {
    if ($IsWindows -or $env:OS -match 'Windows') {
        .\gradlew.bat $gradleTask --no-daemon
    } else {
        ./gradlew $gradleTask --no-daemon
    }
    if ($LASTEXITCODE -ne 0) { throw "gradle $gradleTask fallo." }
}
finally { Pop-Location }

$subPath = if ($Variant -eq "release") { "release\app-release-unsigned.apk" } else { "debug\app-debug.apk" }
$apkSrc = Join-Path $androidDir "app\build\outputs\apk\$subPath"
if (-not (Test-Path $apkSrc)) {
    $apkSrc = Get-ChildItem -Path (Join-Path $androidDir "app\build\outputs\apk") -Recurse -Filter "*.apk" |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1 -ExpandProperty FullName
}
if (-not $apkSrc) { throw "No se genero APK." }

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$apkDst = Join-Path $OutDir "lch-admin-$Variant.apk"
Copy-Item $apkSrc $apkDst -Force

Write-Host ""
Write-Host "=== APK listo ===" -ForegroundColor Green
Write-Host "  $apkDst"
if ($Variant -eq "debug") {
    Write-Host ""
    Write-Host "Para release firmado: genera keystore en Android Studio y usa -Variant release" -ForegroundColor Yellow
}
