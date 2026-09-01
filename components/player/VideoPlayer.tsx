import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Settings, Subtitles, SkipForward } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

interface VideoPlayerProps {
  animeId: string;
  episodeNumber: number;
  videoUrl: string;
  subtitles: { lang: string; url: string; label: string }[];
  audioTracks: { lang: string; label: string; url: string }[];
  onNextEpisode?: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  animeId,
  episodeNumber,
  videoUrl,
  subtitles,
  audioTracks,
  onNextEpisode
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [progress, setProgress] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [selectedSub, setSelectedSub] = useState(subtitles[0]?.lang || 'off');
  const [selectedAudio, setSelectedAudio] = useState(audioTracks[0]?.lang || 'jp');

  const { updateProgress, preferences } = useAppStore();
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-hide controls after inactivity
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const current = videoRef.current.currentTime;
    const duration = videoRef.current.duration;
    const percent = (current / duration) * 100;
    
    setProgress(percent);

    // Sync progress to Zustand store every few seconds or on milestone
    if (Math.floor(current) % 5 === 0) {
      updateProgress(animeId, current, percent);
    }
  };

  return (
    <div 
      className="relative w-full aspect-video bg-black overflow-hidden group select-none"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full h-full object-contain"
        onTimeUpdate={handleTimeUpdate}
        onClick={togglePlay}
      />

      {/* Control Overlay */}
      <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 flex flex-col justify-between p-6 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        
        {/* Top Bar: Title & Language Settings */}
        <div className="flex items-center justify-between">
          <h2 className="text-white font-medium text-lg drop-shadow">Episode {episodeNumber}</h2>
          
          <div className="flex items-center gap-4">
            {/* Audio Selector Dropdown */}
            <div className="flex items-center gap-1 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs text-white border border-white/10">
              <span className="text-gray-400">Audio:</span>
              <select 
                value={selectedAudio} 
                onChange={(e) => setSelectedAudio(e.target.value)}
                className="bg-transparent outline-none text-white font-semibold cursor-pointer"
              >
                {audioTracks.map(track => (
                  <option key={track.lang} value={track.lang} className="bg-[#16161a] text-white">
                    {track.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Subtitle Selector Dropdown */}
            <div className="flex items-center gap-1 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs text-white border border-white/10">
              <Subtitles size={14} className="text-cyan-400" />
              <select 
                value={selectedSub} 
                onChange={(e) => setSelectedSub(e.target.value)}
                className="bg-transparent outline-none text-white font-semibold cursor-pointer"
              >
                <option value="off" className="bg-[#16161a] text-white">Off</option>
                {subtitles.map(sub => (
                  <option key={sub.lang} value={sub.lang} className="bg-[#16161a] text-white">
                    {sub.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Timeline & Actions */}
        <div className="flex flex-col gap-2">
          {/* Progress Bar */}
          <div className="w-full bg-white/20 h-1 rounded-full cursor-pointer relative overflow-hidden group/bar">
            <div 
              className="absolute top-0 left-0 bottom-0 bg-cyan-400 transition-all" 
              style={{ width: `${progress}%` }} 
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={togglePlay} className="p-2 text-white hover:text-cyan-400 transition-colors">
                {isPlaying ? <Pause size={20} /> : <Play size={20} className="fill-white" />}
              </button>

              <button 
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.muted = !isMuted;
                    setIsMuted(!isMuted);
                  }
                }} 
                className="p-2 text-white hover:text-cyan-400 transition-colors"
              >
                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
            </div>

            <div className="flex items-center gap-2">
              {onNextEpisode && (
                <button 
                  onClick={onNextEpisode}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-lg text-xs text-white transition-colors border border-white/10"
                >
                  <SkipForward size={14} /> Next Episode
                </button>
              )}
              <button 
                onClick={() => videoRef.current?.requestFullscreen()}
                className="p-2 text-white hover:text-cyan-400 transition-colors"
              >
                <Maximize size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
