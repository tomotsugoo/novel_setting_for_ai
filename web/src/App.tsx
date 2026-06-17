import { useState } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Characters from "./pages/Characters";
import Scenes from "./pages/Scenes";
import Timeline from "./pages/Timeline";
import Rules from "./pages/Rules";
import Migrate from "./pages/Migrate";
import ConsciousnessSwaps from "./pages/ConsciousnessSwaps";
import Login from "./pages/Login";
import { isAuthenticated } from "./auth";

export default function App() {
  const [authed, setAuthed] = useState(isAuthenticated());
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!authed) {
    return <Login onSuccess={() => setAuthed(true)} />;
  }

  return (
    <HashRouter>
      <div className="flex h-screen bg-gray-100">
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-20 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div className={`
          fixed inset-y-0 left-0 z-30 w-56 transform transition-transform duration-200
          md:relative md:translate-x-0 md:flex md:flex-shrink-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <Sidebar onClose={() => setSidebarOpen(false)} />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="md:hidden flex items-center gap-3 bg-gray-900 text-white px-4 py-3 flex-shrink-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1 rounded hover:bg-gray-700"
              aria-label="メニューを開く"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="font-bold text-lg">NovelSync</span>
          </div>

          <main className="flex-1 overflow-auto p-4 md:p-8">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/characters" element={<Characters />} />
              <Route path="/scenes" element={<Scenes />} />
              <Route path="/timeline" element={<Timeline />} />
              <Route path="/rules" element={<Rules />} />
              <Route path="/consciousness" element={<ConsciousnessSwaps />} />
              <Route path="/migrate" element={<Migrate />} />
            </Routes>
          </main>
        </div>
      </div>
    </HashRouter>
  );
}
