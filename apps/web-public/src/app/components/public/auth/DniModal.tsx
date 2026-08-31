import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { usePublicAuth } from './PublicAuthContext';

export function DniModal() {
  const { showDniModal, setShowDniModal, completeDni } = usePublicAuth();
  const [dni, setDni] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!showDniModal) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await completeDni(dni.trim());
      setDni('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al confirmar DNI');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-[#2a2a2a] bg-lch-card p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-white">Confirmá tu DNI</h2>
            <p className="mt-1 text-sm text-gray-400">
              Lo usamos para identificarte como jugador o capitán del torneo.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowDniModal(false)}
            className="rounded-lg p-1 text-gray-500 hover:bg-[#161616] hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="dni" className="mb-1.5 block text-sm font-bold text-gray-400">
              DNI (sin puntos)
            </label>
            <input
              id="dni"
              inputMode="numeric"
              autoComplete="off"
              value={dni}
              onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
              placeholder="Ej: 30123456"
              className="w-full rounded-xl border border-[#2a2a2a] bg-[#161616] px-4 py-3 text-white outline-none focus:border-lch-accent"
              required
              minLength={7}
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
          )}

          <button
            type="submit"
            disabled={saving || dni.length < 7}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-lch-accent py-3 font-black text-[#0e0e0e] disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : 'Confirmar'}
          </button>
        </form>
      </div>
    </div>
  );
}
