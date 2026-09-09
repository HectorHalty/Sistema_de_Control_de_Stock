import { ArrowLeft, Pencil, Trash2, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFutbolIdentity } from '../auth/useFutbolIdentity';

// Panel de capitán servido por el adapter de identidad (`useFutbolIdentity`).
// `getCaptainTeam()` sólo devuelve datos cuando el rol efectivo es `capitan`.
// Las mutaciones del plantel quedan deshabilitadas hasta que se conecte el
// torneo real: se muestra el plantel actual en modo lectura.
const MUT_DISABLED_TITLE = 'Disponible cuando se conecte el torneo';

/** `rolPlantel` llega como token (`capitan`/`jugador`); en pantalla va la etiqueta. */
function rolPlantelLabel(rolPlantel: string): string {
  if (rolPlantel === 'capitan') return 'Capitán';
  if (rolPlantel === 'jugador') return 'Jugador';
  return rolPlantel;
}

export function CaptainTeamPage() {
  const navigate = useNavigate();
  const { role, getCaptainTeam } = useFutbolIdentity();
  const data = getCaptainTeam();

  if (!data || role.rol !== 'capitan') {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center text-red-300">
        No se pudo cargar el equipo. Volvé a tu perfil e intentá de nuevo.
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
            disabled
            title={MUT_DISABLED_TITLE}
            className="inline-flex items-center gap-2 rounded-xl bg-lch-accent px-4 py-2 text-sm font-black text-[#0e0e0e] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <UserPlus size={16} />
            Agregar jugador
          </button>
        </div>
      </section>

      <p className="rounded-lg border border-[#2a2a2a] bg-[#161616] px-3 py-2 text-xs text-gray-400">
        La edición del plantel está deshabilitada hasta que se conecte el torneo. Podés ver el plantel actual.
      </p>

      <section className="rounded-2xl border border-[#2a2a2a] bg-lch-card p-5">
        <h3 className="mb-3 font-black">Plantel ({plantelCount})</h3>
        {!data.plantel.length ? (
          <p className="text-sm text-gray-500">Todavía no hay jugadores cargados.</p>
        ) : (
          <ul className="space-y-2">
            {data.plantel.map((p) => (
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
                      disabled
                      title={MUT_DISABLED_TITLE}
                      className="rounded-lg p-2 text-gray-400 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Editar jugador"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      disabled
                      title={MUT_DISABLED_TITLE}
                      className="rounded-lg p-2 text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Quitar jugador"
                    >
                      <Trash2 size={16} />
                    </button>
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
