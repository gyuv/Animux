import { useState, useEffect, useCallback } from 'react';
import { fetchAnimeData, AnimeQueryParams, AnimeSearchResult } from '@/services/animeApi';

export const useAnimeSearch = (initialParams?: AnimeQueryParams) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pageInfo, setPageInfo] = useState<AnimeSearchResult['pageInfo']>({
    total: 0,
    currentPage: 1,
    lastPage: 1,
    hasNextPage: false,
  });
  const [filters, setFilters] = useState<AnimeQueryParams>({
    page: 1,
    perPage: 20,
    sort: 'POPULARITY_DESC',
    ...initialParams,
  });

  const loadAnime = useCallback(async (currentFilters: AnimeQueryParams) => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchAnimeData(currentFilters);
      setData(result.media ?? []);
      setPageInfo(result.pageInfo);
    } catch (err) {
      console.error('Failed to load search results', err);
      setData([]);
      setError(err instanceof Error ? err.message : 'Failed to load the catalogue.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAnime(filters);
  }, [filters, loadAnime]);

  const updateFilters = (newFilters: Partial<AnimeQueryParams>) => {
    setFilters((prev) => ({ ...prev, ...newFilters, page: 1 }));
  };

  return { data, loading, error, pageInfo, filters, updateFilters };
};
