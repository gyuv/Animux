'use client';

import { useChroma } from '@/hooks/useChroma';

/**
 * Publishes a colour to the document root for as long as its children are
 * mounted, so focus rings elsewhere on the page match the title in view.
 */
export function ChromaScope({
  color,
  children,
}: {
  color: string | null;
  children: React.ReactNode;
}) {
  useChroma(color);
  return <>{children}</>;
}
