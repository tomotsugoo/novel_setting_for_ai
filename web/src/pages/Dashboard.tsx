import { useEffect, useState } from 'react';
import { api, DashboardData } from '../api';

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.dashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <div className="text-red-500">Error: {error}</div>;
  if (!data) return <div className="text-gray-500">読み込み中...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">ダッシュボード</h2>
      <div className="grid grid-cols-3 gap-3 md:gap-6 mb-6 md:mb-8">
        <div className="bg-white rounded-xl shadow p-3 md:p-6">
          <div className="text-xs md:text-sm text-gray-500 mb-1">キャラクター数</div>
          <div className="text-2xl md:text-3xl font-bold text-indigo-600">{data.characters}</div>
        </div>
        <div className="bg-white rounded-xl shadow p-3 md:p-6">
          <div className="text-xs md:text-sm text-gray-500 mb-1">シーン数</div>
          <div className="text-2xl md:text-3xl font-bold text-indigo-600">{data.scenes}</div>
        </div>
        <div className="bg-white rounded-xl shadow p-3 md:p-6">
          <div className="text-xs md:text-sm text-gray-500 mb-1">執筆済み</div>
          <div className="text-2xl md:text-3xl font-bold text-green-600">{data.written}</div>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">未執筆シーン</h3>
        {data.unwritten_scenes.length === 0 ? (
          <p className="text-gray-500">未執筆シーンはありません</p>
        ) : (
          <ul className="space-y-2">
            {data.unwritten_scenes.map(s => (
              <li key={s.id} className="flex items-center gap-3 text-gray-700">
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">#{s.narrative_order}</span>
                <span>{s.title}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
