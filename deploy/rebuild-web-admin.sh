#!/usr/bin/env bash
# Reconstruye el panel web con la URL pública de la API (fix localhost en el navegador).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
ENV_FILE="${1:-$ROOT/.env.production}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: No existe $ENV_FILE"
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

if [[ -z "${VITE_API_URL:-}" ]]; then
  echo "ERROR: VITE_API_URL no está definido en $ENV_FILE"
  echo "  Ejemplo: VITE_API_URL=https://lachacra-api.duckdns.org"
  exit 1
fi

if [[ "${VITE_API_URL}" == *"127.0.0.1"* ]] || [[ "${VITE_API_URL}" == *"localhost"* ]]; then
  echo "ERROR: VITE_API_URL no puede ser localhost en producción."
  echo "  Valor actual: $VITE_API_URL"
  exit 1
fi

echo "=== Rebuild web-admin ==="
echo "VITE_API_URL=$VITE_API_URL"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file $ENV_FILE"
$COMPOSE build --no-cache web-admin --build-arg VITE_API_URL="$VITE_API_URL"
$COMPOSE up -d web-admin

echo ""
echo "Verificando bundle (no debe contener localhost:3001)..."
if $COMPOSE exec -T web-admin sh -c "grep -r 'localhost:3001' /usr/share/nginx/html/assets/ 2>/dev/null | head -1"; then
  echo "WARN: El bundle aún referencia localhost:3001 — revisá VITE_API_URL al compilar."
else
  echo "OK: Bundle sin localhost:3001"
fi

echo ""
echo "Listo. Abrí https://lachacrafutbol.duckdns.org y recargá con Ctrl+Shift+R"
