// app/explore/page.tsx (Example Page)
'use client';

import React from 'react';
import { useAnimeSearch } from '@/hooks/useAnimeSearch';
import { MediaCard } from '@/components/media/MediaCard';
import { AdvancedSearch } from '@/components/search/AdvancedSearch';

export default function ExplorePage() {
  const { data, loading, updateFilters } = useAnimeSearch();

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white p-6 md:p-12">
      <h1 className="text-3xl font-extrabold tracking-tight mb-8">Explore Catalog</h1>
      
      {/* Search & Filter Bar */}
      <div className="mb-8">
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
      </div>

      {/* Media Grid */}
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
              onClick={(id) => console.log('Navigate to watch:', id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
