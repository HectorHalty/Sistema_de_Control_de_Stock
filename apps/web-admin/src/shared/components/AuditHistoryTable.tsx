import { useMemo, useState } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import type { AuditEntry } from '@/features/inventory/types';
import logoIcon from '@/assets/logo-LCH.png';

type SortColumn = 'date' | 'user' | 'action' | 'element' | 'previousValue' | 'newValue';
type SortDirection = 'asc' | 'desc';

const COLUMNS: { id: SortColumn; label: string; align: 'left' | 'right' }[] = [
  { id: 'date', label: 'Fecha y Hora', align: 'left' },
  { id: 'user', label: 'Usuario', align: 'left' },
  { id: 'action', label: 'Acción', align: 'left' },
  { id: 'element', label: 'Elemento', align: 'left' },
  { id: 'previousValue', label: 'Anterior', align: 'right' },
  { id: 'newValue', label: 'Nuevo', align: 'right' },
];

function getSortValue(entry: AuditEntry, column: SortColumn): string {
  switch (column) {
    case 'date':
      return entry.date;
    case 'user':
      return entry.user;
    case 'action':
      return entry.action;
    case 'element':
      return entry.element;
    case 'previousValue':
      return entry.previousValue || '-';
    case 'newValue':
      return entry.newValue || '-';
  }
}

interface AuditHistoryTableProps {
  entries: AuditEntry[];
  emptyMessage?: string;
  showUserAvatar?: boolean;
  dateColumnLabel?: string;
  /** Estilo compacto para historial de ventas */
  compact?: boolean;
}

export function AuditHistoryTable({
  entries,
  emptyMessage = 'Sin registros',
  showUserAvatar = false,
  dateColumnLabel,
  compact = false,
}: AuditHistoryTableProps) {
  const [search, setSearch] = useState('');
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const columns = COLUMNS.map(col =>
    col.id === 'date' && dateColumnLabel ? { ...col, label: dateColumnLabel } : col,
  );

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      e =>
        e.date.toLowerCase().includes(q) ||
        e.user.toLowerCase().includes(q) ||
        e.action.toLowerCase().includes(q) ||
        e.element.toLowerCase().includes(q) ||
        (e.previousValue || '').toLowerCase().includes(q) ||
        (e.newValue || '').toLowerCase().includes(q),
    );
  }, [entries, search]);

  const sortedEntries = useMemo(() => {
    const list = [...filteredEntries];
    const column = sortColumn ?? 'date';
    const direction = sortColumn ? sortDirection : 'desc';

    list.sort((a, b) => {
      const cmp = getSortValue(a, column).localeCompare(getSortValue(b, column), 'es', { numeric: true });
      return direction === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [filteredEntries, sortColumn, sortDirection]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection(column === 'date' ? 'desc' : 'asc');
    }
  };

  const headerPad = compact ? 'py-2' : 'py-3';
  const cellPad = compact ? 'py-2' : 'py-3';
  const rowClass = compact
    ? 'border-t border-border hover:bg-accent'
    : 'border-b border-border/40 hover:bg-muted/50';

  return (
    <>
      <div className={`${compact ? 'px-4' : 'px-6'} py-3 border-b border-border`}>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar en historial..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-input-background border border-border text-sm outline-none focus:border-[#3d7a3d] text-foreground"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className={`w-full ${compact ? 'min-w-[640px] text-sm' : 'min-w-[700px]'}`}>
          <thead>
            <tr className="bg-muted text-xs text-muted-foreground uppercase">
              {columns.map(col => (
                <th
                  key={col.id}
                  onClick={() => handleSort(col.id)}
                  className={`px-4 ${headerPad} cursor-pointer select-none hover:font-bold ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  <span className={`inline-flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : ''}`}>
                    {col.label}
                    <ChevronDown size={12} className="opacity-70 shrink-0" />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedEntries.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  {search.trim() ? 'No hay resultados para esa búsqueda' : emptyMessage}
                </td>
              </tr>
            ) : (
              sortedEntries.map(entry => (
                <tr key={entry.id} className={rowClass}>
                  <td className={`px-4 ${cellPad} text-xs text-muted-foreground whitespace-nowrap`}>{entry.date}</td>
                  <td className={`px-4 ${cellPad}`}>
                    {showUserAvatar ? (
                      <div className="flex items-center gap-2">
                        <img src={logoIcon} alt="" className="logo-sidebar w-6 h-6 rounded-full" />
                        <span className="text-sm">{entry.user}</span>
                      </div>
                    ) : (
                      <span className="text-sm">{entry.user}</span>
                    )}
                  </td>
                  <td className={`px-4 ${cellPad} text-sm text-muted-foreground`}>{entry.action}</td>
                  <td
                    className={`px-4 ${cellPad} text-sm text-foreground ${compact ? 'font-medium' : ''}`}
                    style={compact ? undefined : { fontWeight: 500 }}
                  >
                    {entry.element}
                  </td>
                  <td className={`px-4 ${cellPad} text-sm text-right text-muted-foreground`}>
                    {entry.previousValue || '-'}
                  </td>
                  <td
                    className={`px-4 ${cellPad} text-sm text-right text-foreground ${compact ? 'font-medium' : ''}`}
                    style={compact ? undefined : { fontWeight: 500 }}
                  >
                    {entry.newValue || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
