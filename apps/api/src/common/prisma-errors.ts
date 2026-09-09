function prismaCode(e: unknown): string | undefined {
  if (typeof e !== 'object' || e === null) return undefined;
  const code = (e as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

/** P2002 — violación de una constraint única. */
export function isPrismaUniqueConflict(e: unknown): boolean {
  return prismaCode(e) === 'P2002';
}

/** P2003 — violación de una clave foránea. */
export function isPrismaForeignKeyViolation(e: unknown): boolean {
  return prismaCode(e) === 'P2003';
}

/** P2025 — la operación esperaba un registro que no existe. */
export function isPrismaRecordNotFound(e: unknown): boolean {
  return prismaCode(e) === 'P2025';
}

/**
 * Violación de una restricción CHECK de Postgres (SQLSTATE 23514: negativos,
 * cantidades > 0, goles, método de auth requerido, etc). El motor de Prisma
 * no le asigna un código conocido propio (no llega como
 * PrismaClientKnownRequestError): sale como PrismaClientUnknownRequestError
 * con el texto crudo de Postgres embebido en el mensaje.
 */
export function isPrismaCheckViolation(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false;
  const message = (e as { message?: unknown }).message;
  return typeof message === 'string' && message.includes('violates check constraint');
}

/**
 * Extrae el nombre de la restricción CHECK violada, solo para el log del
 * servidor. El mensaje de Postgres llega anidado dentro del string de debug
 * del connector de Prisma, así que las comillas del nombre pueden aparecer
 * escapadas (`\"nombre\"`) en vez de literales (`"nombre"`).
 */
export function extractCheckConstraintName(e: unknown): string | undefined {
  if (typeof e !== 'object' || e === null) return undefined;
  const message = (e as { message?: unknown }).message;
  if (typeof message !== 'string') return undefined;
  const match = message.match(/violates check constraint \\?"([^"\\]+)\\?"/);
  return match?.[1];
}
