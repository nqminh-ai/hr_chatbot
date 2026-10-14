'use client';

import { MessageSquare, Plus, Settings2, X } from 'lucide-react';
import type { Conversation, Persona } from '@/types';
import type { SupabaseStatus } from '@/lib/supabase';

interface Props {
  conversations: Conversation[]; active: Conversation | undefined; mobileOpen: boolean;
  onSelect: (id: string) => void; onNew: () => void; onClose: () => void;
  onContext: (persona: string, date: string) => void;
  supabaseStatus?: SupabaseStatus | null;
  personas: Persona[];
}

export function ConversationSidebar({ conversations, active, mobileOpen, onSelect, onNew, onClose, onContext, supabaseStatus, personas }: Props) {
  return <>
    {mobileOpen && <button className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={onClose} aria-label="Đóng danh sách hội thoại" />}
    <aside className={`${mobileOpen ? 'flex' : 'hidden'} fixed inset-y-0 left-0 z-40 w-72 flex-col border-r border-neutral-800 bg-neutral-900 md:static md:flex md:w-64 shrink-0`}>
      <div className="flex items-center gap-3 px-5 py-5"><div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-600 font-bold text-white">AP</div><div><h1 className="text-sm font-semibold">Appota Knowledge</h1><p className="text-xs text-neutral-500">Trợ lý chính sách</p></div><button onClick={onClose} aria-label="Đóng danh sách hội thoại" className="ml-auto md:hidden"><X size={18} /></button></div>
      <button onClick={onNew} disabled={!active} className="mx-3 mb-5 flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3 text-sm hover:bg-neutral-700 disabled:opacity-50"><Plus size={17} />Cuộc trò chuyện mới</button>
      <div className="px-5 text-[11px] font-medium uppercase tracking-wider text-neutral-500">Cuộc trò chuyện</div>
      <nav aria-label="Lịch sử hội thoại" className="min-h-0 flex-1 overflow-y-auto p-3 space-y-1">
        {conversations.filter(chat => chat.messages.length > 0).map(chat => <button key={chat.id} onClick={() => onSelect(chat.id)} aria-current={active?.id === chat.id ? 'page' : undefined} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs ${active?.id === chat.id ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:bg-neutral-800/60'}`}><MessageSquare size={14} className="shrink-0" /><span className="truncate">{chat.title}</span></button>)}
        {!conversations.some(chat => chat.messages.length > 0) && <p className="px-2 pt-3 text-xs leading-5 text-neutral-500">Những cuộc trò chuyện của bạn sẽ xuất hiện ở đây.</p>}
      </nav>
      <details className="mx-3 mb-3 rounded-xl border border-neutral-800 p-3">
        <summary className="flex cursor-pointer items-center gap-2 text-xs text-neutral-400"><Settings2 size={15} />Thiết lập tra cứu</summary>
        {active && <div className="mt-4 space-y-3 text-xs"><label className="block">Bối cảnh nhân sự mẫu<select aria-label="Bối cảnh nhân sự mẫu" value={active.personaId} onChange={event => onContext(event.target.value, active.date)} className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 p-2">{personas.map(profile => <option key={profile.userId} value={profile.userId}>{profile.name} · {profile.role}</option>)}</select></label><label className="block">Ngày áp dụng<input aria-label="Ngày áp dụng" type="date" value={active.date} onChange={event => { if (event.target.value) onContext(active.personaId, event.target.value); }} className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 p-2" /></label><p className="text-[11px] leading-5 text-neutral-500">Đổi bối cảnh sẽ bắt đầu hội thoại mới để giữ đúng chính sách.</p></div>}
      </details>
      <div className="space-y-1 border-t border-neutral-800 px-4 py-3 text-[11px]">
        <p className="flex justify-between gap-2"><span className="text-neutral-500">Nguồn trả lời:</span><span>JSON mẫu</span></p>
        <p className="flex justify-between gap-2"><span className="text-neutral-500">Kết nối Supabase:</span>
          <span className={supabaseStatus?.connected ? 'text-emerald-400' : 'text-neutral-400'}>
            {supabaseStatus === null ? 'Đang kiểm tra' : supabaseStatus?.connected
              ? supabaseStatus.ready ? 'Sẵn sàng' : 'Chưa có dữ liệu'
              : supabaseStatus?.configured ? 'Chưa kết nối' : 'Chưa cấu hình'}
          </span>
        </p>
      </div>
    </aside>
  </>;
}
