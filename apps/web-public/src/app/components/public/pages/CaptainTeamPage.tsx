import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  UserPlus,
  X,
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
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

  async function handlePrintListaBuenaFe() {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const html = await publicApi.captain.getListaBuenaFe(token);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar la Lista de Buena Fe');
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
      if (editingId === player.personaId) setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo quitar jugador');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(player: RosterPlayer) {
    setEditingId(player.personaId);
    setShowForm(false);
    setEditForm({
      nombre: player.nombre,
      apellido: player.apellido,
      dni: player.dni,
      email: player.email ?? '',
      fechaNacimiento: player.fechaNacimiento?.slice(0, 10) ?? '',
      numeroCamiseta: player.numeroCamiseta != null ? String(player.numeroCamiseta) : '',
    });
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !editingId) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await publicApi.captain.updatePlayer(
        editingId,
        {
          nombre: editForm.nombre.trim(),
          apellido: editForm.apellido.trim(),
          dni: editForm.dni.replace(/\D/g, ''),
          email: editForm.email.trim(),
          fechaNacimiento: editForm.fechaNacimiento,
          numeroCamiseta: editForm.numeroCamiseta ? Number(editForm.numeroCamiseta) : null,
        },
        token,
      );
      setData(updated);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar jugador');
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
          <button
            type="button"
            onClick={() => void handlePrintListaBuenaFe()}
            disabled={saving || plantelCount === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-[#2a2a2a] bg-[#161616] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            <FileText size={16} />
            Lista de Buena Fe
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
                className="rounded-xl border border-[#2a2a2a] bg-[#161616]"
              >
                {editingId === p.personaId ? (
                  <form onSubmit={handleSaveEdit} className="space-y-3 p-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold">Editar jugador</h4>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-lg p-1 text-gray-500 hover:text-white"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        placeholder="Nombre"
                        value={editForm.nombre}
                        onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                        className="rounded-lg border border-[#2a2a2a] bg-[#0e0e0e] px-3 py-2 text-sm outline-none focus:border-lch-accent"
                        required
                      />
                      <input
                        placeholder="Apellido"
                        value={editForm.apellido}
                        onChange={(e) => setEditForm({ ...editForm, apellido: e.target.value })}
                        className="rounded-lg border border-[#2a2a2a] bg-[#0e0e0e] px-3 py-2 text-sm outline-none focus:border-lch-accent"
                        required
                      />
                      <input
                        placeholder="DNI"
                        inputMode="numeric"
                        value={editForm.dni}
                        onChange={(e) =>
                          setEditForm({ ...editForm, dni: e.target.value.replace(/\D/g, '') })
                        }
                        className="rounded-lg border border-[#2a2a2a] bg-[#0e0e0e] px-3 py-2 text-sm outline-none focus:border-lch-accent"
                        required
                      />
                      <input
                        placeholder="Email"
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        className="rounded-lg border border-[#2a2a2a] bg-[#0e0e0e] px-3 py-2 text-sm outline-none focus:border-lch-accent"
                        required
                      />
                      <input
                        type="date"
                        value={editForm.fechaNacimiento}
                        onChange={(e) =>
                          setEditForm({ ...editForm, fechaNacimiento: e.target.value })
                        }
                        className="rounded-lg border border-[#2a2a2a] bg-[#0e0e0e] px-3 py-2 text-sm outline-none focus:border-lch-accent"
                        required
                      />
                      <input
                        placeholder="N° camiseta"
                        inputMode="numeric"
                        value={editForm.numeroCamiseta}
                        onChange={(e) =>
                          setEditForm({ ...editForm, numeroCamiseta: e.target.value })
                        }
                        className="rounded-lg border border-[#2a2a2a] bg-[#0e0e0e] px-3 py-2 text-sm outline-none focus:border-lch-accent"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={saving}
                      className="w-full rounded-lg bg-lch-accent py-2 text-sm font-black text-[#0e0e0e] disabled:opacity-50"
                    >
                      {saving ? 'Guardando…' : 'Guardar cambios'}
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center justify-between px-4 py-3">
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
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => startEdit(p)}
                        className="rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-lch-accent"
                        aria-label="Editar jugador"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleRemove(p)}
                        className="rounded-lg p-2 text-red-400 hover:bg-red-500/10"
                        aria-label="Quitar jugador"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                )}
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
