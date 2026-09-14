import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { usePublicAuth } from './PublicAuthContext';

export function JugadorDniStep({ onDone }: { onDone: () => void }) {
  const { completeDni } = usePublicAuth();
  const [dni, setDni] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await completeDni(dni.trim());
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo confirmar el DNI');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-gray-400">
        Ingresá tu DNI para vincularte con tu plantel. Lo usamos sólo para encontrarte en el torneo.
      </p>
      <input
        inputMode="numeric"
        autoComplete="off"
        value={dni}
        onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 9))}
        placeholder="DNI sin puntos"
        className="w-full rounded-xl border border-[#2a2a2a] bg-[#161616] px-4 py-3 text-white outline-none focus:border-lch-accent"
        required
        minLength={7}
      />
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
  );
}
