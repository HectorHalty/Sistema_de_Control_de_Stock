import { Construction, LockKeyhole, MoveRight } from 'lucide-react';
import { Link } from 'react-router';

interface ModulePlaceholderPageProps {
  title: string;
  description?: string;
  denied?: boolean;
  comingSoon?: boolean;
}

export function ModulePlaceholderPage({
  title,
  description,
  denied = false,
  comingSoon = false,
}: ModulePlaceholderPageProps) {
  const heading = denied ? 'Acceso denegado' : comingSoon ? 'En desarrollo' : `${title} — Módulo en proceso`;
  const body = denied
    ? 'Tu perfil no tiene permisos para ingresar a este módulo.'
    : comingSoon
      ? (description ?? `${title} estará disponible próximamente. Estamos trabajando en esta sección.`)
      : (description ?? '');

  return (
    <section className="mx-auto flex min-h-[55vh] w-full max-w-3xl items-center justify-center">
      <article className="w-full rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
        <div className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full ${denied ? 'bg-red-100 text-red-700' : 'bg-[#3d7a3d]/10 text-[#2f5f2f]'}`}>
          {denied ? <LockKeyhole size={28} /> : <Construction size={28} />}
        </div>

        <h2 className="text-foreground">{heading}</h2>
        {comingSoon && !denied && (
          <p className="mt-1 text-lg font-medium text-[#3d7a3d]">{title}</p>
        )}
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">{body}</p>
        {comingSoon && !denied && (
          <p className="mx-auto mt-3 inline-block rounded-full bg-[#3d7a3d]/10 px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-[#2f5f2f]">
            Próximamente
          </p>
        )}

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
