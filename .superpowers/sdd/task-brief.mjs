#!/usr/bin/env node
// Extrae el texto completo de una tarea del plan a un archivo de brief.
// Uso: node .superpowers/sdd/task-brief.mjs <plan.md> <N>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const [planPath, taskNumber] = process.argv.slice(2);
if (!planPath || taskNumber === undefined) {
  console.error('Uso: node task-brief.mjs <plan.md> <N>');
  process.exit(1);
}

const text = readFileSync(planPath, 'utf8');
const lines = text.split(/\r?\n/);

const headerRe = /^### Task (\d+):/;
let start = -1;
let end = lines.length;

for (let i = 0; i < lines.length; i++) {
  const m = headerRe.exec(lines[i]);
  if (!m) continue;
  if (start === -1 && m[1] === String(taskNumber)) {
    start = i;
  } else if (start !== -1) {
    end = i;
    break;
  }
}

if (start === -1) {
  console.error(`No se encontró "### Task ${taskNumber}:" en ${planPath}`);
  process.exit(1);
}

// Cortar antes del separador "---" que precede a la tarea siguiente.
let body = lines.slice(start, end);
while (body.length && (body[body.length - 1].trim() === '' || body[body.length - 1].trim() === '---')) {
  body.pop();
}

const globalStart = lines.findIndex(l => l.trim() === '## Global Constraints');
const globalEnd = lines.findIndex((l, i) => i > globalStart && l.trim() === '---');
const globals = globalStart === -1 ? [] : lines.slice(globalStart, globalEnd);

const outDir = join('.superpowers', 'sdd');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, `task-${taskNumber}-brief.md`);

writeFileSync(
  outPath,
  [
    `# Brief — Task ${taskNumber}`,
    '',
    `Extraído de \`${planPath}\`. Estos son tus requisitos: usá los valores exactos que aparecen acá, verbatim.`,
    '',
    ...globals,
    '',
    '---',
    '',
    ...body,
    '',
  ].join('\n'),
  'utf8',
);

console.log(outPath);
