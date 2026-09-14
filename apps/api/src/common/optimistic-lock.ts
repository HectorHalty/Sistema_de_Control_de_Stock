import { ConflictException } from '@nestjs/common';

export const OPTIMISTIC_LOCK_MESSAGE =
  'Este registro fue modificado por otra persona. Recargá la página y volvé a intentar.';

/**
 * Bloqueo optimista genérico para las entidades editadas desde el admin
 * (Producto, ProductoVenta, OrdenCompra, Configuracion — ver Task 6/7 de
 * docs/superpowers/plans/2026-09-07-integridad-operacional-b.md).
 *
 * El patrón: un `updateMany` condicionado por `{ id, version: expected }` es
 * una sola sentencia SQL atómica (`UPDATE ... WHERE id = $1 AND version = $2`),
 * así que no hace falta un `SELECT ... FOR UPDATE` aparte para detectar la
 * edición concurrente. Si `count` da 0, alguien más ya actualizó el registro
 * (o lo borró) entre que el cliente lo cargó y mandó el update.
 *
 * `expectedVersion` es opcional a propósito: mientras el frontend admin no
 * mande la versión que tenía (Task 8), el caller sigue el camino viejo — un
 * `update` simple sin chequeo, mismo comportamiento que antes de esta tarea.
 */
export function assertVersionedUpdateApplied(count: number): void {
  if (count === 0) {
    throw new ConflictException(OPTIMISTIC_LOCK_MESSAGE);
  }
}
