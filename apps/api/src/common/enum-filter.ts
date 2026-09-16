/**
 * Filtros por query-param contra columnas enum llegan como texto crudo. Un
 * valor fuera del enum que llegue a Prisma lanza PrismaClientValidationError,
 * que el filtro global no traduce y sale 500. Este helper valida el valor
 * contra el enum antes de usarlo, para que el caller pueda responder vacío
 * en vez de dejarlo pasar.
 */

/** Set de valores válidos por objeto de enum, cacheado para no reconstruirlo en cada llamada. */
const validValuesCache = new WeakMap<object, Set<string>>();

function validValuesFor(enumObject: Record<string, string>): Set<string> {
  let cached = validValuesCache.get(enumObject);
  if (!cached) {
    cached = new Set(Object.values(enumObject));
    validValuesCache.set(enumObject, cached);
  }
  return cached;
}

/**
 * Devuelve `value` si matchea alguno de los valores de `enumObject`, o
 * `undefined` si no (incluye `undefined`/`''` y nombres heredados de
 * Object.prototype como "constructor" o "toString").
 */
export function pickEnumValue<T extends string>(
  value: string | undefined,
  enumObject: Record<string, T>,
): T | undefined {
  if (!value) return undefined;
  const valid = validValuesFor(enumObject);
  return valid.has(value) ? (value as T) : undefined;
}
