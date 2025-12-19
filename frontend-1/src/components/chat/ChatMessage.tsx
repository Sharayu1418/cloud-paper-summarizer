'use client';

import { useState, useRef, useEffect } from 'react';
import { User, Bot, Volume2, Pause, Loader2 } from 'lucide-react';
import { ChatMessage as ChatMessageType, SourceCitation } from '@/lib/types';
import { synthesizeText } from '@/lib/api';
import clsx from 'clsx';

interface ChatMessageProps {
  message: ChatMessageType;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleListen = async () => {
    // If playing, pause it
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    // If audio already loaded but paused, resume
    if (audioRef.current && !isPlaying) {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (error) {
        console.error('Error resuming audio:', error);
      }
      return;
    }

    // Otherwise, load and play new audio
    if (isLoading) return;

    try {
      setIsLoading(true);
      const response = await synthesizeText(message.content);
      
      // Create audio from base64
      const audioData = `data:${response.content_type};base64,${response.audio_base64}`;
      const audio = new Audio(audioData);
      audioRef.current = audio;
      
      audio.onplay = () => {
        setIsPlaying(true);
        setIsLoading(false);
      };
      
      audio.onpause = () => {
        setIsPlaying(false);
      };
      
      audio.onended = () => {
        setIsPlaying(false);
        audioRef.current = null;
      };
      
      audio.onerror = () => {
        setIsPlaying(false);
        setIsLoading(false);
        audioRef.current = null;
      };
      
      await audio.play();
    } catch (error) {
      console.error('TTS error:', error);
      setIsLoading(false);
      audioRef.current = null;
    }
  };

  return (
    <div
      className={clsx(
        'flex gap-4 animate-fade-in',
        isUser ? 'flex-row-reverse' : ''
      )}
    >
      {/* Avatar */}
      <div
        className={clsx(
          'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0',
          isUser
            ? 'bg-[var(--color-forest)] text-white'
            : 'bg-[var(--color-parchment)] text-[var(--color-forest)]'
        )}
      >
        {isUser ? <User size={18} /> : <Bot size={18} />}
      </div>

      {/* Content */}
      <div
        className={clsx(
          'flex-1 max-w-[80%]',
          isUser ? 'text-right' : ''
        )}
      >
        <div
          className={clsx(
            'inline-block rounded-2xl px-4 py-3 text-left',
            isUser
              ? 'bg-[var(--color-forest)] text-white rounded-tr-sm'
              : 'bg-white border border-[var(--color-parchment)] rounded-tl-sm'
          )}
        >
          {/* Message text */}
          <div
            className={clsx(
              'prose prose-sm max-w-none',
              isUser ? 'prose-invert' : ''
            )}
          >
            {message.content.split('\n').map((paragraph, i) => (
              <p key={i} className={i > 0 ? 'mt-2' : ''}>
                {paragraph}
              </p>
            ))}
          </div>

          {/* Sources */}
          {message.sources && message.sources.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[var(--color-parchment)]">
              <p className="text-xs font-medium text-[var(--color-stone)] mb-2">
                Sources:
              </p>
              <div className="space-y-1.5">
                {message.sources.map((source, index) => (
                  <SourceBadge key={index} source={source} />
                ))}
              </div>
            </div>
          )}

          {/* Listen button for assistant messages */}
          {!isUser && (
            <div className="mt-3 pt-3 border-t border-[var(--color-parchment)]">
              <button
                onClick={handleListen}
                disabled={isLoading}
                className={clsx(
                  'flex items-center gap-2 text-xs px-3 py-1.5 rounded-full transition-colors',
                  isPlaying
                    ? 'bg-[var(--color-forest)] text-white'
                    : 'bg-[var(--color-parchment)] text-[var(--color-slate)] hover:bg-[var(--color-forest)]/10'
                )}
              >
                {isLoading ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : isPlaying ? (
                  <Pause size={12} />
                ) : (
                  <Volume2 size={12} />
                )}
                {isLoading ? 'Loading...' : isPlaying ? 'Pause' : 'Listen'}
              </button>
            </div>
          )}
        </div>

        {/* Timestamp */}
        {message.timestamp && (
          <p
            className={clsx(
              'text-xs text-[var(--color-stone)] mt-1',
              isUser ? 'text-right' : ''
            )}
          >
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}
      </div>
    </div>
  );
}

function SourceBadge({ source }: { source: SourceCitation }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="w-4 h-4 rounded bg-[var(--color-forest)]/10 text-[var(--color-forest)] flex items-center justify-center flex-shrink-0 mt-0.5">
        {Math.round(source.relevance_score * 100)}%
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-[var(--color-ink)] truncate">
          {source.title}
        </p>
        <p className="text-[var(--color-stone)] truncate">{source.authors}</p>
      </div>
    </div>
  );
}
