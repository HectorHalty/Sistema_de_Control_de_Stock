import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppContext } from '@/app/providers/AppContext';
import { getApiErrorMessage, stockApi } from '@/app/api/client';
import { operatorFields } from '@/shared/utils/persist-mutation';
import { Plus, X, Check, Download, ChevronRight, Truck, FileText, Clock, Filter, Share2, Pencil } from 'lucide-react';
import type { Order, Product } from '@/app/components/store';
import { getUnitLabel, roundUpToOrderUnit } from '@/app/components/store';
import { useSearchParams } from 'react-router';
import { downloadBlobFile } from '@/app/components/download';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import jsPDF from 'jspdf';
import logoLchUrl from '@/assets/logo-LCH.png';
import { calendarDayInArgentina, suggestFromStockCycles, type SuggestionCycle, type SuggestionSpan } from '@/features/inventory/order-suggestions';
import { buildStockCycleRows, stockCycleDay } from '@/features/inventory/stock-cycles';
import { mapApiStockCycleToPayload } from '@/features/inventory/api/inventory-mappers';
import { isOrderReceived, sortOrdersByDateDesc } from '@/features/inventory/sort-orders';

/**
 * Alcanza para la ventana más ancha del selector (180 días): son unas 26
 * semanas y cada semana puede dejar más de un control.
 */
const CYCLES_FOR_SUGGESTIONS = 60;

function cyclesLabel(count: number): string {
  return `promedio de ${count} ${count === 1 ? 'control' : 'controles'}`;
}

function orderLogoUrl(): string {
  return new URL(logoLchUrl, window.location.href).href;
}

function loadOrderLogo(): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar el logo'));
    img.src = orderLogoUrl();
  });
}

function readOrderQuantity(raw: string): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

type OrderView = 'list' | 'create-step1' | 'create-step2' | 'create-step3' | 'confirm-arrival' | 'edit-order';
type StatusFilter = 'all' | 'Pendiente' | 'Recibido';

export function OrdersPage() {
  const ctx = useAppContext();
  const {
    orders, products, addAudit, getTotalStock, warehouses, suppliers, stockPackRounding,
    createPurchaseOrder, updatePurchaseOrder, receivePurchaseOrder, currentUser,
  } = ctx;
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState<OrderView>('list');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [dateType, setDateType] = useState<'regular' | 'after'>('regular');
  const [calcDate, setCalcDate] = useState<string>('');
  const [orderItems, setOrderItems] = useState<{ productId: string; average: number; cyclesUsed: number; raw: number; currentStock: number; suggested: number; quantity: number; included: boolean }[]>([]);
  const [provider, setProvider] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [lastCreatedOrder, setLastCreatedOrder] = useState<Order | null>(null);

  const [arrivalItems, setArrivalItems] = useState<{
    productId: string;
    ordered: number;
    received: number;
    allocations: { warehouseId: string; quantity: number }[];
  }[]>([]);
  const [arrivalDefaultWarehouseId, setArrivalDefaultWarehouseId] = useState<string>('');
  const [savingArrival, setSavingArrival] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editItems, setEditItems] = useState<{ productId: string; quantity: number }[]>([]);

  const filteredOrders = useMemo(() => {
    const list = statusFilter === 'all'
      ? orders
      : orders.filter(o => o.status === statusFilter);
    return sortOrdersByDateDesc(list);
  }, [orders, statusFilter]);

  const pendienteCount = orders.filter(o => o.status === 'Pendiente').length;
  const recibidoCount = orders.filter(o => o.status === 'Recibido').length;
  const startCreateOrder = () => {
    setDateType('regular');
    setProvider('');
    setSupplierId('');
    setView('create-step1');
  };

  // Sync status filter with URL (supports dashboard deep-links)
  useEffect(() => {
    const status = searchParams.get('status');
    if (status === 'Pendiente' || status === 'Recibido') {
      setStatusFilter(status);
    } else if (status === 'all' || status === null) {
      setStatusFilter('all');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setStatusFilterAndUrl = (next: StatusFilter) => {
    setStatusFilter(next);
    const sp = new URLSearchParams(searchParams);
    if (next === 'all') sp.delete('status');
    else sp.set('status', next);
    setSearchParams(sp, { replace: true });
  };

  const selectedSupplier = suppliers.find(s => s.id === supplierId);

  const [span, setSpan] = useState<SuggestionSpan>('month');

  // Fuera de `hydrationQueries`: que no haya ciclos todavía no significa que el
  // inventario esté offline, igual que con el log de auditoría.
  const cyclesQuery = useQuery({
    queryKey: ['inventory', 'cycles', CYCLES_FOR_SUGGESTIONS],
    queryFn: () => stockApi.cycles.list(CYCLES_FOR_SUGGESTIONS),
  });

  const suggestionCycles = useMemo<SuggestionCycle[]>(() => {
    return (cyclesQuery.data ?? []).map(api => {
      const payload = mapApiStockCycleToPayload(api);
      return {
        day: stockCycleDay(payload),
        dateType: payload.dateType ?? 'regular',
        hadSales: payload.hadSales,
        rows: buildStockCycleRows(payload).map(row => ({
          productId: row.productId,
          consumoReal: row.consumoReal,
        })),
      };
    });
  }, [cyclesQuery.data]);

  const calculateSuggestions = () => {
    const supplierProductIds = selectedSupplier?.productIds;
    const catalog = supplierProductIds
      ? products.filter(product => supplierProductIds.includes(product.id))
      : products;
    const today = calendarDayInArgentina(new Date());

    const items = catalog.map(product => {
      const currentStock = getTotalStock(product);
      const result = suggestFromStockCycles({
        cycles: suggestionCycles,
        productId: product.id,
        currentStock,
        orderUnit: product.orderUnit,
        dateType,
        span,
        specificDate: calcDate || undefined,
        packRounding: stockPackRounding,
        today,
      });
      return {
        productId: product.id,
        average: result.average,
        cyclesUsed: result.cyclesUsed,
        raw: result.raw,
        currentStock,
        suggested: result.suggested,
        quantity: result.suggested,
        included: result.suggested > 0,
      };
    });

    setOrderItems(items);
    setView('create-step2');
  };

  const confirmOrder = async () => {
    const items = orderItems.filter(i => i.included && i.quantity > 0).map(i => ({
      productId: i.productId,
      quantityOrdered: i.quantity,
    }));
    try {
      const newOrder = await createPurchaseOrder({
        supplierId: supplierId || undefined,
        provider: selectedSupplier?.name || provider || 'Proveedor General',
        items,
      });
      addAudit({ user: 'Admin', action: 'Creación Pedido ' + newOrder.id, element: newOrder.id, newValue: 'Pendiente' });
      setSuccessMsg('Pedido ' + newOrder.id + ' creado exitosamente');
      setLastCreatedOrder(newOrder);
      setView('create-step3');
    } catch (e) {
      window.alert(getApiErrorMessage(e, 'No se pudo crear el pedido'));
    }
  };

  const startEditOrder = (order: Order) => {
    setSelectedOrder(order);
    setEditItems(order.items.map(i => ({ productId: i.productId, quantity: i.quantityOrdered })));
    setView('edit-order');
  };

  const saveEditOrder = async () => {
    if (!selectedOrder) return;
    const items = editItems.filter(i => i.quantity > 0).map(i => ({
      productId: i.productId,
      quantityOrdered: i.quantity,
    }));
    if (items.length === 0) {
      window.alert('El pedido debe tener al menos un producto con cantidad.');
      return;
    }
    setSavingEdit(true);
    try {
      const updated = await updatePurchaseOrder({
        orderId: selectedOrder.id,
        items,
        version: selectedOrder.version,
      });
      setSelectedOrder(updated);
      setSuccessMsg('Pedido actualizado');
      setView('list');
    } catch (e) {
      window.alert(getApiErrorMessage(e, 'No se pudo guardar el pedido'));
    } finally {
      setSavingEdit(false);
    }
  };

  const buildOrderPDFBlob = async (order: Order): Promise<Blob> => {
    const logo = await loadOrderLogo();
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const margin = 40;
    const pad = 16;
    const contentW = W - margin * 2;
    const textX = margin + pad;
    const textRight = W - margin - pad;
    const green: [number, number, number] = [64, 138, 49];
    let y = 36;

    const logoSize = 56;
    doc.addImage(logo, 'PNG', margin, y, logoSize, logoSize);
    const brandX = margin + logoSize + 12;
    const brandMid = y + logoSize / 2;
    doc.setTextColor(113, 113, 130);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('La Chacra Futbol', brandX, brandMid - 2);
    doc.setTextColor(160, 160, 160);
    doc.setFontSize(8);
    doc.text('Sistema de Gestión LCH', brandX, brandMid + 12);

    y += logoSize + 28;
    doc.setTextColor(17, 17, 17);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Detalle del Pedido', W / 2, y, { align: 'center' });
    y += 12;
    doc.setDrawColor(green[0], green[1], green[2]);
    doc.setLineWidth(1.5);
    doc.line(margin, y, W - margin, y);

    y += 18;
    const boxH = 52;
    doc.setFillColor(247, 247, 245);
    doc.roundedRect(margin, y, contentW, boxH, 4, 4, 'F');

    y += 20;
    const now = new Date();
    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    const secs = String(now.getSeconds()).padStart(2, '0');
    const remito = 'REM-' + order.date.replace(/-/g, '') + '-' + hrs + mins + secs;

    const fields = [
      { label: 'Remito', value: remito },
      { label: 'Fecha', value: order.date },
      { label: 'Proveedor', value: order.provider },
    ];
    const colW = (textRight - textX) / fields.length;
    fields.forEach(({ label, value }, i) => {
      const x = textX + i * colW;
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(label.toUpperCase(), x, y);
      doc.setTextColor(51, 51, 51);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(value, x, y + 14);
    });

    y += boxH - 20 + 18;
    doc.setFillColor(green[0], green[1], green[2]);
    doc.rect(margin, y, contentW, 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Producto', textX, y + 16);
    doc.text('Cantidad Pedida', textRight, y + 16, { align: 'right' });

    y += 24;
    let totalUnits = 0;
    order.items.forEach((item, idx) => {
      if (y > 760) { doc.addPage(); y = 40; }
      const bg = idx % 2 === 0 ? [255, 255, 255] : [249, 249, 247];
      doc.setFillColor(bg[0], bg[1], bg[2]);
      doc.rect(margin, y, contentW, 22, 'F');
      doc.setTextColor(51, 51, 51);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const prod = getProduct(item.productId);
      const unitLabel = prod ? getUnitLabel(prod.unit, true) : 'uds';
      doc.text(getProductName(item.productId).toUpperCase(), textX, y + 15);
      doc.text(item.quantityOrdered + ' ' + unitLabel, textRight, y + 15, { align: 'right' });
      totalUnits += item.quantityOrdered;
      y += 22;
    });

    doc.setFillColor(240, 236, 230);
    doc.rect(margin, y, contentW, 26, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const totalText = String(totalUnits);
    const totalWidth = doc.getTextWidth(totalText);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(113, 113, 130);
    doc.text('Total productos:', textRight - totalWidth - 16, y + 17, { align: 'right' });
    doc.setTextColor(green[0], green[1], green[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(totalText, textRight, y + 17, { align: 'right' });

    y += 48;
    doc.setDrawColor(229, 229, 229);
    doc.setLineWidth(0.5);
    doc.line(margin, y, W - margin, y);
    y += 14;
    doc.setTextColor(180, 180, 180);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Documento generado por Sistema de Gestión LCH - La Chacra Fútbol', W / 2, y, { align: 'center' });
    doc.text('Generado el ' + now.toLocaleDateString('es-AR') + ' a las ' + now.toLocaleTimeString('es-AR'), W / 2, y + 12, { align: 'center' });

    return doc.output('blob');
  };

  const sharePDF = async (order: Order) => {
    const blob = await buildOrderPDFBlob(order);
    const filename = `pedido-${order.id}.pdf`;

    if (Capacitor.isNativePlatform()) {
      const reader = new FileReader();
      const base64 = await new Promise<string>(resolve => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(blob);
      });
      const written = await Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: Directory.Cache,
        recursive: true,
      });
      await Share.share({
        title: `Pedido ${order.id}`,
        files: [written.uri],
        dialogTitle: 'Compartir pedido',
      });
    } else {
      downloadBlobFile({ filename, blob });
    }
  };

  const startArrival = (order: Order) => {
    setSelectedOrder(order);
    const fallbackWarehouseId = warehouses[0]?.id || '';
    setArrivalDefaultWarehouseId(fallbackWarehouseId);
    setArrivalItems(order.items.map(i => ({
      productId: i.productId,
      ordered: i.quantityOrdered,
      received: i.quantityOrdered,
      allocations: [{ warehouseId: fallbackWarehouseId, quantity: i.quantityOrdered }],
    })));
    setView('confirm-arrival');
  };

  const updateArrivalReceived = (idx: number, received: number) => {
    setArrivalItems(prev => {
      const next = [...prev];
      const item = next[idx];
      if (!item) return prev;

      const safeReceived = Math.max(0, received);
      const allocations = item.allocations.length ? [...item.allocations] : [{ warehouseId: arrivalDefaultWarehouseId, quantity: 0 }];
      const restSum = allocations.slice(1).reduce((s, a) => s + (a.quantity || 0), 0);
      allocations[0] = { ...allocations[0], quantity: Math.max(0, safeReceived - restSum) };

      next[idx] = { ...item, received: safeReceived, allocations };
      return next;
    });
  };

  const setAllocationWarehouse = (itemIdx: number, allocIdx: number, warehouseId: string) => {
    setArrivalItems(prev => {
      const next = [...prev];
      const item = next[itemIdx];
      if (!item) return prev;
      const allocations = item.allocations.map((a, i) => i === allocIdx ? { ...a, warehouseId } : a);
      next[itemIdx] = { ...item, allocations };
      return next;
    });
  };

  const setAllocationQuantity = (itemIdx: number, allocIdx: number, quantity: number) => {
    setArrivalItems(prev => {
      const next = [...prev];
      const item = next[itemIdx];
      if (!item) return prev;
      const allocations = item.allocations.map((a, i) => i === allocIdx ? { ...a, quantity: Math.max(0, quantity) } : a);

      // Keep invariant by rebalancing first allocation
      const safeAllocations = allocations.length ? allocations : [{ warehouseId: arrivalDefaultWarehouseId, quantity: 0 }];
      const restSum = safeAllocations.slice(1).reduce((s, a) => s + (a.quantity || 0), 0);
      safeAllocations[0] = { ...safeAllocations[0], quantity: Math.max(0, item.received - restSum) };

      next[itemIdx] = { ...item, allocations: safeAllocations };
      return next;
    });
  };

  const addAllocationRow = (itemIdx: number) => {
    setArrivalItems(prev => {
      const next = [...prev];
      const item = next[itemIdx];
      if (!item) return prev;
      const used = new Set(item.allocations.map(a => a.warehouseId));
      const candidate = warehouses.find(w => !used.has(w.id))?.id || warehouses[0]?.id || arrivalDefaultWarehouseId;
      const allocations = [...item.allocations, { warehouseId: candidate || '', quantity: 0 }];
      next[itemIdx] = { ...item, allocations };
      return next;
    });
  };

  const removeAllocationRow = (itemIdx: number, allocIdx: number) => {
    setArrivalItems(prev => {
      const next = [...prev];
      const item = next[itemIdx];
      if (!item) return prev;
      if (item.allocations.length <= 1) return prev;
      const allocations = item.allocations.filter((_, i) => i !== allocIdx);

      const restSum = allocations.slice(1).reduce((s, a) => s + (a.quantity || 0), 0);
      allocations[0] = { ...allocations[0], quantity: Math.max(0, item.received - restSum) };

      next[itemIdx] = { ...item, allocations };
      return next;
    });
  };

  const arrivalItemError = (item: (typeof arrivalItems)[number]): string | null => {
    const sum = item.allocations.reduce((s, a) => s + (a.quantity || 0), 0);
    if (sum !== item.received) return `La suma por almacén (${sum}) debe ser igual a recibido (${item.received}).`;
    if (item.allocations.some(a => !a.warehouseId)) return 'Seleccioná un almacén en todas las filas.';
    return null;
  };

  const arrivalHasErrors = arrivalItems.some(it => arrivalItemError(it) !== null);

  const confirmArrival = async () => {
    if (!selectedOrder) return;
    if (arrivalHasErrors) return;

    const receivedAtISO = new Date().toISOString();
    setSavingArrival(true);
    try {
      await receivePurchaseOrder({
        orderId: selectedOrder.id,
        items: arrivalItems.map(it => ({
          productId: it.productId,
          quantityReceived: it.received,
          allocations: it.allocations,
        })),
        ...operatorFields({
          operatorId: currentUser.id,
          operatorName: currentUser.username,
        }),
      });
    } catch (e) {
      window.alert(getApiErrorMessage(e, 'No se pudo confirmar el arribo'));
      return;
    } finally {
      setSavingArrival(false);
    }

    const whName = (id: string) => warehouses.find(w => w.id === id)?.name || id;
    const uniqueWh = Array.from(new Set(arrivalItems.flatMap(i => i.allocations.map(a => a.warehouseId)).filter(Boolean)));
    const auditWhere =
      uniqueWh.length === 1
        ? `Almacén: ${whName(uniqueWh[0])}`
        : `Almacenes: múltiples`;

    addAudit({
      user: 'Admin',
      action: 'Confirmación Arribo ' + selectedOrder.id,
      element: selectedOrder.id,
      previousValue: '-',
      newValue: `Recibido · ${auditWhere}`,
    });
    setView('list');
    setSelectedOrder(null);
  };

  const getProductName = (id: string) => products.find(p => p.id === id)?.name || id;
  const getProduct = (id: string) => products.find(p => p.id === id);

  const generatePDF = (order: Order) => {
    const now = new Date();
    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    const secs = String(now.getSeconds()).padStart(2, '0');
    const remito = 'REM-' + order.date.replace(/-/g, '') + '-' + hrs + mins + secs;

    const totalUnits = order.items.reduce((s, i) => s + i.quantityOrdered, 0);

    let rows = '';
    for (const item of order.items) {
      const prod = getProduct(item.productId);
      const unitLabel = prod ? getUnitLabel(prod.unit, true) : 'uds';
      rows += '<tr>';
      rows += '<td style="padding: 12px 16px; border-bottom: 1px solid #e5e5e5; font-size: 13px; color: #333; text-transform: uppercase;">';
      rows += getProductName(item.productId);
      rows += '</td>';
      rows += '<td style="padding: 12px 16px; border-bottom: 1px solid #e5e5e5; text-align: right; font-size: 13px; color: #333; font-weight: 500;">';
      rows += String(item.quantityOrdered) + ' ' + unitLabel;
      rows += '</td>';
      rows += '</tr>';
    }

    const parts = [
      '<!DOCTYPE html><html><head><meta charset="utf-8">',
      '<title>Detalle del Pedido - ' + order.id + '</title>',
      '<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">',
      '<style>',
      '* { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }',
      'body { font-family: Poppins, sans-serif; background: #fff; color: #333; }',
      'th, .meta, .total { -webkit-print-color-adjust: exact; print-color-adjust: exact; }',
      '@media print { body { margin: 0; } .no-print { display: none !important; } }',
      '</style>',
      '</head><body>',
      '<div style="max-width: 700px; margin: 0 auto; padding: 40px 32px;">',
      '<div style="display: flex; align-items: center; gap: 16px; margin-bottom: 28px;">',
      '<img src="' + orderLogoUrl() + '" alt="LCH" style="width: 72px; height: 72px; object-fit: contain; flex-shrink: 0;" />',
      '<div>',
      '<h2 style="font-size: 11px; color: #717182; text-transform: uppercase; letter-spacing: 2px; font-weight: 500;">La Chacra Futbol</h2>',
      '<p style="font-size: 10px; color: #999; margin-top: 2px;">Sistema de Gestión LCH</p>',
      '</div></div>',
      '<h1 style="text-align: center; font-size: 16px; font-weight: 600; color: #111; margin: 0 0 16px; padding-bottom: 12px; border-bottom: 2px solid #408A31;">Detalle del Pedido</h1>',
      '<div class="meta" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 20px; background: #f7f7f5; padding: 16px; border-radius: 8px;">',
      '<div><span style="font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 1px;">Remito</span>',
      '<p style="font-size: 14px; font-weight: 600; color: #333; margin-top: 4px;">' + remito + '</p></div>',
      '<div><span style="font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 1px;">Fecha</span>',
      '<p style="font-size: 14px; font-weight: 600; color: #333; margin-top: 4px;">' + order.date + '</p></div>',
      '<div><span style="font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 1px;">Proveedor</span>',
      '<p style="font-size: 14px; font-weight: 600; color: #333; margin-top: 4px;">' + order.provider + '</p></div>',
      '</div>',
      '<table style="width: 100%; border-collapse: collapse;">',
      '<thead><tr>',
      '<th style="padding: 0; text-align: left; font-size: 13px; font-weight: 600;"><div style="background-color: #408A31; color: #fff; padding: 12px 16px; border-radius: 8px 0 0 8px;">Producto</div></th>',
      '<th style="padding: 0; text-align: right; font-size: 13px; font-weight: 600; width: 180px;"><div style="background-color: #408A31; color: #fff; padding: 12px 16px; border-radius: 0 8px 8px 0;">Cantidad Pedida</div></th>',
      '</tr></thead>',
      '<tbody>' + rows + '</tbody></table>',
      '<div class="total" style="display: flex; justify-content: flex-end; align-items: baseline; gap: 24px; margin-top: 12px; padding: 12px 16px; background-color: #f0ece6; border-radius: 8px;">',
      '<span style="font-size: 13px; color: #717182;">Total productos:</span>',
      '<span style="font-size: 14px; font-weight: 600; color: #408A31; min-width: 72px; text-align: right;">' + totalUnits + '</span>',
      '</div>',
      '<div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e5e5; text-align: center;">',
      '<p style="font-size: 10px; color: #999;">Documento generado por Sistema de Gestión LCH - La Chacra Fútbol</p>',
      '<p style="font-size: 10px; color: #ccc; margin-top: 4px;">Generado el ' + now.toLocaleDateString('es-AR') + ' a las ' + now.toLocaleTimeString('es-AR') + '</p>',
      '</div>',
      '<div class="no-print" style="text-align: center; margin-top: 24px;">',
      '<button onclick="window.print()" style="background: #408A31; color: white; border: none; padding: 12px 32px; border-radius: 8px; font-family: Poppins, sans-serif; font-size: 14px; cursor: pointer; font-weight: 500;">Imprimir / Guardar PDF</button>',
      '</div>',
      '</div></body></html>',
    ];

    const html = parts.join('\n');
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  if (view === 'create-step1') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button onClick={() => setView('list')} className="hover:text-[#3d7a3d]">Pedidos</button>
          <ChevronRight size={14} />
          <span className="text-foreground">Nuevo Pedido - Paso 1</span>
        </div>

        <div className="bg-card rounded-xl border border-border p-6 shadow-sm max-w-xl mx-auto">
          <h2 className="mb-6 text-foreground">Configurar Pedido</h2>
          <div className="space-y-5">
            <div>
              <label className="block text-sm mb-2">Proveedor</label>
              <select
                value={supplierId}
                onChange={e => {
                  setSupplierId(e.target.value);
                  const sup = suppliers.find(s => s.id === e.target.value);
                  setProvider(sup?.name || '');
                }}
                className="w-full px-3 py-2.5 rounded-lg bg-input-background border border-border focus:border-[#3d7a3d] outline-none text-sm"
              >
                <option value="">Seleccionar proveedor…</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.productIds.length} productos)
                  </option>
                ))}
              </select>
              {supplierId && selectedSupplier && (
                <p className="text-xs text-[#3d7a3d] mt-1">
                  {selectedSupplier.productIds.length} productos asignados a este proveedor
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm mb-2">Tipo de Fecha</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setDateType('regular')}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${dateType === 'regular' ? 'border-[#3d7a3d] bg-[#3d7a3d]/5' : 'border-border'}`}
                >
                  <p className="text-sm" style={{ fontWeight: 500 }}>Regular</p>
                  <p className="text-xs text-muted-foreground mt-1">Semana normal de operacion</p>
                </button>
                <button
                  onClick={() => setDateType('after')}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${dateType === 'after' ? 'border-[#3d7a3d] bg-[#3d7a3d]/5' : 'border-border'}`}
                >
                  <p className="text-sm" style={{ fontWeight: 500 }}>After / Especial</p>
                  <p className="text-xs text-muted-foreground mt-1">Solo controles marcados como after</p>
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm mb-2">Periodo de calculo</label>
              <select
                value={span}
                onChange={e => setSpan(e.target.value as SuggestionSpan)}
                className="w-full px-3 py-2.5 rounded-lg bg-input-background border border-border outline-none text-sm"
              >
                <option value="week">Semana</option>
                <option value="month">Ultimo mes</option>
                <option value="quarter">Ultimos 3 meses</option>
                <option value="halfYear">Ultimos 6 meses</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                El promedio sale del consumo real entre controles del tipo elegido: lo que fisicamente salio, no lo que se tickeo. Ultimos 6 meses aplica la misma cuenta a 180 dias.
              </p>
            </div>
            <div>
              <label className="block text-sm mb-2">Fecha especifica (opcional)</label>
              <p className="text-xs text-muted-foreground mb-2">Si elegis una fecha, manda sobre el periodo</p>
              <input
                type="date"
                value={calcDate}
                onChange={e => setCalcDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-input-background border border-border outline-none text-sm"
              />
              {calcDate && (
                <p className="text-xs text-[#3d7a3d] mt-1">
                  Usando los controles del {new Date(calcDate + 'T12:00:00').toLocaleDateString('es-AR')}
                </p>
              )}
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setView('list')} className="px-4 py-2.5 rounded-lg border border-border text-sm">Cancelar</button>
              {/* Sin los ciclos cargados todo daria 0, que se leeria como una respuesta. */}
              <button
                onClick={calculateSuggestions}
                disabled={cyclesQuery.isPending}
                className="px-6 py-2.5 rounded-lg bg-[#3d7a3d] text-white text-sm hover:bg-[#2f5f2f] disabled:opacity-50"
              >
                {cyclesQuery.isPending ? 'Cargando controles…' : 'Calcular Sugerencias'}
              </button>
            </div>
            {cyclesQuery.isError && (
              <p className="text-xs text-red-600 dark:text-red-400">
                No se pudieron traer los controles: el sugerido va a salir en 0. Cargá las cantidades a mano.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'edit-order' && selectedOrder) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button onClick={() => setView('list')} className="hover:text-[#3d7a3d]">Pedidos</button>
          <ChevronRight size={14} />
          <span className="text-foreground">Editar {selectedOrder.id}</span>
        </div>
        <div className="bg-card rounded-xl border border-border shadow-sm divide-y divide-border">
          {editItems.map((item, idx) => (
            <div key={item.productId} className="px-4 py-3 flex items-center justify-between gap-3">
              <p className="text-sm flex-1 truncate" style={{ fontWeight: 500 }}>{getProductName(item.productId)}</p>
              <input
                type="number"
                min={0}
                value={item.quantity}
                onChange={e => {
                  const next = [...editItems];
                  next[idx] = { ...next[idx], quantity: parseInt(e.target.value, 10) || 0 };
                  setEditItems(next);
                }}
                className="w-20 px-2 py-1.5 rounded-lg bg-input-background border border-border outline-none text-sm text-right focus:border-[#3d7a3d]"
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={() => setView('list')} className="px-4 py-2 rounded-lg border border-border text-sm">Cancelar</button>
          <button
            onClick={() => void saveEditOrder()}
            disabled={savingEdit}
            className="px-4 py-2 rounded-lg bg-[#3d7a3d] text-white text-sm disabled:opacity-50"
          >
            {savingEdit ? 'Guardando…' : 'Guardar cantidades'}
          </button>
        </div>
      </div>
    );
  }

  if (view === 'create-step2') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button onClick={() => setView('list')} className="hover:text-[#3d7a3d]">Pedidos</button>
          <ChevronRight size={14} />
          <span className="text-foreground">Nuevo Pedido - Paso 2</span>
        </div>

        <div className="bg-card rounded-xl border border-border shadow-sm">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-foreground">Productos Sugeridos</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Modo: {dateType === 'after' ? 'After / Especial' : 'Regular'} | Proveedor: {selectedSupplier?.name || provider || 'General'}
                {calcDate ? ` | Fecha: ${new Date(calcDate + 'T12:00:00').toLocaleDateString('es-AR')}` : ''}
                {calcDate ? '' : ` | Periodo: ${span === 'week' ? 'semana' : span === 'month' ? 'ultimo mes' : span === 'quarter' ? 'ultimos 3 meses' : 'ultimos 6 meses'}`}
              </p>
            </div>
            <span className="text-xs bg-[#3d7a3d]/10 text-[#3d7a3d] px-3 py-1 rounded-full" style={{ fontWeight: 500 }}>
              {orderItems.filter(i => i.included).length} / {orderItems.length} productos
            </span>
          </div>
          {/* Mobile cards */}
          <div className="block sm:hidden divide-y divide-border">
            {orderItems.map((item, idx) => {
              const prod = getProduct(item.productId);
              const unitLabel = prod ? getUnitLabel(prod.unit, true) : 'uds';
              const packSize = (prod as Product)?.orderUnit;
              return (
                <div key={item.productId} className={`px-4 py-3 flex items-center justify-between gap-3 ${!item.included ? 'opacity-40' : ''}`}>
                  <input
                    type="checkbox"
                    checked={item.included}
                    onChange={() => {
                      const newItems = [...orderItems];
                      newItems[idx] = { ...newItems[idx], included: !newItems[idx].included };
                      setOrderItems(newItems);
                    }}
                    className="w-4 h-4 rounded accent-[#3d7a3d] flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ fontWeight: 500 }}>{getProductName(item.productId)}</p>
                    <p className="text-xs text-muted-foreground">Stock: {item.currentStock} {unitLabel}</p>
                    <p className="text-xs text-muted-foreground">
                      Consumo real prom.: {item.average} {unitLabel} · {cyclesLabel(item.cyclesUsed)}
                    </p>
                    {packSize && item.suggested !== item.raw && (
                      <p className="text-xs text-[#3d7a3d]">Pack x{packSize} → redondeado a {item.suggested}</p>
                    )}
                  </div>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={e => {
                      const newItems = [...orderItems];
                      newItems[idx] = { ...newItems[idx], quantity: readOrderQuantity(e.target.value) };
                      setOrderItems(newItems);
                    }}
                    className="w-20 px-2 py-1.5 rounded-lg bg-input-background border border-border outline-none text-sm text-right focus:border-[#3d7a3d]"
                    min={0}
                    disabled={!item.included}
                  />
                </div>
              );
            })}
          </div>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="bg-muted">
                  <th className="text-center px-4 py-3 text-xs text-muted-foreground uppercase w-12">Incluir</th>
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase">Producto</th>
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase">Consumo Real Prom. por Control</th>
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase">Stock Actual</th>
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase">Cantidad Pedida</th>
                </tr>
              </thead>
              <tbody>
                {orderItems.map((item, idx) => {
                  const prod = getProduct(item.productId);
                  const unitLabel = prod ? getUnitLabel(prod.unit, true) : 'uds';
                  const packSize = (prod as Product)?.orderUnit;
                  return (
                    <tr key={item.productId} className={`border-b border-border/40 ${!item.included ? 'opacity-40' : ''}`}>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={item.included}
                          onChange={() => {
                            const newItems = [...orderItems];
                            newItems[idx] = { ...newItems[idx], included: !newItems[idx].included };
                            setOrderItems(newItems);
                          }}
                          className="w-4 h-4 rounded accent-[#3d7a3d]"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {getProductName(item.productId)}
                        {packSize && <span className="ml-1 text-xs text-[#3d7a3d]">(pack x{packSize})</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-muted-foreground">
                        <div className="flex flex-col items-end">
                          <span>{item.average} {unitLabel}</span>
                          <span className="text-[10px]">{cyclesLabel(item.cyclesUsed)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-right">{item.currentStock} {unitLabel}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-col items-end">
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={e => {
                              const newItems = [...orderItems];
                              newItems[idx] = { ...newItems[idx], quantity: readOrderQuantity(e.target.value) };
                              setOrderItems(newItems);
                            }}
                            className="w-20 px-2 py-1.5 rounded-lg bg-input-background border border-border outline-none text-sm text-right focus:border-[#3d7a3d]"
                            min={0}
                            disabled={!item.included}
                          />
                          {packSize && item.suggested !== item.raw && (
                            <span className="text-[10px] text-[#3d7a3d]">sugerido: {item.suggested}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 flex flex-col sm:flex-row gap-3 justify-between border-t border-border">
            <button onClick={() => setView('create-step1')} className="px-4 py-2 rounded-lg border border-border text-sm">Volver</button>
            <button onClick={confirmOrder} className="px-6 py-2.5 rounded-lg bg-[#3d7a3d] text-white text-sm hover:bg-[#2f5f2f] flex items-center gap-2">
              <Check size={16} />
              Confirmar Pedido
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'create-step3') {
    return (
      <div className="space-y-6 flex items-center justify-center min-h-[60vh]">
        <div className="bg-card rounded-xl border border-border p-8 shadow-sm text-center max-w-md">
          <div className="w-16 h-16 bg-[#3d7a3d]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={32} className="text-[#3d7a3d]" />
          </div>
          <h2 className="text-foreground mb-2">Pedido Creado</h2>
          <p className="text-sm text-muted-foreground mb-6">{successMsg}</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <button onClick={() => setView('list')} className="px-6 py-2.5 rounded-lg bg-[#3d7a3d] text-white text-sm hover:bg-[#2f5f2f]">
              Ver Pedidos
            </button>
            <button
              onClick={() => lastCreatedOrder && generatePDF(lastCreatedOrder)}
              className="px-6 py-2.5 rounded-lg border border-border text-sm flex items-center gap-2 hover:bg-muted transition-colors"
            >
              <Download size={16} />
              Descargar PDF
            </button>
            <button
              onClick={() => lastCreatedOrder && void sharePDF(lastCreatedOrder)}
              className="px-6 py-2.5 rounded-lg bg-[#25D366] text-white text-sm flex items-center gap-2 hover:bg-[#1ebe5d] transition-colors"
            >
              <Share2 size={16} />
              Compartir
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'confirm-arrival' && selectedOrder) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button onClick={() => { setView('list'); setSelectedOrder(null); }} className="hover:text-[#3d7a3d]">Pedidos</button>
          <ChevronRight size={14} />
          <span className="text-foreground">Confirmar Arribo - {selectedOrder.id}</span>
        </div>

        <div className="bg-card rounded-xl border border-border shadow-sm">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-foreground">Confirmar Llegada</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Pedido {selectedOrder.id} | Proveedor: {selectedOrder.provider} | Fecha: {selectedOrder.date}
            </p>
          </div>

          {/* Warehouse storage mode */}
          <div className="px-6 py-4 border-b border-border space-y-3">
            <div>
              <p className="text-sm mb-2" style={{ fontWeight: 600 }}>Guardar stock recibido en</p>
            </div>

            <div className="max-w-md">
              <select
                value={arrivalDefaultWarehouseId}
                onChange={e => {
                  const v = e.target.value;
                  setArrivalDefaultWarehouseId(v);
                  // Apply to all products; user can override some below.
                  setArrivalItems(prev => prev.map(it => ({
                    ...it,
                    allocations: it.allocations.length
                      ? [{ ...it.allocations[0], warehouseId: v }, ...it.allocations.slice(1)]
                      : [{ warehouseId: v, quantity: it.received }],
                  })));
                }}
                className="w-full px-2.5 py-2 rounded-lg bg-input-background border border-border outline-none text-xs"
              >
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="block sm:hidden divide-y divide-border">
            {arrivalItems.map((item, idx) => {
              const diff = item.received - item.ordered;
              const prod = getProduct(item.productId);
              const unitLabel = prod ? getUnitLabel(prod.unit, true) : 'uds';
              const err = arrivalItemError(item);
              return (
                <div key={item.productId} className="px-4 py-3">
                  <p className="text-sm mb-2" style={{ fontWeight: 500 }}>{getProductName(item.productId)}</p>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground flex-1">Pedido: {item.ordered} {unitLabel}</span>
                    <input
                      type="number"
                      value={item.received}
                      onChange={e => {
                        updateArrivalReceived(idx, parseInt(e.target.value) || 0);
                      }}
                      className="w-20 px-2 py-1.5 rounded-lg bg-input-background border border-border outline-none text-sm text-right focus:border-[#3d7a3d]"
                      min={0}
                    />
                    <span className={`text-xs w-10 text-right ${diff < 0 ? 'text-red-600 dark:text-red-400' : diff > 0 ? 'text-[#3d7a3d]' : 'text-muted-foreground'}`}>
                      {diff > 0 ? '+' : ''}{diff}
                    </span>
                  </div>

                  <div className="mt-3 space-y-2">
                    {item.allocations.map((a, aIdx) => (
                      <div key={aIdx} className="flex items-center gap-2">
                        <select
                          value={a.warehouseId}
                          onChange={e => setAllocationWarehouse(idx, aIdx, e.target.value)}
                          className="flex-1 px-2.5 py-2 rounded-lg bg-input-background border border-border outline-none text-xs"
                        >
                          {warehouses.map(w => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          value={a.quantity}
                          onChange={e => setAllocationQuantity(idx, aIdx, parseInt(e.target.value) || 0)}
                          className="w-20 px-2 py-2 rounded-lg bg-input-background border border-border outline-none text-xs text-right"
                          min={0}
                        />
                        {item.allocations.length > 1 && (
                          <button
                            onClick={() => removeAllocationRow(idx, aIdx)}
                            className="px-2 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted"
                            title="Quitar"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => addAllocationRow(idx)}
                      className="text-xs text-[#3d7a3d] hover:underline"
                    >
                      + Agregar almacén
                    </button>
                    {err && <p className="text-xs text-red-600 dark:text-red-400">{err}</p>}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full min-w-[550px]">
              <thead>
                <tr className="bg-muted">
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase">Producto</th>
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase">Almacén</th>
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase">Cantidad Pedida</th>
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase">Cantidad Recibida</th>
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {arrivalItems.map((item, idx) => {
                  const diff = item.received - item.ordered;
                  const prod = getProduct(item.productId);
                  const unitLabel = prod ? getUnitLabel(prod.unit, true) : 'uds';
                  const err = arrivalItemError(item);
                  return (
                    <tr key={item.productId} className="border-b border-border/40">
                      <td className="px-4 py-3 text-sm">{getProductName(item.productId)}</td>
                      <td className="px-4 py-3">
                        <div className="space-y-2">
                          {item.allocations.map((a, aIdx) => (
                            <div key={aIdx} className="flex items-center gap-2">
                              <select
                                value={a.warehouseId}
                                onChange={e => setAllocationWarehouse(idx, aIdx, e.target.value)}
                                className="w-48 px-2.5 py-2 rounded-lg bg-input-background border border-border outline-none text-xs"
                              >
                                {warehouses.map(w => (
                                  <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                              </select>
                              <input
                                type="number"
                                value={a.quantity}
                                onChange={e => setAllocationQuantity(idx, aIdx, parseInt(e.target.value) || 0)}
                                className="w-20 px-2.5 py-2 rounded-lg bg-input-background border border-border outline-none text-xs text-right"
                                min={0}
                              />
                              {item.allocations.length > 1 && (
                                <button
                                  onClick={() => removeAllocationRow(idx, aIdx)}
                                  className="px-2.5 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted"
                                  title="Quitar"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          ))}
                          <button
                            onClick={() => addAllocationRow(idx)}
                            className="text-xs text-[#3d7a3d] hover:underline"
                          >
                            + Agregar almacén
                          </button>
                          {err && <p className="text-xs text-red-600 dark:text-red-400">{err}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-muted-foreground">{item.ordered} {unitLabel}</td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          value={item.received}
                          onChange={e => {
                            updateArrivalReceived(idx, parseInt(e.target.value) || 0);
                          }}
                          className="w-20 px-2 py-1.5 rounded-lg bg-input-background border border-border outline-none text-sm text-right focus:border-[#3d7a3d]"
                          min={0}
                        />
                      </td>
                      <td className={'px-4 py-3 text-sm text-right ' + (diff < 0 ? 'text-red-600 dark:text-red-400' : diff > 0 ? 'text-[#3d7a3d]' : 'text-muted-foreground')}>
                        {diff > 0 ? '+' : ''}{diff}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 flex gap-3 justify-end border-t border-border">
            <button onClick={() => { setView('list'); setSelectedOrder(null); }} className="px-4 py-2 rounded-lg border border-border text-sm">Cancelar</button>
            <button
              onClick={confirmArrival}
              disabled={arrivalHasErrors || savingArrival}
              className={`px-6 py-2.5 rounded-lg text-white text-sm flex items-center gap-2 ${
                arrivalHasErrors || savingArrival ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-[#3d7a3d] hover:bg-[#2f5f2f]'
              }`}
              title={arrivalHasErrors ? 'Revisá la distribución por almacén (la suma debe coincidir con recibido).' : 'Confirmar llegada'}
            >
              <Truck size={16} />
              {savingArrival ? 'Confirmando…' : 'Confirmar Llegada'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Default: List View
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-foreground">Pedidos</h1>
          <p className="text-sm text-muted-foreground mt-1">{orders.length} pedidos registrados</p>
        </div>
        <button
          onClick={startCreateOrder}
          className="flex items-center gap-2 bg-[#3d7a3d] hover:bg-[#2f5f2f] text-white px-4 py-2.5 rounded-lg transition-colors shadow-sm"
        >
          <Plus size={18} />
          Nuevo Pedido
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setStatusFilterAndUrl('all')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors border ${statusFilter === 'all' ? 'bg-[#3d7a3d] text-white border-[#3d7a3d]' : 'bg-card text-muted-foreground border-border hover:bg-muted'}`}
        >
          <Filter size={14} />
          Todos ({orders.length})
        </button>
        <button
          onClick={() => setStatusFilterAndUrl('Pendiente')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors border ${statusFilter === 'Pendiente' ? 'bg-amber-500 text-white border-amber-500' : 'bg-card text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900 hover:bg-amber-50 dark:hover:bg-amber-950/40'}`}
        >
          <Clock size={14} />
          Pendientes ({pendienteCount})
        </button>
        <button
          onClick={() => setStatusFilterAndUrl('Recibido')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors border ${statusFilter === 'Recibido' ? 'bg-green-600 text-white border-green-600' : 'bg-card text-green-700 dark:text-green-300 border-green-200 dark:border-green-900 hover:bg-green-50 dark:hover:bg-green-950/40'}`}
        >
          <Check size={14} />
          Recibidos ({recibidoCount})
        </button>
      </div>

      {/* Mobile cards */}
      <div className="block sm:hidden space-y-3">
        {filteredOrders.map(order => (
          <div key={order.id} className="bg-card rounded-xl border border-border shadow-sm p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm" style={{ fontWeight: 600 }}>{order.id}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{order.provider}</p>
                <p className="text-xs text-muted-foreground">{order.date} · {order.items.length} productos</p>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full flex-shrink-0 ${isOrderReceived(order.status) ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                }`} style={{ fontWeight: 500 }}>
                {order.status}
              </span>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <button
                onClick={() => generatePDF(order)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-muted transition-colors border border-border/60"
              >
                <FileText size={13} />
                PDF
              </button>
              {order.status === 'Pendiente' && (
                <>
                  <button
                    onClick={() => startEditOrder(order)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-muted transition-colors border border-border/60"
                  >
                    <Pencil size={13} />
                    Editar
                  </button>
                  <button
                    onClick={() => startArrival(order)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-[#3d7a3d] text-white hover:bg-[#2f5f2f] transition-colors flex-1 justify-center"
                  >
                    <Truck size={13} />
                    Confirmar Llegada
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        {filteredOrders.length === 0 && (
          <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border border-border">No hay pedidos</div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px]">
            <thead>
              <tr className="bg-muted">
                <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase">ID</th>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase">Fecha</th>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase">Proveedor</th>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase">Estado</th>
                <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase">Productos</th>
                <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map(order => (
                <tr key={order.id} className="border-b border-border/40 hover:bg-muted/50">
                  <td className="px-4 py-3 text-sm" style={{ fontWeight: 500 }}>{order.id}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{order.date}</td>
                  <td className="px-4 py-3 text-sm">{order.provider}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full ${isOrderReceived(order.status) ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                      }`} style={{ fontWeight: 500 }}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-muted-foreground">{order.items.length}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => generatePDF(order)}
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-[#3d7a3d] transition-colors"
                        title="Descargar PDF"
                      >
                        <FileText size={16} />
                      </button>
                      {order.status === 'Pendiente' && (
                        <>
                          <button
                            onClick={() => startEditOrder(order)}
                            className="text-xs text-muted-foreground hover:underline"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => startArrival(order)}
                            className="text-xs text-[#3d7a3d] hover:underline"
                          >
                            Confirmar Llegada
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredOrders.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">No hay pedidos</div>
        )}
      </div>
    </div>
  );
}
