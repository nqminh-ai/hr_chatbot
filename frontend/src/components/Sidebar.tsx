'use client';

import React from 'react';
import { PERSONAS } from '@/lib/mockData';
import { Persona } from '@/types';
import { Users, Calendar, ShieldCheck, PlusCircle, Database, ExternalLink } from 'lucide-react';

interface SidebarProps {
  selectedPersona: Persona;
  onSelectPersona: (persona: Persona) => void;
  businessDate: string;
  onChangeBusinessDate: (date: string) => void;
  onNewChat: () => void;
  isSupabaseLive: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  selectedPersona,
  onSelectPersona,
  businessDate,
  onChangeBusinessDate,
  onNewChat,
  isSupabaseLive,
}) => {
  return (
    <aside className="w-80 bg-neutral-900 border-r border-neutral-800 flex flex-col h-full text-neutral-200">
      {/* Header */}
      <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-white shadow-sm">
            AP
          </div>
          <div>
            <h1 className="font-semibold text-sm tracking-wide text-white">Appota Knowledge</h1>
            <p className="text-[11px] text-neutral-400">Enterprise Policy Copilot</p>
          </div>
        </div>
      </div>

      {/* New Chat Button */}
      <div className="p-3">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700/80 text-sm font-medium text-white transition border border-neutral-700"
        >
          <PlusCircle className="w-4 h-4 text-emerald-400" />
          <span>Cuộc trò chuyện mới</span>
        </button>
      </div>

      {/* Context Configuration */}
      <div className="px-4 py-3 flex-1 overflow-y-auto space-y-5">
        {/* Persona Selector */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5 mb-2">
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            Persona Giả Lập (Mock Identity)
          </label>
          <div className="space-y-1.5">
            {Object.values(PERSONAS).map((p) => {
              const isActive = p.userId === selectedPersona.userId;
              return (
                <button
                  key={p.userId}
                  onClick={() => onSelectPersona(p)}
                  className={`w-full text-left p-2.5 rounded-lg text-xs transition border ${
                    isActive
                      ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                      : 'bg-neutral-800/50 border-neutral-700/50 hover:bg-neutral-800 text-neutral-300'
                  }`}
                >
                  <div className="flex items-center justify-between font-medium">
                    <span className="text-white">{p.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-700/80 text-neutral-300">
                      {p.role}
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-400 mt-1 line-clamp-1">
                    {p.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scope Hierarchy */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5 mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            Phạm vi phân quyền (Scope)
          </label>
          <div className="p-2.5 rounded-lg bg-neutral-800/50 border border-neutral-700/50 text-xs space-y-1">
            {selectedPersona.scopePath?.map((scope, idx) => (
              <div key={idx} className="flex items-center space-x-1.5 text-neutral-300">
                <span className="text-neutral-500">{idx === 0 ? '🏢' : '↳'}</span>
                <span className="truncate">{scope}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Business Date */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5 mb-2">
            <Calendar className="w-3.5 h-3.5 text-amber-400" />
            Ngày nghiệp vụ (As of Date)
          </label>
          <input
            type="date"
            value={businessDate}
            onChange={(e) => onChangeBusinessDate(e.target.value)}
            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
          />
          <p className="text-[10px] text-neutral-500 mt-1">
            *Dùng để kiểm thử hiệu lực chính sách trước và sau ngày 01/03/2026.
          </p>
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-neutral-800 text-[11px] text-neutral-400 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Database className="w-3.5 h-3.5" />
            Database:
          </span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${isSupabaseLive ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800'}`}>
            {isSupabaseLive ? 'Supabase Postgres' : 'Postgres / Local Engine'}
          </span>
        </div>
        <div className="flex items-center justify-between text-neutral-500 pt-1">
          <span>Deploy Target:</span>
          <span className="text-neutral-300 font-medium flex items-center gap-1">
            ▲ Vercel Edge
          </span>
        </div>
      </div>
    </aside>
  );
};
