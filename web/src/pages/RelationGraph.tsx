import { useEffect, useRef, useState } from 'react';
import { api, Character, Relationship } from '../api';

const NODE_R = 28;
const WIDTH = 800;
const HEIGHT = 600;

interface Node {
  id: string;
  name: string;
  role: string;
  avatar: string | null;
  x: number;
  y: number;
}

function roleColor(role: string) {
  if (role === 'protagonist') return '#6366f1';
  if (role === 'antagonist') return '#ef4444';
  return '#64748b';
}

export default function RelationGraph() {
  const [, setCharacters] = useState<Character[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [, setDragOffset] = useState({ x: 0, y: 0 });
  const [hoveredRel, setHoveredRel] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const avatarImgs = useRef<Record<string, string>>({});

  useEffect(() => {
    Promise.all([api.characters.list(), api.relationships.list()])
      .then(([c, r]) => {
        setCharacters(c.characters);
        setRelationships(r.relationships);
        // 円形配置
        const cx = WIDTH / 2, cy = HEIGHT / 2;
        const radius = Math.min(WIDTH, HEIGHT) * 0.36;
        const newNodes: Node[] = c.characters.map((ch, i) => {
          const angle = (2 * Math.PI * i) / c.characters.length - Math.PI / 2;
          return { id: ch.id, name: ch.name, role: ch.role, avatar: ch.avatar, x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
        });
        setNodes(newNodes);
        c.characters.forEach(ch => {
          if (ch.avatar) avatarImgs.current[ch.id] = ch.avatar;
        });
      })
      .catch(e => setError(String(e)));
  }, []);

  const getNode = (id: string) => nodes.find(n => n.id === id);

  const onMouseDown = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const node = nodes.find(n => n.id === id);
    if (!node || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = WIDTH / rect.width;
    const scaleY = HEIGHT / rect.height;
    setDragging(id);
    setDragOffset({ x: e.clientX * scaleX - node.x * scaleX + rect.left * scaleX, y: e.clientY * scaleY - node.y * scaleY + rect.top * scaleY });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = WIDTH / rect.width;
    const scaleY = HEIGHT / rect.height;
    const x = Math.max(NODE_R, Math.min(WIDTH - NODE_R, (e.clientX - rect.left) * scaleX));
    const y = Math.max(NODE_R, Math.min(HEIGHT - NODE_R, (e.clientY - rect.top) * scaleY));
    setNodes(ns => ns.map(n => n.id === dragging ? { ...n, x, y } : n));
  };

  const onMouseUp = () => setDragging(null);

  const visibleRels = showSecret ? relationships : relationships.filter(r => r.is_public);

  if (error) return <div className="text-red-500">Error: {error}</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-800">相関図</h2>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={showSecret} onChange={e => setShowSecret(e.target.checked)} className="rounded" />
          <span className="text-gray-600">非公開の関係性も表示</span>
        </label>
      </div>
      <p className="text-xs text-gray-400 mb-3">ノードはドラッグで移動できます</p>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
          style={{ touchAction: 'none', userSelect: 'none', maxHeight: '70vh' }}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          <defs>
            {nodes.map(n => (
              <clipPath key={`clip-${n.id}`} id={`clip-${n.id}`}>
                <circle cx={n.x} cy={n.y} r={NODE_R - 2} />
              </clipPath>
            ))}
          </defs>

          {/* 関係性の線 */}
          {visibleRels.map(r => {
            const a = getNode(r.character_id_a);
            const b = getNode(r.character_id_b);
            if (!a || !b) return null;
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2;
            const isHovered = hoveredRel === r.id;
            const isPublic = r.is_public;
            return (
              <g key={r.id}>
                <line
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke={isPublic ? '#6366f1' : '#94a3b8'}
                  strokeWidth={isHovered ? 3 : 1.5}
                  strokeDasharray={isPublic ? undefined : '5,4'}
                  opacity={isHovered ? 1 : 0.6}
                />
                {/* ホバー用太い透明線 */}
                <line
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke="transparent"
                  strokeWidth={16}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredRel(r.id)}
                  onMouseLeave={() => setHoveredRel(null)}
                />
                {/* ラベル */}
                <text
                  x={mx} y={my - 6}
                  textAnchor="middle"
                  fontSize={11}
                  fill={isHovered ? '#4f46e5' : '#475569'}
                  fontWeight={isHovered ? 'bold' : 'normal'}
                  className="pointer-events-none"
                  style={{ paintOrder: 'stroke', stroke: 'white', strokeWidth: 3 }}
                >
                  {r.relation_type}
                </text>
              </g>
            );
          })}

          {/* ノード */}
          {nodes.map(n => {
            const img = avatarImgs.current[n.id];
            const color = roleColor(n.role);
            return (
              <g
                key={n.id}
                transform={`translate(${n.x},${n.y})`}
                className="cursor-grab active:cursor-grabbing"
                onMouseDown={e => onMouseDown(e, n.id)}
              >
                <circle r={NODE_R} fill={img ? '#e0e7ff' : color} stroke="white" strokeWidth={2.5} />
                {img ? (
                  <image
                    href={img}
                    x={-NODE_R + 2} y={-NODE_R + 2}
                    width={(NODE_R - 2) * 2} height={(NODE_R - 2) * 2}
                    clipPath={`url(#clip-${n.id})`}
                    preserveAspectRatio="xMidYMid slice"
                  />
                ) : (
                  <text textAnchor="middle" dominantBaseline="central" fontSize={14} fill="white" fontWeight="bold" className="pointer-events-none">
                    {n.name.slice(0, 1)}
                  </text>
                )}
                <circle r={NODE_R} fill="transparent" stroke={color} strokeWidth={2.5} />
                {/* 名前ラベル */}
                <text
                  y={NODE_R + 14}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight="bold"
                  fill="#1e293b"
                  className="pointer-events-none"
                  style={{ paintOrder: 'stroke', stroke: 'white', strokeWidth: 3 }}
                >
                  {n.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* 凡例 */}
      <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="inline-block w-6 h-0.5 bg-indigo-500"></span>公開の関係</span>
        <span className="flex items-center gap-1"><span className="inline-block w-6 border-t-2 border-dashed border-slate-400"></span>非公開の関係</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-indigo-500 inline-block"></span>主人公</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span>敵</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-slate-500 inline-block"></span>サブ</span>
      </div>
    </div>
  );
}
