#!/usr/bin/env bash
# Carga datos iniciales (categorías, depósitos, cocinas, usuario admin).
# Ejecutar UNA vez después del primer deploy. Cambiar password admin123 de inmediato.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "=== Seed producción ==="
echo "WARN: crea usuario admin / admin123 — cambiar password al terminar."
read -r -p "¿Continuar? [y/N] " ans
if [[ "${ans:-}" != "y" && "${ans:-}" != "Y" ]]; then
  echo "Cancelado."
  exit 0
fi

$COMPOSE exec api npx --yes tsx prisma/seed.ts
echo "Seed completado."
