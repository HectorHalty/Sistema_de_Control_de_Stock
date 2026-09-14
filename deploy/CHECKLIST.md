# Checklist de deploy — Fase 1 (Inventario + Ventas)

Camino oficial: **Google Cloud (o cualquier VPS Ubuntu)**. No usamos Oracle Cloud.

Guía detallada de la VM: [GCP.md](./GCP.md)

## Antes de subir

- [ ] Repo en la máquina local actualizado (`SistemaLCH`)
- [ ] Secretos listos (JWT ≥ 32 chars, passwords sin `/ : @`)
- [ ] Dominios DNS / DuckDNS apuntando a la IP de la VM
  - Admin: `lachacrafutbol.duckdns.org` (o el que uses)
  - API: `lachacra-api.duckdns.org`
- [ ] (Opcional) Probar local: `npm run test:deploy`

## En la VM (Ubuntu 22.04+)

```bash
# 1. Bootstrap (Docker, UFW, fail2ban)
bash deploy/server-bootstrap.sh
# cerrar SSH y volver a entrar

# 2. Código en /opt/lch
sudo mkdir -p /opt/lch && sudo chown "$USER:$USER" /opt/lch
# git clone … /opt/lch   Ó   rsync/scp del proyecto
cd /opt/lch
chmod +x deploy/*.sh

# 3. Env
cp .env.production.example .env.production
nano .env.production   # completar TODOS los change-me

# 4. Deploy
./deploy/validate-env.sh
./deploy/deploy.sh
./deploy/seed-prod.sh   # una vez; cambiar admin123 al entrar

# 5. HTTPS
sudo bash deploy/install-caddy.sh
sudo cp deploy/Caddyfile.example /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile   # confirmar dominios
sudo systemctl reload caddy

# 6. Verificar
./deploy/smoke-test.sh
curl -s https://lachacra-api.duckdns.org/health/ready
```

## Post-deploy

- [ ] Login en el panel admin y **cambiar password de admin**
- [ ] Crear usuario operador real
- [ ] Probar: producto → stock → venta → ticket
- [ ] Backup diario en cron:
  ```bash
  sudo mkdir -p /var/backups/lch
  # crontab -e
  # 0 3 * * * /opt/lch/deploy/backup-db.sh
  ```
- [ ] IP estática en GCP (recomendado)
- [ ] APK release solo después: `npm run build:apk:release` (con `VITE_API_URL` HTTPS)

## Qué incluye esta fase

| Servicio | Puerto local | Público |
|----------|--------------|---------|
| web-admin | 127.0.0.1:8080 | HTTPS admin |
| api | 127.0.0.1:3001 | HTTPS api |
| postgres / redis / minio | solo red Docker | no |

**No incluido aún:** sitio `web-public` (próxima fase).

## Si algo falla

| Síntoma | Qué mirar |
|---------|-----------|
| API no arranca | `docker compose -f docker-compose.prod.yml --env-file .env.production logs api --tail 80` |
| MinIO unhealthy | passwords MinIO sin `/ : @`; healthcheck usa `MC_HOST_local` |
| CORS / login APK | `ALLOWED_ORIGINS` con `https://localhost` y `capacitor://localhost` |
| HTTPS no levanta | DNS propagado + Caddy logs: `sudo journalctl -u caddy -n 50` |
