import { useState } from 'react';
import { ArrowLeft, Pencil, Trash2, UserPlus, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFutbolIdentity } from '../auth/useFutbolIdentity';
import { usePublicAuth } from '../auth/PublicAuthContext';
import { publicApi, type RosterPlayer } from '../../../api/public-api';

/** `rolPlantel` llega como token (`capitan`/`jugador`); en pantalla va la etiqueta. */
function rolPlantelLabel(rolPlantel: string): string {
  if (rolPlantel === 'capitan') return 'Capitán';
  if (rolPlantel === 'jugador') return 'Jugador';
  return rolPlantel;
}

interface PlayerDraft {
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
  fechaNacimiento: string;
  numeroCamiseta: string;
  rolPlantel: string;
}

const EMPTY_DRAFT: PlayerDraft = {
  nombre: '', apellido: '', dni: '', email: '', fechaNacimiento: '', numeroCamiseta: '', rolPlantel: 'jugador',
};

function draftToPayload(draft: PlayerDraft): Omit<RosterPlayer, 'personaId' | 'inscripcionId'> {
  return {
    nombre: draft.nombre.trim(),
    apellido: draft.apellido.trim(),
    dni: draft.dni.trim(),
    email: draft.email.trim(),
    fechaNacimiento: draft.fechaNacimiento,
    numeroCamiseta: draft.numeroCamiseta.trim() ? Number(draft.numeroCamiseta) : null,
    rolPlantel: draft.rolPlantel,
  };
}

// `RosterPlayerDto` (backend) exige nombre, apellido, dni, email y
// fechaNacimiento — sólo numeroCamiseta y rolPlantel son opcionales.
function isValidDraft(draft: PlayerDraft): boolean {
  return Boolean(
    draft.nombre.trim() && draft.apellido.trim() && draft.dni.trim()
    && draft.email.trim() && draft.fechaNacimiento,
  );
}

export function CaptainTeamPage() {
  const navigate = useNavigate();
  const { token } = usePublicAuth();
  const { role, getCaptainTeam } = useFutbolIdentity();
  const data = getCaptainTeam();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PlayerDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  // `getCaptainTeam()` viene de un fetch que `useFutbolIdentity` sólo repite al
  // cambiar `token`/rol; cada mutación de plantel ya devuelve el plantel
  // actualizado (`CaptainTeamData.plantel`), así que lo guardamos acá para no
  // depender de un refetch para reflejar el cambio en pantalla.
  const [localPlantel, setLocalPlantel] = useState<RosterPlayer[] | null>(null);

  if (!data || role.rol !== 'capitan') {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center text-red-300">
        No se pudo cargar el equipo. Volvé a tu perfil e intentá de nuevo.
      </div>
    );
  }

  const plantel = localPlantel ?? data.plantel;
  const plantelCount = plantel.length;
  const maxPlantel = data.equipo.maxPlantel;

  const openCreate = () => {
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
    setError(null);
    setShowForm(true);
  };

  const openEdit = (player: RosterPlayer) => {
    setDraft({
      nombre: player.nombre,
      apellido: player.apellido,
      dni: player.dni,
      email: player.email ?? '',
      fechaNacimiento: player.fechaNacimiento ?? '',
      numeroCamiseta: player.numeroCamiseta != null ? String(player.numeroCamiseta) : '',
      rolPlantel: player.rolPlantel,
    });
    setEditingId(player.personaId);
    setError(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!token || !isValidDraft(draft)) return;
    setSaving(true);
    setError(null);
    try {
      const updated = editingId
        ? await publicApi.captain.updatePlayer(editingId, draftToPayload(draft), token)
        : await publicApi.captain.addPlayer(draftToPayload(draft), token);
      setLocalPlantel(updated.plantel);
      setShowForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el jugador');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (personaId: string) => {
    if (!token) return;
    setError(null);
    try {
      const updated = await publicApi.captain.removePlayer(personaId, token);
      setLocalPlantel(updated.plantel);
      setConfirmDeleteId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo quitar al jugador');
    }
  };

  return (
    <div className="space-y-5 p-6" style={{ maxWidth: 780, margin: '0 auto' }}>
      <button
        type="button"
        onClick={() => navigate('/perfil')}
        className="inline-flex items-center gap-1 text-sm text-lch-accent"
      >
        <ArrowLeft size={16} />
        Volver al perfil
      </button>

      <section className="rounded-2xl border border-[#2a2a2a] bg-lch-card p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-lch-accent">{data.equipo.categoria}</p>
        <h2 className="mt-1 text-xl font-black">{data.equipo.name}</h2>
        <p className="mt-1 text-sm text-gray-500">
          {data.torneo.campeonato} · {data.torneo.nombre}
        </p>
        <p className="mt-3 text-sm text-gray-400">
          Plantel: {plantelCount}/{maxPlantel}
        </p>

        {data.proximoPartido && (
          <p className="mt-2 text-sm text-gray-500">
            Próximo: vs {data.proximoPartido.rival} —{' '}
            {new Date(data.proximoPartido.fecha).toLocaleDateString('es-AR')}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openCreate}
            disabled={plantelCount >= maxPlantel}
            title={plantelCount >= maxPlantel ? 'El plantel llegó al máximo' : undefined}
            className="inline-flex items-center gap-2 rounded-xl bg-lch-accent px-4 py-2 text-sm font-black text-[#0e0e0e] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <UserPlus size={16} />
            Agregar jugador
          </button>
        </div>
      </section>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
      )}

      {showForm && (
        <section className="rounded-2xl border border-[#2a2a2a] bg-lch-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-black">{editingId ? 'Editar jugador' : 'Nuevo jugador'}</h3>
            <button type="button" onClick={() => setShowForm(false)} className="text-gray-400" aria-label="Cerrar">
              <X size={18} />
            </button>
          </div>
          <div className="space-y-3">
            <input
              value={draft.nombre}
              onChange={(e) => setDraft({ ...draft, nombre: e.target.value })}
              placeholder="Nombre"
              className="w-full rounded-lg border border-[#2a2a2a] bg-[#161616] px-3 py-2 text-sm outline-none"
            />
            <input
              value={draft.apellido}
              onChange={(e) => setDraft({ ...draft, apellido: e.target.value })}
              placeholder="Apellido"
              className="w-full rounded-lg border border-[#2a2a2a] bg-[#161616] px-3 py-2 text-sm outline-none"
            />
            <input
              value={draft.dni}
              onChange={(e) => setDraft({ ...draft, dni: e.target.value })}
              placeholder="DNI"
              className="w-full rounded-lg border border-[#2a2a2a] bg-[#161616] px-3 py-2 text-sm outline-none"
            />
            <input
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              placeholder="Mail"
              className="w-full rounded-lg border border-[#2a2a2a] bg-[#161616] px-3 py-2 text-sm outline-none"
            />
            <input
              type="date"
              value={draft.fechaNacimiento}
              onChange={(e) => setDraft({ ...draft, fechaNacimiento: e.target.value })}
              className="w-full rounded-lg border border-[#2a2a2a] bg-[#161616] px-3 py-2 text-sm outline-none"
            />
            <input
              type="number"
              value={draft.numeroCamiseta}
              onChange={(e) => setDraft({ ...draft, numeroCamiseta: e.target.value })}
              placeholder="Número de camiseta (opcional)"
              className="w-full rounded-lg border border-[#2a2a2a] bg-[#161616] px-3 py-2 text-sm outline-none"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-[#2a2a2a] px-4 py-2 text-sm">
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!isValidDraft(draft) || saving}
                className="rounded-lg bg-lch-accent px-4 py-2 text-sm font-black text-[#0e0e0e] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-[#2a2a2a] bg-lch-card p-5">
        <h3 className="mb-3 font-black">Plantel ({plantelCount})</h3>
        {!plantel.length ? (
          <p className="text-sm text-gray-500">Todavía no hay jugadores cargados.</p>
        ) : (
          <ul className="space-y-2">
            {plantel.map((p) => (
              <li key={p.personaId} className="rounded-xl border border-[#2a2a2a] bg-[#161616]">
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-bold">
                      {p.apellido}, {p.nombre}
                      {p.numeroCamiseta != null ? ` · #${p.numeroCamiseta}` : ''}
                    </p>
                    <p className="text-xs text-gray-500">
                      DNI {p.dni} · {rolPlantelLabel(p.rolPlantel)}
                      {p.email ? ` · ${p.email}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(p)}
                      className="rounded-lg p-2 text-gray-400 hover:text-lch-accent"
                      aria-label="Editar jugador"
                    >
                      <Pencil size={16} />
                    </button>
                    {confirmDeleteId === p.personaId ? (
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => handleDelete(p.personaId)} className="rounded-lg bg-red-500 px-2 py-1 text-xs text-white">
                          Sí
                        </button>
                        <button type="button" onClick={() => setConfirmDeleteId(null)} className="rounded-lg border border-[#2a2a2a] px-2 py-1 text-xs">
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(p.personaId)}
                        className="rounded-lg p-2 text-red-400 hover:text-red-300"
                        aria-label="Quitar jugador"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
