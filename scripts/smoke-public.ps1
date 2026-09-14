# Smoke test - web publica + auth + QR redeem (requiere API :3001, DB seed, admin admin123)
param(
    [string]$ApiBase = 'http://127.0.0.1:3001'
)

$ErrorActionPreference = 'Stop'

function Invoke-Json {
    param([string]$Method, [string]$Path, [object]$Body, [string]$Token)
    $headers = @{ 'Content-Type' = 'application/json' }
    if ($Token) { $headers['Authorization'] = "Bearer $Token" }
    $params = @{
        Uri = "$ApiBase$Path"
        Method = $Method
        Headers = $headers
    }
    if ($Body) { $params.Body = ($Body | ConvertTo-Json -Compress) }
    return Invoke-RestMethod @params
}

function Invoke-JsonExpectFail {
    param([string]$Method, [string]$Path, [object]$Body, [string]$Token)
    try {
        Invoke-Json -Method $Method -Path $Path -Body $Body -Token $Token | Out-Null
        return $false
    }
    catch {
        return $true
    }
}

function Get-JsonArrayCount {
    param($Value)
    if ($null -eq $Value) { return 0 }
    if ($Value -is [System.Array]) { return $Value.Count }
    return 1
}

Write-Host "=== Smoke web publica ===" -ForegroundColor Cyan

try {
    Invoke-RestMethod -Uri "$ApiBase/health" -Method Get | Out-Null
    Write-Host "OK  API health" -ForegroundColor Green
}
catch {
    Write-Host "FAIL API no responde en $ApiBase" -ForegroundColor Red
    exit 1
}

$menu = Invoke-Json -Method GET -Path '/public/menu'
$itemCount = @($menu.items).Count
if ($itemCount -lt 1) {
    Write-Host "WARN Menu vacio - corre prisma db seed" -ForegroundColor Yellow
}
else {
    Write-Host "OK  Menu ($itemCount productos)" -ForegroundColor Green
}

$loginCap = Invoke-Json -Method POST -Path '/public/auth/login' -Body @{
    email = 'capitan@lachacra.test'
    password = 'capitan123'
}
if ($loginCap.user.rol -ne 'capitan') {
    throw "Login capitan: rol esperado capitan, obtuvo $($loginCap.user.rol)"
}
Write-Host "OK  Login capitan (rol=$($loginCap.user.rol))" -ForegroundColor Green

$loginJug = Invoke-Json -Method POST -Path '/public/auth/login' -Body @{
    email = 'jugador@lachacra.test'
    password = 'jugador123'
}
if ($loginJug.user.rol -ne 'jugador') {
    throw "Login jugador: rol esperado jugador, obtuvo $($loginJug.user.rol)"
}
Write-Host "OK  Login jugador (rol=$($loginJug.user.rol))" -ForegroundColor Green

$registerEmail = "nuevo.smoke.$(Get-Date -Format 'yyyyMMddHHmmss')@lachacra.test"
$register = Invoke-Json -Method POST -Path '/public/auth/register' -Body @{
    email = $registerEmail
    password = 'test123456'
    nombre = 'Usuario Smoke'
    dni = "$(Get-Random -Minimum 40000000 -Maximum 49999999)"
}
if (-not $register.accessToken) { throw 'Register sin accessToken' }
Write-Host "OK  Register nuevo usuario ($registerEmail)" -ForegroundColor Green

$qrToken = $null
if ($itemCount -ge 1) {
    $productId = $menu.items[0].id
    $order = Invoke-Json -Method POST -Path '/public/orders/checkout' -Token $loginJug.accessToken -Body @{
        items = @(@{ salesProductId = $productId; quantity = 1 })
        idempotencyKey = "smoke-$(Get-Date -Format 'yyyyMMddHHmmss')"
    }
    if (-not $order.qr.token) { throw 'Checkout sin token QR' }
    $qrToken = $order.qr.token
    Write-Host "OK  Checkout + QR ($qrToken)" -ForegroundColor Green
}

$admin = Invoke-Json -Method POST -Path '/auth/login' -Body @{
    username = 'admin'
    password = 'admin123'
}
$adminToken = if ($admin.accessToken) { $admin.accessToken } else { $admin.access_token }
if (-not $adminToken) { throw 'Admin login fallo' }
Write-Host "OK  Login admin" -ForegroundColor Green

$torneosPublicCount = Get-JsonArrayCount (Invoke-Json -Method GET -Path '/public/torneos')
if ($torneosPublicCount -lt 1) {
    throw "GET /public/torneos: se esperaba al menos 1 torneo publicado, obtuvo $torneosPublicCount"
}
Write-Host "OK  Torneos publicos ($torneosPublicCount publicados)" -ForegroundColor Green

$torneoDetail = Invoke-Json -Method GET -Path '/public/torneo?categoria=hombres_libre_a'
if (-not $torneoDetail.torneo) { throw 'GET /public/torneo?categoria=hombres_libre_a sin torneo' }
if ($torneoDetail.torneo.categoria -notmatch 'Libre A') {
    throw "Torneo por categoria: esperado Libre A, obtuvo $($torneoDetail.torneo.categoria)"
}
Write-Host "OK  Torneo publico por categoria (Libre A, posiciones=$(@($torneoDetail.standings).Count))" -ForegroundColor Green

$torneosAdminCount = Get-JsonArrayCount (Invoke-Json -Method GET -Path '/football/torneos' -Token $adminToken)
if ($torneosAdminCount -lt 8) {
    throw "GET /football/torneos: se esperaban 8 categorias, obtuvo $torneosAdminCount"
}
Write-Host "OK  Torneos admin ($torneosAdminCount categorias bootstrap)" -ForegroundColor Green

if ($qrToken) {
    $redeem = Invoke-Json -Method POST -Path '/online/redeem-qr' -Token $adminToken -Body @{
        token = $qrToken
    }
    Write-Host "OK  QR redeem (pedido $($redeem.pedido.id))" -ForegroundColor Green

    $failed = Invoke-JsonExpectFail -Method POST -Path '/online/redeem-qr' -Token $adminToken -Body @{
        token = $qrToken
    }
    if (-not $failed) { throw 'QR deberia rechazar segundo canje' }
    Write-Host "OK  QR no reutilizable" -ForegroundColor Green
}

Write-Host ""
Write-Host "Smoke web publica OK." -ForegroundColor Green
