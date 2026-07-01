import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/", label: "ダッシュボード", exact: true },
  { to: "/characters", label: "キャラクター" },
  { to: "/scenes", label: "シーン" },
  { to: "/timeline", label: "タイムライン" },
  { to: "/rules", label: "世界ルール" },
  { to: "/consciousness", label: "意識の入れ替わり" },
  { to: "/relationships", label: "関係性" },
  { to: "/story", label: "本文閲覧" },
  { to: "/relation-graph", label: "相関図" },
  { to: "/migrate", label: "🔧 マイグレーション" },
];

interface Props {
  onClose?: () => void;
}

export default function Sidebar({ onClose }: Props) {
  return (
    <aside className="w-56 bg-gray-900 text-white flex flex-col h-full">
      <div className="px-6 py-5 border-b border-gray-700 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-wide">NovelSync</h1>
          <p className="text-xs text-gray-400 mt-1">v0.1</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden text-gray-400 hover:text-white p-1"
            aria-label="閉じる"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, label, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            onClick={onClose}
            className={({ isActive }) =>
              [
                "block px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-indigo-600 text-white"
                  : "text-gray-300 hover:bg-gray-700 hover:text-white",
              ].join(" ")
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
