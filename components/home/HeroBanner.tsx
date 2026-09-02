'use client';

import React from 'react';
import { Play, Info, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

interface HeroBannerProps {
  title: string;
  description: string;
  backdropUrl: string;
  rating: number;
  genres: string[];
  onPlay: () => void;
  onMoreInfo: () => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  title, description, backdropUrl, rating, genres, onPlay, onMoreInfo
}) => {
  return (
    <div className="relative w-full h-[70vh] min-h-[500px] rounded-3xl overflow-hidden mb-12 border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)]">
      {/* Background Image with Gradient Overlays */}
      <div 
        className="absolute inset-0 bg-cover bg-center scale-105 transition-transform duration-1000"
        style={{ backgroundImage: `url(${backdropUrl})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-[#0a0a0c]/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0c] via-transparent to-transparent" />

      {/* Content Container */}
      <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12 max-w-3xl flex flex-col items-start gap-4 z-10">
        
        {/* Holographic Badge */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold tracking-wider uppercase backdrop-blur-md">
          <Sparkles size={12} className="animate-pulse" /> Trending #1 Worldwide
        </div>

        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-6xl font-black text-white tracking-tight drop-shadow-lg"
        >
          {title}
        </motion.h1>

        <div className="flex items-center gap-3 text-sm text-gray-300">
          <span className="text-yellow-400 font-bold bg-yellow-400/10 px-2 py-0.5 rounded border border-yellow-400/20">
            ★ {rating}
          </span>
          <div className="flex gap-2">
            {genres.map((genre) => (
              <span key={genre} className="px-2.5 py-0.5 rounded bg-white/5 border border-white/10 text-xs text-gray-300">
                {genre}
              </span>
            ))}
          </div>
        </div>

        <p className="text-gray-300 text-sm md:text-base line-clamp-2 max-w-2xl leading-relaxed">
          {description}
        </p>

        {/* Action Buttons with Cyber Glow */}
        <div className="flex items-center gap-4 mt-2">
          <button 
            onClick={onPlay}
            className="flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-xl shadow-[0_0_25px_rgba(6,182,212,0.4)] transition-all duration-300 transform hover:scale-105 active:scale-95"
          >
            <Play size={18} className="fill-white" /> Watch Now
          </button>
          <button 
            onClick={onMoreInfo}
            className="flex items-center gap-2 px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl border border-white/15 backdrop-blur-md transition-all duration-300"
          >
            <Info size={18} /> Details
          </button>
        </div>

      </div>
    </div>
  );
};
