import { useEffect, useState } from 'react';
import { api, Scene, ConsciousnessSwap, Character } from '../api';

type TimelineItem =
  | { type: 'scene'; time: string; data: Scene }
  | { type: 'swap_start'; time: string; data: ConsciousnessSwap }
  | { type: 'swap_end'; time: string; data: ConsciousnessSwap };

export default function Timeline() {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [swaps, setSwaps] = useState<ConsciousnessSwap[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.scenes.list(),
      api.consciousnessSwaps.list(),
      api.characters.list(),
    ]).then(([s, sw, c]) => {
      setScenes(s.scenes);
      setSwaps(sw.swaps);
      setCharacters(c.characters);
    }).catch((e: Error) => setError(e.message));
  }, []);

  const charName = (id: string) => characters.find(c => c.id === id)?.name ?? id;

  const items: TimelineItem[] = [];
  for (const s of scenes) {
    if (s.story_time) items.push({ type: 'scene', time: s.story_time, data: s });
  }
  for (const sw of swaps) {
    items.push({ type: 'swap_start', time: sw.swapped_at, data: sw });
    if (sw.resolved_at) items.push({ type: 'swap_end', time: sw.resolved_at, data: sw });
  }
  items.sort((a, b) => a.time.localeCompare(b.time));

  if (error) return <div className="text-red-500">Error: {error}</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">タイムライン</h2>
      {items.length === 0 ? (
        <p className="text-gray-500">データがありません</p>
      ) : (
        <div className="relative">
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200" />
          <div className="space-y-4">
            {items.map((item, i) => {
              if (item.type === 'scene') {
                const s = item.data;
                return (
                  <div key={`scene-${s.id}`} className="relative flex items-start gap-4">
                    <div className="relative z-10 flex items-center justify-center w-16 h-16 shrink-0">
                      <div className={`w-4 h-4 rounded-full border-2 ${s.is_written ? 'bg-green-500 border-green-600' : 'bg-white border-gray-300'}`} />
                    </div>
                    <div className="bg-white rounded-xl shadow p-4 flex-1 mb-2">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {s.narrative_order != null && (
                          <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">第{s.narrative_order}話</span>
                        )}
                        <h3 className="font-semibold text-gray-900">{s.title}</h3>
                      </div>
                      {s.story_time && <p className="text-xs text-gray-400">⏱ {s.story_time}</p>}
                      {s.location && <p className="text-xs text-gray-400">📍 {s.location}</p>}
                    </div>
                  </div>
                );
              }

              const sw = item.data;
              const isStart = item.type === 'swap_start';
              return (
                <div key={`swap-${sw.id}-${item.type}-${i}`} className="relative flex items-start gap-4">
                  <div className="relative z-10 flex items-center justify-center w-16 h-16 shrink-0">
                    <div className={`w-4 h-4 rounded-full border-2 ${isStart ? 'bg-red-400 border-red-500' : 'bg-blue-400 border-blue-500'}`} />
                  </div>
                  <div className={`rounded-xl shadow p-3 flex-1 mb-2 border-l-4 ${isStart ? 'bg-red-50 border-red-400' : 'bg-blue-50 border-blue-400'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${isStart ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                        {isStart ? '意識入れ替わり' : '自我回復'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800">
                      <span className="font-semibold text-indigo-600">{sw.from_name ?? charName(sw.from_character_id)}</span>
                      {isStart ? (
                        <> の意識 → <span className="font-semibold text-red-600">{sw.to_name ?? charName(sw.to_character_id)}</span> の体へ</>
                      ) : (
                        <> の自我が回復</>
                      )}
                    </p>
                    {isStart && sw.trigger_event && <p className="text-xs text-gray-500 mt-1">原因: {sw.trigger_event}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
