import React, { useState, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Subtitles, SkipForward } from 'lucide-react';
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
  const [progress, setProgress] = useState(0);
  const [showControls, setShowControls] = useState(true);

  const { updateProgress } = useAppStore();

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) videoRef.current.pause();
    else videoRef.current.play();
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const current = videoRef.current.currentTime;
    const duration = videoRef.current.duration;
    const percent = (current / duration) * 100;
    setProgress(percent);
    if (Math.floor(current) % 5 === 0) {
      updateProgress(animeId, current, percent, episodeNumber);
    }
  };

  return (
    <div 
      className="relative w-full aspect-video bg-black overflow-hidden group select-none"
      onMouseMove={() => setShowControls(true)}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full h-full object-contain"
        onTimeUpdate={handleTimeUpdate}
        onClick={togglePlay}
      />
      <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 flex flex-col justify-between p-6 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="flex items-center justify-between">
          <h2 className="text-white font-medium text-lg">Episode {episodeNumber}</h2>
        </div>
        <div className="flex flex-col gap-2">
          <div className="w-full bg-white/20 h-1 rounded-full cursor-pointer overflow-hidden">
            <div className="bg-cyan-400 h-full" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={togglePlay} className="text-white hover:text-cyan-400">
                {isPlaying ? <Pause size={20} /> : <Play size={20} className="fill-white" />}
              </button>
              <button onClick={() => setIsMuted(!isMuted)} className="text-white hover:text-cyan-400">
                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
            </div>
            <div className="flex items-center gap-2">
              {onNextEpisode && (
                <button onClick={onNextEpisode} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 rounded-lg text-xs text-white">
                  <SkipForward size={14} /> Next
                </button>
              )}
              <button onClick={() => videoRef.current?.requestFullscreen()} className="text-white">
                <Maximize size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
