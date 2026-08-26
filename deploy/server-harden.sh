#!/usr/bin/env bash
# Endurece SSH en la VM (GCP / VPS). Ejecutar una vez después del bootstrap.
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Ejecutar con sudo: sudo bash deploy/server-harden.sh"
  exit 1
fi

SSHD="/etc/ssh/sshd_config"
BACKUP="${SSHD}.bak.$(date +%Y%m%d)"

echo "=== LCH — Hardening SSH ==="

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
# No forzamos AllowUsers: en GCP el usuario suele ser el de la cuenta Google, no "ubuntu".

systemctl reload sshd 2>/dev/null || systemctl reload ssh 2>/dev/null || true

echo ">> fail2ban (SSH)..."
mkdir -p /etc/fail2ban/jail.d
cat > /etc/fail2ban/jail.d/sshd.local <<'EOF'
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 4
bantime = 1h
EOF
systemctl enable fail2ban 2>/dev/null || true
systemctl restart fail2ban 2>/dev/null || true

echo "OK: SSH endurecido (solo claves; root login deshabilitado)."
