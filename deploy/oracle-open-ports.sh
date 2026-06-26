#!/usr/bin/env bash
# Abre puertos 80/443 en el firewall del SO (Oracle Ubuntu lo bloquea aunque el Security List esté OK).
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Ejecutar con sudo: sudo bash deploy/oracle-open-ports.sh"
  exit 1
fi

echo ">> Reglas iptables para HTTP/HTTPS..."

# Insertar antes de REJECT (Oracle Ubuntu usa rules.v4)
if iptables -C INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null; then
  echo "Puerto 80 ya permitido."
else
  iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
fi

if iptables -C INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null; then
  echo "Puerto 443 ya permitido."
else
  iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
fi

if command -v apt-get >/dev/null; then
  DEBIAN_FRONTEND=noninteractive apt-get install -y iptables-persistent netfilter-persistent 2>/dev/null || true
  netfilter-persistent save 2>/dev/null || iptables-save > /etc/iptables/rules.v4 2>/dev/null || true
fi

echo "OK: puertos 80 y 443 abiertos en el firewall del sistema."
