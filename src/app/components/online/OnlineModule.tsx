import { useMemo, useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { useAppContext } from '../AppContext';
import { ShieldCheck, Plus, X, Edit, Trash2, Search, Package, Image, Video, Calendar, Star, Link, Tag, Eye, EyeOff, Save, WifiOff } from 'lucide-react';
import type { OnlineProduct, Sponsor, MediaItem, Product } from '../store';
import { isOnlineProductAvailable, validateSponsor, validateMediaItem, PLACEMENT_LABELS } from './cms-domain';
import { initialSalesMenu } from '../sales/data';
import type { SalesOrderItem } from '../sales/types';
import { checkoutOnlineOrder } from './domain';
import { useMediaApiAdapter, useSponsorsApiAdapter, useOnlineCatalogApiAdapter } from '../../api/adapters';

interface OnlineOrder {
  id: string;
  createdAtISO: string;
  status: 'pendiente' | 'confirmado';
  channel: 'Web' | 'App';
  items: SalesOrderItem[];
  total: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value);
}

type OnlineTab = 'resumen' | 'catalogo' | 'carrito' | 'pedidos' | 'productos' | 'sponsors' | 'media' | 'integracion';

export function OnlineModule() {
  const { products, setProducts, currentUser, addSalesAudit, onlineProducts, setOnlineProducts, sponsors, setSponsors, mediaItems, setMediaItems } = useAppContext();
  const mediaApi = useMediaApiAdapter();
  const sponsorsApi = useSponsorsApiAdapter();
  const catalogApi = useOnlineCatalogApiAdapter();
  const [searchParams] = useSearchParams();
  const tabKey = searchParams.get('tab');
  const tab = (['catalogo', 'carrito', 'pedidos', 'productos', 'sponsors', 'media', 'integracion'].includes(tabKey || '')
    ? tabKey
    : 'resumen') as OnlineTab;

  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<SalesOrderItem[]>([]);
  const [orders, setOrders] = useState<OnlineOrder[]>([]);
  const [message, setMessage] = useState('');

  // --- Product CRUD state ---
  const [editingProduct, setEditingProduct] = useState<OnlineProduct | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [productForm, setProductForm] = useState<Omit<OnlineProduct, 'id'>>({
    name: '', description: '', price: 0, images: [], category: 'General',
    attributes: {}, active: true, stockProductId: '',
  });
  const [newAttrKey, setNewAttrKey] = useState('');
  const [newAttrValue, setNewAttrValue] = useState('');

  // --- Sponsor CRUD state ---
  const [editingSponsor, setEditingSponsor] = useState<Sponsor | null>(null);
  const [showSponsorForm, setShowSponsorForm] = useState(false);
  const [sponsorForm, setSponsorForm] = useState<Omit<Sponsor, 'id'>>({
    name: '', imageUrl: '', placement: 'banner', active: true, linkUrl: '',
  });
  const [sponsorErrors, setSponsorErrors] = useState<string[]>([]);

  // --- Media CRUD state ---
  const [editingMedia, setEditingMedia] = useState<MediaItem | null>(null);
  const [showMediaForm, setShowMediaForm] = useState(false);
  const [mediaForm, setMediaForm] = useState<Omit<MediaItem, 'id' | 'createdAtISO'>>({
    title: '', type: 'image', url: '', matchDate: '',
  });
  const [mediaErrors, setMediaErrors] = useState<string[]>([]);
  const [mediaDateFilter, setMediaDateFilter] = useState<string>('all');

  const menu = initialSalesMenu.filter(item => item.active);
  const filteredMenu = menu.filter(item => item.name.toLowerCase().includes(search.toLowerCase()));
  const total = cart.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);

  const metrics = useMemo(() => {
    const confirmed = orders.filter(order => order.status === 'confirmado');
    const revenue = confirmed.reduce((sum, order) => sum + order.total, 0);
    return {
      totalOrders: orders.length,
      pendingOrders: orders.filter(order => order.status === 'pendiente').length,
      confirmedRevenue: revenue,
      activeProducts: onlineProducts.filter(p => p.active).length,
      activeSponsors: sponsors.filter(s => s.active).length,
    };
  }, [orders, onlineProducts, sponsors]);

  const filteredOnlineProducts = useMemo(() => {
    return onlineProducts.filter(p => {
      const match = p.name.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase());
      return match;
    });
  }, [onlineProducts, search]);

  const filteredSponsors = useMemo(() => {
    return sponsors.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
  }, [sponsors, search]);

  const filteredMedia = useMemo(() => {
    let items = mediaItems;
    if (mediaDateFilter !== 'all') {
      items = items.filter(m => m.matchDate === mediaDateFilter);
    }
    return items.sort((a, b) => (b.matchDate || '').localeCompare(a.matchDate || ''));
  }, [mediaItems, mediaDateFilter]);

  const mediaDates = useMemo(() => {
    const dates = new Set<string>();
    mediaItems.forEach(m => { if (m.matchDate) dates.add(m.matchDate); });
    return ['all', ...Array.from(dates).sort().reverse()];
  }, [mediaItems]);

  const checkProductStock = useCallback((product: OnlineProduct): boolean => {
    return isOnlineProductAvailable(product, products);
  }, [products]);

  // --- Product CRUD ---
  const openProductForm = (product?: OnlineProduct) => {
    if (product) {
      setEditingProduct(product);
      setProductForm({
        name: product.name, description: product.description, price: product.price,
        images: [...product.images], category: product.category,
        attributes: { ...product.attributes }, active: product.active,
        stockProductId: product.stockProductId || '',
      });
    } else {
      setEditingProduct(null);
      setProductForm({
        name: '', description: '', price: 0, images: [], category: 'General',
        attributes: {}, active: true, stockProductId: '',
      });
    }
    setShowProductForm(true);
  };

  const saveProduct = async () => {
    if (!productForm.name.trim()) return;

    // API-first
    if (catalogApi.apiAvailable) {
      const apiData = {
        name: productForm.name,
        description: productForm.description,
        price: productForm.price,
        image: productForm.images[0] || productForm.image,
        images: productForm.images,
        category: productForm.category,
        attributes: productForm.attributes,
        stockProductId: productForm.stockProductId || undefined,
      };

      if (editingProduct) {
        const result = await catalogApi.update(editingProduct.id, apiData);
        if (result.ok && 'result' in result) {
          setOnlineProducts(prev => prev.map(p => p.id === editingProduct.id ? {
            ...p, ...result.result,
          } : p));
        }
      } else {
        const result = await catalogApi.create(apiData);
        if (result.ok && 'result' in result) {
          setOnlineProducts(prev => [...prev, {
            id: result.result.id,
            ...result.result,
          }]);
        }
      }
    }

    // Fallback: localStorage
    if (editingProduct) {
      setOnlineProducts(prev => prev.map(p => p.id === editingProduct.id ? {
        ...p, ...productForm,
      } : p));
    } else {
      const newProduct: OnlineProduct = {
        id: `op-${Date.now()}`, ...productForm,
      };
      setOnlineProducts(prev => [...prev, newProduct]);
    }
    setShowProductForm(false);
    setEditingProduct(null);
  };

  const deleteProduct = async (id: string) => {
    if (catalogApi.apiAvailable) {
      await catalogApi.remove(id);
    }
    setOnlineProducts(prev => prev.filter(p => p.id !== id));
  };

  const addAttribute = () => {
    if (!newAttrKey.trim()) return;
    setProductForm(prev => ({
      ...prev,
      attributes: { ...prev.attributes, [newAttrKey.trim()]: newAttrValue },
    }));
    setNewAttrKey('');
    setNewAttrValue('');
  };

  const removeAttribute = (key: string) => {
    setProductForm(prev => {
      const attrs = { ...prev.attributes };
      delete attrs[key];
      return { ...prev, attributes: attrs };
    });
  };

  const addImageUrl = () => {
    const url = prompt('URL de la imagen:');
    if (url?.trim()) {
      setProductForm(prev => ({ ...prev, images: [...prev.images, url.trim()] }));
    }
  };

  // --- Sponsor CRUD ---
  const openSponsorForm = (sponsor?: Sponsor) => {
    if (sponsor) {
      setEditingSponsor(sponsor);
      setSponsorForm({
        name: sponsor.name, imageUrl: sponsor.imageUrl, placement: sponsor.placement,
        active: sponsor.active, linkUrl: sponsor.linkUrl || '',
      });
    } else {
      setEditingSponsor(null);
      setSponsorForm({
        name: '', imageUrl: '', placement: 'banner', active: true, linkUrl: '',
      });
    }
    setSponsorErrors([]);
    setShowSponsorForm(true);
  };

  const saveSponsor = async () => {
    const errors = validateSponsor(sponsorForm);
    if (errors.length > 0) {
      setSponsorErrors(errors);
      return;
    }

    // API-first
    if (sponsorsApi.apiAvailable) {
      const apiData = {
        name: sponsorForm.name,
        imageUrl: sponsorForm.imageUrl,
        placement: sponsorForm.placement,
        linkUrl: sponsorForm.linkUrl,
      };

      if (editingSponsor) {
        await sponsorsApi.update(editingSponsor.id, apiData);
      } else {
        await sponsorsApi.create(apiData);
      }
    }

    // Fallback: localStorage
    if (editingSponsor) {
      setSponsors(prev => prev.map(s => s.id === editingSponsor.id ? {
        ...s, ...sponsorForm,
      } : s));
    } else {
      const newSponsor: Sponsor = { id: `sp-${Date.now()}`, ...sponsorForm };
      setSponsors(prev => [...prev, newSponsor]);
    }
    setShowSponsorForm(false);
    setEditingSponsor(null);
  };

  const deleteSponsor = async (id: string) => {
    if (sponsorsApi.apiAvailable) {
      await sponsorsApi.remove(id);
    }
    setSponsors(prev => prev.filter(s => s.id !== id));
  };

  // --- Media CRUD ---
  const openMediaForm = (item?: MediaItem) => {
    if (item) {
      setEditingMedia(item);
      setMediaForm({
        title: item.title, type: item.type, url: item.url, matchDate: item.matchDate || '',
      });
    } else {
      setEditingMedia(null);
      setMediaForm({ title: '', type: 'image', url: '', matchDate: '' });
    }
    setMediaErrors([]);
    setShowMediaForm(true);
  };

  const saveMedia = async () => {
    const errors = validateMediaItem(mediaForm);
    if (errors.length > 0) {
      setMediaErrors(errors);
      return;
    }

    // API-first
    if (mediaApi.apiAvailable) {
      // For simplicity, we save metadata directly (presign flow would require file upload UI)
      const apiData = {
        title: mediaForm.title,
        type: mediaForm.type,
        url: mediaForm.url,
        mimeType: mediaForm.type === 'image' ? 'image/jpeg' : 'video/mp4',
        size: 0,
        matchDate: mediaForm.matchDate,
      };

      if (editingMedia) {
        // Update not available via simple confirm, fall back to localStorage for edit
      } else {
        // For new items without presign, save metadata only
      }
    }

    // Fallback: localStorage
    if (editingMedia) {
      setMediaItems(prev => prev.map(m => m.id === editingMedia.id ? {
        ...m, ...mediaForm,
      } : m));
    } else {
      const newItem: MediaItem = {
        id: `mi-${Date.now()}`, ...mediaForm,
        createdAtISO: new Date().toISOString(),
      };
      setMediaItems(prev => [...prev, newItem]);
    }
    setShowMediaForm(false);
    setEditingMedia(null);
  };

  const deleteMedia = async (id: string) => {
    if (mediaApi.apiAvailable) {
      await mediaApi.remove(id);
    }
    setMediaItems(prev => prev.filter(m => m.id !== id));
  };

  // --- Cart actions ---
  const addToCart = (productId: string) => {
    const menuProduct = menu.find(item => item.id === productId);
    if (!menuProduct) return;
    setCart(prev => {
      const existing = prev.find(item => item.menuProductId === menuProduct.id);
      if (existing) {
        return prev.map(item =>
          item.menuProductId === menuProduct.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [...prev, { menuProductId: menuProduct.id, name: menuProduct.name, unitPrice: menuProduct.price, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, next: number) => {
    if (!Number.isFinite(next) || next <= 0) return;
    setCart(prev => prev.map(item => (item.menuProductId === id ? { ...item, quantity: Math.floor(next) } : item)));
  };

  const removeFromCart = (id: string) => setCart(prev => prev.filter(item => item.menuProductId !== id));

  const createOnlineOrder = () => {
    if (cart.length === 0) { setMessage('Agrega productos al carrito para generar el pedido online.'); return; }
    const result = checkoutOnlineOrder(cart, menu, products);
    if (!result.ok) { setMessage(`No se puede confirmar. Stock insuficiente: ${result.missingSummary}`); return; }
    setProducts(result.updatedProducts);
    const newOrder: OnlineOrder = {
      id: `on-${Date.now()}`, createdAtISO: new Date().toISOString(), status: 'confirmado',
      channel: Math.random() > 0.5 ? 'Web' : 'App', items: cart, total,
    };
    setOrders(prev => [newOrder, ...prev]);
    setCart([]);
    setMessage(`Pedido online confirmado (${newOrder.channel}) por ${formatCurrency(newOrder.total)}.`);
    addSalesAudit({ user: currentUser.username, action: `Venta Online #${newOrder.id}`, element: 'Pedidos Online', previousValue: '-', newValue: `${newOrder.items.length} item(s)` });
  };

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h2 className="text-foreground">Ventas Online — Administracion</h2>
        <p className="text-sm text-muted-foreground">CMS para gestionar productos, sponsors y contenido multimedia del sitio publico.</p>
      </header>

      {message && (
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="ml-2 text-muted-foreground hover:text-foreground"><X size={14} /></button>
        </div>
      )}

      {/* API availability indicator */}
      {(mediaApi.apiAvailable === false || sponsorsApi.apiAvailable === false || catalogApi.apiAvailable === false) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700 flex items-center gap-2">
          <WifiOff size={14} />
          <span>Modo offline — los cambios se guardan localmente.</span>
        </div>
      )}

      {tab === 'resumen' && (
        <section className="grid gap-3 md:grid-cols-5">
          <article className="rounded-2xl border border-border bg-card p-4 shadow-sm"><p className="text-sm text-muted-foreground">Pedidos</p><p className="text-2xl text-foreground" style={{ fontWeight: 700 }}>{metrics.totalOrders}</p></article>
          <article className="rounded-2xl border border-border bg-card p-4 shadow-sm"><p className="text-sm text-muted-foreground">Pendientes</p><p className="text-2xl text-foreground" style={{ fontWeight: 700 }}>{metrics.pendingOrders}</p></article>
          <article className="rounded-2xl border border-border bg-card p-4 shadow-sm"><p className="text-sm text-muted-foreground">Facturacion</p><p className="text-2xl text-foreground" style={{ fontWeight: 700 }}>{formatCurrency(metrics.confirmedRevenue)}</p></article>
          <article className="rounded-2xl border border-border bg-card p-4 shadow-sm"><p className="text-sm text-muted-foreground">Productos</p><p className="text-2xl text-foreground" style={{ fontWeight: 700 }}>{metrics.activeProducts}</p></article>
          <article className="rounded-2xl border border-border bg-card p-4 shadow-sm"><p className="text-sm text-muted-foreground">Sponsors</p><p className="text-2xl text-foreground" style={{ fontWeight: 700 }}>{metrics.activeSponsors}</p></article>
        </section>
      )}

      {tab === 'catalogo' && (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar producto..." className="w-full rounded-xl border border-border bg-background px-3 py-2 outline-none focus:border-[#2d5fa8]" />
          <div className="grid gap-2 md:grid-cols-2">
            {filteredMenu.map(item => (
              <button key={item.id} onClick={() => addToCart(item.id)} className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2 text-left hover:border-[#2d5fa8]">
                <span><span className="mr-2">{item.emoji}</span>{item.name}</span>
                <span className="text-sm text-[#2d5fa8]">{formatCurrency(item.price)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {tab === 'carrito' && (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
          {cart.length === 0 && <p className="text-sm text-muted-foreground">No hay items en el carrito.</p>}
          {cart.map(item => (
            <article key={item.menuProductId} className="flex items-center justify-between rounded-xl border border-border bg-background p-3">
              <div><p className="text-sm text-foreground">{item.name}</p><p className="text-xs text-muted-foreground">{formatCurrency(item.unitPrice)} c/u</p></div>
              <div className="flex items-center gap-2">
                <input type="number" min={1} value={item.quantity} onChange={event => updateQuantity(item.menuProductId, Number(event.target.value))} className="w-16 rounded-lg border border-border px-2 py-1" />
                <button onClick={() => removeFromCart(item.menuProductId)} className="rounded-lg border border-border px-2 py-1 text-xs">Quitar</button>
              </div>
            </article>
          ))}
          <div className="flex items-center justify-between border-t border-border pt-3">
            <p>Total</p><p style={{ fontWeight: 700 }}>{formatCurrency(total)}</p>
          </div>
          <button onClick={createOnlineOrder} className="w-full rounded-xl bg-[#2d5fa8] py-2.5 text-sm text-white hover:bg-[#244d8a]">Confirmar pedido online</button>
        </section>
      )}

      {tab === 'pedidos' && (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-2">
          {orders.length === 0 && <p className="text-sm text-muted-foreground">Todavia no hay pedidos online.</p>}
          {orders.map(order => (
            <article key={order.id} className="rounded-xl border border-border bg-background p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-foreground">Pedido {order.id}</p>
                <span className="rounded-full bg-[#2d5fa8]/10 px-2 py-0.5 text-xs text-[#2d5fa8]">{order.channel}</span>
              </div>
              <p className="text-xs text-muted-foreground">{new Date(order.createdAtISO).toLocaleString('es-AR')} · {formatCurrency(order.total)}</p>
            </article>
          ))}
        </section>
      )}

      {/* ===== PRODUCTOS CRUD ===== */}
      {tab === 'productos' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-foreground">Productos del Sitio</h3>
            <button onClick={() => openProductForm()} className="text-xs bg-[#2d5fa8] text-white px-3 py-1.5 rounded-lg hover:bg-[#244d8a] flex items-center gap-1">
              <Plus size={12} /> Nuevo Producto
            </button>
          </div>

          {/* Product form modal */}
          {showProductForm && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
              <h4 className="text-foreground" style={{ fontWeight: 600 }}>{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h4>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Nombre</label>
                  <input value={productForm.name} onChange={e => setProductForm(prev => ({ ...prev, name: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#2d5fa8]" placeholder="Nombre del producto" />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Precio</label>
                  <input type="number" value={productForm.price} onChange={e => setProductForm(prev => ({ ...prev, price: parseInt(e.target.value) || 0 }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#2d5fa8]" />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Categoria</label>
                  <input value={productForm.category} onChange={e => setProductForm(prev => ({ ...prev, category: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#2d5fa8]" />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Vincular a stock (opcional)</label>
                  <select value={productForm.stockProductId} onChange={e => setProductForm(prev => ({ ...prev, stockProductId: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#2d5fa8]">
                    <option value="">Sin vinculacion (siempre disponible)</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} (stock: {p.stockByWarehouse.reduce((s, w) => s + w.quantity, 0)})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Descripcion</label>
                <textarea value={productForm.description} onChange={e => setProductForm(prev => ({ ...prev, description: e.target.value }))} rows={3} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#2d5fa8]" />
              </div>

              {/* Images */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Imagenes (URLs)</label>
                <div className="flex gap-2 mb-2">
                  <button onClick={addImageUrl} className="text-xs bg-muted px-2 py-1 rounded hover:bg-muted/80 flex items-center gap-1"><Image size={12} /> Agregar URL</button>
                </div>
                {productForm.images.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {productForm.images.map((url, i) => (
                      <div key={i} className="relative group">
                        <img src={url} alt="" className="w-16 h-16 rounded-lg object-cover border border-border" />
                        <button onClick={() => setProductForm(prev => ({ ...prev, images: prev.images.filter((_, idx) => idx !== i) }))} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Attributes */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Atributos</label>
                <div className="flex gap-2 mb-2">
                  <input value={newAttrKey} onChange={e => setNewAttrKey(e.target.value)} placeholder="Clave" className="rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none w-24" />
                  <input value={newAttrValue} onChange={e => setNewAttrValue(e.target.value)} placeholder="Valor" className="rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none flex-1" />
                  <button onClick={addAttribute} className="text-xs bg-muted px-2 py-1 rounded hover:bg-muted/80 flex items-center gap-1"><Tag size={12} /> Agregar</button>
                </div>
                {Object.entries(productForm.attributes).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2 text-xs bg-muted rounded-lg px-2 py-1 mb-1">
                    <span className="text-muted-foreground">{key}:</span>
                    <span className="text-foreground" style={{ fontWeight: 500 }}>{value}</span>
                    <button onClick={() => removeAttribute(key)} className="ml-auto text-red-500 hover:text-red-700"><X size={10} /></button>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={productForm.active} onChange={e => setProductForm(prev => ({ ...prev, active: e.target.checked }))} className="rounded accent-[#2d5fa8]" />
                  Activo
                </label>
              </div>

              <div className="flex gap-2 justify-end">
                <button onClick={() => { setShowProductForm(false); setEditingProduct(null); }} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted">Cancelar</button>
                <button onClick={saveProduct} className="px-4 py-2 rounded-lg bg-[#2d5fa8] text-white text-sm hover:bg-[#244d8a] flex items-center gap-1"><Save size={14} /> Guardar</button>
              </div>
            </div>
          )}

          {/* Products list */}
          <div className="space-y-2">
            {filteredOnlineProducts.length === 0 && <p className="text-sm text-muted-foreground">No hay productos online creados.</p>}
            {filteredOnlineProducts.map(product => {
              const available = checkProductStock(product);
              return (
                <article key={product.id} className="rounded-xl border border-border bg-background p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {product.images.length > 0 ? (
                        <img src={product.images[0]} alt={product.name} className="w-16 h-16 rounded-lg object-cover border border-border flex-shrink-0" />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                          <Package size={20} className="text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.category} · {formatCurrency(product.price)}</p>
                        {product.stockProductId && (
                          <p className="text-xs text-muted-foreground">
                            Vinculado: {products.find(p => p.id === product.stockProductId)?.name || product.stockProductId}
                            {!available && <span className="text-red-500 ml-1">(sin stock)</span>}
                          </p>
                        )}
                        {Object.keys(product.attributes).length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {Object.entries(product.attributes).map(([k, v]) => (
                              <span key={k} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{k}: {v}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => setOnlineProducts(prev => prev.map(p => p.id === product.id ? { ...p, active: !p.active } : p))} className={`p-1.5 rounded ${product.active ? 'text-green-600' : 'text-muted-foreground'}`} title={product.active ? 'Desactivar' : 'Activar'}>
                        {product.active ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                      <button onClick={() => openProductForm(product)} className="p-1.5 rounded text-blue-600 hover:bg-blue-50"><Edit size={14} /></button>
                      <button onClick={() => deleteProduct(product.id)} className="p-1.5 rounded text-red-600 hover:bg-red-50"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* ===== SPONSORS CRUD ===== */}
      {tab === 'sponsors' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-foreground">Sponsors</h3>
            <button onClick={() => openSponsorForm()} className="text-xs bg-[#2d5fa8] text-white px-3 py-1.5 rounded-lg hover:bg-[#244d8a] flex items-center gap-1">
              <Plus size={12} /> Nuevo Sponsor
            </button>
          </div>

          {/* Sponsor form */}
          {showSponsorForm && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
              <h4 className="text-foreground" style={{ fontWeight: 600 }}>{editingSponsor ? 'Editar Sponsor' : 'Nuevo Sponsor'}</h4>
              {sponsorErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 space-y-1">
                  {sponsorErrors.map((err, i) => <p key={i}>⚠ {err}</p>)}
                </div>
              )}
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Nombre</label>
                  <input value={sponsorForm.name} onChange={e => setSponsorForm(prev => ({ ...prev, name: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#2d5fa8]" placeholder="Nombre del sponsor" />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Ubicacion</label>
                  <select value={sponsorForm.placement} onChange={e => setSponsorForm(prev => ({ ...prev, placement: e.target.value as Sponsor['placement'] }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#2d5fa8]">
                    {Object.entries(PLACEMENT_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">URL de imagen</label>
                  <input value={sponsorForm.imageUrl} onChange={e => setSponsorForm(prev => ({ ...prev, imageUrl: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#2d5fa8]" placeholder="https://..." />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">URL de link (opcional)</label>
                  <input value={sponsorForm.linkUrl || ''} onChange={e => setSponsorForm(prev => ({ ...prev, linkUrl: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#2d5fa8]" placeholder="https://..." />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={sponsorForm.active} onChange={e => setSponsorForm(prev => ({ ...prev, active: e.target.checked }))} className="rounded accent-[#2d5fa8]" />
                  Activo
                </label>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setShowSponsorForm(false); setEditingSponsor(null); }} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted">Cancelar</button>
                <button onClick={saveSponsor} className="px-4 py-2 rounded-lg bg-[#2d5fa8] text-white text-sm hover:bg-[#244d8a] flex items-center gap-1"><Save size={14} /> Guardar</button>
              </div>
            </div>
          )}

          {/* Sponsors list */}
          <div className="space-y-2">
            {filteredSponsors.length === 0 && <p className="text-sm text-muted-foreground">No hay sponsors creados.</p>}
            {filteredSponsors.map(sponsor => (
              <article key={sponsor.id} className="rounded-xl border border-border bg-background p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {sponsor.imageUrl ? (
                      <img src={sponsor.imageUrl} alt={sponsor.name} className="w-12 h-12 rounded-lg object-cover border border-border" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center"><Star size={20} className="text-muted-foreground" /></div>
                    )}
                    <div>
                      <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>{sponsor.name}</p>
                      <p className="text-xs text-muted-foreground">{PLACEMENT_LABELS[sponsor.placement]}{sponsor.linkUrl && <span className="ml-2"><Link size={10} className="inline" /></span>}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setSponsors(prev => prev.map(s => s.id === sponsor.id ? { ...s, active: !s.active } : s))} className={`px-2 py-1 rounded text-xs ${sponsor.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {sponsor.active ? 'Activo' : 'Inactivo'}
                    </button>
                    <button onClick={() => openSponsorForm(sponsor)} className="p-1.5 rounded text-blue-600 hover:bg-blue-50"><Edit size={14} /></button>
                    <button onClick={() => deleteSponsor(sponsor.id)} className="p-1.5 rounded text-red-600 hover:bg-red-50"><Trash2 size={14} /></button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ===== MEDIA CRUD ===== */}
      {tab === 'media' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-foreground">Galeria Multimedia</h3>
            <button onClick={() => openMediaForm()} className="text-xs bg-[#2d5fa8] text-white px-3 py-1.5 rounded-lg hover:bg-[#244d8a] flex items-center gap-1">
              <Plus size={12} /> Nuevo Item
            </button>
          </div>

          {/* Date filter */}
          <div className="flex gap-2 flex-wrap">
            {mediaDates.map(date => (
              <button
                key={date}
                onClick={() => setMediaDateFilter(date)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${mediaDateFilter === date ? 'bg-[#2d5fa8] text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
              >
                {date === 'all' ? 'Todas las fechas' : date}
              </button>
            ))}
          </div>

          {/* Media form */}
          {showMediaForm && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
              <h4 className="text-foreground" style={{ fontWeight: 600 }}>{editingMedia ? 'Editar Item' : 'Nuevo Item Multimedia'}</h4>
              {mediaErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 space-y-1">
                  {mediaErrors.map((err, i) => <p key={i}>⚠ {err}</p>)}
                </div>
              )}
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Titulo</label>
                  <input value={mediaForm.title} onChange={e => setMediaForm(prev => ({ ...prev, title: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#2d5fa8]" placeholder="Titulo del item" />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Tipo</label>
                  <select value={mediaForm.type} onChange={e => setMediaForm(prev => ({ ...prev, type: e.target.value as 'image' | 'video' }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#2d5fa8]">
                    <option value="image">Imagen</option>
                    <option value="video">Video</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">URL</label>
                  <input value={mediaForm.url} onChange={e => setMediaForm(prev => ({ ...prev, url: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#2d5fa8]" placeholder="https://..." />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Fecha del partido (opcional)</label>
                  <input type="date" value={mediaForm.matchDate} onChange={e => setMediaForm(prev => ({ ...prev, matchDate: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#2d5fa8]" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setShowMediaForm(false); setEditingMedia(null); }} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted">Cancelar</button>
                <button onClick={saveMedia} className="px-4 py-2 rounded-lg bg-[#2d5fa8] text-white text-sm hover:bg-[#244d8a] flex items-center gap-1"><Save size={14} /> Guardar</button>
              </div>
            </div>
          )}

          {/* Media grid */}
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
            {filteredMedia.length === 0 && <p className="text-sm text-muted-foreground col-span-full text-center py-8">No hay items multimedia.</p>}
            {filteredMedia.map(item => (
              <article key={item.id} className="rounded-xl border border-border bg-background overflow-hidden group">
                <div className="h-32 bg-muted flex items-center justify-center relative">
                  {item.type === 'image' ? (
                    item.url ? (
                      <img src={item.url} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <Image size={24} className="text-muted-foreground" />
                    )
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <Video size={24} className="text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">Video</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                    <button onClick={() => openMediaForm(item)} className="p-1.5 bg-white rounded-full text-blue-600"><Edit size={12} /></button>
                    <button onClick={() => deleteMedia(item.id)} className="p-1.5 bg-white rounded-full text-red-600"><Trash2 size={12} /></button>
                  </div>
                </div>
                <div className="p-2">
                  <p className="text-xs text-foreground truncate" style={{ fontWeight: 500 }}>{item.title}</p>
                  {item.matchDate && (
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Calendar size={8} /> {item.matchDate}
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === 'integracion' && (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 text-[#2d5fa8]" size={18} />
            <div>
              <h3 className="text-foreground">Arquitectura de seguridad prevista</h3>
              <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground space-y-1">
                <li>Este modulo es solo backoffice interno ERP (web + APK interna).</li>
                <li>Clientes usarán frontend externo separado (web + apps store), sin compartir vistas de administracion.</li>
                <li>La logica de stock es comun para evitar inconsistencias entre venta fisica y online.</li>
              </ul>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
