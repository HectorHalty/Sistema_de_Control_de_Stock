#!/usr/bin/env bash
# Verificaciones post-deploy (localhost o dominios públicos).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env.production ]]; then
  # shellcheck disable=SC1091
  source .env.production
fi

API_LOCAL="http://127.0.0.1:${API_PORT:-3001}"
ADMIN_LOCAL="http://127.0.0.1:${ADMIN_PORT:-8080}"

fail=0

check() {
  local label="$1"
  local url="$2"
  local expect="${3:-200}"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" "$url" || echo "000")
  if [[ "$code" == "$expect" ]]; then
    echo "  OK  $label ($code)"
  else
    echo "  FAIL $label (esperado $expect, obtuvo $code) — $url"
    fail=$((fail + 1))
  fi
}

echo "Smoke tests (local):"

check "API /health" "$API_LOCAL/health"
check "Admin index" "$ADMIN_LOCAL/"

if [[ -n "${API_DOMAIN:-}" && "$API_DOMAIN" != "api.lachacra.com" ]]; then
  echo ""
  echo "Smoke tests (público):"
  check "API HTTPS" "https://${API_DOMAIN}/health"
  check "Admin HTTPS" "https://${ADMIN_DOMAIN:-admin.example.com}/"
  check "Swagger bloqueado" "https://${API_DOMAIN}/api/docs" "404"
fi

if [[ "$fail" -gt 0 ]]; then
  echo ""
  echo "Smoke test falló: $fail error(es)"
  exit 1
fi

echo ""
echo "Smoke test OK."
