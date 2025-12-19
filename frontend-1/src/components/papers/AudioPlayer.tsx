'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Loader2, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

interface AudioPlayerProps {
  audioBase64: string;
  contentType: string;
  label?: string;
  size?: 'sm' | 'md';
}

export default function AudioPlayer({ 
  audioBase64, 
  contentType, 
  label = 'Play',
  size = 'md' 
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Cleanup audio on unmount
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handlePlayPause = async () => {
    setError(null);

    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    try {
      setIsLoading(true);

      if (!audioRef.current) {
        const audioData = `data:${contentType};base64,${audioBase64}`;
        audioRef.current = new Audio(audioData);

        audioRef.current.onplay = () => {
          setIsPlaying(true);
          setIsLoading(false);
        };

        audioRef.current.onended = () => {
          setIsPlaying(false);
        };

        audioRef.current.onerror = () => {
          setError('Failed to play audio');
          setIsPlaying(false);
          setIsLoading(false);
        };
      }

      await audioRef.current.play();
    } catch (err) {
      setError('Failed to play audio');
      setIsLoading(false);
    }
  };

  const iconSize = size === 'sm' ? 12 : 16;

  return (
    <button
      onClick={handlePlayPause}
      disabled={isLoading}
      className={clsx(
        'flex items-center gap-2 rounded-full transition-colors',
        size === 'sm' ? 'text-xs px-2 py-1' : 'text-sm px-3 py-1.5',
        error
          ? 'bg-[var(--color-error)]/10 text-[var(--color-error)]'
          : isPlaying
          ? 'bg-[var(--color-forest)] text-white'
          : 'bg-[var(--color-parchment)] text-[var(--color-slate)] hover:bg-[var(--color-forest)]/10'
      )}
      title={error || undefined}
    >
      {isLoading ? (
        <Loader2 size={iconSize} className="animate-spin" />
      ) : error ? (
        <AlertCircle size={iconSize} />
      ) : isPlaying ? (
        <Pause size={iconSize} />
      ) : (
        <Play size={iconSize} />
      )}
      {label && <span>{isPlaying ? 'Pause' : label}</span>}
    </button>
  );
}

