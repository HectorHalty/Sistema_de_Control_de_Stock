#!/usr/bin/env bash
# Bootstrap inicial en una VM Ubuntu 22.04+ (Google Cloud u otro VPS).
#   bash deploy/server-bootstrap.sh
set -euo pipefail

echo "=== LCH — Bootstrap servidor (GCP / VPS) ==="

if [[ $EUID -eq 0 ]]; then
  echo "No ejecutar como root. Usá tu usuario normal (con sudo)."
  exit 1
fi

echo ">> Actualizando sistema..."
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq

echo ">> Instalando dependencias..."
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
  git curl ca-certificates ufw fail2ban

echo ">> Instalando Docker..."
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
  echo "Docker instalado. Cerrá sesión SSH y volvé a entrar para usar docker sin sudo."
fi

echo ">> Firewall UFW (SSH + HTTP + HTTPS)..."
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
echo "y" | sudo ufw enable || true

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/server-harden.sh" ]]; then
  echo ">> Endureciendo SSH..."
  sudo bash "$SCRIPT_DIR/server-harden.sh"
fi

sudo systemctl enable fail2ban 2>/dev/null || true

echo ""
echo "=== Bootstrap completado ==="
echo ""
echo "Próximos pasos:"
echo "  1. Cerrar sesión SSH y volver a entrar (grupo docker)"
echo "  2. sudo mkdir -p /opt/lch && sudo chown \$USER:\$USER /opt/lch"
echo "     git clone <URL-DEL-REPO> /opt/lch && cd /opt/lch"
echo "     # o subir el proyecto por scp/rsync"
echo "  3. cp .env.production.example .env.production  # completar secretos"
echo "  4. ./deploy/deploy.sh"
echo "  5. ./deploy/seed-prod.sh"
echo "  6. sudo bash deploy/install-caddy.sh"
echo "  7. sudo cp deploy/Caddyfile.example /etc/caddy/Caddyfile  # editar dominios"
echo "  8. sudo systemctl reload caddy"
echo ""
echo "Guía: deploy/GCP.md · Checklist: deploy/CHECKLIST.md"
