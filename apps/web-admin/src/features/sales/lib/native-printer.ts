import { Capacitor } from '@capacitor/core';
import { ESCPOSProxy } from 'esc-pos-proxy-capacitor-plugin';

export type NativePrintResult = { ok: true } | { ok: false; error: string };

/** Impresión LAN directa desde APK (Android/iOS). En web siempre false. */
export function isNativeLanPrinting(): boolean {
  return Capacitor.isNativePlatform();
}

const PRIVATE_IPV4 =
  /^(?:10\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|172\.(?:1[6-9]|2\d|3[01])\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|192\.168\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?))$/;

export function isPrivateLanIp(ip: string): boolean {
  return PRIVATE_IPV4.test(ip.trim());
}

function friendlyNativeError(err: unknown, ip: string, port: number): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/timeout|timed out/i.test(msg)) {
    return `Tiempo de espera agotado conectando a ${ip}:${port}. Verificá que la tablet esté en el WiFi del club.`;
  }
  if (/refused|ECONNREFUSED/i.test(msg)) {
    return `La impresora rechazó la conexión en ${ip}:${port}.`;
  }
  if (/unreachable|Network/i.test(msg)) {
    return `No se alcanza ${ip}. La tablet debe estar en la misma red que la impresora.`;
  }
  return msg || `No se pudo conectar a ${ip}:${port}.`;
}

export async function nativePingPrinter(ip: string, port: number): Promise<NativePrintResult> {
  if (!isPrivateLanIp(ip)) {
    return {
      ok: false,
      error: `La IP ${ip} no es de red local. Configurá la impresora en 192.168.x.x.`,
    };
  }
  try {
    const { online } = await ESCPOSProxy.ping({ ip, port });
    if (online) return { ok: true };
    return {
      ok: false,
      error: `No responde ${ip}:${port}. Verificá que la impresora esté encendida y en el WiFi del club.`,
    };
  } catch (err) {
    return { ok: false, error: friendlyNativeError(err, ip, port) };
  }
}

export async function nativePrintEscPos(
  ip: string,
  port: number,
  base64Payload: string,
): Promise<NativePrintResult> {
  if (!isPrivateLanIp(ip)) {
    return {
      ok: false,
      error: `La IP ${ip} no es de red local. Configurá la impresora en 192.168.x.x.`,
    };
  }
  try {
    await ESCPOSProxy.print({ ip, port, message: base64Payload });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendlyNativeError(err, ip, port) };
  }
}
