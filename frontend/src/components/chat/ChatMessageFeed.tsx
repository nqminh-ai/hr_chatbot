import type { RefObject } from 'react';
import { Bot, Sparkles } from 'lucide-react';
import { SAMPLE_QUERIES } from '@/lib/mockData';
import type { ChatMessage, Citation } from '@/types';
import { ChatMessageItem } from './ChatMessageItem';

interface ChatMessageFeedProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (query: string) => void;
  onSelectCitation: (citation: Citation, message?: ChatMessage) => void;
  endRef: RefObject<HTMLDivElement | null>;
}

function EmptyChat({ isLoading, onSendMessage }: Pick<ChatMessageFeedProps, 'isLoading' | 'onSendMessage'>) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-12">
      <div className="w-14 h-14 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-4 shadow-lg shadow-emerald-950/40">
        <Sparkles className="w-7 h-7" />
      </div>
      <h2 className="text-xl font-semibold text-white mb-2">Bạn muốn tìm hiểu điều gì hôm nay?</h2>
      <p className="text-xs text-neutral-400 mb-8 leading-relaxed">
        Hỏi về ngày phép, cách đăng ký hoặc người phê duyệt. Bạn có thể hỏi tiếp trong cùng cuộc trò chuyện.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 w-full text-left">
        {SAMPLE_QUERIES.map((query) => (
          <button
            key={query}
            onClick={() => onSendMessage(query)}
            disabled={isLoading}
            className="p-3 rounded-xl bg-neutral-900/80 hover:bg-neutral-800/80 border border-neutral-800 hover:border-neutral-700 text-xs text-neutral-300 transition group flex flex-col justify-between"
          >
            <span className="font-medium text-white group-hover:text-emerald-400 transition">{query}</span>
            <span className="text-[10px] text-neutral-500 mt-2 flex items-center gap-1">Hỏi ngay &rarr;</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ChatMessageFeed({ messages, isLoading, onSendMessage, onSelectCitation, endRef }: ChatMessageFeedProps) {
  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-12 py-6 space-y-6">
      {messages.length === 0
        ? <EmptyChat isLoading={isLoading} onSendMessage={onSendMessage} />
        : messages.map(message => (
            <ChatMessageItem key={message.id} message={message} onSelectCitation={onSelectCitation} />
          ))}
      {isLoading && (
        <div className="flex gap-3 max-w-3xl mr-auto">
          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
            <Bot className="w-4 h-4 animate-spin" />
          </div>
          <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 text-neutral-400 text-xs flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Đang đối chiếu chính sách & phân cấp quyền...</span>
          </div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
