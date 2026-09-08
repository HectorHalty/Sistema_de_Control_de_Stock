import { useCallback, useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import {
  footballApi,
  getAccessToken,
  type FootballInscription,
  type FootballRoster,
} from '@/app/api/client';
import {
  FutbolError,
  FutbolPanelShell,
  futbolButtonClass,
  openListaBuenaFe,
  useFutbolOverview,
} from '../futbol-shared';

function formatFechaNacimiento(value?: string | null) {
  if (!value) return '—';
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${day}/${month}/${year}`;
  }
  return value;
}

export function PlantelPanel() {
  const { torneoId } = useFutbolOverview();
  const [equipos, setEquipos] = useState<FootballInscription[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [roster, setRoster] = useState<FootballRoster | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEquipos = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    try {
      const insc = await footballApi.inscriptions.list(token, torneoId ?? undefined);
      setEquipos(insc);
      if (!selectedId && insc[0]) setSelectedId(insc[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [torneoId, selectedId]);

  const loadRoster = useCallback(async (inscripcionId: string) => {
    const token = getAccessToken();
    if (!token || !inscripcionId) return;
    setError(null);
    try {
      setRoster(await footballApi.roster.get(inscripcionId, token));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar plantel');
    }
  }, []);

  useEffect(() => {
    void loadEquipos();
  }, [loadEquipos]);

  useEffect(() => {
    if (selectedId) void loadRoster(selectedId);
  }, [selectedId, loadRoster]);

  return (
    <FutbolPanelShell title="Lista de Buena Fe (solo lectura)">
      <p className="text-sm text-muted-foreground">
        Plantel cargado por capitanes en la web pública. Podés reimprimir la LBFE desde acá.
      </p>
      {error && <FutbolError message={error} />}
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="min-w-[220px] rounded-lg border border-border bg-background px-3 py-2 text-sm"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {equipos.map((eq) => (
            <option key={eq.id} value={eq.id}>
              {eq.equipo.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!selectedId}
          className={`${futbolButtonClass()} flex items-center gap-2`}
          onClick={() => openListaBuenaFe(selectedId).catch((e) => setError(String(e)))}
        >
          <FileText size={16} />
          Imprimir LBFE
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : roster ? (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3">Jugador</th>
                <th className="px-4 py-3">Dorsal</th>
                <th className="px-4 py-3">DNI</th>
                <th className="px-4 py-3">Fecha Nac.</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Rol</th>
              </tr>
            </thead>
            <tbody>
              {roster.jugadores.map((j) => {
                const esCapitan = roster.capitan?.personaId === j.personaId;
                return (
                  <tr
                    key={j.id}
                    className={`border-t border-border ${esCapitan ? 'bg-primary/10' : ''}`}
                  >
                    <td className="px-4 py-3">
                      {j.apellido}, {j.nombre}
                      {esCapitan && (
                        <span className="ml-2 rounded-full bg-primary/20 px-2 py-0.5 text-xs font-semibold text-primary">
                          Capitán
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">{j.numeroCamiseta ?? '—'}</td>
                    <td className="px-4 py-3">{j.dni}</td>
                    <td className="px-4 py-3">{formatFechaNacimiento(j.fechaNacimiento)}</td>
                    <td className="px-4 py-3">{j.email ?? '—'}</td>
                    <td className="px-4 py-3">{j.rolPlantel}</td>
                  </tr>
                );
              })}
              {roster.jugadores.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                    Sin jugadores cargados aún
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </FutbolPanelShell>
  );
}
