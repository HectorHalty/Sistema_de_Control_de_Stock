# Google Cloud — Guía fase 1 (Sistema LCH)

Camino oficial de deploy. **No usamos Oracle Cloud.**

Crédito nuevo GCP: **USD 300 por 90 días** (tarjeta requerida; no cobran si no excedés el trial).

Checklist corto: [CHECKLIST.md](./CHECKLIST.md)

---

## Parte 1 — Crear cuenta y proyecto

1. Entrá a https://console.cloud.google.com
2. Iniciá sesión con Google → **Get started for free**
3. Completá datos + tarjeta (verificación; no se cobra automáticamente el trial)
4. Creá un proyecto:
   - Arriba: selector de proyecto → **New project**
   - Name: `lch-prod` → **Create**

---

## Parte 2 — Crear la VM

1. Menú ☰ → **Compute Engine** → **VM instances**
2. Si pide, **Enable** la API (1–2 min)
3. **Create instance**

| Campo | Valor |
|-------|--------|
| **Name** | `lch-prod` |
| **Region** | `southamerica-east1` (São Paulo) |
| **Zone** | `southamerica-east1-b` (cualquiera de la región) |
| **Machine type** | `e2-medium` (2 vCPU, 4 GB) — ideal |
| | o `e2-small` (2 GB) justo para pruebas |
| **Boot disk** | **Change** → Ubuntu → **Ubuntu 22.04 LTS** → 30 GB |
| **Firewall** | ✅ Allow HTTP traffic |
| | ✅ Allow HTTPS traffic |

4. **Advanced options** → **Security** → **Add item** (SSH key) opcional:
   - En tu PC: `ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\lch-gcp" -N '""'`
   - Copiá el contenido de `lch-gcp.pub` en formato: `ubuntu:ssh-ed25519 AAAA...` (o tu usuario GCP)
5. **Create** (2–3 min hasta **Running**)

---

## Parte 3 — Firewall (seguro)

Menú ☰ → **VPC network** → **Firewall** → **Create firewall rule**

### SSH solo desde tu IP (recomendado)

| Campo | Valor |
|-------|--------|
| Name | `allow-ssh-myip` |
| Targets | All instances in the network |
| Source IPv4 | `TU_IP/32` (ver abajo) |
| Protocols | tcp:22 |

Tu IP en PowerShell:

```powershell
(Invoke-WebRequest -Uri "https://ifconfig.me/ip" -UseBasicParsing).Content.Trim()
```

HTTP/HTTPS: al marcar las casillas en la VM, GCP crea `default-allow-http` y `default-allow-https` (puertos 80 y 443).

**No abras** 3001, 5432, 6379, 8080, 9000.

---

## Parte 4 — Conectar por SSH

### Opción A — Desde el navegador (más fácil)

1. **Compute Engine** → **VM instances**
2. Clic en **SSH** junto a `lch-prod`
3. Se abre terminal en el navegador

### Opción B — Desde tu PC con gcloud

```powershell
winget install Google.CloudSDK
gcloud init
gcloud auth login
gcloud config set project lch-prod
gcloud compute ssh lch-prod --zone=southamerica-east1-b
```

### Opción C — SSH clásico con clave

```powershell
ssh -i "$env:USERPROFILE\.ssh\lch-gcp" TU_USUARIO@IP_EXTERNA
```

---

## Parte 5 — Deploy del sistema LCH

En la VM:

```bash
# Dependencias + Docker + firewall
sudo mkdir -p /opt/lch && sudo chown "$USER:$USER" /opt/lch
# Subí el repo (git clone o scp/rsync) a /opt/lch
cd /opt/lch && chmod +x deploy/*.sh
bash deploy/server-bootstrap.sh
```

Cerrá sesión SSH y volvé a entrar (grupo docker).

```bash
cd /opt/lch
cp .env.production.example .env.production
nano .env.production
```

Completar (sin `/` `:` `@` en passwords de Postgres/MinIO):

```env
ADMIN_DOMAIN=lachacrafutbol.duckdns.org
API_DOMAIN=lachacra-api.duckdns.org
VITE_API_URL=https://lachacra-api.duckdns.org
ALLOWED_ORIGINS=https://lachacrafutbol.duckdns.org,https://localhost,capacitor://localhost,http://localhost
# + JWT_SECRET, POSTGRES_PASSWORD, REDIS_PASSWORD, MINIO_...
```

```bash
./deploy/validate-env.sh
./deploy/deploy.sh
./deploy/seed-prod.sh
sudo bash deploy/install-caddy.sh
sudo cp deploy/Caddyfile.example /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile
sudo systemctl reload caddy
./deploy/smoke-test.sh
```

---

## Parte 6 — Dominio y HTTPS

DuckDNS (ya usado en el ejemplo) o registrador:

| Tipo | Nombre | Valor |
|------|--------|-------|
| A / DuckDNS | admin / `lachacrafutbol` | IP externa de la VM |
| A / DuckDNS | api / `lachacra-api` | IP externa de la VM |

---

## Parte 7 — Reservar IP estática (recomendado)

1. **VPC network** → **IP addresses** → **Reserve static address**
2. **Regional** → `southamerica-east1` → **Reserve**
3. **VM instances** → `lch-prod` → **Edit** → cambiar IP efímera por la estática

---

## Costos estimados (después del trial)

| Recurso | ~USD/mes |
|---------|----------|
| e2-medium 24/7 São Paulo | ~USD 25–35 |
| Disco 30 GB | ~USD 3 |
| Tráfico | bajo para uso interno |

Dentro de los **USD 300** del trial alcanza **varios meses** de e2-medium.

Alternativa barata después del trial: Hetzner / otro VPS — mismos scripts (`server-bootstrap.sh` + `deploy.sh`).

---

## Checklist

- [ ] Proyecto `lch-prod` creado
- [ ] VM Running (São Paulo, Ubuntu 22.04, e2-medium)
- [ ] HTTP + HTTPS firewall activos
- [ ] SSH restringido a tu IP (opcional)
- [ ] `server-bootstrap.sh` + `deploy.sh` OK
- [ ] IP estática reservada
- [ ] Dominio / DuckDNS apuntando a la IP
- [ ] Password admin cambiada

---

## Problemas frecuentes

| Problema | Solución |
|----------|----------|
| No puedo SSH | Revisá firewall `allow-ssh` y tu IP actual |
| `docker: permission denied` | Cerrá sesión SSH y volvé a entrar |
| Web no carga | Caddy corriendo + DNS propagado |
| Usuario SSH raro | Usá el botón **SSH** del navegador primero |
| MinIO unhealthy | Passwords MinIO sin `/ : @` |
