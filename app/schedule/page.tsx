import Link from 'next/link';
import { getSchedule, AniListError } from '@/services/anilist';
import { ScheduleBoard } from '@/components/schedule/ScheduleBoard';
import { EmptyState } from '@/components/ui/EmptyState';
import { CatalogueNotice } from '@/components/ui/CatalogueNotice';

export const metadata = {
  title: 'Schedule',
  description: 'Every episode broadcasting this week, in your own time zone.',
};

// Half an hour: the board carries live countdowns, so a stale render is worse
// here than anywhere else in the app.
export const revalidate = 1800;

export default async function SchedulePage() {
  // A day either side of the week covers every time zone the viewer might be
  // in — the grouping into local days happens in the browser, where the offset
  // is actually known.
  const now = Math.floor(Date.now() / 1000);
  const start = now - 86400;
  const end = now + 8 * 86400;

  let entries;
  let notice: string | null = null;

  try {
    const result = await getSchedule(start, end);
    entries = result.entries;
    notice = result.meta.notice;
  } catch (error) {
    return (
      <EmptyState
        title="The schedule is unavailable"
        body={
          error instanceof AniListError
            ? error.viewerMessage
            : 'Something went wrong reaching the catalogue.'
        }
        action={<Link href="/" className="key-primary">Back to home</Link>}
      />
    );
  }

  return (
    <>
      <header className="gutter-x pb-2 pt-24">
        <h1 className="font-display text-hero font-black text-paper">This week on air</h1>
        <p className="mt-2 max-w-[54ch] text-body text-haze">
          Every episode broadcasting over the next seven days, grouped into your own days and
          shown in your own clock time.
        </p>
      </header>

      {notice && <CatalogueNotice message={notice} />}

      {entries.length === 0 ? (
        <EmptyState
          title="Nothing is scheduled"
          body="No broadcasts were listed for the coming week."
        />
      ) : (
        <ScheduleBoard entries={entries} />
      )}
    </>
  );
}
