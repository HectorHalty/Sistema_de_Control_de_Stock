import { useEffect, useMemo, useRef, useState } from 'react';
import type { PublicSponsor } from '../../../api/public-api';
import { carouselDwellMs, nextIndex, orderSponsorsForSlot } from './sponsor-carousel-model';

const MOVE_MS = 400;

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function Slide({
  sponsor,
  videoRef,
}: {
  sponsor: PublicSponsor;
  videoRef?: (el: HTMLVideoElement | null) => void;
}) {
  const height = sponsor.heightPx ?? 96;

  const body = sponsor.imageUrl ? (
    sponsor.mediaType === 'video' ? (
      <video
        ref={videoRef}
        src={sponsor.imageUrl}
        muted
        playsInline
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    ) : (
      <img
        src={sponsor.imageUrl}
        alt={sponsor.name}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    )
  ) : (
    <div className="flex h-full w-full items-center justify-center bg-[#161616] text-[11px] font-bold text-gray-500">
      {sponsor.name}
    </div>
  );

  const shell = (
    <div
      className="relative overflow-hidden rounded-xl border border-[#2a2a2a]"
      style={{ height, background: '#161616' }}
    >
      {body}
    </div>
  );

  if (sponsor.linkUrl) {
    return (
      <a href={sponsor.linkUrl} target="_blank" rel="noopener noreferrer" className="block">
        {shell}
      </a>
    );
  }
  return shell;
}

export function SponsorCarousel({
  slot,
  sponsors,
}: {
  slot: 'home' | 'cantina';
  sponsors: PublicSponsor[];
}) {
  const slides = useMemo(() => orderSponsorsForSlot(sponsors, slot), [sponsors, slot]);
  const [index, setIndex] = useState(0);
  const reduced = prefersReducedMotion();
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  useEffect(() => {
    setIndex(0);
  }, [slot, slides.length]);

  useEffect(() => {
    if (reduced || slides.length < 2) return;
    const current = slides[index];
    if (!current) return;
    const dwell = carouselDwellMs(current);
    const t = window.setTimeout(
      () => setIndex((i) => nextIndex(i, slides.length)),
      dwell + MOVE_MS,
    );
    return () => window.clearTimeout(t);
  }, [index, slides, reduced]);

  useEffect(() => {
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === index) {
        void v.play().catch(() => {});
      } else {
        v.pause();
        v.currentTime = 0;
      }
    });
  }, [index, slides.length]);

  if (slides.length === 0) return null;
  if (slides.length === 1 || reduced) return <Slide sponsor={slides[0]} />;

  return (
    <div className="overflow-hidden">
      <div
        className="flex"
        style={{
          transform: `translateX(-${index * 100}%)`,
          transition: `transform ${MOVE_MS}ms ease`,
        }}
      >
        {slides.map((s, i) => (
          <div key={s.id} className="w-full shrink-0" style={{ flex: '0 0 100%' }}>
            <Slide
              sponsor={s}
              videoRef={(el) => {
                videoRefs.current[i] = el;
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
