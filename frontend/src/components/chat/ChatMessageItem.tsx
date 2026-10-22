import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { AlertTriangle, Bot, ChevronDown, ChevronUp, FileText, User } from 'lucide-react';
import type { ChatMessage, Citation } from '@/types';

interface ChatMessageItemProps {
  message: ChatMessage;
  onSelectCitation: (citation: Citation, message?: ChatMessage) => void;
}

export function ChatMessageItem({ message, onSelectCitation }: ChatMessageItemProps) {
  const [traceOpen, setTraceOpen] = useState(false);
  const fromUser = message.sender === 'user';

  return (
    <div className={`flex gap-3 max-w-3xl ${fromUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold ${
        fromUser ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white'
      }`}>
        {fromUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      <div className="space-y-2 max-w-[85%]">
        <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
          fromUser
            ? 'bg-blue-600 text-white rounded-tr-none'
            : 'bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-tl-none shadow-sm'
        }`}>
          {message.status === 'insufficient_evidence' && (
            <div className="mb-3 p-2.5 rounded-lg bg-amber-950/40 border border-amber-600/40 text-amber-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>Có quy định hiện hành nhưng chưa có căn cứ xử lý ngoại lệ cho đối tượng này.</span>
            </div>
          )}
          <div className="chat-markdown prose prose-invert prose-sm max-w-none space-y-2">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
          {!!message.citations?.length && (
            <div className="mt-4 pt-3 border-t border-neutral-800">
              <div className="text-[11px] font-semibold text-neutral-400 mb-2 flex items-center gap-1">
                <FileText className="w-3 h-3 text-emerald-400" />
                Căn cứ trích dẫn chính sách ({message.citations.length}):
              </div>
              <div className="flex flex-wrap gap-1.5">
                {message.citations.map((citation) => (
                  <button
                    key={`${citation.doc_id}-${citation.version}-${citation.clause}`}
                    onClick={() => onSelectCitation(citation, message)}
                    className="px-2.5 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700 border border-neutral-700/80 text-[11px] text-emerald-300 flex items-center gap-1 transition"
                  >
                    <span className="font-mono font-semibold">{citation.doc_id}</span>
                    <span className="text-neutral-400">· {citation.clause}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {!fromUser && message.trace && (
          <div className="text-[11px] text-neutral-400">
            <button onClick={() => setTraceOpen(value => !value)} className="hover:text-neutral-300 flex items-center gap-1 font-mono">
              {traceOpen
                ? <><ChevronUp className="w-3 h-3" /> Thu gọn Trace Log</>
                : <><ChevronDown className="w-3 h-3" /> Xem Trace Log nghiệp vụ</>}
            </button>
            {traceOpen && (
              <pre className="mt-1.5 p-2 rounded bg-neutral-900 border border-neutral-800 font-mono text-[10px] text-neutral-400 overflow-x-auto">
                {JSON.stringify(message.trace, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
