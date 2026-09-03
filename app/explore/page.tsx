'use client';

import React from 'react';
import { useAnimeSearch } from '@/hooks/useAnimeSearch';
import { MediaCard } from '@/components/media/MediaCard';
import { AdvancedSearch } from '@/components/search/AdvancedSearch';
import { HeroBanner } from '@/components/home/HeroBanner';
import { useTVNavigation } from '@/hooks/useTVNavigation';
import { Sparkles, Compass } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

export default function ExplorePage() {
  useTVNavigation();
  const { data, loading, error, updateFilters } = useAnimeSearch();

  // Pick the first item for the Hero Banner showcase if available
  const heroAnime = data[0];

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white p-6 md:p-12">
      
      {/* Platform Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.4)]">
            <Compass className="text-white animate-spin-slow" size={22} />
          </div>
          <div>
            <span className="text-xs uppercase tracking-widest text-cyan-400 font-bold">ANIMUX STREAM DECK</span>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">Explore Catalog</h1>
          </div>
        </div>
      </div>

      {/* Cinematic Hero Showcase */}
      {heroAnime && (
        <HeroBanner
          title={heroAnime.title.english || heroAnime.title.romaji}
          description={heroAnime.description?.replace(/<[^>]*>?/gm, '') || 'Immerse yourself in next-generation high-definition anime streaming with multi-language audio support.'}
          backdropUrl={heroAnime.bannerImage || heroAnime.coverImage.extraLarge}
          rating={heroAnime.averageScore ? heroAnime.averageScore / 10 : 8.5}
          genres={heroAnime.genres?.slice(0, 3) || ['Action', 'Sci-Fi']}
          onPlay={() => console.log('Play:', heroAnime.id)}
          onMoreInfo={() => console.log('Info:', heroAnime.id)}
        />
      )}
      
      {/* Advanced Filter Search Box */}
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

      {error && !loading && (
        <EmptyState
          title="The catalogue is temporarily unavailable"
          body={error}
        />
      )}

      {/* Section Title */}
      <div className="flex items-center gap-2 mb-6">
        <Sparkles className="text-cyan-400" size={18} />
        <h2 className="text-xl font-bold tracking-wide text-white">Trending Broadcasts</h2>
      </div>

      {/* Grid Display */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="aspect-[2/3] bg-white/5 animate-pulse rounded-2xl border border-white/5" />
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
};
