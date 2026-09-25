/**
 * Aritmética de un ciclo de stock (de un conteo al siguiente).
 *
 * La suma de los movimientos la hace el servidor (`GET /stock/cycles/:id`):
 * acá sólo se despeja la identidad del ciclo, para que sea testeable sin red
 * ni estado. Módulo puro a propósito: nada de React, cliente HTTP ni store.
 *
 *   adiciones         = entradas + devoluciones + anulaciones + ajustes positivos
 *   salidas           = ventas + consumos + roturas + vencidos + ajustes negativos
 *   esperadoCalculado = contadoAnterior + adiciones − salidas
 *   diferencia        = esperadoGuardado − contado
 *   consumoReal       = contadoAnterior + adiciones − contado
 *
 * Cuando al libro no le falta nada, `consumoReal === salidas + diferencia`.
 */
import type { StockCountType, UnidadMedida } from './types';

/** Fila cruda del ciclo: lo que el endpoint devuelve, sin derivar nada. */
export interface StockCyclePayloadRow {
  productId: string;
  productName: string;
  unit: UnidadMedida;
  /** Contado en el control anterior; null si ese control no incluyó el producto. */
  countedBefore: number | null;
  /** Contado en el control que cierra el ciclo; null en el ciclo abierto. */
  counted: number | null;
  /** Esperado que guardó el control; null en el ciclo abierto. */
  expected: number | null;
  entradas: number;
  devoluciones: number;
  anulaciones: number;
  ventas: number;
  consumos: number;
  roturas: number;
  vencidos: number;
  /** Signado: correccion + entrada_directa + los ajustes sin motivo. */
  ajustes: number;
}

/** Respuesta de `GET /stock/cycles/:sessionId`. */
export interface StockCyclePayload {
  sessionId: string;
  sessionCreatedAt: string | null;
  sessionDate: string | null;
  dateType: StockCountType | null;
  previousSessionId: string | null;
  previousCreatedAt: string | null;
  days: number;
  /** Un ciclo sin ventas es un control de pedido recibido, no merma de mostrador. */
  hadSales: boolean;
  rows: StockCyclePayloadRow[];
}

export interface StockCycleRow extends StockCyclePayloadRow {
  adiciones: number;
  salidas: number;
  /** null cuando no hay contado anterior: el ciclo no arranca de cero, arranca de nada. */
  esperadoCalculado: number | null;
  /** Lo que el conteo corrigió: salió sin registrarse. null en el ciclo abierto. */
  diferencia: number | null;
  /** Lo que físicamente salió. null si falta el contado anterior o el contado. */
  consumoReal: number | null;
  /**
   * `diferencia` sobre `consumoReal`, en porcentaje. Tres unidades que faltan de
   * algo que mueve cinco pesan más que tres de algo que mueve doscientas.
   */
  porcentajeDiferencia: number | null;
  /**
   * Si la cuenta del ciclo reproduce el esperado que guardó el control. Un
   * ajuste de tipo `correccion` la rompe legítimamente — es admitir que el
   * libro estaba mal — y por eso `false` es una señal para mostrar.
   */
  cierra: boolean;
  sinContadoAnterior: boolean;
}

export interface StockCycleTotals {
  /** Unidades que salieron. */
  consumoReal: number;
  /** De esas, las que el libro explica. */
  salidas: number;
  /** De esas, las que no. */
  diferencia: number;
  /**
   * Filas que no entran en los tres números de arriba porque les falta el
   * contado anterior o el contado. Se listan aparte en vez de desbalancear el
   * pie de la tabla.
   */
  filasIncompletas: number;
}

function round3(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

export function buildStockCycleRows(payload: StockCyclePayload): StockCycleRow[] {
  return payload.rows.map(row => {
    const { countedBefore, counted, expected } = row;
    const adiciones = round3(
      row.entradas + row.devoluciones + row.anulaciones + Math.max(row.ajustes, 0),
    );
    const salidas = round3(
      row.ventas + row.consumos + row.roturas + row.vencidos + Math.max(-row.ajustes, 0),
    );

    const esperadoCalculado =
      countedBefore === null ? null : round3(countedBefore + adiciones - salidas);
    const diferencia =
      expected === null || counted === null ? null : round3(expected - counted);
    const consumoReal =
      countedBefore === null || counted === null
        ? null
        : round3(countedBefore + adiciones - counted);
    const porcentajeDiferencia =
      diferencia === null || consumoReal === null
        ? null
        : consumoReal === 0
          ? 0
          : round3((diferencia / consumoReal) * 100);

    return {
      ...row,
      adiciones,
      salidas,
      esperadoCalculado,
      diferencia,
      consumoReal,
      porcentajeDiferencia,
      cierra:
        esperadoCalculado !== null &&
        expected !== null &&
        round3(esperadoCalculado) === round3(expected),
      sinContadoAnterior: countedBefore === null,
    };
  });
}

/**
 * Suma solo las filas con la cuenta completa, así el pie de la tabla cierra:
 * lo que salió es lo que el libro explica más lo que no. Las incompletas se
 * cuentan aparte.
 */
export function buildStockCycleTotals(rows: StockCycleRow[]): StockCycleTotals {
  const totals = rows.reduce<StockCycleTotals>(
    (acc, row) => {
      if (row.consumoReal === null || row.diferencia === null) {
        return { ...acc, filasIncompletas: acc.filasIncompletas + 1 };
      }
      return {
        consumoReal: acc.consumoReal + row.consumoReal,
        salidas: acc.salidas + row.salidas,
        diferencia: acc.diferencia + row.diferencia,
        filasIncompletas: acc.filasIncompletas,
      };
    },
    { consumoReal: 0, salidas: 0, diferencia: 0, filasIncompletas: 0 },
  );
  return {
    consumoReal: round3(totals.consumoReal),
    salidas: round3(totals.salidas),
    diferencia: round3(totals.diferencia),
    filasIncompletas: totals.filasIncompletas,
  };
}
