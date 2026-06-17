import { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Characters from "./pages/Characters";
import Scenes from "./pages/Scenes";
import Timeline from "./pages/Timeline";
import Rules from "./pages/Rules";
import Migrate from "./pages/Migrate";
import Login from "./pages/Login";
import { isAuthenticated } from "./auth";

export default function App() {
  const [authed, setAuthed] = useState(isAuthenticated());

  if (!authed) {
    return <Login onSuccess={() => setAuthed(true)} />;
  }

  return (
    <BrowserRouter basename="/novel_setting_for_ai">
      <div className="flex h-screen bg-gray-100">
        <Sidebar />
        <main className="flex-1 overflow-auto p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/characters" element={<Characters />} />
            <Route path="/scenes" element={<Scenes />} />
            <Route path="/timeline" element={<Timeline />} />
            <Route path="/rules" element={<Rules />} />
            <Route path="/migrate" element={<Migrate />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
