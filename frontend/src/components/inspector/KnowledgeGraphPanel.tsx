import type { GraphNode, KnowledgeGraphData } from '@/types';

interface KnowledgeGraphPanelProps {
  graph?: KnowledgeGraphData;
}

const nodeColors: Record<GraphNode['type'], string> = {
  persona: 'border-blue-500/50 bg-blue-950/30 text-blue-300',
  org: 'border-amber-500/50 bg-amber-950/30 text-amber-300',
  policy: 'border-emerald-500/50 bg-emerald-950/30 text-emerald-300',
  clause: 'border-purple-500/50 bg-purple-950/30 text-purple-300',
  action: 'border-neutral-500/50 bg-neutral-950/30 text-neutral-300',
};

export function KnowledgeGraphPanel({ graph }: KnowledgeGraphPanelProps) {
  return (
    <div className="space-y-3">
      <div className="text-xs text-neutral-400 mb-2">
        Quan hệ chiếu tri thức giữa Persona, Pháp nhân và Điều khoản chính sách:
      </div>
      {graph?.nodes.length ? (
        <div className="space-y-2">
          <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800">
            <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
              Các Nút Tri Thức ({graph.nodes.length})
            </div>
            <div className="space-y-1.5">
              {graph.nodes.map(node => (
                <div key={node.id} className={`px-2 py-1.5 rounded border text-xs flex items-center justify-between ${nodeColors[node.type]}`}>
                  <span className="font-medium truncate">{node.label}</span>
                  <span className="text-[10px] uppercase opacity-75">{node.type}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800">
            <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
              Liên Kết Chiếu (Edges - {graph.edges.length})
            </div>
            <div className="space-y-1 text-xs font-mono text-neutral-400">
              {graph.edges.map(edge => (
                <div key={`${edge.source}-${edge.label}-${edge.target}`} className="p-1 rounded bg-neutral-900 flex items-center justify-between">
                  <span className="text-white truncate max-w-[120px]">{edge.source}</span>
                  <span className="text-emerald-400 text-[10px]">-- {edge.label} --&gt;</span>
                  <span className="text-white truncate max-w-[120px]">{edge.target}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-10 text-neutral-500 text-xs">Không có dữ liệu graph cho kết quả này.</div>
      )}
    </div>
  );
}
