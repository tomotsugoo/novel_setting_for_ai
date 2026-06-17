const roleConfig: Record<string, { label: string; className: string }> = {
  protagonist: { label: '主人公', className: 'bg-indigo-100 text-indigo-800' },
  antagonist: { label: '敵', className: 'bg-red-100 text-red-800' },
  supporting: { label: 'サブ', className: 'bg-gray-100 text-gray-800' },
};

export default function Badge({ role }: { role: string }) {
  const cfg = roleConfig[role] ?? { label: role, className: 'bg-gray-100 text-gray-800' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}
