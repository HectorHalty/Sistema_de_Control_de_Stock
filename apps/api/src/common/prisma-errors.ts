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
