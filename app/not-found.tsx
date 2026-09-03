import Link from 'next/link';
import { EmptyState } from '@/components/ui/EmptyState';

export const metadata = { title: 'Not found' };

export default function NotFound() {
  return (
    <EmptyState
      title="There is nothing at this address"
      body="The title may have been removed from the catalogue, or the link may be mistyped."
      action={
        <div className="flex gap-3">
          <Link href="/" className="key-primary">Back to home</Link>
          <Link href="/browse" className="key-ghost">Browse the catalogue</Link>
        </div>
      }
    />
  );
}
