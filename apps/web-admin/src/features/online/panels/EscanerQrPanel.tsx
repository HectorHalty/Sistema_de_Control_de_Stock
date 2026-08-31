import { useState } from 'react';
import { QrCode, ScanLine } from 'lucide-react';
import { onlineApi, getAccessToken } from '@/app/api/client';
import { OnlineError, OnlinePanelShell, onlineButtonClass, onlineFieldClass } from '../online-shared';

export function EscanerQrPanel() {
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
      const res = await onlineApi.redeemQr(token.trim(), authToken);
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
    <OnlinePanelShell title="Escáner QR cantina">
      <div className="mx-auto max-w-lg rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <ScanLine size={20} className="text-primary" />
          <h3 className="font-bold">Retiro de pedido web</h3>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Escaneá o ingresá el código del cliente. Al confirmar se marca retirado y se descuenta stock.
        </p>
        <form onSubmit={handleRedeem} className="space-y-3">
          <input
            value={token}
            onChange={(e) => setToken(e.target.value.toUpperCase())}
            placeholder="LCH-XXXXXXXX"
            className={`${onlineFieldClass()} font-mono uppercase`}
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={loading || !token.trim()}
            className={`${onlineButtonClass()} w-full`}
          >
            {loading ? 'Validando...' : 'Confirmar retiro'}
          </button>
        </form>
      </div>

      {error && <OnlineError message={error} />}

      {result && (
        <div className="mx-auto max-w-lg rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
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
        </div>
      )}
    </OnlinePanelShell>
  );
}
