#!/usr/bin/env bash
# Parche urgente producción: trust proxy (rate limit) + CORS admin + rebuild API.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
ENV_FILE="${1:-$ROOT/.env.production}"
MAIN_TS="$ROOT/apps/api/src/main.ts"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: No existe $ENV_FILE"
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

echo "=== Fix producción LCH ==="

# .env mínimo para web + CORS
upsert_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}

upsert_env "VITE_API_URL" "https://lachacra-api.duckdns.org"
upsert_env "ADMIN_DOMAIN" "lachacrafutbol.duckdns.org"
upsert_env "API_DOMAIN" "lachacra-api.duckdns.org"
upsert_env "ALLOWED_ORIGINS" "https://lachacrafutbol.duckdns.org,https://localhost,capacitor://localhost,http://localhost"
upsert_env "AUTH_LIMIT_MAX" "200"
upsert_env "AUTH_LIMIT_WINDOW_MS" "900000"

echo ">> .env.production (claves relevantes):"
grep -E '^(VITE_API_URL|ADMIN_DOMAIN|ALLOWED_ORIGINS|AUTH_LIMIT_MAX|AUTH_LIMIT_WINDOW_MS)=' "$ENV_FILE"

# trust proxy en main.ts (si falta)
if [[ -f "$MAIN_TS" ]] && ! grep -q "trust proxy" "$MAIN_TS"; then
  echo ">> Aplicando parche trust proxy en apps/api/src/main.ts"
  sed -i '/const app = await NestFactory.create(AppModule);/a\
  if (process.env.NODE_ENV !== '\''production'\'' ? false : true) {\
    app.getHttpAdapter().getInstance().set('\''trust proxy'\'', 1);\
  }' "$MAIN_TS"
  # Simpler patch - use node or python if sed fails on multiline
fi

if [[ -f "$MAIN_TS" ]] && ! grep -q "trust proxy" "$MAIN_TS"; then
  echo "WARN: No se pudo parchear main.ts automáticamente."
  echo "  Agregá manualmente después de NestFactory.create:"
  echo "  app.getHttpAdapter().getInstance().set('trust proxy', 1);"
fi

COMPOSE="docker compose -f docker-compose.prod.yml --env-file $ENV_FILE"

echo ">> Rebuild API (rate limits SPA + trust proxy + CORS)..."
$COMPOSE build --no-cache api
$COMPOSE up -d api

echo ">> Rebuild web-admin (mensajes de error + URL API)..."
$COMPOSE build --no-cache web-admin
$COMPOSE up -d web-admin

echo ">> Esperando /health..."
for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:${API_PORT:-3001}/health" >/dev/null 2>&1; then
    echo "API healthy."
    break
  fi
  sleep 2
done

echo ">> Test CORS + rate limit desde admin web..."
CORS_HEADERS=$(curl -sI -X OPTIONS "https://lachacra-api.duckdns.org/auth/login" \
  -H "Origin: https://lachacrafutbol.duckdns.org" \
  -H "Access-Control-Request-Method: POST")
echo "$CORS_HEADERS" | grep -iE 'access-control-allow-origin|ratelimit-limit|HTTP/' || true
if echo "$CORS_HEADERS" | grep -q '429'; then
  echo "WARN: API respondió 429 — esperá ~15 min o reiniciá el contenedor api para limpiar el límite."
fi
if echo "$CORS_HEADERS" | grep -qi 'ratelimit-limit: 100'; then
  echo "ERROR: Sigue el rate limit viejo (100). Verificá que el rebuild de api usó el código nuevo."
  exit 1
fi

echo ""
echo "=== Listo ==="
echo "Recargá https://lachacrafutbol.duckdns.org con Ctrl+Shift+R"
echo "Si sigue fallando: sudo docker compose -f docker-compose.prod.yml --env-file .env.production logs api --tail 20"
