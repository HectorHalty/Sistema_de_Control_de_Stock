# Oracle Cloud — Guía fase 1 (Sistema LCH)

Tenancy: **hectormanuelhalty** · Región recomendada: **Brazil East (Sao Paulo)** ✓

---

## Parte 1 — Crear la VM (desde la pantalla que tenés)

### 1.1 Red (si es cuenta nueva)

1. En **Home → Build**, clic en **Set up a network with a wizard**
2. Dejá los valores por defecto (VCN pública + internet gateway)
3. Finalizá el wizard

> Si ya tenés una VCN de un intento anterior, saltá este paso.

### 1.2 Crear la instancia

1. Clic en **Create a VM instance** (o menú ☰ → **Compute** → **Instances** → **Create instance**)

| Campo | Valor |
|-------|--------|
| **Name** | `lch-prod` |
| **Compartment** | root (default) |
| **Placement** | Brazil East (Sao Paulo) |

**Image and shape:**

3. **Image:** `Canonical Ubuntu 22.04` (Minimal o standard)
4. Clic en **Change shape**
5. Seleccioná **Ampere** → **VM.Standard.A1.Flex** (Always Free-eligible)
6. **OCPUs:** `2` · **Memory (GB):** `12` (podés usar hasta 4 OCPU / 24 GB gratis en total)
7. **Confirm**

**Networking:**

8. **Primary VNIC:** dejá la VCN/subnet pública
9. **Public IPv4 address:** ✅ Assign a public IPv4 address

**SSH keys:**

10. **Generate a key pair** → **Save private key** (`lch-oracle.key`) — **no lo pierdas**
11. **Save public key** (opcional)

**Boot volume:**

12. **Size:** 50 GB (dentro del free tier)

13. **Create**

Esperá 1–3 min hasta **State: Running**. Anotá la **Public IP** (ej. `129.xxx.xxx.xxx`).

---

## Parte 2 — Abrir puertos en Oracle (Security List)

Oracle tiene **dos** firewalls: el de la nube y el del Ubuntu. Hay que abrir ambos.

### 2.1 Security List (consola web) — configuración segura

1. Menú ☰ → **Networking** → **Virtual cloud networks**
2. Entrá a **lch-vcn** → **Security Lists** → **Default Security List**

**Reglas de entrada recomendadas:**

| Source CIDR | Protocol | Port | Motivo |
|-------------|----------|------|--------|
| `TU_IP/32` | TCP | `22` | SSH **solo desde tu IP** (no `0.0.0.0/0`) |
| `0.0.0.0/0` | TCP | `80` | HTTP (Caddy + Let's Encrypt) |
| `0.0.0.0/0` | TCP | `443` | HTTPS (panel + API + APK) |

Obtener tu IP pública (desde tu PC):

```powershell
(Invoke-WebRequest -Uri "https://ifconfig.me/ip" -UseBasicParsing).Content.Trim()
```

Ejemplo: si tu IP es `181.47.123.89`, la regla SSH queda `181.47.123.89/32`.

**Editar la regla SSH existente (puerto 22):**

1. Menú **⋮** en la fila del puerto 22 → **Edit**
2. Cambiá **Source CIDR** de `0.0.0.0/0` → `TU_IP/32`
3. **Save**

> Si tu IP de internet cambia (4G, otro WiFi), actualizá esta regla o no podrás conectar por SSH.

**Reglas ICMP** (las que vienen por defecto): dejalas — son diagnóstico de red.

**Nunca abras al exterior:** 3001, 5432, 6379, 8080, 9000.

> Docker y Caddy escuchan en `127.0.0.1`; solo Caddy (80/443) recibe tráfico público.

---

## Parte 3 — Primer acceso SSH (desde tu PC Windows)

Guardá la clave privada, por ejemplo en `C:\Users\halty\.ssh\lch-oracle.key`.

```powershell
# Permisos (PowerShell como admin, una vez)
icacls "$env:USERPROFILE\.ssh\lch-oracle.key" /inheritance:r /grant:r "$env:USERNAME:R"

# Conectar (reemplazá IP)
ssh -i "$env:USERPROFILE\.ssh\lch-oracle.key" ubuntu@TU_IP_PUBLICA
```

Si pregunta `Are you sure you want to continue connecting?` → `yes`.

---

## Parte 4 — Bootstrap en la VM

### Opción A — Con el repo en GitHub

```bash
# En la VM (usuario ubuntu)
sudo mkdir -p /opt/lch && sudo chown ubuntu:ubuntu /opt/lch
git clone https://github.com/TU-USUARIO/TU-REPO.git /opt/lch
cd /opt/lch
chmod +x deploy/*.sh
bash deploy/oracle-bootstrap.sh
```

### Opción B — Subir archivos sin GitHub (SCP desde Windows)

```powershell
# Desde tu PC, en la carpeta del proyecto
scp -i "$env:USERPROFILE\.ssh\lch-oracle.key" -r "Stock La Chacra Futbol\Sistema_de_Control_de_Stock" ubuntu@TU_IP:/opt/lch
```

Luego en la VM:

```bash
cd /opt/lch
chmod +x deploy/*.sh
bash deploy/oracle-bootstrap.sh
```

**Importante:** después del bootstrap, **cerrá SSH y volvé a entrar** (para el grupo `docker`).

---

## Parte 5 — Configurar producción

```bash
cd /opt/lch
cp .env.production.example .env.production
nano .env.production   # o vim
```

Completá (ejemplo):

```env
ADMIN_DOMAIN=admin.tudominio.com
API_DOMAIN=api.tudominio.com

POSTGRES_PASSWORD=abc123soloLetrasYNumeros48chars
JWT_SECRET=<generar con node o openssl>
REDIS_PASSWORD=otraClaveSegura123
MINIO_ACCESS_KEY=lchminio01
MINIO_SECRET_KEY=otraClaveMinio123

ALLOWED_ORIGINS=https://admin.tudominio.com,https://localhost,capacitor://localhost
VITE_API_URL=https://api.tudominio.com
```

Generar JWT en la VM:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Validar y desplegar:

```bash
./deploy/validate-env.sh
./deploy/deploy.sh
./deploy/seed-prod.sh    # una vez — cambiar admin123 después
```

---

## Parte 6 — HTTPS con Caddy

```bash
sudo bash deploy/install-caddy.sh
sudo nano /etc/caddy/Caddyfile   # copiá desde deploy/Caddyfile.example y poné tus dominios
sudo systemctl reload caddy
```

Si aún no tenés dominio, podés probar por IP (solo HTTP local):

```bash
curl http://127.0.0.1:8080/
curl http://127.0.0.1:3001/health
```

Para HTTPS real necesitás dominio apuntando a la IP pública.

---

## Parte 7 — DNS (cuando tengas dominio)

En Cloudflare, DonWeb o NIC.ar:

| Tipo | Nombre | Valor |
|------|--------|-------|
| A | `admin` | IP pública de la VM |
| A | `api` | IP pública de la VM |

Esperá 5–30 min y probá:

```bash
./deploy/smoke-test.sh
```

---

## Parte 8 — Reservar IP (opcional pero recomendado)

La IP pública puede cambiar si recreás la VM.

1. Menú ☰ → **Networking** → **IP management** → **Reserved public IPs**
2. **Reserve public IP address**
3. Asociala a la instancia `lch-prod`

---

## Checklist rápido

- [ ] VM Ampere A1 Running (São Paulo)
- [ ] Security List: 22, 80, 443
- [ ] SSH funciona
- [ ] `oracle-bootstrap.sh` ejecutado
- [ ] Re-login SSH (docker sin sudo)
- [ ] `.env.production` completo
- [ ] `./deploy/deploy.sh` OK
- [ ] `./deploy/seed-prod.sh` + cambiar admin123
- [ ] Caddy + dominios
- [ ] Backup cron: `0 3 * * * /opt/lch/deploy/backup-db.sh`

---

## Problemas frecuentes

| Síntoma | Solución |
|---------|----------|
| No puedo crear Ampere A1 | Capacidad agotada en São Paulo — probá otra región o reintentá más tarde |
| SSH timeout | Revisá Security List puerto 22 y que la VM esté Running |
| Web no carga desde afuera | Ejecutá `sudo bash deploy/oracle-open-ports.sh` |
| `docker: permission denied` | Cerrá sesión SSH y volvé a entrar |
| API unhealthy | `docker compose -f docker-compose.prod.yml logs api` — revisá password sin `/` en POSTGRES_PASSWORD |
| Caddy no obtiene certificado | DNS debe apuntar a la IP antes de reload |

---

## Costos

Con **Always Free** (Ampere A1 dentro de límites + 50 GB boot volume): **USD 0/mes**.

Único costo recomendado: dominio ~USD 10/año.
