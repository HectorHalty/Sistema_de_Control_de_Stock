import { useState } from 'react';
import { QrCode, ScanLine } from 'lucide-react';
import { salesApi, getAccessToken } from '@/app/api/client';

export function RetiroQrModule() {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    ticketNumber: number | null;
    total: number;
    items: { name: string; quantity: number }[];
    retiradoEn: string;
  } | null>(null);

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    const authToken = getAccessToken();
    if (!authToken || !token.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await salesApi.redeemPublicQr(token.trim(), authToken);
      setResult({
        ticketNumber: res.pedido.ticketNumber,
        total: res.pedido.total,
        items: res.pedido.items,
        retiradoEn: res.pedido.retiradoEn,
      });
      setToken('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo validar el código');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-20 lg:pb-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <ScanLine size={20} className="text-primary" />
          <h2 className="text-lg font-bold">Retiro cantina</h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Ingresá el código QR del pedido web para marcarlo como retirado. Cada código se usa una
          sola vez.
        </p>
        <form onSubmit={handleRedeem} className="space-y-3">
          <input
            value={token}
            onChange={(e) => setToken(e.target.value.toUpperCase())}
            placeholder="LCH-XXXXXXXX"
            className="w-full rounded-lg border border-border bg-background px-4 py-3 font-mono text-sm uppercase outline-none focus:border-primary"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={loading || !token.trim()}
            className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {loading ? 'Validando...' : 'Confirmar retiro'}
          </button>
        </form>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
          <div className="mb-3 flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-300">
            <QrCode size={18} />
            Retiro confirmado
          </div>
          <p className="text-sm">
            <strong>Ticket:</strong> #{result.ticketNumber ?? '—'}
          </p>
          <p className="text-sm">
            <strong>Total:</strong> ${result.total.toLocaleString('es-AR')}
          </p>
          <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
            {result.items.map((item, i) => (
              <li key={i}>
                {item.quantity}× {item.name}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            {new Date(result.retiradoEn).toLocaleString('es-AR')}
          </p>
        </div>
      )}
    </div>
  );
}
