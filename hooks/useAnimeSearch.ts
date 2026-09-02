import { useState, useEffect, useCallback } from 'react';
import { fetchAnimeData, AnimeQueryParams } from '@/services/animeApi';

export const useAnimeSearch = (initialParams?: AnimeQueryParams) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [pageInfo, setPageInfo] = useState<any>({});
  const [filters, setFilters] = useState<AnimeQueryParams>({
    page: 1,
    perPage: 20,
    sort: 'POPULARITY_DESC',
    ...initialParams,
  });

  const loadAnime = useCallback(async (currentFilters: AnimeQueryParams) => {
    setLoading(true);
    try {
      const result = await fetchAnimeData(currentFilters);
      setData(result.media);
      setPageInfo(result.pageInfo);
    } catch (error) {
      console.error('Failed to load search results', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnime(filters);
  }, [filters, loadAnime]);

  const updateFilters = (newFilters: Partial<AnimeQueryParams>) => {
    setFilters((prev) => ({ ...prev, ...newFilters, page: 1 }));
  };

  return {
    data,
    loading,
    pageInfo,
    filters,
    updateFilters,
  };
};
