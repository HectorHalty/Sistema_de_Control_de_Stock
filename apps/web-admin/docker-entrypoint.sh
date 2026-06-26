#!/bin/sh
# Inyecta la URL de la API en runtime (no depende del build de Vite).
set -e
API_URL="${LCH_API_URL:-${VITE_API_URL:-https://lachacra-api.duckdns.org}}"
HTML="/usr/share/nginx/html/index.html"
CONFIG="/usr/share/nginx/html/lch-config.js"

printf 'window.__LCH_API_URL__ = "%s";\n' "$API_URL" > "$CONFIG"

# Asegura que index.html cargue lch-config.js antes del bundle (idempotente).
if ! grep -q 'lch-config.js' "$HTML" 2>/dev/null; then
  sed -i 's|<script type="module"|<script src="/lch-config.js"></script><script type="module"|' "$HTML"
fi

echo "web-admin: LCH_API_URL=$API_URL"
exec nginx -g 'daemon off;'
