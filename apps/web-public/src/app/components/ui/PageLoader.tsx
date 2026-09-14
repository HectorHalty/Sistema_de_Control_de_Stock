import { Loader2 } from 'lucide-react';

export function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-lch-accent">
      <Loader2 className="animate-spin" size={32} />
    </div>
  );
}
