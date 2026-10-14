'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage, Citation } from '@/types';
import { Send, Bot, User, AlertTriangle, FileText, ChevronDown, ChevronUp, Layers, Sparkles, Menu, Square } from 'lucide-react';
import { SAMPLE_QUERIES } from '@/lib/mockData';

interface ChatAreaProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (query: string) => void;
  onSelectCitation: (citation: Citation, message?: ChatMessage) => void;
  onOpenSidebar: () => void;
  onStop: () => void;
  provider: 'rules' | 'gemini';
  onToggleInspector: () => void;
  isInspectorOpen: boolean;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  messages,
  isLoading,
  onSendMessage,
  onSelectCitation,
  onToggleInspector,
  isInspectorOpen,
  onOpenSidebar,
  onStop,
  provider,
}) => {
  const [input, setInput] = useState('');
  const [openTraceId, setOpenTraceId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-950 text-neutral-100 overflow-hidden relative">
      {/* Top Bar */}
      <header className="h-14 border-b border-neutral-800/80 px-6 flex items-center justify-between bg-neutral-900/40 backdrop-blur-sm">
        <div className="flex items-center space-x-2">
          <button onClick={onOpenSidebar} aria-label="Mở danh sách hội thoại" className="md:hidden"><Menu size={18} /></button>
          <Bot className="w-5 h-5 text-emerald-400" />
          <span className="font-medium text-sm text-white">Trợ lý Appota</span>
        </div>
        <button
          onClick={onToggleInspector}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition border ${
            isInspectorOpen
              ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300'
              : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{isInspectorOpen ? 'Đóng nguồn' : 'Nguồn & chính sách'}</span>
        </button>
      </header>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto px-4 md:px-12 py-6 space-y-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-12">
            <div className="w-14 h-14 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-4 shadow-lg shadow-emerald-950/40">
              <Sparkles className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Bạn muốn tìm hiểu điều gì hôm nay?</h2>
            <p className="text-xs text-neutral-400 mb-8 leading-relaxed">
              Hỏi về ngày phép, cách đăng ký hoặc người phê duyệt. Bạn có thể hỏi tiếp trong cùng cuộc trò chuyện.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 w-full text-left">
              {SAMPLE_QUERIES.map((query, idx) => (
                <button
                  key={idx}
                  onClick={() => onSendMessage(query)}
                  disabled={isLoading}
                  className="p-3 rounded-xl bg-neutral-900/80 hover:bg-neutral-800/80 border border-neutral-800 hover:border-neutral-700 text-xs text-neutral-300 transition group flex flex-col justify-between"
                >
                  <span className="font-medium text-white group-hover:text-emerald-400 transition">
                    {query}
                  </span>
                  <span className="text-[10px] text-neutral-500 mt-2 flex items-center gap-1">
                    Hỏi ngay &rarr;
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-3xl ${
                msg.sender === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
              }`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold ${
                  msg.sender === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-emerald-600 text-white'
                }`}
              >
                {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Message Bubble */}
              <div className="space-y-2 max-w-[85%]">
                <div
                  className={`p-4 rounded-2xl text-sm leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-none'
                      : 'bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-tl-none shadow-sm'
                  }`}
                >
                  {/* Status alert for assistant */}
                  {msg.status === 'insufficient_evidence' && (
                    <div className="mb-3 p-2.5 rounded-lg bg-amber-950/40 border border-amber-600/40 text-amber-300 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                      <span>Có quy định hiện hành nhưng chưa có căn cứ xử lý ngoại lệ cho đối tượng này.</span>
                    </div>
                  )}

                  <div className="chat-markdown prose prose-invert prose-sm max-w-none space-y-2">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>

                  {/* Citations chip bar */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-neutral-800">
                      <div className="text-[11px] font-semibold text-neutral-400 mb-2 flex items-center gap-1">
                        <FileText className="w-3 h-3 text-emerald-400" />
                        Căn cứ trích dẫn chính sách ({msg.citations.length}):
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.citations.map((c, idx) => (
                          <button
                            key={idx}
                            onClick={() => onSelectCitation(c, msg)}
                            className="px-2.5 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700 border border-neutral-700/80 text-[11px] text-emerald-300 flex items-center gap-1 transition"
                          >
                            <span className="font-mono font-semibold">{c.doc_id}</span>
                            <span className="text-neutral-400">· {c.clause}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Trace accordion toggle */}
                {msg.sender === 'assistant' && msg.trace && (
                  <div className="text-[11px] text-neutral-400">
                    <button
                      onClick={() => setOpenTraceId(openTraceId === msg.id ? null : msg.id)}
                      className="hover:text-neutral-300 flex items-center gap-1 font-mono"
                    >
                      {openTraceId === msg.id ? (
                        <>
                          <ChevronUp className="w-3 h-3" /> Thu gọn Trace Log
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3 h-3" /> Xem Trace Log nghiệp vụ
                        </>
                      )}
                    </button>
                    {openTraceId === msg.id && (
                      <pre className="mt-1.5 p-2 rounded bg-neutral-900 border border-neutral-800 font-mono text-[10px] text-neutral-400 overflow-x-auto">
                        {JSON.stringify(msg.trace, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {/* Loading Indicator */}
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

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="p-4 bg-neutral-900/60 border-t border-neutral-800/80">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto relative flex items-center">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            maxLength={4000}
            aria-label="Tin nhắn"
            placeholder="Nhắn tin cho trợ lý Appota…"
            className="w-full bg-neutral-800/90 text-white placeholder-neutral-500 rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 border border-neutral-700/80 resize-none"
          />
          {isLoading ? <button type="button" onClick={onStop} aria-label="Dừng trả lời" className="absolute right-2.5 rounded-lg bg-neutral-700 p-2 text-white"><Square className="h-4 w-4" /></button> : <button
            type="submit"
            disabled={!input.trim() || isLoading}
            aria-label="Gửi tin nhắn"
            className="absolute right-2.5 p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:hover:bg-emerald-600 text-white transition shadow-sm"
          >
            <Send className="w-4 h-4" />
          </button>}
        </form>
        <p className="text-[11px] text-center text-neutral-500 mt-2">
          {provider === 'gemini' ? 'Chính sách mẫu · Câu hỏi và ngữ cảnh được gửi tới Google Gemini.' : 'Chính sách mẫu · Đang trả lời theo dữ liệu, chưa bật Gemini.'}
        </p>
      </div>
    </div>
  );
};
