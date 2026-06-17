import { useEffect, useState } from 'react';
import { api, Scene } from '../api';

export default function Timeline() {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.scenes.list()
      .then(r => {
        const sorted = [...r.scenes].sort((a, b) => {
          if (!a.story_time && !b.story_time) return 0;
          if (!a.story_time) return 1;
          if (!b.story_time) return -1;
          return a.story_time.localeCompare(b.story_time);
        });
        setScenes(sorted);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <div className="text-red-500">Error: {error}</div>;
  if (scenes.length === 0) return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">タイムライン</h2>
      <p className="text-gray-500">シーンがありません</p>
    </div>
  );

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">タイムライン</h2>
      <div className="relative">
        <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200" />
        <div className="space-y-6">
          {scenes.map(s => (
            <div key={s.id} className="relative flex items-start gap-6">
              <div className="relative z-10 flex items-center justify-center w-16 h-16 shrink-0">
                <div className={`w-4 h-4 rounded-full border-2 ${s.is_written ? 'bg-green-500 border-green-600' : 'bg-white border-gray-300'}`} />
              </div>
              <div className="bg-white rounded-xl shadow p-4 flex-1 mb-2">
                <div className="flex items-center gap-2 mb-1">
                  {s.narrative_order != null && (
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">第{s.narrative_order}話</span>
                  )}
                  <h3 className="font-semibold text-gray-900">{s.title}</h3>
                </div>
                {s.story_time && <p className="text-xs text-gray-500">物語時間: {s.story_time}</p>}
                {s.location && <p className="text-xs text-gray-500">場所: {s.location}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
