# Reintentos automáticos — São Paulo sin capacidad A1.Flex

Cuando Oracle responde **Out of capacity**, este flujo reintenta cada 30 minutos.

---

## Modo rápido (sin instalar nada)

En PowerShell, desde la carpeta del proyecto:

```powershell
cd "Stock La Chacra Futbol\Sistema_de_Control_de_Stock"
.\scripts\oracle-retry-saopaulo.ps1 -ReminderOnly -IntervalMinutes 30
```

Cada 30 min suena un beep y te avisa para ir a la consola y clic **Create**.

**En la consola, siempre:**
- Región: **Brazil East (Sao Paulo)**
- Shape: **A1.Flex · 1 OCPU · 6 GB** (o 2/8 si entra)
- Fault domain: **Let Oracle choose** (no elijas FD-1 fijo)
- Resto igual que antes (Ubuntu, lch-vcn, IP pública, SSH)

Dejá la ventana de PowerShell abierta. Mejor horarios: **2–6 AM AR**, domingos.

---

## Modo automático (OCI CLI)

### 1. Instalar OCI CLI (Windows)

```powershell
winget install Oracle.OCI.CLI
# o: pip install oci-cli
```

Cerrá y abrí PowerShell. Probá: `oci --version`

### 2. Configurar API keys

1. Consola Oracle → avatar (arriba derecha) → **My profile**
2. **API keys** → **Add API key** → **Generate API key pair**
3. Descargá la clave privada → `C:\Users\halty\.oci\oci_api_key.pem`
4. Copiá el **Configuration file preview** que muestra Oracle
5. Guardalo en `C:\Users\halty\.oci\config`:

```ini
[DEFAULT]
user=ocid1.user.oc1..aaaa...
fingerprint=xx:xx:...
tenancy=ocid1.tenancy.oc1..aaaa...
region=sa-saopaulo-1
key_file=C:\Users\halty\.oci\oci_api_key.pem
```

### 3. Obtener OCIDs

Con CLI configurado:

```powershell
# Compartment (root)
oci iam compartment list --compartment-id-in-subtree true --query "data[?name=='hectormanuelhalty'].id | [0]" --raw-output

# Subnet pública
oci network subnet list --compartment-id COMPARTMENT_OCID --query "data[?\"display-name\"=='public subnet-lch-vcn'].id | [0]" --raw-output

# Imagen Ubuntu 22.04 ARM64
oci compute image list --compartment-id COMPARTMENT_OCID --operating-system "Canonical Ubuntu" --operating-system-version "22.04" --shape "VM.Standard.A1.Flex" --query "data[0].id" --raw-output
```

### 4. Config del retry

```powershell
copy scripts\oracle-retry.config.example.ps1 scripts\oracle-retry.config.ps1
notepad scripts\oracle-retry.config.ps1
```

Pegá los OCIDs. La clave SSH pública debe existir:

```powershell
# Si solo tenés la privada descargada de Oracle, generá el .pub:
ssh-keygen -y -f "$env:USERPROFILE\.ssh\lch-oracle.key" > "$env:USERPROFILE\.ssh\lch-oracle.pub"
```

Agregá `scripts\oracle-retry.config.ps1` al `.gitignore` si tiene OCIDs (opcional).

### 5. Ejecutar retry automático

```powershell
.\scripts\oracle-retry-saopaulo.ps1 -IntervalMinutes 30
```

Cuando entre capacidad, crea la instancia solo y muestra el OCID.

IP pública:

```powershell
oci compute instance list-vnics --instance-id INSTANCE_OCID --query "data[0].\"public-ip\"" --raw-output
```

---

## Cuando entre

1. Anotá la **IP pública**
2. SSH: `ssh -i ~/.ssh/lch-oracle.key ubuntu@IP`
3. Seguí `deploy/ORACLE.md` (bootstrap + deploy)

---

## Tips

| Tip | Detalle |
|-----|---------|
| Intervalo | 30 min default; `-IntervalMinutes 15` más agresivo |
| Límite | `-MaxAttempts 48` = 24 h de reintentos |
| Parar | Ctrl+C en PowerShell |
| Shape | Empezá 1/6; si crea, podés recrear después con 2/8 |
