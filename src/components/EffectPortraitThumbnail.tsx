import React, { useEffect, useState } from 'react';
import {
  EFFECTS_PREVIEW_PORTRAIT_URL,
  getCachedEffectThumbnail,
  requestEffectThumbnail,
} from '../utils/effectThumbnailRenderer';

interface EffectPortraitThumbnailProps {
  effectId: string;
  color?: string;
  params?: Record<string, any>;
  alt?: string;
  className?: string;
  liveMode?: boolean;
}

export const EffectPortraitThumbnail: React.FC<EffectPortraitThumbnailProps> = ({
  effectId,
  color = '#5EEB9A',
  params = {},
  alt = '',
  className = 'w-full h-full object-cover',
  liveMode = false,
}) => {
  const paramsSig = JSON.stringify(params || {});
  const [src, setSrc] = useState<string>(
    () => getCachedEffectThumbnail(effectId, params, liveMode) || EFFECTS_PREVIEW_PORTRAIT_URL
  );

  useEffect(() => {
    const cached = getCachedEffectThumbnail(effectId, params, liveMode);
    if (cached) {
      setSrc(cached);
      return;
    }

    let cancelled = false;
    const cancel = requestEffectThumbnail(
      effectId,
      color,
      params,
      (url) => {
        if (!cancelled) {
          setSrc(url);
        }
      },
      liveMode
    );

    return () => {
      cancelled = true;
      cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectId, color, paramsSig, liveMode]);

  return (
    <img
      src={src}
      alt={alt || effectId}
      className={className}
      loading="lazy"
      decoding="async"
      draggable={false}
    />
  );
};
