export type RemoteConfigRow = {
  key: string;
  scope: string;
  value: unknown;
  version?: number;
};

const versions = new Map<string, number>();

function isVersion(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0;
}

export function clearConfigVersionsForTests(): void {
  versions.clear();
}

export function rememberConfigRow(row: RemoteConfigRow): void {
  if (isVersion(row.version)) versions.set(row.key, row.version);
}

export function rememberConfigRows(rows: RemoteConfigRow[]): void {
  for (const row of rows) rememberConfigRow(row);
}

export function buildUpsertPayload(
  key: string,
  scope: string,
  value: unknown,
): { key: string; scope: string; value: unknown; version?: number } {
  const version = versions.get(key);
  if (version === undefined) return { key, scope, value };
  return { key, scope, value, version };
}
