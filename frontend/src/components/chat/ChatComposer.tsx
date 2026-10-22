import { useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { Send, Square } from 'lucide-react';

interface ChatComposerProps {
  isLoading: boolean;
  onSendMessage: (query: string) => void;
  onStop: () => void;
  provider: 'rules' | 'gemini';
}

export function ChatComposer({ isLoading, onSendMessage, onStop, provider }: ChatComposerProps) {
  const [input, setInput] = useState('');

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const query = input.trim();
    if (!query || isLoading) return;
    onSendMessage(query);
    setInput('');
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <div className="p-4 bg-neutral-900/60 border-t border-neutral-800/80">
      <form onSubmit={submit} className="max-w-3xl mx-auto relative flex items-center">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          maxLength={4000}
          aria-label="Tin nhắn"
          placeholder="Nhắn tin cho trợ lý Appota…"
          className="w-full bg-neutral-800/90 text-white placeholder-neutral-500 rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 border border-neutral-700/80 resize-none"
        />
        {isLoading ? (
          <button type="button" onClick={onStop} aria-label="Dừng trả lời" className="absolute right-2.5 rounded-lg bg-neutral-700 p-2 text-white">
            <Square className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            aria-label="Gửi tin nhắn"
            className="absolute right-2.5 p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:hover:bg-emerald-600 text-white transition shadow-sm"
          >
            <Send className="w-4 h-4" />
          </button>
        )}
      </form>
      <p className="text-[11px] text-center text-neutral-500 mt-2">
        {provider === 'gemini'
          ? 'Chính sách mẫu · Câu hỏi và ngữ cảnh được gửi tới Google Gemini.'
          : 'Chính sách mẫu · Đang trả lời theo dữ liệu, chưa bật Gemini.'}
      </p>
    </div>
  );
}
