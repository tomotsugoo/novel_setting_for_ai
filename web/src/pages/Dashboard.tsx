import { useEffect, useState } from 'react';
import { getDashboard, DashboardData } from '../api';

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDashboard().then(setData).catch((e) => setError(String(e)));
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">ダッシュボード</h2>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      {data ? (
        <>
          <div className="grid grid-cols-3 gap-4 mb-8">
            <StatCard label="キャラクター数" value={data.character_count} color="indigo" />
            <StatCard label="シーン数" value={data.scene_count} color="purple" />
            <StatCard label="執筆済みシーン" value={data.written_scene_count} color="green" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-700 mb-3">未執筆シーン</h3>
            {data.unwritten_scenes.length === 0 ? (
              <p className="text-gray-500 text-sm">すべてのシーンが執筆済みです！</p>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">タイトル</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">場所</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">物語時間</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {data.unwritten_scenes.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-500">{s.narrative_order}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.title}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{s.location ?? '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{s.story_time ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : !error ? (
        <p className="text-gray-400">読み込み中...</p>
      ) : null}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    green: 'bg-green-50 border-green-200 text-green-700',
  };
  return (
    <div className={`rounded-lg border-2 p-5 ${colorMap[color]}`}>
      <p className="text-sm font-medium opacity-75">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
  );
}
