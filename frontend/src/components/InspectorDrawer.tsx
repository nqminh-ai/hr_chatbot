'use client';

import React, { useState } from 'react';
import { Citation, KnowledgeGraphData } from '@/types';
import { X, FileText, Share2, Terminal, CheckCircle2, Layers } from 'lucide-react';

interface InspectorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  citations?: Citation[];
  graph?: KnowledgeGraphData;
  trace?: Record<string, unknown>;
  selectedCitation?: Citation | null;
  queryDate?: string;
}

export const InspectorDrawer: React.FC<InspectorDrawerProps> = ({
  isOpen,
  onClose,
  citations = [],
  graph,
  trace,
  selectedCitation,
  queryDate,
}) => {
  const [activeTab, setActiveTab] = useState<'citations' | 'graph' | 'trace'>('citations');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-20 w-96 max-w-[95vw] bg-neutral-900 border-l border-neutral-800 flex flex-col h-full text-neutral-200 shadow-2xl lg:static shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-emerald-400" />
          <h2 className="font-semibold text-sm text-white">Nguồn & chính sách</h2>
        </div>
        <button
          onClick={onClose}
          aria-label="Đóng nguồn và chính sách"
          className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-800 text-xs font-medium">
        <button
          onClick={() => setActiveTab('citations')}
          className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition ${
            activeTab === 'citations'
              ? 'border-emerald-500 text-emerald-400 bg-neutral-800/40'
              : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Điều khoản ({citations.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('graph')}
          className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition ${
            activeTab === 'graph'
              ? 'border-emerald-500 text-emerald-400 bg-neutral-800/40'
              : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>Sơ đồ Graph</span>
        </button>
        <button
          onClick={() => setActiveTab('trace')}
          className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition ${
            activeTab === 'trace'
              ? 'border-emerald-500 text-emerald-400 bg-neutral-800/40'
              : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Trace Log</span>
        </button>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Tab Citations */}
        {activeTab === 'citations' && (
          <div className="space-y-3">
            {citations.length === 0 ? (
              <div className="text-center py-10 text-neutral-500 text-xs">
                Chưa có trích dẫn điều khoản cho câu hỏi này.
              </div>
            ) : (
              citations.map((c, idx) => {
                const isSelected = selectedCitation?.clause === c.clause && selectedCitation?.doc_id === c.doc_id;
                return (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-lg border transition ${
                      isSelected
                        ? 'bg-emerald-950/30 border-emerald-500/70'
                        : 'bg-neutral-800/40 border-neutral-700/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-neutral-700 text-emerald-300 font-semibold">
                        {c.doc_id} {c.version}
                      </span>
                      <span className="text-[10px] text-neutral-400">{c.scope_level}</span>
                    </div>
                    <div className="font-semibold text-xs text-white mb-1">{c.title}</div>
                    <div className="text-xs text-emerald-400/90 font-medium mb-2">
                      Mục: <span className="font-mono">{c.clause}</span>
                    </div>
                    {c.text_source && (
                      <div className="bg-neutral-900/80 p-2.5 rounded border border-neutral-800 text-xs text-neutral-300 leading-relaxed italic">
                        &ldquo;{c.text_source}&rdquo;
                      </div>
                    )}
                    {c.valid_from && (
                      <div className="mt-2 space-y-1.5 text-[10px] text-neutral-400">
                        <div className="flex items-center justify-between gap-2">
                          <span>
                            Hiệu lực: {c.valid_from} → {c.valid_to || 'không thời hạn'}
                          </span>
                          {queryDate && (
                            <span className="text-emerald-500 flex items-center gap-1 whitespace-nowrap">
                              <CheckCircle2 className="w-3 h-3" /> Có hiệu lực ngày {queryDate}
                            </span>
                          )}
                        </div>
                        {c.source_ref && (
                          <div className="rounded bg-neutral-950 px-2 py-1.5 text-neutral-500 break-all space-y-1">
                            <div>
                              <span className="text-neutral-400">Vị trí nguồn:</span>{' '}
                              <span className="font-mono">{c.source_ref.path}:{c.source_ref.line}</span>
                            </div>
                            <div>
                              <span className="text-neutral-400">Định danh phần:</span>{' '}
                              <span className="font-mono">{c.source_ref.json_pointer}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab Graph */}
        {activeTab === 'graph' && (
          <div className="space-y-3">
            <div className="text-xs text-neutral-400 mb-2">
              Quan hệ chiếu tri thức giữa Persona, Pháp nhân và Điều khoản chính sách:
            </div>
            {graph && graph.nodes.length > 0 ? (
              <div className="space-y-2">
                <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800">
                  <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                    Các Nút Tri Thức ({graph.nodes.length})
                  </div>
                  <div className="space-y-1.5">
                    {graph.nodes.map((node, idx) => {
                      const colorMap = {
                        persona: 'border-blue-500/50 bg-blue-950/30 text-blue-300',
                        org: 'border-amber-500/50 bg-amber-950/30 text-amber-300',
                        policy: 'border-emerald-500/50 bg-emerald-950/30 text-emerald-300',
                        clause: 'border-purple-500/50 bg-purple-950/30 text-purple-300',
                        action: 'border-neutral-500/50 bg-neutral-950/30 text-neutral-300',
                      };
                      return (
                        <div
                          key={`${node.id}-${idx}`}
                          className={`px-2 py-1.5 rounded border text-xs flex items-center justify-between ${
                            colorMap[node.type] || 'border-neutral-700'
                          }`}
                        >
                          <span className="font-medium truncate">{node.label}</span>
                          <span className="text-[10px] uppercase opacity-75">{node.type}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800">
                  <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                    Liên Kết Chiếu (Edges - {graph.edges.length})
                  </div>
                  <div className="space-y-1 text-xs font-mono text-neutral-400">
                    {graph.edges.map((e, idx) => (
                      <div key={idx} className="p-1 rounded bg-neutral-900 flex items-center justify-between">
                        <span className="text-white truncate max-w-[120px]">{e.source}</span>
                        <span className="text-emerald-400 text-[10px]">-- {e.label} --&gt;</span>
                        <span className="text-white truncate max-w-[120px]">{e.target}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-neutral-500 text-xs">
                Không có dữ liệu graph cho kết quả này.
              </div>
            )}
          </div>
        )}

        {/* Tab Trace */}
        {activeTab === 'trace' && (
          <div className="space-y-2">
            <div className="text-xs text-neutral-400">
              Nhật ký suy luận & phân cấp quyền thực tế:
            </div>
            <pre className="p-3 bg-neutral-950 rounded-lg border border-neutral-800 text-[11px] font-mono text-emerald-400 overflow-x-auto leading-relaxed">
              {JSON.stringify(trace || { notice: 'Không có trace log' }, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
