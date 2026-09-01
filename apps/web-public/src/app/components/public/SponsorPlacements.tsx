import { useQuery } from '@tanstack/react-query';
import { publicApi, type PublicSponsor } from '../../api/public-api';
import { SponsorPlacement } from './SponsorPlacement';

export function usePublicSponsors() {
  return useQuery({
    queryKey: ['sponsors-all'],
    queryFn: () => publicApi.sponsors(),
    staleTime: 60_000,
  });
}

export function SidebarSponsors({ sponsors }: { sponsors: PublicSponsor[] }) {
  const items = sponsors.filter((s) => s.placement === 'sidebar');
  if (!items.length) return null;

  return (
    <div className="space-y-2 px-3 pb-2">
      <p className="px-1 text-[10px] font-black uppercase tracking-widest text-gray-600">
        Sponsors
      </p>
      {items.map((s) => (
        <SponsorPlacement key={s.id} sponsor={s} />
      ))}
    </div>
  );
}

export function FooterSponsors({ sponsors }: { sponsors: PublicSponsor[] }) {
  const items = sponsors.filter((s) => s.placement === 'footer');
  if (!items.length) return null;

  return (
    <footer
      style={{ borderTop: '1px solid #1e1e1e', background: '#0e0e0e' }}
      className="hidden px-4 py-3 md:block"
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-3">
        {items.map((s) => (
          <SponsorPlacement key={s.id} sponsor={s} compact />
        ))}
      </div>
    </footer>
  );
}

export function MobileFooterSponsors({ sponsors }: { sponsors: PublicSponsor[] }) {
  const items = sponsors.filter((s) => s.placement === 'footer');
  if (!items.length) return null;

  return (
    <div className="border-t border-[#1e1e1e] bg-[#0e0e0e] px-3 py-2 md:hidden">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {items.map((s) => (
          <div key={s.id} className="min-w-[140px] shrink-0">
            <SponsorPlacement sponsor={s} compact />
          </div>
        ))}
      </div>
    </div>
  );
}
