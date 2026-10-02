import { useEffect, useState } from 'react';
import { LuImageOff } from 'react-icons/lu';
import { api } from '../api/client';

/** Image of an item stored in B2 (served by the backend at /images/:filename), with a fallback placeholder. */
export default function ItemImage({ filename, alt = '', className = '', loading = 'lazy' }) {
  const [failed, setFailed] = useState(false);
  const src = api.imageUrl(filename);
  useEffect(() => setFailed(false), [filename]);

  if (!src || failed) {
    return (
      <div className={`item-image item-image--empty ${className}`.trim()} aria-hidden="true">
        <LuImageOff />
      </div>
    );
  }
  return <img className={`item-image ${className}`.trim()} src={src} alt={alt} loading={loading} onError={() => setFailed(true)} />;
}
