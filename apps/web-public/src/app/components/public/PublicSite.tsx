import { useState, useMemo, useEffect } from 'react';
import { Trophy, Clock, MapPin, Shield, ShoppingCart, UtensilsCrossed, ChevronRight, Star, ExternalLink, Image, Video, Calendar, ChevronLeft, ChevronRight as ChevronRightIcon } from 'lucide-react';
import { usePublicAppContext } from '../PublicAppContext';
import { footballMatches, footballTeams } from '../futbol/data';
import { buildStandings, getUpcomingMatches } from '../futbol/domain';
import type { SalesProduct, MediaItem, Sponsor as LocalSponsor, OnlineProduct as LocalOnlineProduct } from '../store';
import { isOnlineProductAvailable, groupMediaByDate } from '../online/cms-domain';
import { useMediaApiAdapter, useSponsorsApiAdapter, useOnlineCatalogApiAdapter } from '../../api/adapters';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value);
}

interface PublicSiteProps {
  onLoginClick: () => void;
}

export function PublicSite({ onLoginClick }: PublicSiteProps) {
  const { salesProducts, sponsors: localSponsors, products, onlineProducts: localOnlineProducts, mediaItems: localMediaItems } = usePublicAppContext();
  const mediaApi = useMediaApiAdapter();
  const sponsorsApi = useSponsorsApiAdapter();
  const catalogApi = useOnlineCatalogApiAdapter();

  // API-first data: use API data when available, fallback to localStorage
  const [apiSponsors, setApiSponsors] = useState<LocalSponsor[]>([]);
  const [apiMedia, setApiMedia] = useState<MediaItem[]>([]);
  const [apiOnlineProducts, setApiOnlineProducts] = useState<LocalOnlineProduct[]>([]);

  useEffect(() => {
    if (sponsorsApi.apiAvailable) {
      sponsorsApi.list(true).then(setApiSponsors);
    }
  }, [sponsorsApi.apiAvailable]);

  useEffect(() => {
    if (mediaApi.apiAvailable) {
      mediaApi.list().then(setApiMedia);
    }
  }, [mediaApi.apiAvailable]);

  useEffect(() => {
    if (catalogApi.apiAvailable) {
      catalogApi.list(true).then(setApiOnlineProducts);
    }
  }, [catalogApi.apiAvailable]);

  // Use API data when available, fallback to localStorage
  const sponsors = sponsorsApi.apiAvailable ? apiSponsors : localSponsors;
  const mediaItems = mediaApi.apiAvailable ? apiMedia : localMediaItems;
  const onlineProducts = catalogApi.apiAvailable ? apiOnlineProducts : localOnlineProducts;

  const [activeSection, setActiveSection] = useState<'tournament' | 'canteen' | 'media'>('tournament');
  const [canteenCategory, setCanteenCategory] = useState<string>('Todas');
  const [selectedMediaDate, setSelectedMediaDate] = useState<string>('');

  const standings = useMemo(() => buildStandings(footballTeams, footballMatches), []);
  const upcoming = useMemo(() => getUpcomingMatches(footballMatches), []);

  const activeMenu = useMemo(() => {
    const active = salesProducts.filter(p => p.active);
    if (canteenCategory === 'Todas') return active;
    return active.filter(p => p.category === canteenCategory);
  }, [salesProducts, canteenCategory]);

  const menuCategories = useMemo(() => {
    const cats = ['Todas', ...Array.from(new Set(salesProducts.filter(p => p.active).map(p => p.category)))];
    return cats;
  }, [salesProducts]);

  const activeSponsors = useMemo(() => sponsors.filter(s => s.active), [sponsors]);
  const bannerSponsors = useMemo(() => activeSponsors.filter(s => s.placement === 'banner'), [activeSponsors]);
  const fullscreenSponsors = useMemo(() => activeSponsors.filter(s => s.placement === 'fullscreen'), [activeSponsors]);

  // Online products (from CMS)
  const availableOnlineProducts = useMemo(() => {
    return onlineProducts.filter(p => isOnlineProductAvailable(p, products));
  }, [onlineProducts, products]);

  // Media grouped by date
  const mediaByDate = useMemo(() => groupMediaByDate(mediaItems), [mediaItems]);
  const mediaDates = useMemo(() => Object.keys(mediaByDate), [mediaByDate]);

  const checkProductStock = (product: SalesProduct): boolean => {
    if (product.recipe.length === 0) return true;
    const stockMap = new Map(products.map(p => [p.id, p]));
    for (const recipeItem of product.recipe) {
      const stock = stockMap.get(recipeItem.stockProductId);
      if (!stock) return false;
      const available = stock.stockByWarehouse.reduce((s, w) => s + w.quantity, 0);
      if (available < recipeItem.quantity) return false;
    }
    return true;
  };

  return (
    <div className="min-h-screen bg-[#131313] text-[#e5e2e1]">
      {/* Fullscreen sponsor overlay */}
      {fullscreenSponsors.length > 0 && (
        <div className="relative overflow-hidden">
          <div className="h-48 md:h-64 relative">
            <img
              src={fullscreenSponsors[0].imageUrl}
              alt={fullscreenSponsors[0].name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#131313] via-[#131313]/50 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
              <span className="text-xs text-[#bccabb] bg-[#131313]/60 px-2 py-1 rounded-full">Sponsor Oficial</span>
              {fullscreenSponsors[0].linkUrl && (
                <a href={fullscreenSponsors[0].linkUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#6bfb9a] flex items-center gap-1 hover:underline">
                  Visitar <ExternalLink size={10} />
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <header className="sticky top-0 z-50 bg-[#131313]/95 backdrop-blur-sm border-b border-[#27272A]">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#3d7a3d] rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">LCH</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#6bfb9a] tracking-tight">La Chacra</h1>
              <p className="text-[10px] text-[#bccabb] uppercase tracking-wider">Sports Complex</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveSection('tournament')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${activeSection === 'tournament' ? 'bg-[#6bfb9a]/10 text-[#6bfb9a] border border-[#6bfb9a]/30' : 'bg-[#201f1f] text-[#bccabb] hover:bg-[#2a2a2a] border border-[#3d4a3e]'}`}
            >
              <Trophy size={14} /> Torneo
            </button>
            <button
              onClick={() => setActiveSection('canteen')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${activeSection === 'canteen' ? 'bg-[#6bfb9a]/10 text-[#6bfb9a] border border-[#6bfb9a]/30' : 'bg-[#201f1f] text-[#bccabb] hover:bg-[#2a2a2a] border border-[#3d4a3e]'}`}
            >
              <UtensilsCrossed size={14} /> Cantina
            </button>
            {mediaItems.length > 0 && (
              <button
                onClick={() => setActiveSection('media')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${activeSection === 'media' ? 'bg-[#6bfb9a]/10 text-[#6bfb9a] border border-[#6bfb9a]/30' : 'bg-[#201f1f] text-[#bccabb] hover:bg-[#2a2a2a] border border-[#3d4a3e]'}`}
              >
                <Image size={14} /> Galeria
              </button>
            )}
            <button
              onClick={onLoginClick}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-[#3d7a3d] text-[#003919] hover:bg-[#4ade80] transition-colors ml-2"
            >
              Iniciar Sesion
            </button>
          </div>
        </div>
      </header>

      {/* Banner sponsors */}
      {bannerSponsors.length > 0 && (
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex gap-4 overflow-x-auto hide-scrollbar">
            {bannerSponsors.map(sponsor => (
              <a
                key={sponsor.id}
                href={sponsor.linkUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 h-16 w-48 bg-[#1A1A1A] border border-[#27272A] rounded-lg overflow-hidden hover:border-[#6bfb9a]/30 transition-colors"
              >
                {sponsor.imageUrl ? (
                  <img src={sponsor.imageUrl} alt={sponsor.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#bccabb] text-xs font-bold">{sponsor.name}</div>
                )}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {activeSection === 'tournament' && (
          <div className="space-y-6">
            {/* Next match hero */}
            {upcoming.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold text-[#e5e2e1] mb-4">Proximo Partido</h2>
                <div className="bg-[#1A1A1A] border border-[#27272A] rounded-xl p-6 relative overflow-hidden">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-8">
                      <div className="flex flex-col items-center">
                        <div className="w-16 h-16 md:w-20 md:h-20 bg-[#2a2a2a] rounded-full border border-[#3d4a3e] flex items-center justify-center mb-2">
                          <Shield className="w-8 h-8 text-[#6bfb9a] fill-current" />
                        </div>
                        <span className="text-base font-bold text-center">
                          {footballTeams.find(t => t.id === upcoming[0].homeTeamId)?.name || 'Local'}
                        </span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-3xl md:text-5xl font-black text-[#353534]">VS</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="w-16 h-16 md:w-20 md:h-20 bg-[#2a2a2a] rounded-full border border-[#3d4a3e] flex items-center justify-center mb-2">
                          <Shield className="w-8 h-8 text-[#ffb4ab] fill-current" />
                        </div>
                        <span className="text-base font-bold text-center">
                          {footballTeams.find(t => t.id === upcoming[0].awayTeamId)?.name || 'Visitante'}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-center md:items-end gap-2 border-t md:border-t-0 md:border-l border-[#27272A] pt-4 md:pt-0 md:pl-6">
                      <div className="flex items-center gap-2 text-[#6bfb9a]">
                        <Clock className="w-5 h-5" />
                        <span className="text-xl font-bold">
                          {new Date(upcoming[0].dateISO).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[#bccabb]">
                        <MapPin className="w-5 h-5" />
                        <span className="text-base">{upcoming[0].field || 'Cancha por definir'}</span>
                      </div>
                      <span className="text-xs text-[#6bfb9a] bg-[#6bfb9a]/10 px-2 py-1 rounded-full font-bold uppercase">
                        Fecha {upcoming[0].round}
                      </span>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* League table */}
            <section>
              <div className="flex justify-between items-end mb-4">
                <h3 className="text-xl font-semibold text-[#e5e2e1]">Tabla de Posiciones</h3>
              </div>
              <div className="bg-[#1A1A1A] border border-[#27272A] rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[320px]">
                    <thead>
                      <tr className="bg-[#2a2a2a] border-b border-[#27272A]">
                        <th className="p-3 text-xs font-bold uppercase tracking-widest text-[#bccabb] w-12 text-center">Pos</th>
                        <th className="p-3 text-xs font-bold uppercase tracking-widest text-[#bccabb]">Equipo</th>
                        <th className="p-3 text-xs font-bold uppercase tracking-widest text-[#bccabb] text-center w-12 hidden sm:table-cell">PJ</th>
                        <th className="p-3 text-xs font-bold uppercase tracking-widest text-[#bccabb] text-center w-12 hidden sm:table-cell">DIF</th>
                        <th className="p-3 text-xs font-bold uppercase tracking-widest text-[#6bfb9a] text-center w-12">PTS</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {standings.map((row, idx) => (
                        <tr key={row.teamId} className={`border-b border-[#27272A] ${idx === 0 ? 'bg-[#6bfb9a]/5' : ''} hover:bg-[#2a2a2a] transition-colors`}>
                          <td className="p-3 text-center font-bold text-[#6bfb9a]">{idx + 1}</td>
                          <td className="p-3 font-bold text-[#e5e2e1] flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-[#353534] flex items-center justify-center text-[10px]">
                              {(footballTeams.find(t => t.id === row.teamId)?.name || 'E').slice(0, 2).toUpperCase()}
                            </div>
                            {footballTeams.find(t => t.id === row.teamId)?.name || 'Equipo'}
                          </td>
                          <td className="p-3 text-center text-[#bccabb] hidden sm:table-cell">{row.played}</td>
                          <td className="p-3 text-center text-[#bccabb] hidden sm:table-cell">{row.goalsFor - row.goalsAgainst > 0 ? '+' : ''}{row.goalsFor - row.goalsAgainst}</td>
                          <td className="p-3 text-center font-bold text-[#6bfb9a]">{row.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* Upcoming matches */}
            <section>
              <h3 className="text-xl font-semibold text-[#e5e2e1] mb-4">Proximas Fechas</h3>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {upcoming.slice(0, 6).map(match => (
                  <div key={match.id} className="bg-[#1A1A1A] border border-[#27272A] rounded-xl p-4">
                    <div className="flex justify-between items-center mb-3 border-b border-[#27272A] pb-2">
                      <span className="text-xs font-bold uppercase tracking-widest text-[#bccabb]">
                        {new Date(match.dateISO).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </span>
                      <span className="px-2 py-1 rounded-full bg-[#6bfb9a]/10 text-[#6bfb9a] text-[10px] font-bold uppercase">
                        {match.field || 'Cancha TBD'}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-base text-[#e5e2e1]">
                          {footballTeams.find(t => t.id === match.homeTeamId)?.name || 'Local'}
                        </span>
                        <span className="text-xl font-semibold text-[#353534]">-</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-base text-[#e5e2e1]">
                          {footballTeams.find(t => t.id === match.awayTeamId)?.name || 'Visitante'}
                        </span>
                        <span className="text-xl font-semibold text-[#353534]">-</span>
                      </div>
                    </div>
                    <p className="text-xs text-[#bccabb] mt-2">
                      {new Date(match.dateISO).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Canteen promo */}
            <section className="bg-[#1A1A1A] border border-[#27272A] rounded-xl overflow-hidden">
              <div className="p-6 flex flex-col md:flex-row items-center gap-6">
                <div className="flex-1">
                  <h4 className="text-xl font-bold text-[#6bfb9a] mb-2">Tercer Tiempo</h4>
                  <p className="text-sm text-[#bccabb] mb-4">
                    Hambre despues del partido? Pre-ordena tus burgers y cervezas directamente a la mesa de tu equipo.
                  </p>
                  <button
                    onClick={() => setActiveSection('canteen')}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#27272A] text-[#e5e2e1] text-sm font-bold hover:border-[#6bfb9a] hover:text-[#6bfb9a] transition-colors"
                  >
                    <UtensilsCrossed className="w-4 h-4" />
                    Ver Menu de la Cantina
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeSection === 'canteen' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-black text-[#6bfb9a] uppercase">Cantina</h2>
            </div>

            {/* Category filters */}
            <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
              {menuCategories.map(cat => (
                <button key={cat} onClick={() => setCanteenCategory(cat)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                    canteenCategory === cat ? 'bg-[#6bfb9a]/10 border border-[#6bfb9a] text-[#6bfb9a]' : 'bg-[#201f1f] border border-[#3d4a3e] text-[#bccabb] hover:text-[#6bfb9a] hover:border-[#6bfb9a]'
                  }`}>
                  {cat}
                </button>
              ))}
            </div>

            {/* Product grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeMenu.map(product => {
                const inStock = checkProductStock(product);
                return (
                  <article key={product.id} className={`bg-[#1A1A1A] border border-[#27272A] rounded-xl overflow-hidden flex flex-col transition-transform hover:scale-[1.01] duration-200 ${!inStock ? 'opacity-60' : ''}`}>
                    <div className="h-40 bg-[#2a2a2a] flex items-center justify-center relative">
                      <span className="text-6xl">{product.emoji}</span>
                      {!inStock && (
                        <div className="absolute inset-0 bg-[#131313]/60 backdrop-blur-[2px] flex items-center justify-center">
                          <span className="bg-[#353534] text-[#bccabb] px-4 py-2 rounded-full border border-[#3d4a3e] font-bold text-xs uppercase">Agotado</span>
                        </div>
                      )}
                      {inStock && (
                        <span className="absolute top-3 right-3 bg-[#6bfb9a]/10 text-[#6bfb9a] px-3 py-1 rounded-full border border-[#6bfb9a]/20 text-[10px] font-bold uppercase">Disponible</span>
                      )}
                    </div>
                    <div className="p-4 flex flex-col flex-1">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-lg font-semibold text-[#e5e2e1] leading-tight">{product.name}</h3>
                        <span className="text-[#6bfb9a] font-bold text-lg">{formatCurrency(product.price)}</span>
                      </div>
                      <p className="text-sm text-[#bccabb] mb-4 flex-1">{product.category} · {product.recipe.length} ingrediente(s)</p>
                      {!inStock && <p className="text-xs text-[#ffb4ab] mt-2">Sin stock disponible</p>}
                    </div>
                  </article>
                );
              })}
            </div>

            {activeMenu.length === 0 && (
              <div className="text-center py-16 text-[#bccabb]">
                <ShoppingCart size={48} className="mx-auto mb-4 opacity-30" />
                <p className="text-lg">No hay productos disponibles en esta categoria.</p>
              </div>
            )}

            {/* Online products section (from CMS) */}
            {availableOnlineProducts.length > 0 && (
              <section className="mt-8 pt-8 border-t border-[#27272A]">
                <h3 className="text-xl font-semibold text-[#e5e2e1] mb-4">Tienda Online</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {availableOnlineProducts.map(product => (
                    <article key={product.id} className="bg-[#1A1A1A] border border-[#27272A] rounded-xl overflow-hidden flex flex-col group transition-transform hover:scale-[1.01] duration-200">
                      <div className="h-48 bg-[#2a2a2a] relative overflow-hidden">
                        {product.images.length > 0 ? (
                          <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><ShoppingCart size={32} className="text-[#353534]" /></div>
                        )}
                        <span className="absolute top-3 right-3 bg-[#6bfb9a]/10 text-[#6bfb9a] px-3 py-1 rounded-full border border-[#6bfb9a]/20 text-[10px] font-bold uppercase">Disponible</span>
                      </div>
                      <div className="p-4 flex flex-col flex-1">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-lg font-semibold text-[#e5e2e1] leading-tight">{product.name}</h3>
                          <span className="text-[#6bfb9a] font-bold text-lg">{formatCurrency(product.price)}</span>
                        </div>
                        <p className="text-sm text-[#bccabb] mb-3 flex-1">{product.description}</p>
                        {Object.keys(product.attributes).length > 0 && (
                          <div className="flex gap-1 flex-wrap mb-3">
                            {Object.entries(product.attributes).map(([k, v]) => (
                              <span key={k} className="text-[10px] bg-[#2a2a2a] text-[#bccabb] px-2 py-0.5 rounded-full border border-[#27272A]">{k}: {v}</span>
                            ))}
                          </div>
                        )}
                        {product.stockProductId && (
                          <p className="text-[10px] text-[#bccabb]">
                            Stock vinculado: {products.find(p => p.id === product.stockProductId)?.name || 'N/A'}
                          </p>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {/* Sponsors */}
            {activeSponsors.length > 0 && (
              <section className="mt-8 pt-8 border-t border-[#27272A]">
                <h3 className="text-sm uppercase tracking-widest text-[#bccabb] mb-4 text-center">Sponsors Oficiales</h3>
                <div className="flex gap-6 justify-center flex-wrap">
                  {activeSponsors.map(sponsor => (
                    <a key={sponsor.id} href={sponsor.linkUrl || '#'} target="_blank" rel="noopener noreferrer"
                      className="bg-[#1A1A1A] border border-[#27272A] rounded-xl overflow-hidden hover:border-[#6bfb9a]/30 transition-colors group">
                      {sponsor.imageUrl ? (
                        <img src={sponsor.imageUrl} alt={sponsor.name} className="w-32 h-20 object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <div className="w-32 h-20 flex items-center justify-center bg-[#2a2a2a]">
                          <div className="flex flex-col items-center gap-1">
                            <Star className="w-6 h-6 text-[#6bfb9a]" />
                            <span className="text-[10px] text-[#bccabb] font-bold">{sponsor.name}</span>
                          </div>
                        </div>
                      )}
                    </a>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {activeSection === 'media' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-black text-[#6bfb9a] uppercase">Galeria</h2>
            </div>

            {/* Date tabs */}
            {mediaDates.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
                {mediaDates.map(date => (
                  <button key={date} onClick={() => setSelectedMediaDate(selectedMediaDate === date ? '' : date)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                      selectedMediaDate === date ? 'bg-[#6bfb9a]/10 border border-[#6bfb9a] text-[#6bfb9a]' : 'bg-[#201f1f] border border-[#3d4a3e] text-[#bccabb] hover:text-[#6bfb9a]'
                    }`}>
                    {date === 'sin-fecha' ? 'Sin fecha' : date}
                  </button>
                ))}
              </div>
            )}

            {/* Media grouped by date */}
            {Object.entries(mediaByDate)
              .filter(([date]) => !selectedMediaDate || date === selectedMediaDate)
              .map(([date, items]) => (
                <section key={date} className="space-y-3">
                  <h3 className="text-lg font-semibold text-[#e5e2e1] flex items-center gap-2">
                    <Calendar size={16} className="text-[#6bfb9a]" />
                    {date === 'sin-fecha' ? 'Sin fecha asignada' : date}
                    <span className="text-xs text-[#bccabb] font-normal">({items.length} items)</span>
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {items.map(item => (
                      <div key={item.id} className="bg-[#1A1A1A] border border-[#27272A] rounded-xl overflow-hidden group">
                        <div className="aspect-video bg-[#2a2a2a] relative overflow-hidden">
                          {item.type === 'image' ? (
                            item.url ? (
                              <img src={item.url} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center"><Image size={24} className="text-[#353534]" /></div>
                            )
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-[#2a2a2a]">
                              <div className="flex flex-col items-center gap-2">
                                <div className="w-12 h-12 rounded-full bg-[#6bfb9a]/20 flex items-center justify-center">
                                  <Video size={20} className="text-[#6bfb9a]" />
                                </div>
                                <span className="text-[10px] text-[#bccabb]">Video</span>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <p className="text-sm text-[#e5e2e1] truncate" style={{ fontWeight: 500 }}>{item.title}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}

            {Object.keys(mediaByDate).length === 0 && (
              <div className="text-center py-16 text-[#bccabb]">
                <Image size={48} className="mx-auto mb-4 opacity-30" />
                <p className="text-lg">Aun no hay contenido multimedia.</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#27272A] mt-12">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[#bccabb]">© 2026 La Chacra Futbol - Sports Complex</p>
          <div className="flex items-center gap-4">
            <span className="text-xs text-[#bccabb]">Sponsor Oficial</span>
            <div className="flex items-center gap-2 text-[#6bfb9a] opacity-80">
              <div className="w-4 h-4 bg-[#6bfb9a] rounded-sm rotate-45"></div>
              <span className="text-xs font-bold tracking-wider uppercase">Gatorade</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
