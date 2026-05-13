import { Construction, LockKeyhole, MoveRight } from 'lucide-react';
import { Link } from 'react-router';

interface ModulePlaceholderPageProps {
  title: string;
  description: string;
  denied?: boolean;
}

export function ModulePlaceholderPage({ title, description, denied = false }: ModulePlaceholderPageProps) {
  return (
    <section className="mx-auto flex min-h-[55vh] w-full max-w-3xl items-center justify-center">
      <article className="w-full rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
        <div className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full ${denied ? 'bg-red-100 text-red-700' : 'bg-[#3d7a3d]/10 text-[#2f5f2f]'}`}>
          {denied ? <LockKeyhole size={28} /> : <Construction size={28} />}
        </div>

        <h2 className="text-foreground">{denied ? 'Acceso Denegado' : `${title} - Modulo en proceso`}</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          {denied ? 'Tu perfil no tiene permisos para ingresar a este modulo.' : description}
        </p>

        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full bg-[#3d7a3d] px-5 py-2.5 text-sm text-white transition-colors hover:bg-[#2f5f2f]"
          >
            Volver al Inicio <MoveRight size={16} />
          </Link>
        </div>
      </article>
    </section>
  );
}
