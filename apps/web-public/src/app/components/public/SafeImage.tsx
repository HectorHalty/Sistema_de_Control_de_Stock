import { useState } from 'react';

type Props = {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackLabel?: string;
};

export function SafeImage({ src, alt, className, fallbackLabel }: Props) {
  const [failed, setFailed] = useState(false);
  const showFallback = !src || failed;

  if (showFallback) {
    return (
      <div
        className={`flex items-center justify-center bg-[#161616] px-2 text-center text-[10px] font-bold text-gray-500 ${className ?? ''}`}
      >
        {fallbackLabel ?? alt}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`object-cover ${className ?? ''}`}
    />
  );
}
