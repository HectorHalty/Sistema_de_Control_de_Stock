#!/usr/bin/env bash
# Bootstrap inicial en una VM Oracle Cloud (Ubuntu 22.04).
# Ejecutar como usuario ubuntu después del primer SSH:
#   curl -fsSL <raw-url>/deploy/oracle-bootstrap.sh | bash
#   — o, con el repo clonado:
#   bash deploy/oracle-bootstrap.sh
set -euo pipefail

echo "=== LCH — Bootstrap Oracle Cloud ==="

if [[ $EUID -eq 0 ]]; then
  echo "No ejecutar como root. Usá el usuario ubuntu."
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
if [[ -f "$SCRIPT_DIR/oracle-open-ports.sh" ]]; then
  sudo bash "$SCRIPT_DIR/oracle-open-ports.sh"
else
  echo "WARN: oracle-open-ports.sh no encontrado — ejecutalo manualmente después."
fi

sudo systemctl enable fail2ban 2>/dev/null || true

if [[ -f "$SCRIPT_DIR/oracle-harden.sh" ]]; then
  echo ">> Endureciendo SSH (oracle-harden)..."
  sudo bash "$SCRIPT_DIR/oracle-harden.sh"
fi

echo ""
echo "=== Bootstrap completado ==="
echo ""
echo "Próximos pasos:"
echo "  1. Cerrar sesión SSH y volver a entrar (grupo docker)"
echo "  2. Clonar el repo:  sudo mkdir -p /opt/lch && sudo chown \$USER:\$USER /opt/lch"
echo "     git clone <URL-DEL-REPO> /opt/lch && cd /opt/lch"
echo "  3. cp .env.production.example .env.production  # completar secretos"
echo "  4. ./deploy/deploy.sh"
echo "  5. sudo bash deploy/install-caddy.sh"
echo "  6. sudo cp deploy/Caddyfile.example /etc/caddy/Caddyfile  # editar dominios"
echo "  7. sudo systemctl reload caddy"
echo ""
echo "Guía completa: deploy/ORACLE.md"
