#!/usr/bin/env bash
# Endurece SSH y servicios en la VM Oracle (ejecutar una vez después del bootstrap).
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Ejecutar con sudo: sudo bash deploy/oracle-harden.sh"
  exit 1
fi

SSHD="/etc/ssh/sshd_config"
BACKUP="${SSHD}.bak.$(date +%Y%m%d)"

echo "=== LCH — Hardening Oracle VM ==="

cp "$SSHD" "$BACKUP"
echo "Backup SSH: $BACKUP"

harden_sshd() {
  local key="$1"
  local value="$2"
  if grep -qE "^[# ]*${key}[[:space:]]" "$SSHD"; then
    sed -i -E "s/^[# ]*${key}.*/${key} ${value}/" "$SSHD"
  else
    echo "${key} ${value}" >> "$SSHD"
  fi
}

harden_sshd "PermitRootLogin" "no"
harden_sshd "PasswordAuthentication" "no"
harden_sshd "KbdInteractiveAuthentication" "no"
harden_sshd "ChallengeResponseAuthentication" "no"
harden_sshd "X11Forwarding" "no"
harden_sshd "MaxAuthTries" "3"
harden_sshd "LoginGraceTime" "30"
harden_sshd "AllowUsers" "ubuntu"

systemctl reload sshd || systemctl reload ssh

echo ">> fail2ban (SSH)..."
mkdir -p /etc/fail2ban/jail.d
cat > /etc/fail2ban/jail.d/lch-sshd.local << 'EOF'
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
findtime = 600
bantime = 3600
EOF

systemctl enable fail2ban
systemctl restart fail2ban

echo ">> Actualizaciones automáticas de seguridad..."
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq unattended-upgrades apt-listchanges 2>/dev/null || true
dpkg-reconfigure -plow unattended-upgrades 2>/dev/null || true

echo ""
echo "=== Hardening completado ==="
echo "  - SSH: solo claves, sin root, max 3 intentos"
echo "  - fail2ban: ban 1h tras 3 fallos en 10 min"
echo ""
echo "IMPORTANTE: no cierres esta sesión hasta probar otra conexión SSH en otra terminal."
