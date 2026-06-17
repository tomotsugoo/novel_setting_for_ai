import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/", label: "ダッシュボード", exact: true },
  { to: "/characters", label: "キャラクター" },
  { to: "/scenes", label: "シーン" },
  { to: "/timeline", label: "タイムライン" },
  { to: "/rules", label: "世界ルール" },
  { to: "/consciousness", label: "意識の入れ替わり" },
  { to: "/migrate", label: "🔧 マイグレーション" },
];

export default function Sidebar() {
  return (
    <aside className="w-56 bg-gray-900 text-white flex flex-col">
      <div className="px-6 py-5 border-b border-gray-700">
        <h1 className="text-lg font-bold tracking-wide">NovelSync</h1>
        <p className="text-xs text-gray-400 mt-1">v0.1</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, label, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) =>
              [
                "block px-3 py-2 rounded-md text-sm font-medium transition-colors",
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
