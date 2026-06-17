import { BrowserRouter, Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Characters from "./pages/Characters";
import Scenes from "./pages/Scenes";
import Timeline from "./pages/Timeline";
import Rules from "./pages/Rules";

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen bg-gray-100">
        <Sidebar />
        <main className="flex-1 overflow-auto p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/characters" element={<Characters />} />
            <Route path="/scenes" element={<Scenes />} />
            <Route path="/timeline" element={<Timeline />} />
            <Route path="/rules" element={<Rules />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
