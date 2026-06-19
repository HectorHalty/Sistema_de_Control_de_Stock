#!/usr/bin/env bash
# Instala Caddy en Ubuntu/Debian para HTTPS automático (Let's Encrypt).
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Ejecutar con sudo: sudo bash deploy/install-caddy.sh"
  exit 1
fi

apt-get update
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl

curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list

apt-get update
apt-get install -y caddy

systemctl enable caddy
echo ""
echo "Caddy instalado. Copiá tu Caddyfile:"
echo "  cp deploy/Caddyfile.example /etc/caddy/Caddyfile"
echo "  systemctl reload caddy"
