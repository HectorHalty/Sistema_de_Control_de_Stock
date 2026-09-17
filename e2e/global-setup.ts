import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { TEST_DATABASE_URL } from './constants';

function run(cmd: string, args: string[], cwd: string) {
  const r = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL, DIRECT_URL: TEST_DATABASE_URL },
  });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed`);
}

// El reset destructivo (`prisma migrate reset`) corre en `start-stack.mjs`,
// ANTES de levantar la API — Playwright espera a que el `webServer` completo
// (proceso + chequeo de `url`) esté listo antes de correr `globalSetup`, así
// que si el reset viviera acá, `/health/ready` nunca respondería 200 (la base
// todavía no existiría) y quedaría en deadlock. Acá solo sembramos datos:
// son seeds idempotentes (upsert), seguros de correr con la API ya arriba.
export default async function globalSetup() {
  const api = path.resolve(__dirname, '../apps/api');
  run('npm', ['run', 'prisma:seed'], api);
  run('npm', ['run', 'prisma:seed:demo'], api);
}
