'use client';

import React from 'react';
import { useAnimeSearch } from '@/hooks/useAnimeSearch';
import { MediaCard } from '@/components/media/MediaCard';
import { AdvancedSearch } from '@/components/search/AdvancedSearch';
import { useTVNavigation } from '@/hooks/useTVNavigation';

export default function ExplorePage() {
  useTVNavigation();
  const { data, loading, updateFilters } = useAnimeSearch();

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white p-6 md:p-12">
      <h1 className="text-4xl font-extrabold tracking-tight mb-8 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
        Animux Catalog
      </h1>
      
      <AdvancedSearch 
        isOpen={true} 
        onClose={() => {}} 
        onSearch={(searchFilters) => {
          updateFilters({
            search: searchFilters.query,
            genres: searchFilters.genre,
            status: searchFilters.status[0],
          });
        }} 
      />

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="aspect-[2/3] bg-white/5 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {data.map((anime) => (
            <MediaCard
              key={anime.id}
              id={anime.id.toString()}
              title={anime.title.english || anime.title.romaji}
              image={anime.coverImage.extraLarge || anime.coverImage.large}
              rating={anime.averageScore ? anime.averageScore / 10 : 0}
              isNew={anime.status === 'RELEASING'}
              episodeCount={anime.episodes?.toString()}
              onClick={(id) => console.log('Selected Anime ID:', id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
