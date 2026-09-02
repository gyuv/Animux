import { CloudOff } from 'lucide-react';

/**
 * Shown when the catalogue is being served from cache or the fallback
 * provider. It sits above the content rather than replacing it, because the
 * content is still worth watching — the viewer just deserves to know the
 * shelves may be a few hours behind.
 */
export function CatalogueNotice({ message }: { message: string }) {
  return (
    <div className="gutter-x pt-4" role="status">
      <p
        className="flex items-center gap-2.5 rounded-key border border-ink-600/70 bg-ink-800/60
                   px-3.5 py-2.5 text-micro text-haze backdrop-blur-md"
      >
        <CloudOff size={14} className="shrink-0 text-signal" aria-hidden />
        {message}
      </p>
    </div>
  );
}
