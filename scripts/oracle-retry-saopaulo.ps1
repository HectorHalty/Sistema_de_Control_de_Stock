# Oracle Cloud - Reintentos automaticos (Sao Paulo, A1.Flex)
#
# Modo recordatorio:
#   .\scripts\oracle-retry-saopaulo.ps1 -ReminderOnly
#
# Modo OCI CLI (ver deploy/ORACLE-RETRY.md):
#   .\scripts\oracle-retry-saopaulo.ps1

#Requires -Version 5.1
param(
    [switch]$ReminderOnly,
    [int]$IntervalMinutes = 30,
    [int]$MaxAttempts = 0,
    [string]$ConfigFile = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$DefaultConfig = Join-Path $Root "scripts\oracle-retry.config.ps1"
if (-not $ConfigFile) { $ConfigFile = $DefaultConfig }

function Write-Log {
    param([string]$Msg, [string]$Color = "Cyan")
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$ts] $Msg" -ForegroundColor $Color
}

function Test-OciCli {
    return $null -ne (Get-Command oci -ErrorAction SilentlyContinue)
}

function Invoke-ReminderLoop {
    param([int]$Minutes, [int]$Max)
    $n = 0
    Write-Log "Modo recordatorio: cada $Minutes min. Abri Oracle Cloud y Create instance." "Yellow"
    Write-Log "Region: Brazil East (Sao Paulo) | Shape: A1.Flex 1/6 | Fault domain: Let Oracle choose" "DarkGray"
    while ($true) {
        $n++
        if ($Max -gt 0 -and $n -gt $Max) { break }
        Write-Log "Intento $n - ANDA A ORACLE CLOUD Y CLIC EN CREATE" "Green"
        [console]::Beep(800, 300)
        Start-Sleep -Seconds ($Minutes * 60)
    }
}

function Invoke-OciLaunch {
    param($Cfg)
    $shapeConfig = "{ `"ocpus`": $($Cfg.Ocpus), `"memoryInGBs`": $($Cfg.MemoryGB) }"
    $ociArgs = @(
        "compute", "instance", "launch",
        "--availability-domain", $Cfg.AvailabilityDomain,
        "--compartment-id", $Cfg.CompartmentId,
        "--shape", "VM.Standard.A1.Flex",
        "--shape-config", $shapeConfig,
        "--subnet-id", $Cfg.SubnetId,
        "--image-id", $Cfg.ImageId,
        "--display-name", $Cfg.DisplayName,
        "--assign-public-ip", "true"
    )
    if ($Cfg.SshPublicKeyPath -and (Test-Path $Cfg.SshPublicKeyPath)) {
        $ociArgs += "--ssh-authorized-keys-file"
        $ociArgs += $Cfg.SshPublicKeyPath
    }
    if ($Cfg.FaultDomain) {
        $ociArgs += "--fault-domain"
        $ociArgs += $Cfg.FaultDomain
    }
    $out = & oci @ociArgs 2>&1
    return @{ ExitCode = $LASTEXITCODE; Output = ($out | Out-String) }
}

function Invoke-OciRetryLoop {
    param($Cfg, [int]$Minutes, [int]$Max)
    $n = 0
    Write-Log "Modo OCI CLI - reintentos cada $Minutes min" "Yellow"
    while ($true) {
        $n++
        if ($Max -gt 0 -and $n -gt $Max) {
            Write-Log "Maximo de intentos alcanzado ($Max)." "Red"
            break
        }
        Write-Log "Intento $n - lanzando instancia $($Cfg.DisplayName)..." "Cyan"
        $result = Invoke-OciLaunch -Cfg $Cfg
        if ($result.ExitCode -eq 0) {
            Write-Log "INSTANCIA CREADA" "Green"
            Write-Host $result.Output
            break
        }
        $err = $result.Output
        if ($err -match "Out of capacity|OutOfCapacity|500") {
            Write-Log "Sin capacidad - proximo intento en $Minutes min" "DarkYellow"
        } else {
            Write-Log "Error (revisar config):" "Red"
            Write-Host $err
            break
        }
        Start-Sleep -Seconds ($Minutes * 60)
    }
}

Write-Log "=== LCH - Retry capacidad Oracle (Sao Paulo) ==="

if ($ReminderOnly -or -not (Test-Path $ConfigFile)) {
    if (-not (Test-Path $ConfigFile) -and -not $ReminderOnly) {
        Write-Log "No existe config - modo recordatorio." "Yellow"
        Write-Log "Para auto-crear: copia scripts\oracle-retry.config.example.ps1 a oracle-retry.config.ps1" "DarkGray"
    }
    Invoke-ReminderLoop -Minutes $IntervalMinutes -Max $MaxAttempts
    exit 0
}

if (-not (Test-OciCli)) {
    Write-Log "OCI CLI no instalado. Usa -ReminderOnly." "Red"
    Invoke-ReminderLoop -Minutes $IntervalMinutes -Max $MaxAttempts
    exit 1
}

. $ConfigFile
Invoke-OciRetryLoop -Cfg $script:OracleRetryConfig -Minutes $IntervalMinutes -Max $MaxAttempts
