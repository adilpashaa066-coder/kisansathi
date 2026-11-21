import { useState } from 'react';

interface ResilientImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackIcon?: string;
  fallbackText?: string;
  fallbackClassName?: string;
}

export function ResilientImage({
  src,
  alt,
  className = '',
  fallbackIcon = 'agriculture',
  fallbackText,
  fallbackClassName = 'bg-primary-fixed text-primary',
}: ResilientImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        aria-label={alt}
        className={`flex items-center justify-center font-bold select-none ${fallbackClassName} ${className}`}
      >
        {fallbackText ? (
          <span>{fallbackText}</span>
        ) : (
          <span className="material-symbols-outlined text-[24px]">{fallbackIcon}</span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
