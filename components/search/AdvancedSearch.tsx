import React, { useState, useEffect, useRef } from 'react';
import { Search, Filter, X, ChevronDown } from 'lucide-react';

interface SearchFilters {
  query: string;
  status: string[];
  genre: string[];
  audio: string[];
}

interface AdvancedSearchProps {
  onSearch: (filters: SearchFilters) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const AdvancedSearch: React.FC<AdvancedSearchProps> = ({ 
  onSearch, isOpen, onClose 
}) => {
  const [query, setQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<SearchFilters>({
    query: '',
    status: [],
    genre: [],
    audio: []
  });

  // Hotkey Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // Trigger global search modal if needed
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleFilter = (category: keyof SearchFilters, value: string) => {
    const current = activeFilters[category];
    const updated = current.includes(value)
      ? current.filter((f: string) => f !== value)
      : [...current, value];
    
    setActiveFilters({ ...activeFilters, [category]: updated });
    onSearch({ ...activeFilters, [category]: updated });
  };

  const categories = [
    { label: 'Status', options: ['Ongoing', 'Completed'] },
    { label: 'Audio', options: ['Sub', 'Dub', 'Sub/Dub'] },
    { label: 'Genre', options: ['Action', 'Romance', 'Isekai', 'Mecha'] }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 backdrop-blur-md pt-20" onClick={onClose}>
      <div 
        className="w-full max-w-4xl bg-[#16161a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-5 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="p-4 border-b border-white/5 flex items-center gap-3">
          <Search className="text-gray-400" />
          <input 
            autoFocus
            className="flex-1 bg-transparent outline-none text-xl text-white placeholder-gray-500"
            placeholder="Search anime, studios, or genres..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              onSearch({ ...activeFilters, query: e.target.value });
            }}
          />
          <kbd className="hidden md:inline-block px-2 py-1 text-xs text-gray-500 border border-white/10 rounded">ESC</kbd>
        </div>

        {/* Filters */}
        <div className="p-4 flex gap-4 overflow-x-auto no-scrollbar">
          {categories.map((f) => (
            <div key={f.label} className="relative group">
              <button className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-gray-300 transition-colors">
                {f.label} <ChevronDown size={14} />
              </button>
              {/* Dropdown */}
              <div className="absolute top-full left-0 mt-2 w-48 bg-[#1e1e24] border border-white/10 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                {f.options.map(opt => (
                  <button
                    key={opt}
                    onClick={() => toggleFilter(f.label.toLowerCase() as keyof SearchFilters, opt)}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-white/5 ${activeFilters[f.label.toLowerCase() as keyof SearchFilters]?.includes(opt) ? 'text-cyan-400' : 'text-gray-300'}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
