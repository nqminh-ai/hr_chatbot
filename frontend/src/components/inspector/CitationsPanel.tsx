import { CheckCircle2 } from 'lucide-react';
import type { Citation } from '@/types';

interface CitationsPanelProps {
  citations: Citation[];
  selectedCitation?: Citation | null;
  queryDate?: string;
}

function CitationCard({ citation, selected, queryDate }: { citation: Citation; selected: boolean; queryDate?: string }) {
  return (
    <div className={`p-3.5 rounded-lg border transition ${
      selected ? 'bg-emerald-950/30 border-emerald-500/70' : 'bg-neutral-800/40 border-neutral-700/60'
    }`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-neutral-700 text-emerald-300 font-semibold">
          {citation.doc_id} {citation.version}
        </span>
        <span className="text-[10px] text-neutral-400">{citation.scope_level}</span>
      </div>
      <div className="font-semibold text-xs text-white mb-1">{citation.title}</div>
      <div className="text-xs text-emerald-400/90 font-medium mb-2">
        Mục: <span className="font-mono">{citation.clause}</span>
      </div>
      {citation.text_source && (
        <div className="bg-neutral-900/80 p-2.5 rounded border border-neutral-800 text-xs text-neutral-300 leading-relaxed italic">
          &ldquo;{citation.text_source}&rdquo;
        </div>
      )}
      {citation.valid_from && (
        <div className="mt-2 space-y-1.5 text-[10px] text-neutral-400">
          <div className="flex items-center justify-between gap-2">
            <span>Hiệu lực: {citation.valid_from} → {citation.valid_to || 'không thời hạn'}</span>
            {queryDate && (
              <span className="text-emerald-500 flex items-center gap-1 whitespace-nowrap">
                <CheckCircle2 className="w-3 h-3" /> Có hiệu lực ngày {queryDate}
              </span>
            )}
          </div>
          {citation.source_ref && (
            <div className="rounded bg-neutral-950 px-2 py-1.5 text-neutral-500 break-all space-y-1">
              <div><span className="text-neutral-400">Vị trí nguồn:</span>{' '}<span className="font-mono">{citation.source_ref.path}:{citation.source_ref.line}</span></div>
              <div><span className="text-neutral-400">Định danh phần:</span>{' '}<span className="font-mono">{citation.source_ref.json_pointer}</span></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function CitationsPanel({ citations, selectedCitation, queryDate }: CitationsPanelProps) {
  if (!citations.length) {
    return <div className="text-center py-10 text-neutral-500 text-xs">Chưa có trích dẫn điều khoản cho câu hỏi này.</div>;
  }
  return (
    <div className="space-y-3">
      {citations.map(citation => (
        <CitationCard
          key={`${citation.doc_id}-${citation.version}-${citation.clause}`}
          citation={citation}
          queryDate={queryDate}
          selected={selectedCitation?.clause === citation.clause && selectedCitation?.doc_id === citation.doc_id}
        />
      ))}
    </div>
  );
}
