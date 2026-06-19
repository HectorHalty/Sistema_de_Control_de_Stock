#!/usr/bin/env bash
# Valida .env.production antes de desplegar.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${1:-$ROOT/.env.production}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: No existe $ENV_FILE"
  echo "  cp .env.production.example .env.production"
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

errors=0

check_required() {
  local name="$1"
  local value="${!name:-}"
  if [[ -z "$value" ]]; then
    echo "ERROR: $name no está definido"
    errors=$((errors + 1))
  fi
}

check_not_default() {
  local name="$1"
  local value="${!name:-}"
  local pattern="$2"
  if [[ "$value" == *"$pattern"* ]]; then
    echo "ERROR: $name sigue con valor de ejemplo ($pattern)"
    errors=$((errors + 1))
  fi
}

check_required POSTGRES_PASSWORD
check_required JWT_SECRET
check_required REDIS_PASSWORD
check_required MINIO_ACCESS_KEY
check_required MINIO_SECRET_KEY
check_required VITE_API_URL
check_required ALLOWED_ORIGINS

check_not_default POSTGRES_PASSWORD "change-me"
check_not_default JWT_SECRET "change-me"
check_not_default REDIS_PASSWORD "change-me"
check_not_default MINIO_ACCESS_KEY "change-me"
check_not_default MINIO_SECRET_KEY "change-me"

if [[ "${JWT_SECRET:-}" != "" && ${#JWT_SECRET} -lt 32 ]]; then
  echo "ERROR: JWT_SECRET debe tener al menos 32 caracteres (tiene ${#JWT_SECRET})"
  errors=$((errors + 1))
fi

if [[ "${POSTGRES_PASSWORD:-}" =~ [/:@] ]]; then
  echo "ERROR: POSTGRES_PASSWORD contiene /, : o @ — invalida DATABASE_URL. Usá solo letras/números."
  errors=$((errors + 1))
fi

if [[ "${VITE_API_URL:-}" != https://* ]]; then
  echo "WARN: VITE_API_URL no usa HTTPS — la APK en producción debería usar https://"
fi

if [[ "${ALLOWED_ORIGINS:-}" != *"capacitor://localhost"* ]]; then
  echo "WARN: ALLOWED_ORIGINS no incluye capacitor://localhost (requerido para APK)"
fi

if [[ "$errors" -gt 0 ]]; then
  echo ""
  echo "Validación fallida con $errors error(es)."
  exit 1
fi

echo "OK: $ENV_FILE válido para producción."
