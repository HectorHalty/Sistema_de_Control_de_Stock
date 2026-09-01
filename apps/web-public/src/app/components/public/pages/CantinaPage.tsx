import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { publicApi, type PublicMenuItem, type PublicSponsor } from '../../../api/public-api';
import { useCart, formatPrice } from '../cart/CartContext';
import { PageLoader } from '../../ui/PageLoader';
import { IconCart, IconMinus, IconPlus, IconStar } from '../figma-icons';
import { CANTEEN_HERO_IMG, foodImageFor } from '../food-images';

export function CantinaPage() {
  const navigate = useNavigate();
  const { items: cart, add, remove, count, total } = useCart();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('todas');
  const [activeQuickFilter, setActiveQuickFilter] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['menu'],
    queryFn: () => publicApi.menu(),
  });

  const { data: sponsors = [] } = useQuery({
    queryKey: ['sponsors-cantina'],
    queryFn: () => publicApi.sponsors(),
  });

  const cantinaBanner = useMemo((): PublicSponsor | null => {
    return (
      sponsors.find((s) => s.bannerLabel?.includes('Cantina')) ??
      sponsors.find((s) => s.placement === 'banner' && s.bannerLabel?.toLowerCase().includes('cantina')) ??
      null
    );
  }, [sponsors]);

  const menu = data?.items ?? [];
  const webFilters = data?.filters ?? [];
  const webCategories = data?.categories ?? [];

  const categories = useMemo(() => {
    if (webCategories.length > 0) {
      return webCategories.map((c) => ({ id: c.slug, label: c.name }));
    }
    return [...new Set(menu.map((m) => m.category).filter(Boolean))].map((c) => ({
      id: c,
      label: c,
    }));
  }, [menu, webCategories]);

  const popular = useMemo(
    () => menu.filter((m) => m.popular || m.filters?.includes('popular')).slice(0, 4),
    [menu],
  );

  const filtered = useMemo(() => {
    return menu.filter((item) => {
      const matchCat =
        filter === 'todas' ||
        item.category === filter ||
        item.categorySlug === filter;
      const q = search.toLowerCase();
      const matchSearch =
        !search ||
        item.name.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q);

      let matchQuick = true;
      if (activeQuickFilter === 'popular') {
        matchQuick = !!item.popular || !!item.filters?.includes('popular');
      } else if (activeQuickFilter === 'economico') {
        matchQuick =
          !!item.filters?.includes('economico') ||
          (item.price > 0 && item.price <= 5000);
      } else if (activeQuickFilter === 'bebidas') {
        matchQuick =
          !!item.filters?.includes('bebidas') ||
          item.category.toLowerCase().includes('bebida');
      }

      return matchCat && matchSearch && matchQuick;
    });
  }, [menu, filter, search, activeQuickFilter]);


  if (isLoading) return <PageLoader />;

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center text-red-300">
          {(error as Error).message}
        </div>
      </div>
    );
  }

  const quickFilters = webFilters.length
    ? webFilters
    : [
        { slug: 'popular', label: 'Popular' },
        { slug: 'economico', label: 'Económico' },
        { slug: 'bebidas', label: 'Bebidas' },
      ];

  const cats: { id: string; label: string; icon: ReactNode }[] = [
    {
      id: 'todas',
      label: 'Todo',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      ),
    },
    ...categories.map((c) => ({
      id: c.id,
      label: c.label.length > 10 ? `${c.label.slice(0, 8)}.` : c.label,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 11h18M5 11V9a7 7 0 0114 0v2M3 15h18"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      ),
    })),
  ];

  return (
    <div className="relative mx-auto max-w-4xl pb-28">
      <div
        style={{ background: '#111111', borderBottom: '1px solid #1e1e1e' }}
        className="sticky top-0 z-20 px-6 pb-4 pt-5"
      >
        <div className="flex items-center gap-3">
          <div
            style={{ background: '#1c1c1c', border: '1px solid #2a2a2a' }}
            className="flex flex-1 items-center gap-3 rounded-xl px-4 py-2.5"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              className="shrink-0 text-gray-500"
            >
              <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
              <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar platos..."
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'white',
                width: '100%',
                fontSize: 14,
              }}
              className="placeholder-gray-600"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="text-lg leading-none text-gray-600">
                ×
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => navigate('/carrito')}
            style={{ background: '#1c1c1c', border: '1px solid #2a2a2a', position: 'relative' }}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-gray-400 hover:text-white"
          >
            <IconCart />
            {count > 0 && (
              <span
                style={{
                  background: '#6BFF9E',
                  color: '#0e0e0e',
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  fontSize: 10,
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {count}
              </span>
            )}
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            style={{
              background: showFilters ? '#6BFF9E22' : '#1c1c1c',
              border: showFilters ? '1px solid #6BFF9E55' : '1px solid #2a2a2a',
              color: showFilters ? '#6BFF9E' : '#9ca3af',
            }}
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path
                d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Filtros
          </button>
          {quickFilters.map((f) => (
            <button
              key={f.slug}
              type="button"
              onClick={() =>
                setActiveQuickFilter(activeQuickFilter === f.slug ? null : f.slug)
              }
              style={{
                background: activeQuickFilter === f.slug ? '#6BFF9E22' : '#1c1c1c',
                border:
                  activeQuickFilter === f.slug ? '1px solid #6BFF9E55' : '1px solid #2a2a2a',
                color: activeQuickFilter === f.slug ? '#6BFF9E' : '#9ca3af',
              }}
              className="shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold capitalize"
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6 px-6 pt-5">
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-0.5">
          {cats.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setFilter(cat.id)}
              style={
                filter === cat.id
                  ? { background: '#6BFF9E', color: '#0e0e0e', border: '1px solid #6BFF9E' }
                  : { background: '#1c1c1c', color: '#9ca3af', border: '1px solid #2a2a2a' }
              }
              className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold"
            >
              {cat.icon}
              {cat.label}
            </button>
          ))}
        </div>

        <CantinaPromoBanner banner={cantinaBanner} />

        {!search && filter === 'todas' && !activeQuickFilter && popular.length > 0 && (
          <div>
            <h2 className="mb-3 text-base font-black text-white">Los más pedidos</h2>
            <div className="grid grid-cols-2 gap-3">
              {popular.map((item) => (
                <MenuCard
                  key={item.id}
                  item={item}
                  qty={cart.find((c) => c.id === item.id)?.qty ?? 0}
                  popular
                  onAdd={() => add(item)}
                  onRemove={() => remove(item.id)}
                />
              ))}
            </div>
          </div>
        )}

        <div>
          <h2 className="mb-3 text-base font-black text-white">
            {search ? `Resultados para "${search}"` : filter === 'todas' ? 'Todo el menú' : filter}
          </h2>
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-600">Sin resultados.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filtered.map((item) => (
                <MenuCard
                  key={`all-${item.id}`}
                  item={item}
                  qty={cart.find((c) => c.id === item.id)?.qty ?? 0}
                  onAdd={() => add(item)}
                  onRemove={() => remove(item.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {count > 0 && (
        <div className="fixed bottom-6 right-6 z-30">
          <button
            type="button"
            onClick={() => navigate('/carrito')}
            style={{ background: '#6BFF9E', color: '#0e0e0e' }}
            className="flex items-center gap-3 rounded-2xl px-5 py-3 font-bold shadow-2xl transition-transform hover:scale-105"
          >
            <IconCart />
            <span>
              {count} {count === 1 ? 'item' : 'items'}
            </span>
            <span
              style={{ background: '#0e0e0e', color: '#6BFF9E' }}
              className="rounded-lg px-2 py-0.5 text-sm font-black"
            >
              {formatPrice(total)}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

function CantinaPromoBanner({ banner }: { banner: PublicSponsor | null }) {
  const height = banner?.heightPx ?? 112;
  const mediaUrl = banner?.imageUrl ?? CANTEEN_HERO_IMG;
  const title = banner?.name ?? 'El tercer tiempo es acá';
  const subtitle = banner?.bannerLabel ?? 'Pedí online, retirá en cantina';

  const inner = (
    <div
      style={{ background: '#1c1c1c', border: '1px solid #2a2a2a', height, maxHeight: 140 }}
      className="relative overflow-hidden rounded-2xl"
    >
      {banner?.mediaType === 'video' ? (
        <video
          src={mediaUrl}
          autoPlay
          muted
          loop
          playsInline
          className="h-full w-full object-cover"
        />
      ) : (
        <img src={mediaUrl} alt={title} className="h-full w-full object-cover" />
      )}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.85) 40%, transparent)' }}
      />
      <div className="absolute inset-0 flex flex-col justify-center px-5">
        <span style={{ color: '#6BFF9E' }} className="text-[9px] font-black uppercase tracking-widest">
          Promo del día
        </span>
        <p className="text-base font-black leading-tight text-white">{title}</p>
        <p className="text-[11px] text-gray-400">{subtitle}</p>
      </div>
    </div>
  );

  if (banner?.linkUrl) {
    return (
      <a href={banner.linkUrl} target="_blank" rel="noreferrer" className="block">
        {inner}
      </a>
    );
  }

  return inner;
}

function MenuCard({
  item,
  qty,
  popular,
  onAdd,
  onRemove,
}: {
  item: PublicMenuItem;
  qty: number;
  popular?: boolean;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const imgSrc = item.imageUrl || foodImageFor(item.name, item.category);

  return (
    <div
      style={{ background: '#1c1c1c', border: '1px solid #2a2a2a' }}
      className="flex flex-col overflow-hidden rounded-xl"
    >
      <div className="relative h-36 shrink-0 overflow-hidden">
        <img src={imgSrc} alt={item.name} className="h-full w-full object-cover" />
        {popular && (
          <div
            style={{ background: '#6BFF9E', color: '#0e0e0e' }}
            className="absolute left-2 top-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black"
          >
            <IconStar /> Popular
          </div>
        )}
        {item.price === 0 && (
          <div
            style={{ background: '#60a5fa22', color: '#60a5fa', border: '1px solid #60a5fa44' }}
            className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold"
          >
            Gratis
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <p className="text-sm font-bold text-white">{item.name}</p>
        {item.description && (
          <p className="mt-0.5 flex-1 text-xs leading-relaxed text-gray-500">{item.description}</p>
        )}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-lg font-black text-white">
            {item.price === 0 ? 'Gratis' : formatPrice(item.price)}
          </span>
          {qty > 0 ? (
            <div
              style={{ background: '#252525', border: '1px solid #3a3a3a' }}
              className="flex items-center gap-2 rounded-xl px-1 py-1"
            >
              <button
                type="button"
                onClick={onRemove}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-white hover:bg-[#3a3a3a]"
              >
                <IconMinus />
              </button>
              <span className="w-5 text-center text-sm font-bold text-white">{qty}</span>
              <button
                type="button"
                onClick={onAdd}
                style={{ background: '#6BFF9E', color: '#0e0e0e' }}
                className="flex h-7 w-7 items-center justify-center rounded-lg"
              >
                <IconPlus />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onAdd}
              style={{ background: '#6BFF9E', color: '#0e0e0e' }}
              className="flex h-8 w-8 items-center justify-center rounded-xl font-bold transition-all hover:scale-105"
            >
              <IconPlus />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
