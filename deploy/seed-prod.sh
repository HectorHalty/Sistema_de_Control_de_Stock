#!/usr/bin/env bash
# Carga datos iniciales (categorías, depósitos, cocinas, usuario admin).
# Ejecutar UNA vez después del primer deploy. Cambiar password admin123 de inmediato.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "=== Seed producción ==="
echo "WARN: si no existe admin, crea admin / admin123 — cambiar password al terminar."
echo "      Si admin ya existe, NO toca la password."
read -r -p "¿Continuar? [y/N] " ans
if [[ "${ans:-}" != "y" && "${ans:-}" != "Y" ]]; then
  echo "Cancelado."
  exit 0
fi

$COMPOSE exec api node prisma/seed.cjs
echo "Seed completado."
echo "Si acabás de crear admin: entrá al panel y cambiá la password YA."
