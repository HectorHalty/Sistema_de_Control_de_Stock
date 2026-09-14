import { useCallback, useEffect, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import {
  footballApi,
  getAccessToken,
  type FootballPlanillaEquipo,
  type FootballPlanillasResponse,
} from '@/app/api/client';
import { downloadBlobFile } from '@/app/components/download';
import {
  FutbolError,
  FutbolPanelShell,
  futbolButtonClass,
  futbolCardClass,
  futbolFieldClass,
} from '../futbol-shared';

function nextSaturdayISO(): string {
  const now = new Date();
  const day = now.getDay(); // 0=domingo ... 6=sabado
  const diff = (6 - day + 7) % 7 || 7;
  const next = new Date(now);
  next.setDate(now.getDate() + diff);
  const y = next.getFullYear();
  const m = String(next.getMonth() + 1).padStart(2, '0');
  const d = String(next.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatFechaNac(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function nombreJugador(j: { nombre: string; apellido: string }): string {
  return `${j.apellido}, ${j.nombre}`;
}

interface EquipoEnPartido {
  key: string;
  categoriaNombre: string;
  campeonatoNombre: string;
  equipo: FootballPlanillaEquipo;
  rival: FootballPlanillaEquipo;
}

/**
 * Dibuja una planilla de cancha (una página) para un equipo, en el mismo
 * estilo manual (setFillColor/roundedRect/text) usado en
 * OrdersPage.tsx -> buildOrderPDFBlob.
 */
function drawPlanillaPage(doc: jsPDF, item: EquipoEnPartido) {
  const W = doc.internal.pageSize.getWidth();
  const marginX = 36;
  let y = 40;

  // Título
  doc.setTextColor(45, 80, 22);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('PLANILLA DE CANCHA', W / 2, y, { align: 'center' });
  y += 10;
  doc.setDrawColor(45, 80, 22);
  doc.setLineWidth(1.2);
  doc.line(marginX, y, W - marginX, y);
  y += 18;

  // Fila Liga / Temporada / Club
  doc.setFillColor(249, 249, 247);
  doc.roundedRect(marginX, y, W - marginX * 2, 46, 4, 4, 'F');
  const infoFields = [
    { label: 'LIGA', value: item.categoriaNombre },
    { label: 'TEMPORADA', value: item.campeonatoNombre },
    { label: 'CLUB', value: item.equipo.equipoNombre },
  ];
  const colW = (W - marginX * 2) / infoFields.length;
  infoFields.forEach((f, i) => {
    const x = marginX + 10 + i * colW;
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(f.label, x, y + 16);
    doc.setTextColor(51, 51, 51);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(f.value || '—', x, y + 32, { maxWidth: colW - 14 });
  });
  y += 60;

  // Rival (informativo, no forma parte de los campos "en blanco")
  doc.setTextColor(113, 113, 130);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Rival: ${item.rival.equipoNombre}`, marginX, y);
  y += 18;

  // Día / Horario / Cancha N° / Resultado — SIEMPRE en blanco (a completar a mano)
  doc.setFontSize(10);
  doc.setTextColor(51, 51, 51);
  doc.setFont('helvetica', 'normal');
  const line1 = 'Día: __ / __ / ______        Horario: ____________        Cancha N°: ______';
  doc.text(line1, marginX, y);
  y += 18;
  doc.text('Resultado: ___________________________________________________', marginX, y);
  y += 20;

  // Tabla de jugadores
  const headers = ['N°', 'NOMBRE DEL JUGADOR', 'DNI', 'FECHA NAC.', 'DORSAL', 'G', 'TA', 'DA', 'TR', 'FIRMA'];
  const colWidths = [22, 150, 62, 58, 40, 20, 20, 20, 20, 91];
  const tableW = colWidths.reduce((a, b) => a + b, 0);
  const tableX = marginX;

  doc.setFillColor(45, 80, 22);
  doc.rect(tableX, y, tableW, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  let hx = tableX;
  headers.forEach((h, i) => {
    doc.text(h, hx + colWidths[i] / 2, y + 13, { align: 'center' });
    hx += colWidths[i];
  });
  y += 20;

  const rowH = 20;
  const roster = item.equipo.roster;
  const rowCount = Math.max(roster.length, 1);
  for (let i = 0; i < rowCount; i++) {
    if (y + rowH > 780) {
      doc.addPage();
      y = 40;
      doc.setFillColor(45, 80, 22);
      doc.rect(tableX, y, tableW, 20, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      let hx2 = tableX;
      headers.forEach((h, j) => {
        doc.text(h, hx2 + colWidths[j] / 2, y + 13, { align: 'center' });
        hx2 += colWidths[j];
      });
      y += 20;
    }
    const jugador = roster[i];
    const bg = i % 2 === 0 ? [255, 255, 255] : [249, 249, 247];
    doc.setFillColor(bg[0], bg[1], bg[2]);
    doc.rect(tableX, y, tableW, rowH, 'F');
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.4);
    doc.rect(tableX, y, tableW, rowH, 'S');

    doc.setTextColor(51, 51, 51);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');

    const cells = jugador
      ? [
          String(i + 1),
          nombreJugador(jugador),
          jugador.dni || '',
          formatFechaNac(jugador.fechaNacimiento),
          jugador.numeroCamiseta != null ? String(jugador.numeroCamiseta) : '',
          '', '', '', '', '',
        ]
      : [String(i + 1), '', '', '', '', '', '', '', '', ''];

    let cx = tableX;
    cells.forEach((c, ci) => {
      if (ci === 1) {
        doc.text(c, cx + 4, y + 13, { maxWidth: colWidths[ci] - 8 });
      } else {
        doc.text(c, cx + colWidths[ci] / 2, y + 13, { align: 'center' });
      }
      cx += colWidths[ci];
    });
    y += rowH;
  }

  y += 24;
  if (y > 700) {
    doc.addPage();
    y = 40;
  }

  // Dos tablitas lado a lado
  const halfW = (tableW - 16) / 2;
  const leftX = tableX;
  const rightX = tableX + halfW + 16;

  doc.setTextColor(45, 80, 22);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Árbitro (Firma y Aclaración)', leftX, y);
  doc.text('Capitán (Firma y Aclaración)', rightX, y);
  y += 8;

  const subRowH = 16;
  const leftCols = [halfW * 0.6, halfW * 0.4];
  const leftHeaders = ['Número Goleador', 'Min.'];
  const rightCols = [halfW * 0.34, halfW * 0.33, halfW * 0.33];
  const rightHeaders = ['N°', 'Tarjeta', 'Min.'];

  let ty = y;
  // Headers
  doc.setFillColor(240, 236, 230);
  doc.rect(leftX, ty, halfW, subRowH, 'F');
  doc.rect(rightX, ty, halfW, subRowH, 'F');
  doc.setTextColor(113, 113, 130);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  let lx = leftX;
  leftHeaders.forEach((h, i) => {
    doc.text(h, lx + leftCols[i] / 2, ty + 11, { align: 'center' });
    lx += leftCols[i];
  });
  let rx = rightX;
  rightHeaders.forEach((h, i) => {
    doc.text(h, rx + rightCols[i] / 2, ty + 11, { align: 'center' });
    rx += rightCols[i];
  });
  ty += subRowH;

  const emptyRows = 6;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.4);
  for (let i = 0; i < emptyRows; i++) {
    doc.rect(leftX, ty, halfW, subRowH, 'S');
    let lx2 = leftX;
    for (let c = 1; c < leftCols.length; c++) {
      lx2 += leftCols[c - 1];
      doc.line(lx2, ty, lx2, ty + subRowH);
    }
    doc.rect(rightX, ty, halfW, subRowH, 'S');
    let rx2 = rightX;
    for (let c = 1; c < rightCols.length; c++) {
      rx2 += rightCols[c - 1];
      doc.line(rx2, ty, rx2, ty + subRowH);
    }
    ty += subRowH;
  }

  y = ty + 30;
  if (y > 780) {
    doc.addPage();
    y = 60;
  }

  // Firmas
  doc.setTextColor(51, 51, 51);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Firma Director Técnico: ________________________________', tableX, y);
  y += 26;
  doc.text('Firma Capitán: ________________________________________', tableX, y);
}

function buildPlanillaPDFBlob(item: EquipoEnPartido): Blob {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  drawPlanillaPage(doc, item);
  return doc.output('blob');
}

function buildAllPlanillasPDFBlob(items: EquipoEnPartido[]): Blob {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  items.forEach((item, idx) => {
    if (idx > 0) doc.addPage();
    drawPlanillaPage(doc, item);
  });
  return doc.output('blob');
}

function flattenEquipos(data: FootballPlanillasResponse): EquipoEnPartido[] {
  const out: EquipoEnPartido[] = [];
  for (const cat of data.categorias) {
    for (const match of cat.matches) {
      out.push({
        key: `${match.matchId}-home`,
        categoriaNombre: cat.categoriaNombre,
        campeonatoNombre: cat.campeonatoNombre,
        equipo: match.home,
        rival: match.away,
      });
      out.push({
        key: `${match.matchId}-away`,
        categoriaNombre: cat.categoriaNombre,
        campeonatoNombre: cat.campeonatoNombre,
        equipo: match.away,
        rival: match.home,
      });
    }
  }
  return out;
}

export function PlanillasPanel() {
  const [fecha, setFecha] = useState<string>(nextSaturdayISO());
  const [data, setData] = useState<FootballPlanillasResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [downloadingAll, setDownloadingAll] = useState(false);

  const reload = useCallback(async (targetFecha: string) => {
    const token = getAccessToken();
    if (!token || !targetFecha) return;
    setLoading(true);
    setError(null);
    try {
      const res = await footballApi.planillas.get(token, targetFecha);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar las planillas');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload(fecha);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const equipos = useMemo(() => (data ? flattenEquipos(data) : []), [data]);

  useEffect(() => {
    if (equipos.length > 0 && !equipos.some((e) => e.key === selectedKey)) {
      setSelectedKey(equipos[0].key);
    }
    if (equipos.length === 0) {
      setSelectedKey('');
    }
  }, [equipos, selectedKey]);

  const totalPartidos = data ? data.categorias.reduce((s, c) => s + c.matches.length, 0) : 0;

  function handleDescargarIndividual() {
    const item = equipos.find((e) => e.key === selectedKey);
    if (!item) return;
    const blob = buildPlanillaPDFBlob(item);
    const safeName = item.equipo.equipoNombre.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    downloadBlobFile({ filename: `planilla-${safeName}-${data?.fecha ?? fecha}.pdf`, blob });
  }

  function handleDescargarTodas() {
    if (equipos.length === 0) return;
    setDownloadingAll(true);
    try {
      const blob = buildAllPlanillasPDFBlob(equipos);
      downloadBlobFile({ filename: `planillas-${data?.fecha ?? fecha}.pdf`, blob });
    } finally {
      setDownloadingAll(false);
    }
  }

  return (
    <FutbolPanelShell
      title="Planillas de cancha"
      subtitle="Descargá las planillas de cancha en PDF"
    >
      {error && <FutbolError message={error} />}

      <div className={futbolCardClass('flex flex-wrap items-end gap-3 p-4')}>
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">Fecha</label>
          <input
            type="date"
            className={futbolFieldClass('max-w-[180px]')}
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>
        <button
          type="button"
          className={futbolButtonClass()}
          disabled={loading || !fecha}
          onClick={() => void reload(fecha)}
        >
          {loading ? 'Actualizando...' : 'Actualizar planillas'}
        </button>
        <button
          type="button"
          className={futbolButtonClass('ghost')}
          disabled={downloadingAll || equipos.length === 0}
          onClick={handleDescargarTodas}
        >
          {downloadingAll ? 'Generando...' : `Imprimir todas las del ${data?.fecha ?? fecha}`}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando planillas...</p>
      ) : !data || totalPartidos === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted p-8 text-center text-sm text-muted-foreground">
          No hay partidos programados para esta fecha.
        </div>
      ) : (
        <>
          {/* Resumen por categoría */}
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3">Torneo</th>
                  <th className="px-4 py-3">Partidos</th>
                  <th className="px-4 py-3">Equipos</th>
                </tr>
              </thead>
              <tbody>
                {data.categorias.map((cat) => (
                  <tr key={cat.categoriaId} className="border-t border-border align-top">
                    <td className="px-4 py-3 font-medium">{cat.categoriaNombre}</td>
                    <td className="px-4 py-3">{cat.campeonatoNombre}</td>
                    <td className="px-4 py-3">{cat.matches.length}</td>
                    <td className="px-4 py-3">
                      {cat.matches.map((m) => `${m.home.equipoNombre} vs ${m.away.equipoNombre}`).join(' · ') || '—'}
                    </td>
                  </tr>
                ))}
                {data.categorias.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                      Sin categorías con partidos esta fecha.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Selector individual */}
          <div className={futbolCardClass('flex flex-wrap items-end gap-3 p-4')}>
            <div className="min-w-[260px] flex-1">
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                Equipo / partido
              </label>
              <select
                className={futbolFieldClass()}
                value={selectedKey}
                onChange={(e) => setSelectedKey(e.target.value)}
              >
                {equipos.map((e) => (
                  <option key={e.key} value={e.key}>
                    {e.categoriaNombre} — {e.equipo.equipoNombre} (vs {e.rival.equipoNombre})
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className={futbolButtonClass()}
              disabled={!selectedKey}
              onClick={handleDescargarIndividual}
            >
              Descargar PDF
            </button>
          </div>
        </>
      )}
    </FutbolPanelShell>
  );
}
