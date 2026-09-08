import { useCallback, useEffect, useState } from 'react';
import {
  footballApi,
  getAccessToken,
  type FootballCategoriaConfig,
  type FootballInscription,
  type FootballTorneo,
} from '@/app/api/client';
import {
  FutbolError,
  FutbolPanelShell,
  futbolButtonClass,
  futbolFieldClass,
} from '../futbol-shared';

const GENEROS: { value: 'hombres' | 'mujeres'; label: string }[] = [
  { value: 'hombres', label: 'Hombres' },
  { value: 'mujeres', label: 'Mujeres' },
];

interface CategoriaFormState {
  codigo: string;
  nombre: string;
  genero: 'hombres' | 'mujeres';
  maxPlantel: string;
  colorHex: string;
}

const emptyForm: CategoriaFormState = {
  codigo: '',
  nombre: '',
  genero: 'hombres',
  maxPlantel: '',
  colorHex: '#6BFF9E',
};

export function CategoriasPanel() {
  const [categorias, setCategorias] = useState<FootballCategoriaConfig[]>([]);
  const [torneos, setTorneos] = useState<FootballTorneo[]>([]);
  const [inscripciones, setInscripciones] = useState<FootballInscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [form, setForm] = useState<CategoriaFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [campeonatoId, setCampeonatoId] = useState('');
  const [bootstrapping, setBootstrapping] = useState(false);

  const [moveTargets, setMoveTargets] = useState<Record<string, string>>({});
  const [movingId, setMovingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [cats, torns, inscs] = await Promise.all([
        footballApi.categorias.list(token),
        footballApi.torneos(token),
        footballApi.inscriptions.list(token),
      ]);
      setCategorias(cats);
      setTorneos(torns);
      setInscripciones(inscs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function startEdit(cat: FootballCategoriaConfig) {
    setEditingId(cat.id);
    setForm({
      codigo: cat.codigo,
      nombre: cat.nombre,
      genero: cat.genero,
      maxPlantel: cat.maxPlantel != null ? String(cat.maxPlantel) : '',
      colorHex: cat.colorHex ?? '#6BFF9E',
    });
    setInfo(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    if (!token || !form.codigo.trim() || !form.nombre.trim()) return;
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const maxPlantel = form.maxPlantel.trim() ? Number(form.maxPlantel) : undefined;
      if (editingId) {
        await footballApi.categorias.update(
          editingId,
          {
            codigo: form.codigo.trim(),
            nombre: form.nombre.trim(),
            genero: form.genero,
            maxPlantel,
            colorHex: form.colorHex || undefined,
          },
          token,
        );
        setInfo('Categoría actualizada.');
      } else {
        await footballApi.categorias.create(
          {
            codigo: form.codigo.trim(),
            nombre: form.nombre.trim(),
            genero: form.genero,
            maxPlantel,
            colorHex: form.colorHex || undefined,
          },
          token,
        );
        setInfo('Categoría creada.');
      }
      resetForm();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la categoría');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(cat: FootballCategoriaConfig) {
    const token = getAccessToken();
    if (!token) return;
    if (!window.confirm(`¿Borrar la categoría "${cat.nombre}"? Esta acción no se puede deshacer.`)) return;
    setDeletingId(cat.id);
    setError(null);
    setInfo(null);
    try {
      await footballApi.categorias.remove(cat.id, token);
      setInfo('Categoría eliminada.');
      if (editingId === cat.id) resetForm();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la categoría');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleBootstrap() {
    const token = getAccessToken();
    if (!token) return;
    setBootstrapping(true);
    setError(null);
    setInfo(null);
    try {
      const result = await footballApi.bootstrapTorneos(token, campeonatoId.trim() || undefined);
      setInfo(`Torneos generados: ${result.created} (campeonato ${result.campeonatoId}).`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el bootstrap de torneos');
    } finally {
      setBootstrapping(false);
    }
  }

  async function handleMove(inscripcion: FootballInscription) {
    const token = getAccessToken();
    const targetTorneoId = moveTargets[inscripcion.id];
    if (!token || !targetTorneoId || targetTorneoId === inscripcion.torneoId) return;
    setMovingId(inscripcion.id);
    setError(null);
    setInfo(null);
    try {
      await footballApi.inscriptions.update(inscripcion.id, { torneoId: targetTorneoId }, token);
      setInfo(`Equipo "${inscripcion.equipo.name}" reasignado.`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo reasignar el equipo');
    } finally {
      setMovingId(null);
    }
  }

  return (
    <FutbolPanelShell title="Categorías">
      {error && <FutbolError message={error} />}
      {info && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-300">
          {info}
        </div>
      )}

      {/* Alta / edición de categorías */}
      <form
        onSubmit={handleSubmit}
        className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-6"
      >
        <input
          className={futbolFieldClass()}
          placeholder="Código"
          value={form.codigo}
          onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
        />
        <input
          className={`${futbolFieldClass()} md:col-span-2`}
          placeholder="Nombre"
          value={form.nombre}
          onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
        />
        <select
          className={futbolFieldClass()}
          value={form.genero}
          onChange={(e) => setForm((f) => ({ ...f, genero: e.target.value as 'hombres' | 'mujeres' }))}
        >
          {GENEROS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
        <input
          className={futbolFieldClass()}
          type="number"
          min={1}
          placeholder="Cupo plantel"
          value={form.maxPlantel}
          onChange={(e) => setForm((f) => ({ ...f, maxPlantel: e.target.value }))}
        />
        <input
          type="color"
          className="h-10 w-full rounded-lg border border-border bg-background"
          value={form.colorHex}
          onChange={(e) => setForm((f) => ({ ...f, colorHex: e.target.value }))}
        />
        <div className="flex gap-2 md:col-span-6">
          <button
            type="submit"
            disabled={saving || !form.codigo.trim() || !form.nombre.trim()}
            className={futbolButtonClass()}
          >
            {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear categoría'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className={futbolButtonClass('ghost')}>
              Cancelar edición
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando categorías...</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Género</th>
                <th className="px-4 py-3">Cupo plantel</th>
                <th className="px-4 py-3">Color</th>
                <th className="px-4 py-3">Torneos</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {categorias.map((cat) => (
                <tr key={cat.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{cat.codigo}</td>
                  <td className="px-4 py-3">{cat.nombre}</td>
                  <td className="px-4 py-3 capitalize">{cat.genero}</td>
                  <td className="px-4 py-3">{cat.maxPlantel}</td>
                  <td className="px-4 py-3">
                    {cat.colorHex ? (
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="inline-block h-4 w-4 rounded-full border border-border"
                          style={{ background: cat.colorHex }}
                        />
                        {cat.colorHex}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3">{cat._count?.torneos ?? 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(cat)}
                        className={futbolButtonClass('ghost')}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === cat.id}
                        onClick={() => handleDelete(cat)}
                        className={futbolButtonClass('ghost')}
                      >
                        {deletingId === cat.id ? 'Borrando...' : 'Borrar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {categorias.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                    No hay categorías cargadas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Torneos existentes + bootstrap */}
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">Torneos</h3>
        <p className="text-xs text-muted-foreground">
          No hay un endpoint para crear campeonatos (temporadas) desde este panel todavía —
          pegá el ID de un campeonato ya existente para generar (o completar) un torneo por
          cada categoría configurada.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            className={futbolFieldClass('max-w-xs')}
            placeholder="ID de campeonato (opcional)"
            value={campeonatoId}
            onChange={(e) => setCampeonatoId(e.target.value)}
          />
          <button
            type="button"
            onClick={handleBootstrap}
            disabled={bootstrapping}
            className={futbolButtonClass()}
          >
            {bootstrapping ? 'Generando...' : 'Bootstrap torneos'}
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3">Torneo</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Campeonato</th>
                <th className="px-4 py-3">Activo</th>
                <th className="px-4 py-3">Publicado</th>
              </tr>
            </thead>
            <tbody>
              {torneos.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{t.nombre}</td>
                  <td className="px-4 py-3">{t.categoria?.nombre ?? '—'}</td>
                  <td className="px-4 py-3">{t.campeonato?.nombre ?? '—'}</td>
                  <td className="px-4 py-3">{t.activo ? 'Sí' : 'No'}</td>
                  <td className="px-4 py-3">{t.publicado ? 'Sí' : 'No'}</td>
                </tr>
              ))}
              {torneos.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    No hay torneos cargados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reasignar equipo a otro torneo/categoría */}
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">Reasignar equipo a otro torneo</h3>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3">Equipo</th>
                <th className="px-4 py-3">Torneo actual</th>
                <th className="px-4 py-3">Mover a</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {inscripciones.map((insc) => (
                <tr key={insc.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{insc.equipo.name}</td>
                  <td className="px-4 py-3">{insc.torneo?.nombre ?? '—'}</td>
                  <td className="px-4 py-3">
                    <select
                      className={futbolFieldClass()}
                      value={moveTargets[insc.id] ?? insc.torneoId}
                      onChange={(e) =>
                        setMoveTargets((m) => ({ ...m, [insc.id]: e.target.value }))
                      }
                    >
                      {torneos.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nombre}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={
                        movingId === insc.id ||
                        !moveTargets[insc.id] ||
                        moveTargets[insc.id] === insc.torneoId
                      }
                      onClick={() => handleMove(insc)}
                      className={futbolButtonClass('ghost')}
                    >
                      {movingId === insc.id ? 'Moviendo...' : 'Mover'}
                    </button>
                  </td>
                </tr>
              ))}
              {inscripciones.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                    No hay equipos inscriptos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </FutbolPanelShell>
  );
}
