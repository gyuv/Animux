'use client';

import { useEffect, useState } from 'react';
import { Plus, Check } from 'lucide-react';
import { useLibrary } from '@/store/useLibrary';

export function SaveButton({ animeId }: { animeId: string }) {
  const [mounted, setMounted] = useState(false);
  const saved = useLibrary((s) => s.saved.includes(animeId));
  const toggleSaved = useLibrary((s) => s.toggleSaved);

  useEffect(() => setMounted(true), []);

  return (
    <button type="button" onClick={() => toggleSaved(animeId)} aria-pressed={mounted && saved} className="key-ghost">
      {mounted && saved ? <Check size={17} aria-hidden /> : <Plus size={17} aria-hidden />}
      {mounted && saved ? 'Saved' : 'Save'}
    </button>
  );
}
