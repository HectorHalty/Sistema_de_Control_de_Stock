import { useCallback, useEffect, useState } from 'react';
import {
  footballApi,
  getAccessToken,
  type FootballCaptain,
  type FootballInscription,
} from '@/app/api/client';
import {
  FutbolError,
  FutbolPanelShell,
  futbolButtonClass,
  futbolFieldClass,
  useFutbolOverview,
} from '../futbol-shared';

export function CapitanesPanel() {
  const { torneoId } = useFutbolOverview();
  const [rows, setRows] = useState<FootballCaptain[]>([]);
  const [equipos, setEquipos] = useState<FootballInscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [dni, setDni] = useState('');
  const [equipoId, setEquipoId] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [caps, insc] = await Promise.all([
        footballApi.captains.list(token, torneoId ?? undefined),
        footballApi.inscriptions.list(token, torneoId ?? undefined),
      ]);
      setRows(caps);
      setEquipos(insc);
      if (!equipoId && insc[0]) setEquipoId(insc[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [torneoId, equipoId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    if (!token || !torneoId || !email || !dni || !equipoId) return;
    setSaving(true);
    try {
      await footballApi.captains.create({ email, dni, torneoId, equipoInscripcionId: equipoId }, token);
      setEmail('');
      setDni('');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActivo(row: FootballCaptain) {
    const token = getAccessToken();
    if (!token) return;
    await footballApi.captains.update(row.id, { activo: !row.activo }, token);
    await reload();
  }

  return (
    <FutbolPanelShell title="Registro de capitanes">
      {error && <FutbolError message={error} />}
      <form onSubmit={handleCreate} className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-4">
        <input
          className={futbolFieldClass()}
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className={futbolFieldClass()}
          placeholder="DNI"
          value={dni}
          onChange={(e) => setDni(e.target.value)}
        />
        <select
          className={futbolFieldClass()}
          value={equipoId}
          onChange={(e) => setEquipoId(e.target.value)}
        >
          {equipos.map((eq) => (
            <option key={eq.id} value={eq.id}>
              {eq.equipo.name}
            </option>
          ))}
        </select>
        <button type="submit" disabled={saving || !torneoId} className={futbolButtonClass()}>
          {saving ? 'Guardando...' : 'Registrar capitán'}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">DNI</th>
                <th className="px-4 py-3">Equipo</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-4 py-3">{row.email}</td>
                  <td className="px-4 py-3">{row.dni}</td>
                  <td className="px-4 py-3">{row.equipoInscripcion?.equipo.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleActivo(row)}
                      className={futbolButtonClass('ghost')}
                    >
                      {row.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </FutbolPanelShell>
  );
}
