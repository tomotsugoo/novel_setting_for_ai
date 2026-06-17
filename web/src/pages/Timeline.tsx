import { useEffect, useState } from 'react';
import { listScenes, Scene } from '../api';

export default function Timeline() {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listScenes()
      .then((r) => {
        const sorted = [...r.scenes].sort((a, b) => {
          const ta = a.story_time ?? '';
          const tb = b.story_time ?? '';
          if (ta < tb) return -1;
          if (ta > tb) return 1;
          return a.narrative_order - b.narrative_order;
        });
        setScenes(sorted);
        setLoading(false);
      })
      .catch((e) => { setError(String(e)); setLoading(false); });
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">タイムライン</h2>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      {loading ? (
        <p className="text-gray-400">読み込み中...</p>
      ) : scenes.length === 0 ? (
        <p className="text-gray-400">シーンがありません</p>
      ) : (
        <div className="relative pl-8">
          <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200" />
          <div className="space-y-6">
            {scenes.map((s) => (
              <div key={s.id} className="relative">
                <div className="absolute -left-5 top-1.5 w-3 h-3 rounded-full border-2 border-indigo-400 bg-white" />
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-indigo-500 font-medium mb-1">
                        {s.story_time ?? '時間未設定'} {s.location ? `— ${s.location}` : ''}
                      </p>
                      <h3 className="text-sm font-semibold text-gray-900">{s.title}</h3>
                      {s.synopsis && <p className="text-sm text-gray-500 mt-1">{s.synopsis}</p>}
                    </div>
                    <span className={`ml-3 shrink-0 text-xs px-2 py-0.5 rounded-full ${s.is_written ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {s.is_written ? '執筆済' : '未執筆'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
