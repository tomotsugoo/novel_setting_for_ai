interface BadgeProps {
  role: string | null;
}

const roleColors: Record<string, string> = {
  '主人公': 'bg-indigo-100 text-indigo-800',
  '敵': 'bg-red-100 text-red-800',
  'protagonist': 'bg-indigo-100 text-indigo-800',
  'antagonist': 'bg-red-100 text-red-800',
  'villain': 'bg-red-100 text-red-800',
};

export default function Badge({ role }: BadgeProps) {
  if (!role) return <span className="text-gray-400 text-xs">-</span>;
  const color = roleColors[role] ?? 'bg-gray-100 text-gray-800';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {role}
    </span>
  );
}
