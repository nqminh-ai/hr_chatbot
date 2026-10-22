'use client';

import { useState } from 'react';
import { Layers, X } from 'lucide-react';
import type { Citation, KnowledgeGraphData } from '@/types';
import { CitationsPanel } from './inspector/CitationsPanel';
import { InspectorTabs } from './inspector/InspectorTabs';
import type { InspectorTab } from './inspector/InspectorTabs';
import { KnowledgeGraphPanel } from './inspector/KnowledgeGraphPanel';
import { TracePanel } from './inspector/TracePanel';

interface InspectorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  citations?: Citation[];
  graph?: KnowledgeGraphData;
  trace?: Record<string, unknown>;
  selectedCitation?: Citation | null;
  queryDate?: string;
}

export function InspectorDrawer({
  isOpen,
  onClose,
  citations = [],
  graph,
  trace,
  selectedCitation,
  queryDate,
}: InspectorDrawerProps) {
  const [activeTab, setActiveTab] = useState<InspectorTab>('citations');
  if (!isOpen) return null;

  return (
    <aside aria-label="Nguồn và chính sách" className="fixed inset-y-0 right-0 z-20 w-96 max-w-[95vw] bg-neutral-900 border-l border-neutral-800 flex flex-col h-full text-neutral-200 shadow-2xl lg:static shrink-0">
      <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-emerald-400" />
          <h2 className="font-semibold text-sm text-white">Nguồn & chính sách</h2>
        </div>
        <button onClick={onClose} aria-label="Đóng nguồn và chính sách" className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition">
          <X className="w-4 h-4" />
        </button>
      </div>

      <InspectorTabs activeTab={activeTab} citationCount={citations.length} onChange={setActiveTab} />
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'citations' && <CitationsPanel citations={citations} selectedCitation={selectedCitation} queryDate={queryDate} />}
        {activeTab === 'graph' && <KnowledgeGraphPanel graph={graph} />}
        {activeTab === 'trace' && <TracePanel trace={trace} />}
      </div>
    </aside>
  );
}
