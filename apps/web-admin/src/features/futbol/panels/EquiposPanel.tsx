import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, FileText, Shield } from 'lucide-react';
import {
  footballApi,
  getAccessToken,
  type FootballCaptain,
  type FootballInscription,
  type FootballRoster,
  type FootballTorneo,
} from '@/app/api/client';
import {
  FutbolError,
  FutbolPanelShell,
  FutbolSuccess,
  futbolButtonClass,
  futbolCardClass,
  futbolFieldClass,
  openListaBuenaFe,
  useFutbolOverview,
} from '../futbol-shared';
import { TeamLogoUpload } from '../components/TeamLogoUpload';

function formatFechaNacimiento(value?: string | null) {
  if (!value) return '—';
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${day}/${month}/${year}`;
  }
  return value;
}

function TeamAvatar({ logo, name }: { logo?: string | null; name: string }) {
  if (logo) {
    return <img src={logo} alt="" className="h-9 w-9 rounded-lg border border-border object-cover" />;
  }
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted text-xs font-semibold text-muted-foreground">
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function CreateTeamForm({
  torneos,
  defaultTorneoId,
  onCreated,
}: {
  torneos: FootballTorneo[];
  defaultTorneoId: string;
  onCreated: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [logo, setLogo] = useState('');
  const [torneoId, setTorneoId] = useState(defaultTorneoId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!torneoId && defaultTorneoId) setTorneoId(defaultTorneoId);
  }, [defaultTorneoId, torneoId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    if (!token || !name.trim() || !torneoId) return;
    setSaving(true);
    setError(null);
    try {
      const team = await footballApi.teams.create({ name: name.trim(), logo: logo || undefined }, token);
      await footballApi.inscriptions.create({ torneoId, equipoId: team.id }, token);
      setName('');
      setLogo('');
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el equipo');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`space-y-3 ${futbolCardClass('p-4')}`}>
      <h3 className="text-sm font-semibold text-foreground">Nuevo equipo</h3>
      {error && <FutbolError message={error} />}
      <div className="grid gap-3 md:grid-cols-2">
        <input
          className={futbolFieldClass()}
          placeholder="Nombre del equipo"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <select className={futbolFieldClass()} value={torneoId} onChange={(e) => setTorneoId(e.target.value)}>
          <option value="">Elegir categoría...</option>
          {torneos.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
            </option>
          ))}
        </select>
      </div>
      <TeamLogoUpload value={logo} onChange={setLogo} label="Logo (opcional)" />
      <button type="submit" disabled={saving || !name.trim() || !torneoId} className={futbolButtonClass()}>
        {saving ? 'Creando...' : 'Crear equipo'}
      </button>
    </form>
  );
}

function TeamDetail({
  row,
  torneos,
  onChanged,
}: {
  row: FootballInscription;
  torneos: FootballTorneo[];
  onChanged: () => Promise<void>;
}) {
  const [name, setName] = useState(row.equipo.name);
  const [logo, setLogo] = useState(row.equipo.logo ?? '');
  const [torneoId, setTorneoId] = useState(row.torneoId);
  const [activo, setActivo] = useState(row.activo);
  const [savingTeam, setSavingTeam] = useState(false);

  const [captains, setCaptains] = useState<FootballCaptain[]>([]);
  const [roster, setRoster] = useState<FootballRoster | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(true);

  const [capEmail, setCapEmail] = useState('');
  const [capDni, setCapDni] = useState('');
  const [savingCaptain, setSavingCaptain] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoadingDetail(true);
    try {
      const [allCaptains, rosterResp] = await Promise.all([
        footballApi.captains.list(token, row.torneoId),
        footballApi.roster.get(row.id, token),
      ]);
      setCaptains(allCaptains.filter((c) => c.equipoInscripcionId === row.id));
      setRoster(rosterResp);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el detalle');
    } finally {
      setLoadingDetail(false);
    }
  }, [row.id, row.torneoId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSaveTeam(e: React.FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    if (!token) return;
    setSavingTeam(true);
    setError(null);
    setInfo(null);
    try {
      if (name.trim() !== row.equipo.name || logo !== (row.equipo.logo ?? '')) {
        await footballApi.teams.update(row.equipoId, { name: name.trim(), logo: logo || undefined }, token);
      }
      if (torneoId !== row.torneoId || activo !== row.activo) {
        await footballApi.inscriptions.update(row.id, { torneoId, activo }, token);
      }
      setInfo('Datos del equipo actualizados.');
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setSavingTeam(false);
    }
  }

  async function handleAddCaptain(e: React.FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    if (!token || !capEmail.trim() || !capDni.trim()) return;
    setSavingCaptain(true);
    setError(null);
    try {
      await footballApi.captains.create(
        { email: capEmail.trim(), dni: capDni.trim(), torneoId: row.torneoId, equipoInscripcionId: row.id },
        token,
      );
      setCapEmail('');
      setCapDni('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el capitán');
    } finally {
      setSavingCaptain(false);
    }
  }

  async function toggleCaptainActivo(captain: FootballCaptain) {
    const token = getAccessToken();
    if (!token) return;
    await footballApi.captains.update(captain.id, { activo: !captain.activo }, token);
    await load();
  }

  return (
    <div className="space-y-4 border-t border-border bg-muted/30 p-4">
      {error && <FutbolError message={error} />}
      {info && <FutbolSuccess message={info} />}

      <form onSubmit={handleSaveTeam} className={`space-y-3 ${futbolCardClass('p-4')}`}>
        <h4 className="text-sm font-semibold text-foreground">Datos del equipo</h4>
        <div className="grid gap-3 md:grid-cols-2">
          <input className={futbolFieldClass()} value={name} onChange={(e) => setName(e.target.value)} />
          <select className={futbolFieldClass()} value={torneoId} onChange={(e) => setTorneoId(e.target.value)}>
            {torneos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </div>
        <TeamLogoUpload value={logo} onChange={setLogo} label="Logo" />
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
          Equipo activo
        </label>
        <button type="submit" disabled={savingTeam} className={futbolButtonClass()}>
          {savingTeam ? 'Guardando...' : 'Guardar datos del equipo'}
        </button>
      </form>

      <div className={futbolCardClass('p-4')}>
        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Shield size={16} className="text-[#3d7a3d]" />
          Capitán
        </h4>
        {loadingDetail ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : (
          <div className="space-y-3">
            {captains.length === 0 ? (
              <p className="text-sm text-muted-foreground">Este equipo todavía no tiene capitán registrado.</p>
            ) : (
              <ul className="space-y-2">
                {captains.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <span>
                      {c.email} <span className="text-muted-foreground">· DNI {c.dni}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleCaptainActivo(c)}
                      className={futbolButtonClass('ghost', 'px-3 py-1 text-xs')}
                    >
                      {c.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={handleAddCaptain} className="grid gap-2 sm:grid-cols-3">
              <input
                className={futbolFieldClass()}
                type="email"
                placeholder="Email del capitán"
                value={capEmail}
                onChange={(e) => setCapEmail(e.target.value)}
              />
              <input
                className={futbolFieldClass()}
                placeholder="DNI"
                value={capDni}
                onChange={(e) => setCapDni(e.target.value)}
              />
              <button
                type="submit"
                disabled={savingCaptain || !capEmail.trim() || !capDni.trim()}
                className={futbolButtonClass('ghost')}
              >
                {savingCaptain ? 'Guardando...' : 'Agregar capitán'}
              </button>
            </form>
          </div>
        )}
      </div>

      <div className={futbolCardClass('p-4')}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-foreground">Plantel</h4>
          <button
            type="button"
            className={`${futbolButtonClass('ghost')} flex items-center gap-2`}
            onClick={() => openListaBuenaFe(row.id).catch((e) => setError(String(e)))}
          >
            <FileText size={16} />
            Imprimir LBFE
          </button>
        </div>
        {loadingDetail ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-3">Jugador</th>
                  <th className="px-4 py-3">Dorsal</th>
                  <th className="px-4 py-3">DNI</th>
                  <th className="px-4 py-3">Fecha Nac.</th>
                  <th className="px-4 py-3">Email</th>
                </tr>
              </thead>
              <tbody>
                {(roster?.jugadores ?? []).map((j) => {
                  const esCapitan = roster?.capitan?.personaId === j.personaId;
                  return (
                    <tr key={j.id} className={`border-t border-border ${esCapitan ? 'bg-[#3d7a3d]/10' : ''}`}>
                      <td className="px-4 py-3">
                        {j.apellido}, {j.nombre}
                        {esCapitan && (
                          <span className="ml-2 rounded-full bg-[#3d7a3d] px-2 py-0.5 text-xs font-semibold text-white">
                            Capitán
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">{j.numeroCamiseta ?? '—'}</td>
                      <td className="px-4 py-3">{j.dni}</td>
                      <td className="px-4 py-3">{formatFechaNacimiento(j.fechaNacimiento)}</td>
                      <td className="px-4 py-3">{j.email ?? '—'}</td>
                    </tr>
                  );
                })}
                {(roster?.jugadores.length ?? 0) === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                      Sin jugadores cargados aún — los carga el capitán desde la web pública.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export function EquiposPanel() {
  const { torneoId } = useFutbolOverview();
  const [rows, setRows] = useState<FootballInscription[]>([]);
  const [torneos, setTorneos] = useState<FootballTorneo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [insc, allTorneos] = await Promise.all([
        footballApi.inscriptions.list(token, torneoId ?? undefined),
        footballApi.torneos(token),
      ]);
      setRows(insc);
      setTorneos(allTorneos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [torneoId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <FutbolPanelShell title="Equipos" subtitle={`${rows.length} equipo(s) inscriptos`}>
      {error && <FutbolError message={error} />}

      <CreateTeamForm torneos={torneos} defaultTorneoId={torneoId ?? ''} onCreated={reload} />

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando equipos...</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          {rows.map((row) => {
            const expanded = expandedId === row.id;
            return (
              <div key={row.id} className="border-b border-border last:border-0">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : row.id)}
                  className="flex w-full items-center gap-3 bg-card px-4 py-3 text-left hover:bg-muted/50"
                >
                  {expanded ? (
                    <ChevronDown size={16} className="shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
                  )}
                  <TeamAvatar logo={row.equipo.logo} name={row.equipo.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{row.equipo.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.torneo?.categoria?.nombre ?? '—'} · {row._count?.jugadores ?? 0} jugadores
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                      row.activo
                        ? 'bg-[#3d7a3d]/10 text-[#3d7a3d]'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {row.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </button>
                {expanded && <TeamDetail row={row} torneos={torneos} onChanged={reload} />}
              </div>
            );
          })}
          {rows.length === 0 && (
            <p className="bg-card px-4 py-6 text-center text-sm text-muted-foreground">
              No hay equipos cargados en esta categoría.
            </p>
          )}
        </div>
      )}
    </FutbolPanelShell>
  );
}
