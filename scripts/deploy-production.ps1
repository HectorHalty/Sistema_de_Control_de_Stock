#Requires -Version 5.1
<#
  Despliega el fix de producción en el VPS (API rate limit + web-admin nuevo).
  Requiere SSH al servidor donde corre Docker.

  Ejemplo:
    .\scripts\deploy-production.ps1 -SshTarget "ubuntu@34.39.195.237"
    .\scripts\deploy-production.ps1 -SshTarget "usuario@lch-prod" -RemoteDir "/home/ubuntu/Sistema_de_Control_de_Stock"
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$SshTarget,
    [string]$RemoteDir = "~/Sistema_de_Control_de_Stock"
)

$ErrorActionPreference = "Stop"

Write-Host "=== LCH — Deploy remoto ===" -ForegroundColor Cyan
Write-Host "Servidor: $SshTarget"
Write-Host "Directorio: $RemoteDir"
Write-Host ""

$remoteCmd = @"
set -euo pipefail
cd $RemoteDir
echo '>> git pull...'
git pull
echo '>> fix producción (rebuild api + web-admin)...'
bash deploy/fix-production-now.sh
echo '>> rate limit header (debe ser 1000, no 100):'
curl -sI -X OPTIONS 'https://lachacra-api.duckdns.org/auth/login' \
  -H 'Origin: https://lachacrafutbol.duckdns.org' \
  -H 'Access-Control-Request-Method: POST' | grep -i 'ratelimit-limit\|access-control-allow-origin' || true
"@

ssh $SshTarget $remoteCmd

Write-Host ""
Write-Host "Listo. Abrí https://lachacrafutbol.duckdns.org y recargá con Ctrl+Shift+R" -ForegroundColor Green
