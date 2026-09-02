import React, { useState } from 'react';
import { Search, ChevronDown } from 'lucide-react';

interface AdvancedSearchProps {
  onSearch: (filters: { query: string; status: string[]; genre: string[]; audio: string[] }) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const AdvancedSearch: React.FC<AdvancedSearchProps> = ({ onSearch, isOpen }) => {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string[]>([]);
  const [genre, setGenre] = useState<string[]>([]);
  const [audio, setAudio] = useState<string[]>([]);

  const triggerSearch = (newQuery: string, newStatus: string[], newGenre: string[], newAudio: string[]) => {
    onSearch({ query: newQuery, status: newStatus, genre: newGenre, audio: newAudio });
  };

  const toggleFilter = (type: 'status' | 'genre' | 'audio', value: string) => {
    let updated: string[] = [];
    if (type === 'status') {
      updated = status.includes(value) ? status.filter(f => f !== value) : [...status, value];
      setStatus(updated);
      triggerSearch(query, updated, genre, audio);
    } else if (type === 'genre') {
      updated = genre.includes(value) ? genre.filter(f => f !== value) : [...genre, value];
      setGenre(updated);
      triggerSearch(query, status, updated, audio);
    } else if (type === 'audio') {
      updated = audio.includes(value) ? audio.filter(f => f !== value) : [...audio, value];
      setAudio(updated);
      triggerSearch(query, status, genre, updated);
    }
  };

  const categories = [
    { label: 'Status', key: 'status' as const, options: ['Ongoing', 'Completed'] },
    { label: 'Audio', key: 'audio' as const, options: ['Sub', 'Dub'] },
    { label: 'Genre', key: 'genre' as const, options: ['Action', 'Romance', 'Isekai', 'Mecha'] }
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
            triggerSearch(e.target.value, status, genre, audio);
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
                const currentList = cat.key === 'status' ? status : cat.key === 'genre' ? genre : audio;
                const isSelected = currentList.includes(opt);
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
