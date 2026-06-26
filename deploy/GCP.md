# Google Cloud — Guía fase 1 (Sistema LCH)

Crédito nuevo: **USD 300 por 90 días** (tarjeta requerida, no cobran si no excedés el trial).

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
   - Copiá el contenido de `lch-gcp.pub` en formato: `ubuntu:ssh-ed25519 AAAA...`
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

**No abras** 3001, 5432, 6379, 8080.

---

## Parte 4 — Conectar por SSH

### Opción A — Desde el navegador (más fácil)

1. **Compute Engine** → **VM instances**
2. Clic en **SSH** junto a `lch-prod`
3. Se abre terminal en el navegador (usuario `TU_USUARIO` o el que configuraste)

### Opción B — Desde tu PC con gcloud

1. Instalá Google Cloud CLI:
   ```powershell
   winget install Google.CloudSDK
   ```
2. Cerrá y abrí PowerShell:
   ```powershell
   gcloud init
   gcloud auth login
   gcloud config set project lch-prod
   ```
3. Conectar:
   ```powershell
   gcloud compute ssh lch-prod --zone=southamerica-east1-b
   ```

### Opción C — SSH clásico con clave

```powershell
ssh -i "$env:USERPROFILE\.ssh\lch-gcp" TU_USUARIO@IP_EXTERNA
```

La **IP externa** está en la lista de VM instances.

> En Ubuntu de GCP el usuario suele ser tu **email de Google** (sin @gmail.com) o el que pusiste en la metadata SSH.

---

## Parte 5 — Deploy del sistema LCH

En la VM (cualquier método SSH):

```bash
# Dependencias + Docker + firewall
curl -fsSL https://raw.githubusercontent.com/TU-USUARIO/TU-REPO/main/deploy/oracle-bootstrap.sh | bash
# — o si subiste el repo:
sudo mkdir -p /opt/lch && sudo chown $USER:$USER /opt/lch
git clone https://github.com/TU-USUARIO/TU-REPO.git /opt/lch
cd /opt/lch && chmod +x deploy/*.sh
bash deploy/oracle-bootstrap.sh
```

Cerrá sesión SSH y volvé a entrar (grupo docker).

```bash
cd /opt/lch
cp .env.production.example .env.production
nano .env.production
```

Completar (sin `/` en POSTGRES_PASSWORD):

```env
ADMIN_DOMAIN=admin.tudominio.com
API_DOMAIN=api.tudominio.com
VITE_API_URL=https://api.tudominio.com
ALLOWED_ORIGINS=https://admin.tudominio.com,https://localhost,capacitor://localhost
# + JWT, POSTGRES_PASSWORD, REDIS, MINIO...
```

```bash
./deploy/validate-env.sh
./deploy/deploy.sh
./deploy/seed-prod.sh
sudo bash deploy/install-caddy.sh
sudo cp deploy/Caddyfile.example /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

---

## Parte 6 — Dominio y HTTPS

En tu registrador (Cloudflare, DonWeb, NIC.ar):

| Tipo | Nombre | Valor |
|------|--------|-------|
| A | `admin` | IP externa de la VM |
| A | `api` | IP externa de la VM |

Smoke test:

```bash
./deploy/smoke-test.sh
```

---

## Parte 7 — Reservar IP estática (recomendado)

1. **VPC network** → **IP addresses** → **Reserve static address**
2. **Regional** → región `southamerica-east1` → **Reserve**
3. **VM instances** → `lch-prod` → **Edit** → **Network interfaces** → cambiar IP efímera por la estática

Así la IP no cambia al reiniciar la VM.

---

## Costos estimados (después del trial)

| Recurso | ~USD/mes |
|---------|----------|
| e2-medium 24/7 São Paulo | ~USD 25–35 |
| Disco 30 GB | ~USD 3 |
| Tráfico | bajo para uso interno |

Dentro de los **USD 300** del trial alcanza **varios meses** de e2-medium.

Para ahorrar después del trial: **e2-small** + monitorear RAM, o migrar a Hetzner.

---

## Checklist

- [ ] Proyecto `lch-prod` creado
- [ ] VM `lch-prod` Running (São Paulo, Ubuntu 22.04, e2-medium)
- [ ] HTTP + HTTPS firewall activos
- [ ] SSH restringido a tu IP (opcional)
- [ ] Conectado por SSH (navegador o gcloud)
- [ ] `oracle-bootstrap.sh` + `deploy.sh` OK
- [ ] IP estática reservada
- [ ] Dominio apuntando a la IP

---

## Problemas frecuentes

| Problema | Solución |
|----------|----------|
| No puedo SSH | Revisá firewall `allow-ssh` y tu IP actual |
| `docker: permission denied` | Cerrá sesión SSH y volvé a entrar |
| Web no carga | `sudo bash deploy/oracle-open-ports.sh` + Caddy corriendo |
| Usuario SSH raro | Usá el botón **SSH** del navegador primero |
