import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { publicApi } from '../../../api/public-api';
import { usePublicAuth } from '../auth/PublicAuthContext';
import { useCart } from '../cart/CartContext';
import { PageLoader } from '../../ui/PageLoader';
import { IconCamera, IconCart, IconClock, IconFood, IconMapPin, RivalMark, StarBadge } from '../figma-icons';
import { CANTEEN_HERO_IMG, GALLERY_FALLBACK } from '../food-images';

function formatMatchDate(iso: string) {
  return new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'short',
  })
    .format(new Date(iso))
    .toUpperCase();
}

function displayName(email?: string | null) {
  if (!email) return null;
  const local = email.split('@')[0] ?? email;
  return local.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function HomePage() {
  const navigate = useNavigate();
  const { meContext, user } = usePublicAuth();
  const { count } = useCart();

  const { data, error, isLoading } = useQuery({
    queryKey: ['home-bundle'],
    queryFn: () => publicApi.homeBundle(),
  });
  const { data: torneo } = useQuery({
    queryKey: ['torneo'],
    queryFn: () => publicApi.torneo(),
  });
  const { data: media = [] } = useQuery({
    queryKey: ['media'],
    queryFn: () => publicApi.media(),
  });

  if (isLoading) return <PageLoader />;

  if (error) {
    return (
      <div className="p-6" style={{ maxWidth: 920, margin: '0 auto' }}>
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center text-red-300">
          <p className="font-medium">No pudimos cargar el sitio</p>
          <p className="mt-2 text-sm">{(error as Error).message}</p>
        </div>
      </div>
    );
  }

  const name = displayName(user?.email);
  const myTeam = meContext?.equipo?.name;
  const nextFromCtx = meContext?.proximoPartido;
  const nextPublic = data?.proximosPartidos[0];
  const played = (torneo?.partidos ?? []).filter((p) => p.status === 'jugado').slice(-3).reverse();
  const thumbs = media.filter((m) => m.type !== 'video').slice(0, 3);
  const galleryImgs = thumbs.length
    ? thumbs.map((t) => t.url)
    : GALLERY_FALLBACK;

  const localName = nextFromCtx?.local ?? nextPublic?.local.name;
  const awayName = nextFromCtx?.visitante ?? nextPublic?.visitante.name;
  const cancha = nextFromCtx?.cancha ?? nextPublic?.cancha;
  const hora = nextFromCtx?.hora ?? nextPublic?.hora;
  const fechaIso = nextFromCtx?.fecha ?? nextPublic?.fecha;
  const jornada = nextPublic?.jornada;

  return (
    <div className="space-y-5 p-6" style={{ maxWidth: 920, margin: '0 auto' }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            {user ? 'Bienvenido de vuelta' : 'Bienvenido al predio'}
          </p>
          <h1 className="mt-0.5 text-2xl font-black text-white">
            {name ? `¡Hola, ${name}!` : 'La Chacra Fútbol'}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => navigate('/carrito')}
          style={{ background: '#1c1c1c', border: '1px solid #2a2a2a', position: 'relative' }}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-gray-300 transition-all hover:border-[#6BFF9E44] hover:text-white"
          aria-label="Ver carrito"
        >
          <IconCart />
          {count > 0 && (
            <span
              style={{
                background: '#6BFF9E',
                color: '#0e0e0e',
                position: 'absolute',
                top: -6,
                right: -6,
                minWidth: 18,
                height: 18,
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 4px',
              }}
            >
              {count}
            </span>
          )}
        </button>
      </div>

      {localName && awayName ? (
        <div
          style={{ background: '#1c1c1c', border: '1px solid #2a2a2a', borderRadius: 14, overflow: 'hidden' }}
        >
          <div
            style={{ background: '#161616', borderBottom: '1px solid #222' }}
            className="flex items-center justify-between px-5 pb-2.5 pt-3"
          >
            <p className="text-xs font-bold uppercase tracking-widest text-white">
              {nextFromCtx ? 'Mi Próximo Partido' : 'Próximo partido'}
            </p>
            <span
              style={{ background: '#6BFF9E18', color: '#6BFF9E', border: '1px solid #6BFF9E33' }}
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-black"
            >
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#6BFF9E]" />
              {fechaIso ? formatMatchDate(fechaIso) : ''}
              {hora ? ` · ${hora}` : ''}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-6 px-5 py-4">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div
                style={{ background: '#6BFF9E15', border: '1px solid #6BFF9E33' }}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
              >
                <StarBadge />
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-black leading-tight text-white">{localName}</p>
                <p className="text-xs text-gray-500">Local</p>
              </div>
            </div>
            <div className="shrink-0 px-4 text-center">
              <p style={{ color: '#6BFF9E' }} className="text-3xl font-black leading-none">
                VS
              </p>
              {cancha && (
                <div className="mt-1.5 flex items-center justify-center gap-1 text-[10px] text-gray-600">
                  <IconMapPin /> {cancha}
                </div>
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-row-reverse items-center justify-end gap-3">
              <div
                style={{ background: '#252525', border: '1px solid #333' }}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
              >
                <RivalMark />
              </div>
              <div className="min-w-0 text-right">
                <p className="truncate text-base font-black leading-tight text-white">{awayName}</p>
                <p className="text-xs text-gray-500">Visitante</p>
              </div>
            </div>
            <div style={{ width: 1, height: 40, background: '#2a2a2a' }} className="hidden shrink-0 sm:block" />
            <div className="hidden shrink-0 space-y-1 text-right sm:block">
              <div className="flex items-center justify-end gap-1.5 text-xs text-gray-400">
                <IconClock /> {jornada ? `Jornada ${jornada}` : data?.torneo?.categoria ?? 'Torneo'}
              </div>
              <p className="text-[10px] text-gray-600">
                {data?.torneo?.campeonato ?? 'La Chacra Fútbol'}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {!!data?.sponsors.length && (
        <SponsorBanner
          sponsor={
            data.sponsors.find((s) => s.bannerLabel?.includes('Home')) ?? data.sponsors[0]
          }
        />
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div style={{ background: '#1c1c1c', border: '1px solid #2a2a2a' }} className="rounded-2xl p-5">
            <p className="mb-4 text-sm font-bold text-white">Últimos Resultados</p>
            {played.length ? (
              <div className="space-y-3">
                {played.map((r) => {
                  const myInvolved =
                    myTeam && (r.local === myTeam || r.visitante === myTeam);
                  const myScore = myInvolved
                    ? r.local === myTeam
                      ? r.homeGoals
                      : r.awayGoals
                    : r.homeGoals;
                  const oppScore = myInvolved
                    ? r.local === myTeam
                      ? r.awayGoals
                      : r.homeGoals
                    : r.awayGoals;
                  const won = (myScore ?? 0) > (oppScore ?? 0);
                  const drew = myScore === oppScore;
                  const label = won ? 'VICTORIA' : drew ? 'EMPATE' : 'DERROTA';
                  return (
                    <div
                      key={r.id}
                      style={{ background: '#161616', border: '1px solid #242424', borderRadius: 12 }}
                      className="px-4 py-3"
                    >
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-[10px] font-medium text-gray-600">
                          J{r.jornada ?? '—'}
                          {r.cancha ? ` · ${r.cancha}` : ''}
                        </span>
                        {myInvolved && (
                          <span
                            style={{
                              background: won ? '#6BFF9E18' : '#ffffff08',
                              color: won ? '#6BFF9E' : '#9ca3af',
                              border: `1px solid ${won ? '#6BFF9E33' : '#2a2a2a'}`,
                              borderRadius: 6,
                              fontSize: 9,
                              fontWeight: 900,
                              padding: '2px 7px',
                              letterSpacing: '0.06em',
                            }}
                          >
                            {label}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <p className="flex-1 truncate text-xs font-bold text-white">{r.local}</p>
                        <p
                          style={{ color: won ? '#6BFF9E' : '#9ca3af' }}
                          className="shrink-0 text-base font-black"
                        >
                          {r.homeGoals}-{r.awayGoals}
                        </p>
                        <p className="flex-1 truncate text-right text-xs font-bold text-gray-400">
                          {r.visitante}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Todavía no hay partidos jugados.</p>
            )}
          </div>

          {!!data?.standings.length && (
            <div
              style={{ background: '#1c1c1c', border: '1px solid #2a2a2a' }}
              className="flex-1 rounded-2xl p-5"
            >
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-bold text-white">Tabla de Posiciones</p>
                <button
                  type="button"
                  onClick={() => navigate('/torneo')}
                  style={{ color: '#6BFF9E' }}
                  className="text-xs font-bold hover:underline"
                >
                  Ver todo →
                </button>
              </div>
              <div className="mb-1 flex items-center gap-3 border-b border-[#242424] px-2 pb-1">
                <span className="w-5 text-[10px] font-bold text-gray-600">#</span>
                <span className="flex-1 text-[10px] font-bold text-gray-600">Equipo</span>
                <span className="w-6 text-center text-[10px] font-bold text-gray-600">PJ</span>
                <span className="w-6 text-center text-[10px] font-bold text-gray-600">PG</span>
                <span className="w-8 text-center text-[10px] font-bold text-gray-600">Pts</span>
              </div>
              {data.standings.slice(0, 6).map((row, i) => {
                const highlight = myTeam === row.teamName;
                return (
                  <div
                    key={row.inscripcionId}
                    style={
                      highlight
                        ? { background: '#6BFF9E0e', borderRadius: 9, border: '1px solid #6BFF9E22' }
                        : {}
                    }
                    className="flex items-center gap-3 px-2 py-2"
                  >
                    <span
                      style={{ color: highlight ? '#6BFF9E' : '#4b5563' }}
                      className="w-5 text-xs font-black"
                    >
                      {i + 1}
                    </span>
                    <span
                      style={{ color: highlight ? 'white' : '#d1d5db' }}
                      className="flex-1 truncate text-xs font-semibold"
                    >
                      {row.teamName}
                    </span>
                    <span className="w-6 text-center text-xs text-gray-500">{row.played}</span>
                    <span className="w-6 text-center text-xs text-gray-500">{row.won}</span>
                    <span
                      style={{
                        color: highlight ? '#6BFF9E' : 'white',
                        background: highlight ? '#6BFF9E15' : '#1a1a1a',
                        borderRadius: 6,
                        padding: '1px 0',
                      }}
                      className="w-8 text-center text-xs font-black"
                    >
                      {row.points}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => navigate('/cantina')}
            style={{ borderRadius: 18, overflow: 'hidden', cursor: 'pointer', position: 'relative', height: 300 }}
            className="text-left"
          >
            <img
              src={CANTEEN_HERO_IMG}
              alt="Cantina"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(105deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.75) 55%, rgba(0,0,0,0.2) 100%)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(105deg, rgba(107,255,158,0.08) 0%, transparent 50%)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                padding: '24px 26px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
              }}
            >
              <div style={{ marginBottom: 20 }}>
                <p
                  style={{
                    color: '#6BFF9E',
                    fontSize: 10,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.2em',
                    marginBottom: 10,
                  }}
                >
                  La Chacra · Canteen
                </p>
                <p
                  style={{
                    color: 'white',
                    fontSize: 30,
                    fontWeight: 900,
                    lineHeight: 1.05,
                    marginBottom: 10,
                  }}
                >
                  El Tercer
                  <br />
                  Tiempo es acá.
                </p>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 1.6 }}>
                  Hamburguesas · Pizzas · Bebidas
                  <br />
                  Pedí online, retirá sin filas.
                </p>
              </div>
              <span
                style={{
                  background: '#6BFF9E',
                  color: '#0e0e0e',
                  borderRadius: 12,
                  padding: '12px 22px',
                  fontSize: 13,
                  fontWeight: 900,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  alignSelf: 'flex-start',
                  letterSpacing: '0.02em',
                }}
              >
                <IconFood /> Ver Menú
              </span>
            </div>
          </button>

          <div
            style={{ background: '#1c1c1c', border: '1px solid #2a2a2a', borderRadius: 18, overflow: 'hidden' }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3, height: 100 }}>
              {galleryImgs.map((src, i) => (
                <div key={`${src}-${i}`} style={{ overflow: 'hidden', position: 'relative' }}>
                  <img
                    src={src}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                  {i === 2 && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(0,0,0,0.55)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <span className="text-sm font-black text-white">
                        {media.length > 3 ? `+${media.length - 2}` : 'Galería'}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p style={{ color: '#6BFF9E' }} className="text-[10px] font-black uppercase tracking-widest">
                  {data?.torneo?.campeonato ?? 'Torneo'}
                </p>
                <p className="mt-0.5 text-xs font-bold text-white">Fotos & Videos del finde</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/fotos')}
                style={{ background: '#1a1a1a', color: 'white', border: '1px solid #2a2a2a' }}
                className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold"
              >
                <IconCamera /> Ver todo
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SponsorBanner({
  sponsor,
}: {
  sponsor: {
    name: string;
    imageUrl?: string;
    linkUrl?: string | null;
    bannerLabel?: string | null;
    mediaType?: string;
    widthPx?: number | null;
    heightPx?: number | null;
  };
}) {
  const height = sponsor.heightPx ?? 86;
  const inner = (
    <div
      style={{
        borderRadius: 14,
        overflow: 'hidden',
        position: 'relative',
        height,
        border: '1px solid #2a2a2a',
      }}
    >
      {sponsor.imageUrl ? (
        sponsor.mediaType === 'video' ? (
          <video
            src={sponsor.imageUrl}
            autoPlay
            muted
            loop
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 30%' }}
          />
        ) : (
          <img
            src={sponsor.imageUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 30%' }}
          />
        )
      ) : (
        <div className="h-full w-full bg-[#161616]" />
      )}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to right, rgba(14,14,14,0.92) 40%, rgba(14,14,14,0.25))',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
        }}
      >
        <div>
          <span
            style={{
              color: '#6BFF9E',
              fontSize: 9,
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              display: 'block',
            }}
          >
            Sponsor oficial
          </span>
          <span
            style={{ color: 'white', fontSize: 17, fontWeight: 900, lineHeight: 1.2, display: 'block' }}
          >
            {sponsor.name}
          </span>
        </div>
        <div
          style={{
            background: '#6BFF9E',
            color: '#0e0e0e',
            padding: '6px 16px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 900,
            flexShrink: 0,
          }}
        >
          Ver más
        </div>
      </div>
    </div>
  );
  if (sponsor.linkUrl) {
    return (
      <a href={sponsor.linkUrl} target="_blank" rel="noreferrer">
        {inner}
      </a>
    );
  }
  return inner;
}
