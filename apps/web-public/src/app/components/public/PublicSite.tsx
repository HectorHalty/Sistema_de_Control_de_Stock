import { Construction } from 'lucide-react';

export function PublicSite() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#131313] px-4 text-[#e5e2e1]">
      <article className="w-full max-w-lg rounded-3xl border border-[#2e2e2e] bg-[#1a1a1a] p-8 text-center shadow-lg">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#3d7a3d]/20 text-[#6bfb9a]">
          <Construction size={28} />
        </div>

        <h1 className="text-2xl font-semibold text-[#e5e2e1]">En desarrollo</h1>
        <p className="mt-2 text-lg font-medium text-[#6bfb9a]">La Chacra Fútbol</p>
        <p className="mx-auto mt-3 max-w-md text-sm text-[#bccabb]">
          El sitio público estará disponible próximamente. Estamos trabajando en esta sección.
        </p>
        <p className="mx-auto mt-4 inline-block rounded-full bg-[#3d7a3d]/15 px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-[#6bfb9a]">
          Próximamente
        </p>
      </article>
    </div>
  );
}
