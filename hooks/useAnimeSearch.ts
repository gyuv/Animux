import { useState, useEffect, useRef, useCallback } from 'react';
import {
  fetchAnimeData,
  CatalogueUnavailable,
  type AnimeQueryParams,
  type CatalogueResponse,
} from '@/services/animeApi';

const EMPTY_PAGE = { total: 0, currentPage: 1, lastPage: 1, hasNextPage: false };

/**
 * Search state for client-rendered browsing.
 *
 * Two things the previous version got wrong, both of which showed up as a
 * blank grid: it logged errors to the console and left `data` as an empty
 * array, so a failure was indistinguishable from no matches; and it had no way
 * to cancel an in-flight request, so typing quickly could land an older, slower
 * response on top of a newer one.
 */
export const useAnimeSearch = (initialParams?: AnimeQueryParams) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pageInfo, setPageInfo] = useState<CatalogueResponse['pageInfo']>(EMPTY_PAGE);
  const [filters, setFilters] = useState<AnimeQueryParams>({
    page: 1,
    perPage: 20,
    sort: 'POPULARITY_DESC',
    ...initialParams,
  });

  const inFlight = useRef<AbortController | null>(null);

  const loadAnime = useCallback(async (currentFilters: AnimeQueryParams) => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    setLoading(true);
    setError(null);

    try {
      const result = await fetchAnimeData(currentFilters, controller.signal);
      setData(result.media);
      setPageInfo(result.pageInfo);
      setNotice(result.notice ?? null);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return; // superseded
      setError(
        err instanceof CatalogueUnavailable ? err.message : 'Something went wrong while searching.',
      );
      setData([]);
      setPageInfo(EMPTY_PAGE);
    } finally {
      if (inFlight.current === controller) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnime(filters);
    return () => inFlight.current?.abort();
  }, [filters, loadAnime]);

  const updateFilters = (newFilters: Partial<AnimeQueryParams>) => {
    setFilters((prev) => ({ ...prev, ...newFilters, page: 1 }));
  };

  const goToPage = (page: number) => setFilters((prev) => ({ ...prev, page }));

  return {
    data,
    loading,
    error,
    notice,
    pageInfo,
    filters,
    updateFilters,
    goToPage,
    retry: () => loadAnime(filters),
  };
};
