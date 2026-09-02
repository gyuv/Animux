// hooks/useStreamSource.ts
import { useState, useEffect } from 'react';

export const useStreamSource = (animeId: string, episode: number) => {
  const [streamData, setStreamData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    async function fetchStream() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/stream?id=${animeId}&episode=${episode}`);
        if (!res.ok) throw new Error('Failed to load stream');
        const data = await res.json();
        
        if (isMounted) {
          setStreamData(data);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Unknown error');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchStream();

    return () => {
      isMounted = false;
    };
  }, [animeId, episode]);

  return { streamData, loading, error };
};
