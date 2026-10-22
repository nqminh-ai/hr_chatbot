import type { LucideIcon } from 'lucide-react';
import { FileText, Share2, Terminal } from 'lucide-react';

export type InspectorTab = 'citations' | 'graph' | 'trace';

interface InspectorTabsProps {
  activeTab: InspectorTab;
  citationCount: number;
  onChange: (tab: InspectorTab) => void;
}

const tabs: Array<{ id: InspectorTab; label: string; icon: LucideIcon }> = [
  { id: 'citations', label: 'Điều khoản', icon: FileText },
  { id: 'graph', label: 'Sơ đồ Graph', icon: Share2 },
  { id: 'trace', label: 'Trace Log', icon: Terminal },
];

export function InspectorTabs({ activeTab, citationCount, onChange }: InspectorTabsProps) {
  return (
    <div role="tablist" aria-label="Nội dung kiểm chứng" className="flex border-b border-neutral-800 text-xs font-medium">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          role="tab"
          aria-selected={activeTab === id}
          onClick={() => onChange(id)}
          className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition ${
            activeTab === id
              ? 'border-emerald-500 text-emerald-400 bg-neutral-800/40'
              : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Icon className="w-3.5 h-3.5" />
          <span>{label}{id === 'citations' ? ` (${citationCount})` : ''}</span>
        </button>
      ))}
    </div>
  );
}
