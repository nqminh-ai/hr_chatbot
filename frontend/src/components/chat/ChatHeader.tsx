import { Bot, Layers, Menu } from 'lucide-react';

interface ChatHeaderProps {
  isInspectorOpen: boolean;
  onOpenSidebar: () => void;
  onToggleInspector: () => void;
}

export function ChatHeader({ isInspectorOpen, onOpenSidebar, onToggleInspector }: ChatHeaderProps) {
  return (
    <header className="h-14 border-b border-neutral-800/80 px-6 flex items-center justify-between bg-neutral-900/40 backdrop-blur-sm">
      <div className="flex items-center space-x-2">
        <button onClick={onOpenSidebar} aria-label="Mở danh sách hội thoại" className="md:hidden">
          <Menu size={18} />
        </button>
        <Bot className="w-5 h-5 text-emerald-400" />
        <span className="font-medium text-sm text-white">Trợ lý Appota</span>
      </div>
      <button
        onClick={onToggleInspector}
        aria-expanded={isInspectorOpen}
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
  );
}
