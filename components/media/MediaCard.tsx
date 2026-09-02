'use client';

import React from 'react';
import Image from 'next/image';
import { Play, Star } from 'lucide-react';
import { motion } from 'framer-motion';

interface MediaCardProps {
  id: string;
  title: string;
  image: string;
  rating: number;
  isNew?: boolean;
  episodeCount?: string;
  onClick: (id: string) => void;
}

export const MediaCard: React.FC<MediaCardProps> = ({ 
  id, title, image, rating, isNew, episodeCount, onClick 
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -8, scale: 1.02 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="group relative cursor-pointer rounded-2xl overflow-hidden bg-[#121217] border border-white/10 hover:border-cyan-500/50 shadow-[0_4px_20px_rgba(0,0,0,0.5)] hover:shadow-[0_0_30px_rgba(6,182,212,0.2)] transition-all duration-300"
      onClick={() => onClick(id)}
      tabIndex={0}
      role="button"
    >
      <div className="aspect-[2/3] relative overflow-hidden bg-[#0d0d11]">
        <Image
          src={image}
          alt={title}
          fill
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 15vw"
          className="object-cover transition-transform duration-700 group-hover:scale-110"
          loading="lazy"
        />
        
        {/* Cyber Dark Vignette Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-transparent to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />

        {/* Top Badges */}
        <div className="absolute top-3 left-3 flex gap-2">
          {isNew && (
            <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 rounded-md backdrop-blur-md">
              NEW
            </span>
          )}
        </div>

        {/* Bottom Card Meta */}
        <div className="absolute bottom-0 left-0 right-0 p-4 flex flex-col justify-end translate-y-1 group-hover:translate-y-0 transition-transform">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 text-xs text-cyan-300 font-semibold">
              <Star size={13} className="text-yellow-400 fill-yellow-400" />
              <span>{rating}</span>
            </div>
            {episodeCount && (
              <span className="text-[11px] text-gray-400 bg-white/10 px-2 py-0.5 rounded-full backdrop-blur-md">
                {episodeCount} EPS
              </span>
            )}
          </div>
          <h3 className="text-white font-bold text-sm tracking-wide truncate group-hover:text-cyan-400 transition-colors">
            {title}
          </h3>
        </div>
      </div>
    </motion.div>
  );
};
