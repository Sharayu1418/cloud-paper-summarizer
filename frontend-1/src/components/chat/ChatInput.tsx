'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import clsx from 'clsx';

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export default function ChatInput({
  onSend,
  isLoading = false,
  disabled = false,
  placeholder = 'Ask a question about your papers...',
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [message]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading && !disabled) {
      onSend(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div
        className={clsx(
          'flex items-end gap-3 bg-white border rounded-xl p-3 transition-all duration-200',
          disabled
            ? 'border-[var(--color-sand)] bg-[var(--color-cream)]'
            : 'border-[var(--color-parchment)] focus-within:border-[var(--color-forest)] focus-within:ring-2 focus-within:ring-[var(--color-forest)]/20'
        )}
      >
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          rows={1}
          className={clsx(
            'flex-1 resize-none bg-transparent text-[var(--color-ink)] placeholder:text-[var(--color-stone)]',
            'focus:outline-none disabled:cursor-not-allowed',
            'text-base leading-relaxed'
          )}
        />

        <button
          type="submit"
          disabled={!message.trim() || isLoading || disabled}
          className={clsx(
            'w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 flex-shrink-0',
            message.trim() && !isLoading && !disabled
              ? 'bg-[var(--color-forest)] text-white hover:bg-[var(--color-forest-light)]'
              : 'bg-[var(--color-parchment)] text-[var(--color-stone)] cursor-not-allowed'
          )}
        >
          {isLoading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Send size={18} />
          )}
        </button>
      </div>

      {/* Hint text */}
      <p className="text-xs text-[var(--color-stone)] mt-2 text-center">
        Press Enter to send, Shift+Enter for new line
      </p>
    </form>
  );
}

