interface TracePanelProps {
  trace?: Record<string, unknown>;
}

export function TracePanel({ trace }: TracePanelProps) {
  return (
    <div className="space-y-2">
      <div className="text-xs text-neutral-400">Nhật ký suy luận & phân cấp quyền thực tế:</div>
      <pre className="p-3 bg-neutral-950 rounded-lg border border-neutral-800 text-[11px] font-mono text-emerald-400 overflow-x-auto leading-relaxed">
        {JSON.stringify(trace || { notice: 'Không có trace log' }, null, 2)}
      </pre>
    </div>
  );
}
