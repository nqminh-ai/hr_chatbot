'use client';

import { useEffect, useRef, useState } from 'react';
import { ChatArea } from './ChatArea';
import { ConversationSidebar } from './ConversationSidebar';
import { InspectorDrawer } from './InspectorDrawer';
import { businessToday, newConversation, restoreConversations, serializeConversations, STORAGE_KEY, LEGACY_STORAGE_KEY } from '@/lib/conversations';
import { validPersonas, validReply } from '@/lib/chat-validation';
import type { SupabaseStatus } from '@/lib/supabase';
import type { ChatMessage, Citation, Conversation, Persona } from '@/types';

export function ChatClient() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState('');
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspection, setInspection] = useState<ChatMessage | null>(null);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [provider, setProvider] = useState<'rules' | 'gemini'>('rules');
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseStatus | null>(null);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [notice, setNotice] = useState('');
  const request = useRef<{ id: number; controller?: AbortController; busy: boolean }>({ id: 0, busy: false });
  const active = conversations.find(chat => chat.id === activeId);
  const latest = inspection || active?.messages.filter(message => message.sender === 'assistant').at(-1);

  useEffect(() => {
    const pendingRequest = request.current;
    let restored: Conversation[] = [];
    try { restored = restoreConversations(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY)); }
    // Hydrate browser storage after mount so server and initial client renders match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    catch { setNotice('Không đọc được lịch sử cũ. Cuộc trò chuyện hiện tại vẫn sử dụng được.'); }
    const chats = restored.length ? restored : [newConversation()];
    setConversations(chats); setActiveId(chats[0].id);
    const controller = new AbortController();
    fetch('/api/chat', { cache: 'no-store', signal: controller.signal }).then(response => {
      if (!response.ok) throw new Error('Bootstrap unavailable');
      return response.json();
    }).then(data => {
      if (controller.signal.aborted) return;
      if (!validPersonas(data.personas)) throw new Error('Invalid bootstrap');
      setPersonas(data.personas);
      const validChats = restored.filter(chat => data.personas.some((persona: Persona) => persona.userId === chat.personaId));
      const hydrated = validChats.length ? validChats : [newConversation(data.personas[0].userId)];
      setConversations(hydrated); setActiveId(hydrated[0].id);
      setProvider(data.provider === 'gemini' ? 'gemini' : 'rules');
      if (data.supabase) {
        setSupabaseStatus(data.supabase);
      }
    }).catch(() => {
      if (!controller.signal.aborted) setNotice('Không tải được trạng thái hệ thống. Bạn có thể thử lại sau khi tải lại trang.');
    }).finally(() => { if (!controller.signal.aborted) setReady(true); });
    return () => { controller.abort(); pendingRequest.controller?.abort(); };
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(STORAGE_KEY, serializeConversations(conversations)); }
    // Report a failure while synchronizing with external browser storage.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    catch { setNotice('Bộ nhớ trình duyệt không lưu được lịch sử. Hội thoại vẫn hoạt động trong phiên này.'); }
  }, [conversations, ready]);

  function cancelPending() {
    request.current.controller?.abort(); request.current.id += 1; request.current.busy = false;
    setLoading(false); setInspection(null); setSelectedCitation(null); setInspectorOpen(false);
  }

  function startChat(personaId = active?.personaId || personas[0]?.userId || 'lan', date = businessToday()) {
    cancelPending();
    const chat = newConversation(personaId, date);
    setConversations(previous => [chat, ...previous.filter(item => item.messages.length)]);
    setActiveId(chat.id); setMobileSidebar(false);
  }

  function stopReply() {
    if (!active || !request.current.busy) return;
    const chatId = active.id;
    cancelPending();
    const message: ChatMessage = { id: crypto.randomUUID(), sender: 'assistant', status: 'error', createdAt: new Date().toISOString(),
      content: 'Đã dừng trả lời. Bạn có thể gửi câu hỏi tiếp theo.' };
    setConversations(previous => previous.map(chat => chat.id === chatId
      ? { ...chat, updatedAt: message.createdAt, messages: [...chat.messages, message] } : chat));
  }

  async function sendMessage(query: string) {
    if (!ready || !active || !query.trim() || query.length > 4000 || request.current.busy) return;
    const chatId = active.id;
    const controller = new AbortController();
    const id = ++request.current.id;
    request.current.controller = controller; request.current.busy = true;
    const user: ChatMessage = { id: crypto.randomUUID(), sender: 'user', content: query.trim(), createdAt: new Date().toISOString() };
    setConversations(previous => previous.map(chat => chat.id === chatId ? { ...chat, title: chat.messages.length ? chat.title : query.slice(0, 50), updatedAt: user.createdAt, messages: [...chat.messages, user] } : chat));
    setLoading(true); setInspection(null); setSelectedCitation(null);
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ query: user.content, personaId: active.personaId, date: active.date, context: active.context,
          messages: active.messages.filter(message => message.sender === 'user').slice(-20).map(message => ({ sender: message.sender, content: message.content })) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Chưa thể trả lời. Vui lòng thử lại.');
      if (id !== request.current.id) return;
      if (!validReply(data)) throw new Error('Phản hồi không hợp lệ. Vui lòng thử lại.');
      setProvider(data.provider);
      const bot: ChatMessage = { id: crypto.randomUUID(), sender: 'assistant', content: data.answer, status: data.status,
        queryDate: data.query_date, citations: data.citations, graph: data.graph, trace: data.trace, provider: data.provider, createdAt: new Date().toISOString() };
      setConversations(previous => previous.map(chat => chat.id === chatId ? { ...chat, context: data.context, updatedAt: bot.createdAt, messages: [...chat.messages, bot] } : chat));
      if (data.notice) setNotice(data.notice);
    } catch (error) {
      if (id !== request.current.id) return;
      const stopped = controller.signal.aborted;
      const bot: ChatMessage = { id: crypto.randomUUID(), sender: 'assistant', status: 'error', createdAt: new Date().toISOString(),
        content: stopped ? 'Đã dừng trả lời. Bạn có thể gửi câu hỏi tiếp theo.' : error instanceof Error ? error.message : 'Không thể kết nối. Vui lòng thử lại.' };
      setConversations(previous => previous.map(chat => chat.id === chatId ? { ...chat, messages: [...chat.messages, bot] } : chat));
    } finally {
      if (id === request.current.id) { request.current.busy = false; setLoading(false); }
    }
  }

  function selectCitation(citation: Citation, message?: ChatMessage) {
    setInspection(message || null); setSelectedCitation(citation); setInspectorOpen(true);
  }

  return <div className="flex h-dvh w-full overflow-hidden bg-neutral-950 font-sans text-neutral-100 antialiased">
    <ConversationSidebar conversations={conversations} active={active} mobileOpen={mobileSidebar} onClose={() => setMobileSidebar(false)} onNew={() => startChat()}
      onSelect={id => { cancelPending(); setActiveId(id); setMobileSidebar(false); }} onContext={(persona, date) => startChat(persona, date)} supabaseStatus={supabaseStatus} personas={personas} />
    <main className="flex min-w-0 flex-1 flex-col">
      {notice && <div role="status" className="flex items-center justify-between gap-3 border-b border-neutral-800 bg-neutral-900 px-4 py-2 text-xs text-neutral-400"><span>{notice}</span><button aria-label="Đóng thông báo" onClick={() => setNotice('')}>×</button></div>}
      <ChatArea key={activeId} messages={active?.messages || []} isLoading={loading || !ready} onSendMessage={sendMessage} onSelectCitation={selectCitation}
        onToggleInspector={() => setInspectorOpen(value => !value)} isInspectorOpen={inspectorOpen} onOpenSidebar={() => setMobileSidebar(true)} onStop={stopReply} provider={provider} />
    </main>
    <InspectorDrawer isOpen={inspectorOpen} onClose={() => setInspectorOpen(false)} citations={latest?.citations} graph={latest?.graph} trace={latest?.trace} selectedCitation={selectedCitation} queryDate={latest?.queryDate} />
  </div>;
}
