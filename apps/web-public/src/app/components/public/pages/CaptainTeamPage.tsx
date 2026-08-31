import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { publicApi, type CaptainTeamData, type RosterPlayer } from '../../../api/public-api';
import { usePublicAuth } from '../auth/PublicAuthContext';

const emptyForm = {
  nombre: '',
  apellido: '',
  dni: '',
  email: '',
  fechaNacimiento: '',
  numeroCamiseta: '',
};

export function CaptainTeamPage() {
  const navigate = useNavigate();
  const { token } = usePublicAuth();
  const [data, setData] = useState<CaptainTeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function loadTeam() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const team = await publicApi.captain.getTeam(token);
      setData(team);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar plantel');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTeam();
  }, [token]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await publicApi.captain.addPlayer(
        {
          nombre: form.nombre.trim(),
          apellido: form.apellido.trim(),
          dni: form.dni.replace(/\D/g, ''),
          email: form.email.trim(),
          fechaNacimiento: form.fechaNacimiento,
          numeroCamiseta: form.numeroCamiseta ? Number(form.numeroCamiseta) : null,
          rolPlantel: 'jugador',
        },
        token,
      );
      setData(updated);
      setForm(emptyForm);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo agregar jugador');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(player: RosterPlayer) {
    if (!token || !confirm(`¿Quitar a ${player.nombre} ${player.apellido} del plantel?`)) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await publicApi.captain.removePlayer(player.personaId, token);
      setData(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo quitar jugador');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-lch-accent">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center text-red-300">
        {error ?? 'No se pudo cargar el equipo'}
      </div>
    );
  }

  const plantelCount = data.plantel.length;
  const maxPlantel = data.equipo.maxPlantel;

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
            onClick={() => setShowForm((v) => !v)}
            disabled={plantelCount >= maxPlantel || saving}
            className="inline-flex items-center gap-2 rounded-xl bg-lch-accent px-4 py-2 text-sm font-black text-[#0e0e0e] disabled:opacity-50"
          >
            <UserPlus size={16} />
            Agregar jugador
          </button>
        </div>
      </section>

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="space-y-3 rounded-2xl border border-[#2a2a2a] bg-lch-card p-5"
        >
          <h3 className="font-semibold">Nuevo jugador</h3>
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Nombre"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="rounded-xl border border-[#2a2a2a] bg-[#161616] px-3 py-2 text-sm outline-none focus:border-lch-accent"
              required
            />
            <input
              placeholder="Apellido"
              value={form.apellido}
              onChange={(e) => setForm({ ...form, apellido: e.target.value })}
              className="rounded-xl border border-[#2a2a2a] bg-[#161616] px-3 py-2 text-sm outline-none focus:border-lch-accent"
              required
            />
            <input
              placeholder="DNI"
              inputMode="numeric"
              value={form.dni}
              onChange={(e) => setForm({ ...form, dni: e.target.value.replace(/\D/g, '') })}
              className="rounded-xl border border-[#2a2a2a] bg-[#161616] px-3 py-2 text-sm outline-none focus:border-lch-accent"
              required
            />
            <input
              placeholder="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="rounded-xl border border-[#2a2a2a] bg-[#161616] px-3 py-2 text-sm outline-none focus:border-lch-accent"
              required
            />
            <input
              placeholder="Nacimiento (AAAA-MM-DD)"
              type="date"
              value={form.fechaNacimiento}
              onChange={(e) => setForm({ ...form, fechaNacimiento: e.target.value })}
              className="rounded-xl border border-[#2a2a2a] bg-[#161616] px-3 py-2 text-sm outline-none focus:border-lch-accent"
              required
            />
            <input
              placeholder="N° camiseta"
              inputMode="numeric"
              value={form.numeroCamiseta}
              onChange={(e) => setForm({ ...form, numeroCamiseta: e.target.value })}
              className="rounded-xl border border-[#2a2a2a] bg-[#161616] px-3 py-2 text-sm outline-none focus:border-lch-accent"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-lch-accent py-2.5 text-sm font-black text-[#0e0e0e]"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
            Guardar
          </button>
        </form>
      )}

      <section className="rounded-2xl border border-[#2a2a2a] bg-lch-card p-5">
        <h3 className="mb-3 font-black">Plantel ({plantelCount})</h3>
        {!data.plantel.length ? (
          <p className="text-sm text-gray-500">Todavía no hay jugadores cargados.</p>
        ) : (
          <ul className="space-y-2">
            {data.plantel.map((p) => (
              <li
                key={p.personaId}
                className="flex items-center justify-between rounded-xl border border-[#2a2a2a] bg-[#161616] px-4 py-3"
              >
                <div>
                  <p className="font-bold">
                    {p.apellido}, {p.nombre}
                    {p.numeroCamiseta != null ? ` · #${p.numeroCamiseta}` : ''}
                  </p>
                  <p className="text-xs text-gray-500">
                    DNI {p.dni}
                    {p.email ? ` · ${p.email}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleRemove(p)}
                  className="rounded-lg p-2 text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
      )}
    </div>
  );
}
