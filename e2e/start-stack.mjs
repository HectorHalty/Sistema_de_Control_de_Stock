#!/usr/bin/env node
// Levanta la API (Nest) y los dos frontends (Vite admin + Vite pública) contra
// la base de test, para que Playwright pueda pegarle a la stack real.
// Lo invoca `webServer.command` de playwright.config.ts — el proceso queda
// vivo hasta que Playwright lo mata con SIGTERM/SIGINT al terminar la corrida.
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Duplicado a propósito en vez de `import ... from './constants.ts'`: este
// archivo lo ejecuta un `node` plano (`webServer.command`), no el runner de
// Playwright (que sí transforma TS antes de correrlo). Node solo resuelve
// `import` de un `.ts` sin flags desde la 22.6/23.6 en adelante — los
// Dockerfiles del repo (`apps/api`, `apps/web-admin`) fijan `node:20-alpine`,
// así que un `import './constants.ts'` acá rompería en CI con
// ERR_UNKNOWN_FILE_EXTENSION. Mantener estos valores en sync con
// `e2e/constants.ts` si cambian.
const API_URL = 'http://127.0.0.1:3002';
// Igual que apps/api/scripts/reset-test-db.mjs: leemos TEST_DATABASE_URL del
// entorno antes que nada. `localhost` resuelve IPv4+IPv6 y en CI (Actions +
// Docker) el contenedor de Postgres sólo publica IPv4, así que el reset y la
// API podían terminar hablando con hosts distintos — de ahí el fallback
// literal en 127.0.0.1 en vez de localhost.
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://lch:lch_dev_pass@127.0.0.1:5432/lch_stock_test?schema=public';
const JWT_SECRET = 'lch-e2e-jwt-secret-not-for-production';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.resolve(__dirname, '../apps/api');
const adminDir = path.resolve(__dirname, '../apps/web-admin');
const publicDir = path.resolve(__dirname, '../apps/web-public');

const VITE_API_URL = API_URL;

/** Puertos que esta corrida de e2e necesita para sí sola. */
function assertPortFree(port) {
  return new Promise((resolve, reject) => {
    const tester = net.createServer();
    tester.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`puerto ${port} en uso`));
      } else {
        reject(err);
      }
    });
    tester.once('listening', () => {
      tester.close(() => resolve());
    });
    tester.listen(port, '127.0.0.1');
  });
}

/** TCP connect simple — alcanza para saber si algo escucha en el puerto. */
function tcpProbe(host, port, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (ok) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

async function httpProbe(url, timeoutMs = 2000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

async function pollUntil(checkFn, { timeoutMs, intervalMs = 1000, label }) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await checkFn()) return true;
    if (Date.now() >= deadline) {
      console.error(`Timeout esperando: ${label}`);
      return false;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

function prefixed(tag, chunk) {
  const text = chunk.toString();
  for (const line of text.split(/\r?\n/)) {
    if (line.length > 0) process.stdout.write(`[${tag}] ${line}\n`);
  }
}

function spawnChild(tag, cmd, args, opts) {
  console.log(`[${tag}] spawn: ${cmd} ${args.join(' ')} (cwd=${opts.cwd})`);
  const child = spawn(cmd, args, { shell: true, ...opts });
  child.stdout?.on('data', (d) => prefixed(tag, d));
  child.stderr?.on('data', (d) => prefixed(tag, d));
  child.on('spawn', () => console.log(`[${tag}] pid=${child.pid}`));
  child.on('error', (err) => console.error(`[${tag}] error al spawnear: ${err.message}`));
  child.on('exit', (code, signal) => {
    if (code !== null && code !== 0) {
      console.error(`[${tag}] terminó con código ${code}`);
    } else if (signal) {
      console.error(`[${tag}] terminado por señal ${signal}`);
    }
  });
  return child;
}

const children = [];

/**
 * `spawn(..., { shell: true })` en Windows crea un cmd.exe intermedio: matar
 * ese PID con child.kill() no llega a los procesos reales (node de nest/vite)
 * y quedan colgados con los puertos tomados. `taskkill /T` mata el árbol.
 */
function killChildTree(child) {
  if (child.killed || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', shell: true });
  } else {
    try {
      child.kill('SIGTERM');
    } catch {
      // ya estaba muerto
    }
  }
}

function killChildren() {
  for (const child of children) {
    killChildTree(child);
  }
}

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\nRecibida ${signal}, cerrando API + frontends de e2e…`);
  killChildren();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

async function main() {
  // 1. Puertos libres — si un e2e anterior quedó colgado, avisar y salir.
  for (const port of [3002, 5175, 5176]) {
    try {
      await assertPortFree(port);
    } catch {
      console.error('puerto en uso, cerrá el e2e anterior');
      process.exit(1);
    }
  }

  // 2. Infra (Postgres + MinIO) tiene que estar arriba de antes (docker compose).
  const infraOk = await pollUntil(
    async () => {
      const pgUp = await tcpProbe('127.0.0.1', 5432);
      const minioUp = await httpProbe('http://127.0.0.1:9000/minio/health/live');
      return pgUp && minioUp;
    },
    { timeoutMs: 30_000, label: 'Postgres (5432) + MinIO (9000)' },
  );
  if (!infraOk) {
    console.error('Infra no disponible — levantá "npm run dev:infra" antes de correr e2e.');
    process.exit(1);
  }

  // 2.5. Reset de la base de test — tiene que pasar ANTES de levantar la API.
  // Playwright corre el `webServer` (esto) completo, incluyendo el chequeo de
  // `url`, antes de disparar `globalSetup`: si el reset viviera ahí, `/health/ready`
  // nunca respondería 200 (la base no existe todavía) y quedaría en deadlock.
  // Además, en una segunda corrida la API ya tendría una conexión abierta a la
  // base existente, y `prisma migrate reset` no puede DROP DATABASE con
  // sesiones activas. Por eso el reset se hace acá, antes del `spawn` de nest;
  // `global-setup.ts` solo siembra datos (seeds idempotentes) una vez que la
  // API ya está arriba.
  console.log('Reseteando base de test antes de levantar la API…');
  const reset = spawnSync('node', ['scripts/reset-test-db.mjs'], {
    cwd: apiDir,
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL, DIRECT_URL: TEST_DATABASE_URL },
  });
  if (reset.status !== 0) {
    console.error('No se pudo resetear la base de test — abortando e2e.');
    process.exit(1);
  }

  // 3. API (Nest), sin --watch, apuntando a la base de test.
  const api = spawnChild('api', 'npx', ['nest', 'start'], {
    cwd: apiDir,
    env: {
      ...process.env,
      PORT: '3002',
      NODE_ENV: 'development',
      DATABASE_URL: TEST_DATABASE_URL,
      DIRECT_URL: TEST_DATABASE_URL,
      JWT_SECRET,
      MINIO_ENDPOINT: '127.0.0.1',
      MINIO_PORT: '9000',
      MINIO_ACCESS_KEY: 'minio_admin',
      MINIO_SECRET_KEY: 'minio_dev_pass',
      MINIO_USE_SSL: 'false',
    },
  });
  children.push(api);

  // 4. Vite admin.
  const admin = spawnChild(
    'admin',
    'npx',
    ['vite', '--port', '5175', '--strictPort', '--host', '127.0.0.1', '--open', 'false'],
    {
      cwd: adminDir,
      env: { ...process.env, VITE_API_URL },
    },
  );
  children.push(admin);

  // 5. Vite pública.
  const pub = spawnChild(
    'public',
    'npx',
    ['vite', '--port', '5176', '--strictPort', '--host', '127.0.0.1', '--open', 'false'],
    {
      cwd: publicDir,
      env: { ...process.env, VITE_API_URL },
    },
  );
  children.push(pub);

  // 6. Esperar a que la API esté lista de verdad (Postgres respondiendo detrás).
  const apiOk = await pollUntil(() => httpProbe(`${API_URL}/health/ready`), {
    timeoutMs: 60_000,
    label: `${API_URL}/health/ready`,
  });
  if (!apiOk) {
    console.error('La API no llegó a healthy — abortando e2e.');
    killChildren();
    process.exit(1);
  }

  console.log('Stack de e2e lista: API 3002, admin 5175, pública 5176.');
  // El proceso queda vivo — Playwright ya puede empezar a correr los tests.
  // Se cierra por SIGTERM/SIGINT (ver handlers arriba).
}

main().catch((err) => {
  console.error(err);
  killChildren();
  process.exit(1);
});
