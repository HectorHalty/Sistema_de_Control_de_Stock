type Props = {
  message: string;
  onRetry?: () => void;
};

export function QueryError({ message, onRetry }: Props) {
  return (
    <div className="p-6">
      <div className="mx-auto max-w-md rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
        <p className="text-sm font-semibold text-red-300">No pudimos cargar esta sección.</p>
        <p className="mt-1 text-xs text-red-300/80">{message}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 rounded-xl bg-lch-accent px-5 py-2.5 text-xs font-black text-[#0e0e0e]"
          >
            Reintentar
          </button>
        )}
      </div>
    </div>
  );
}
