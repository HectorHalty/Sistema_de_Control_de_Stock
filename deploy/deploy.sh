#!/usr/bin/env bash
# Despliegue de producción — Fase 1 (inventario + ventas)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "=== LCH — Deploy producción ==="

bash "$ROOT/deploy/validate-env.sh"

echo ">> Construyendo e iniciando servicios..."
$COMPOSE up -d --build

echo ">> Esperando health check de la API..."
for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:${API_PORT:-3001}/health" >/dev/null 2>&1; then
    echo "API healthy."
    break
  fi
  if [[ "$i" -eq 30 ]]; then
    echo "ERROR: API no respondió a /health"
    $COMPOSE logs api --tail 50
    exit 1
  fi
  sleep 2
done

echo ">> Smoke test..."
bash "$ROOT/deploy/smoke-test.sh"

echo ""
echo "=== Deploy completado ==="
echo "  Admin (local): http://127.0.0.1:${ADMIN_PORT:-8080}"
echo "  API  (local):  http://127.0.0.1:${API_PORT:-3001}/health"
echo ""
echo "Próximos pasos:"
echo "  1. Configurar Caddy: sudo cp deploy/Caddyfile.example /etc/caddy/Caddyfile"
echo "  2. Datos iniciales:  ./deploy/seed-prod.sh"
echo "  3. Cambiar password del usuario admin inmediatamente"
