const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** True when the id was assigned on the client and not yet replaced by a server UUID. */
export function isLocalOnlyId(id: string): boolean {
  return !UUID_RE.test(id);
}
