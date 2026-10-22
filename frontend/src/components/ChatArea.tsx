'use client';

import { useEffect, useRef } from 'react';
import type { ChatMessage, Citation } from '@/types';
import { ChatComposer } from './chat/ChatComposer';
import { ChatHeader } from './chat/ChatHeader';
import { ChatMessageFeed } from './chat/ChatMessageFeed';

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

export function ChatArea({
  messages,
  isLoading,
  onSendMessage,
  onSelectCitation,
  onToggleInspector,
  isInspectorOpen,
  onOpenSidebar,
  onStop,
  provider,
}: ChatAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-950 text-neutral-100 overflow-hidden relative">
      <ChatHeader
        isInspectorOpen={isInspectorOpen}
        onOpenSidebar={onOpenSidebar}
        onToggleInspector={onToggleInspector}
      />
      <ChatMessageFeed
        messages={messages}
        isLoading={isLoading}
        onSendMessage={onSendMessage}
        onSelectCitation={onSelectCitation}
        endRef={messagesEndRef}
      />
      <ChatComposer
        isLoading={isLoading}
        onSendMessage={onSendMessage}
        onStop={onStop}
        provider={provider}
      />
    </div>
  );
}
