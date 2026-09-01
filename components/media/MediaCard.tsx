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
  
  // TV/D-Pad Focus Management
  const handleFocus = (e: React.FocusEvent<HTMLDivElement>) => {
    // Vercel Edge: Ensure no layout shift on focus
    e.currentTarget.style.transform = "scale(1.05)";
    e.currentTarget.style.zIndex = "50";
    e.currentTarget.style.boxShadow = "0 0 0 2px #8b5cf6, 0 10px 25px -5px rgba(0,0,0,0.5)";
  };

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    e.currentTarget.style.transform = "scale(1)";
    e.currentTarget.style.zIndex = "10";
    e.currentTarget.style.boxShadow = "none";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="relative group cursor-pointer rounded-xl overflow-hidden bg-[#0a0a0c] transition-all duration-300 ease-out"
      onFocus={handleFocus}
      onBlur={handleBlur}
      onClick={() => onClick(id)}
      tabIndex={0}
      role="button"
      aria-label={`Watch ${title}`}
    >
      {/* Image Container: Next.js Image Optimization */}
      <div className="aspect-[2/3] relative overflow-hidden bg-[#131316]">
        <Image
          src={image}
          alt={title}
          fill
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 15vw"
          className="object-cover transition-transform duration-500 group-hover:scale-110"
          priority={false} // Lazy load by default
          loading="lazy"
        />
        
        {/* Neo-Cinematic Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Hover Content: Glassmorphism */}
        <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300 bg-gradient-to-t from-[#0a0a0c] to-transparent">
          <div className="flex items-center gap-2 mb-2">
            <button 
              className="p-2 bg-white/10 backdrop-blur-md rounded-full hover:bg-white/20 transition-colors border border-white/10"
              onClick={(e) => {
                e.stopPropagation();
                onClick(id);
              }}
            >
              <Play size={16} className="text-white fill-white" />
            </button>
            <button 
              className="p-2 bg-white/10 backdrop-blur-md rounded-full hover:bg-white/20 transition-colors border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <Star size={16} className="text-yellow-400 fill-yellow-400" />
            </button>
          </div>
          
          <h3 className="text-white font-semibold text-sm truncate">{title}</h3>
          
          <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
            <span className="text-yellow-400 font-bold">{rating}</span>
            {isNew && <span className="text-cyan-400 bg-cyan-400/10 px-1 rounded">NEW</span>}
            {episodeCount && <span>{episodeCount} EPS</span>}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
