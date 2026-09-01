import React from 'react';
import { motion } from 'framer-motion';
import { Play, Info, Star } from 'lucide-react';

// TV Remote Focus Helper
const TVFocus = ({ children, className }: any) => {
  return (
    <div
      className={className}
      tabIndex={0}
      onFocus={(e) => {
        // Optional: Add visual focus ring logic for D-Pad here
        e.currentTarget.style.transform = "scale(1.05)";
        e.currentTarget.style.zIndex = "50";
        e.currentTarget.style.boxShadow = "0 0 0 4px rgba(139, 92, 246, 0.8)";
      }}
      onBlur={(e) => {
        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.zIndex = "10";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {children}
    </div>
  );
};

interface MediaCardProps {
  title: string;
  image: string;
  rating: number;
  isNew?: boolean;
  episodeCount?: string;
}

const MediaCard: React.FC<MediaCardProps> = ({ title, image, rating, isNew, episodeCount }) => {
  return (
    <TVFocus 
      className="relative group cursor-pointer rounded-xl overflow-hidden bg-[#131316] transition-all duration-300 ease-out hover:scale-105 hover:z-40 focus:outline-none"
    >
      {/* Image Container with Aspect Ratio Lock */}
      <div className="aspect-[2/3] relative overflow-hidden">
        <motion.img
          whileHover={{ scale: 1.1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          src={image}
          alt={title}
          className="w-full h-full object-cover"
        />
        
        {/* Overlay Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Hover Info */}
        <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
          <div className="flex items-center gap-2 mb-2">
            <button className="p-2 bg-white/10 backdrop-blur-md rounded-full hover:bg-white/20 transition-colors">
              <Play size={16} className="text-white fill-white" />
            </button>
            <button className="p-2 bg-white/10 backdrop-blur-md rounded-full hover:bg-white/20 transition-colors">
              <Info size={16} className="text-white" />
            </button>
          </div>
          <h3 className="text-white font-semibold text-sm truncate">{title}</h3>
          <div className="flex items-center gap-2 text-xs text-gray-300 mt-1">
            <span className="flex items-center gap-1 text-yellow-400">
              <Star size={12} className="fill-yellow-400" /> {rating}
            </span>
            {isNew && <span className="text-cyan-400 font-bold">NEW</span>}
            {episodeCount && <span>{episodeCount} EPS</span>}
          </div>
        </div>
      </div>
    </TVFocus>
  );
};

export const MediaGrid = ({ items }: { items: any[] }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 p-4 md:p-8">
      {items.map((item) => (
        <MediaCard key={item.id} {...item} />
      ))}
    </div>
  );
};
