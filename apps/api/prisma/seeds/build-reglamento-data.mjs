/**
 * Genera prisma/seeds/reglamento-data.json desde el texto oficial.
 * Uso: node prisma/seeds/build-reglamento-data.mjs [ruta-al-texto.txt]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NO_APLICABLES = new Set(['30', '31', '31 bis', '42', '43', '44']);

function normalizeNumero(raw) {
  return raw
    .replace(/\*/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function parseReglamento(text) {
  const apartadoBlocks = text.split(/(?=APARTADO [IVXLCDM]+:)/i).filter(Boolean);
  const apartados = [];

  for (const block of apartadoBlocks) {
    const headerMatch = block.match(/^APARTADO ([IVXLCDM]+):\s*([^\n]+)/i);
    if (!headerMatch) continue;

    const numeroRomano = headerMatch[1].toUpperCase();
    const tituloResto = headerMatch[2].trim();
    const cuerpo = block.slice(headerMatch[0].length).trim();

    const articuloRegex = /ART[IÍ]CULO\s+([\d]+(?:\s*(?:BIS|bis|\*))?)\s*:/gi;
    const articulos = [];
    const matches = [...cuerpo.matchAll(articuloRegex)];

    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      const numero = normalizeNumero(m[1]);
      const start = m.index + m[0].length;
      const end = i + 1 < matches.length ? matches[i + 1].index : cuerpo.length;
      const contenido = cuerpo.slice(start, end).trim();
      articulos.push({
        numero,
        contenido,
        aplicable: !NO_APLICABLES.has(numero),
      });
    }

    apartados.push({
      numeroRomano,
      titulo: `APARTADO ${numeroRomano}: ${tituloResto}`,
      articulos,
    });
  }

  const anexoBlocks = text.split(/(?=ANEXO [IVXLCDM]+:)/i).filter((b) => /^ANEXO/i.test(b.trim()));
  const anexos = anexoBlocks.map((block, idx) => {
    const headerMatch = block.match(/^ANEXO ([IVXLCDM]+):\s*([^\n]+)/i);
    const titulo = headerMatch
      ? `ANEXO ${headerMatch[1]}: ${headerMatch[2].trim()}`
      : `ANEXO ${idx + 1}`;
    const contenido = block.slice((headerMatch?.[0]?.length ?? 0)).trim();
    return {
      numero: idx + 1,
      titulo,
      contenido,
    };
  });

  return { apartados, anexos };
}

const inputPath = process.argv[2] ?? path.join(__dirname, 'reglamento-oficial.txt');
let text = '';
if (fs.existsSync(inputPath)) {
  text = fs.readFileSync(inputPath, 'utf8');
} else {
  const transcriptPath =
    process.env.LCH_REGLAMENTO_TRANSCRIPT ??
    'C:/Users/HectorHalty/.cursor/projects/d-Desarrollo/agent-transcripts/93d091d0-a236-41fb-b9b5-42c782814caa/93d091d0-a236-41fb-b9b5-42c782814caa.jsonl';
  if (fs.existsSync(transcriptPath)) {
    const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n');
    const userLine = lines.find((l) => l.includes('APARTADO I: DISPOSICIONES GENERALES'));
    if (!userLine) {
      console.error('No se encontró el reglamento en el transcript.');
      process.exit(1);
    }
    const obj = JSON.parse(userLine);
    const raw = obj.message.content.find((c) => c.type === 'text')?.text ?? '';
    text = raw.slice(raw.indexOf('Reglamento'));
  } else {
    console.error(`No se encontró ${inputPath} ni transcript alternativo.`);
    process.exit(1);
  }
}

const data = parseReglamento(text);
const outPath = path.join(__dirname, 'reglamento-data.json');
fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');

const artCount = data.apartados.reduce((n, a) => n + a.articulos.length, 0);
console.log(`OK: ${data.apartados.length} apartados, ${artCount} artículos, ${data.anexos.length} anexos → ${outPath}`);
