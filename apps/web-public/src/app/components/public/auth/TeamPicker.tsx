import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useFutbolIdentity } from './useFutbolIdentity';

export function TeamPicker({ onPick }: { onPick: (equipoInscripcionId: string) => void }) {
  const { listTeams } = useFutbolIdentity();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 200);
    return () => clearTimeout(t);
  }, [search]);

  const teams = useMemo(() => listTeams(debounced || undefined), [listTeams, debounced]);

  return (
    <div>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar equipo..."
          className="w-full rounded-xl border border-[#2a2a2a] bg-[#161616] py-2.5 pl-10 pr-4 text-sm outline-none focus:border-lch-accent"
        />
      </div>
      <div className="max-h-56 space-y-2 overflow-y-auto">
        {teams.map((t) => (
          <button
            key={t.equipoInscripcionId}
            type="button"
            onClick={() => onPick(t.equipoInscripcionId)}
            className="flex w-full items-center justify-between rounded-xl border border-[#2a2a2a] bg-[#161616] px-4 py-3 text-left text-sm hover:border-lch-accent/40"
          >
            <span>
              <span className="font-medium">{t.name}</span>
              <span className="ml-2 text-gray-500">{t.categoria}</span>
            </span>
          </button>
        ))}
        {!teams.length && (
          <p className="py-4 text-center text-sm text-gray-500">Sin equipos</p>
        )}
      </div>
    </div>
  );
}
