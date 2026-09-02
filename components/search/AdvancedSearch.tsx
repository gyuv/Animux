import React, { useState } from 'react';
import { Search, ChevronDown } from 'lucide-react';

interface SearchFilters {
  query: string;
  status: string[];
  genre: string[];
  audio: string[];
  [key: string]: string | string[]; // Index signature for dynamic access
}

interface AdvancedSearchProps {
  onSearch: (filters: SearchFilters) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const AdvancedSearch: React.FC<AdvancedSearchProps> = ({ onSearch, isOpen }) => {
  const [query, setQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<SearchFilters>({
    query: '',
    status: [],
    genre: [],
    audio: []
  });

  const toggleFilter = (category: keyof SearchFilters, value: string) => {
    const current = (activeFilters[category] as string[]) || [];
    const updated = current.includes(value)
      ? current.filter((f: string) => f !== value)
      : [...current, value];
    
    const newFilters = { ...activeFilters, [category]: updated };
    setActiveFilters(newFilters);
    onSearch(newFilters);
  };

  const categories = [
    { label: 'Status', key: 'status', options: ['Ongoing', 'Completed'] },
    { label: 'Audio', key: 'audio', options: ['Sub', 'Dub'] },
    { label: 'Genre', key: 'genre', options: ['Action', 'Romance', 'Isekai', 'Mecha'] }
  ];

  if (!isOpen) return null;

  return (
    <div className="w-full max-w-4xl mx-auto bg-[#16161a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden mb-8">
      <div className="p-4 border-b border-white/5 flex items-center gap-3">
        <Search className="text-gray-400" />
        <input 
          className="flex-1 bg-transparent outline-none text-lg text-white placeholder-gray-500"
          placeholder="Search anime, studios, or genres..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            const newFilters = { ...activeFilters, query: e.target.value };
            setActiveFilters(newFilters);
            onSearch(newFilters);
          }}
        />
      </div>

      <div className="p-4 flex gap-4 overflow-x-auto">
        {categories.map((cat) => (
          <div key={cat.key} className="relative group">
            <button className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-gray-300 transition-colors">
              {cat.label} <ChevronDown size={14} />
            </button>
            <div className="absolute top-full left-0 mt-2 w-48 bg-[#1e1e24] border border-white/10 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
              {cat.options.map(opt => {
                const isSelected = (activeFilters[cat.key] as string[])?.includes(opt);
                return (
                  <button
                    key={opt}
                    onClick={() => toggleFilter(cat.key, opt)}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-white/5 ${isSelected ? 'text-cyan-400 font-semibold' : 'text-gray-300'}`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
