#Requires -Version 5.1
<#
  Genera un APK debug del panel admin (web-admin) para probar en smartphone.

  El telefono debe estar en la misma red WiFi que la PC donde corre la API.
  La API debe estar levantada: npm run start:dev (o solo dev:api).

  Uso:
    .\scripts\build-apk-admin.ps1
    .\scripts\build-apk-admin.ps1 -ApiUrl "http://192.168.0.50:3001"
#>
param(
    [string]$ApiUrl = ""
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$AdminDir = Join-Path $Root "apps\web-admin"
$OutDir = Join-Path $Root "release\apk"

function Get-LanIp {
    $addrs = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object {
            $_.IPAddress -notmatch '^127\.' -and
            $_.IPAddress -notmatch '^169\.254\.' -and
            $_.IPAddress -notmatch '^172\.(1[6-9]|2[0-9]|3[01])\.' -and
            $_.InterfaceAlias -notmatch 'vEthernet|WSL|VirtualBox|Loopback|Hyper-V'
        } |
        Sort-Object InterfaceMetric
    if ($addrs) { return $addrs[0].IPAddress }
    return "192.168.1.1"
}

function Ensure-AndroidPlatform {
    $androidDir = Join-Path $AdminDir "android"
    if (-not (Test-Path $androidDir)) {
        Write-Host "Agregando plataforma Android (Capacitor)..." -ForegroundColor Yellow
        Push-Location $AdminDir
        try {
            $prevEap = $ErrorActionPreference
            $ErrorActionPreference = "Continue"
            & npx cap add android 2>&1 | Out-Host
            $ErrorActionPreference = $prevEap
            if ($LASTEXITCODE -ne 0) { throw "cap add android fallo." }
        }
        finally {
            Pop-Location
        }
    }
    return $androidDir
}

function Enable-CleartextHttp([string]$AndroidDir) {
    $manifest = Join-Path $AndroidDir "app\src\main\AndroidManifest.xml"
    if (-not (Test-Path $manifest)) { return }
    $xml = Get-Content $manifest -Raw
    if ($xml -match 'usesCleartextTraffic') { return }
    $xml = $xml -replace '<application', '<application android:usesCleartextTraffic="true"'
    Set-Content -Path $manifest -Value $xml -NoNewline
    Write-Host "Habilitado HTTP cleartext en AndroidManifest (API local)." -ForegroundColor DarkGray
}

# --- SDK / Java ---
$sdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
if (-not (Test-Path $sdk)) {
    throw "No se encontro Android SDK. Instala Android Studio."
}
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
if (-not $env:JAVA_HOME) {
    $java = Get-Command java -ErrorAction SilentlyContinue
    if ($java) {
        $env:JAVA_HOME = (Resolve-Path (Join-Path (Split-Path $java.Source -Parent) "..")).Path
    }
}

if (-not $ApiUrl) {
    $ip = Get-LanIp
    $ApiUrl = "http://${ip}:3001"
}

Write-Host "=== Build APK - Sistema LCH Admin ===" -ForegroundColor Cyan
Write-Host "API URL embebida: $ApiUrl" -ForegroundColor Yellow
Write-Host "(El telefono y la PC deben estar en la misma red WiFi)" -ForegroundColor DarkGray
Write-Host ""

if (-not (Test-Path (Join-Path $Root "node_modules"))) {
    Write-Host "Instalando dependencias..." -ForegroundColor Yellow
    Push-Location $Root
    npm install
    Pop-Location
}

Write-Host ">> Compilando frontend..." -ForegroundColor Cyan
Push-Location $AdminDir
try {
    $env:VITE_API_URL = $ApiUrl
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "vite build fallo." }
}
finally {
    Pop-Location
}

$androidDir = Ensure-AndroidPlatform
Enable-CleartextHttp $androidDir

Write-Host ">> Sincronizando Capacitor..." -ForegroundColor Cyan
Push-Location $AdminDir
try {
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & npx cap sync android 2>&1 | Out-Host
    $ErrorActionPreference = $prevEap
    if ($LASTEXITCODE -ne 0) { throw "cap sync fallo." }
}
finally {
    Pop-Location
}

Write-Host ">> Compilando APK (debug)..." -ForegroundColor Cyan
Push-Location (Join-Path $androidDir)
try {
    if ($IsWindows -or $env:OS -match 'Windows') {
        .\gradlew.bat assembleDebug --no-daemon
    } else {
        ./gradlew assembleDebug --no-daemon
    }
    if ($LASTEXITCODE -ne 0) { throw "gradle assembleDebug fallo." }
}
finally {
    Pop-Location
}

$apkSrc = Join-Path $androidDir "app\build\outputs\apk\debug\app-debug.apk"
if (-not (Test-Path $apkSrc)) {
    throw "No se genero el APK en $apkSrc"
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$apkDst = Join-Path $OutDir "lch-admin-debug.apk"
Copy-Item $apkSrc $apkDst -Force

Write-Host ""
Write-Host "=== APK listo ===" -ForegroundColor Green
Write-Host "  $apkDst"
Write-Host ""
Write-Host "Para instalar en el telefono:" -ForegroundColor Cyan
Write-Host "  1. Copia el APK al celular (USB, Drive, etc.)"
Write-Host "  2. Activa 'Origenes desconocidas' si te lo pide"
Write-Host "  3. Abri el APK e instala"
Write-Host "  4. En la PC corre la API: npm run start:dev"
Write-Host "  5. Celular y PC en la misma WiFi"
Write-Host ""
