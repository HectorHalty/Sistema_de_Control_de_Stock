import type { PublicSponsor } from '../../../api/public-api';

type Props = {
  sponsor: PublicSponsor;
  compact?: boolean;
};

export function SponsorPlacement({ sponsor, compact = false }: Props) {
  const height = compact ? (sponsor.heightPx ?? 64) : (sponsor.heightPx ?? 120);
  const width = sponsor.widthPx ?? undefined;

  const inner = (
    <div
      style={{
        borderRadius: compact ? 10 : 12,
        overflow: 'hidden',
        height,
        maxWidth: width,
        width: width ? '100%' : undefined,
        border: '1px solid #2a2a2a',
        background: '#161616',
      }}
      className="relative"
    >
      {sponsor.imageUrl ? (
        sponsor.mediaType === 'video' ? (
          <video
            src={sponsor.imageUrl}
            autoPlay
            muted
            loop
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <img
            src={sponsor.imageUrl}
            alt={sponsor.name}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )
      ) : (
        <div className="flex h-full items-center justify-center px-2 text-center text-[10px] font-bold text-gray-500">
          {sponsor.name}
        </div>
      )}
    </div>
  );

  if (sponsor.linkUrl) {
    return (
      <a href={sponsor.linkUrl} target="_blank" rel="noopener noreferrer" className="block">
        {inner}
      </a>
    );
  }

  return inner;
}
