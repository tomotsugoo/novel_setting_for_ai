import { useEffect, useState } from 'react';
import { api, Scene, ConsciousnessSwap, Character, SceneCharacter, Relationship } from '../api';

function Avatar({ src, name }: { src: string | null; name: string }) {
  if (src) return <img src={src} alt={name} className="w-6 h-6 rounded-full object-cover shrink-0" />;
  return (
    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">
      {name.slice(0, 1)}
    </div>
  );
}

export default function Timeline() {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [swaps, setSwaps] = useState<ConsciousnessSwap[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [sceneCharsMap, setSceneCharsMap] = useState<Record<string, SceneCharacter[]>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.scenes.list(),
      api.consciousnessSwaps.list(),
      api.characters.list(),
      api.relationships.list(),
    ]).then(async ([s, sw, c, rel]) => {
      setScenes(s.scenes);
      setSwaps(sw.swaps);
      setCharacters(c.characters);
      setRelationships(rel.relationships);
      const map: Record<string, SceneCharacter[]> = {};
      await Promise.all(s.scenes.map(async scene => {
        try {
          const r = await api.sceneCharacters.list(scene.id);
          map[scene.id] = r.scene_characters;
        } catch {
          map[scene.id] = [];
        }
      }));
      setSceneCharsMap(map);
    }).catch((e: Error) => setError(e.message));
  }, []);

  const charName = (id: string) => characters.find(c => c.id === id)?.name ?? id;
  const charAvatar = (id: string) => characters.find(c => c.id === id)?.avatar ?? null;

  // シーンをstory_time順にソート
  const sorted = [...scenes]
    .filter(s => s.story_time)
    .sort((a, b) => a.story_time!.localeCompare(b.story_time!));

  // シーンの物語時間に一致するスワップイベントを取得
  const swapsAtTime = (time: string) => {
    const starts = swaps.filter(sw => sw.swapped_at === time);
    const ends = swaps.filter(sw => sw.resolved_at === time);
    return { starts, ends };
  };

  // シーン時点で有効かつ登場キャラが絡む関係性
  const relsForScene = (time: string, charIds: Set<string>) =>
    relationships.filter(r => {
      const timeOk = (r.valid_from == null || r.valid_from <= time) && (r.valid_to == null || r.valid_to > time);
      const charOk = charIds.has(r.character_id_a) || charIds.has(r.character_id_b);
      return timeOk && charOk;
    });

  if (error) return <div className="text-red-500">Error: {error}</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">タイムライン</h2>
      {sorted.length === 0 ? (
        <p className="text-gray-500">データがありません</p>
      ) : (
        <div className="relative">
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200" />
          <div className="space-y-4">
            {sorted.map(s => {
              const chars = sceneCharsMap[s.id] ?? [];
              const { starts, ends } = swapsAtTime(s.story_time!);
              const charIdSet = new Set(chars.map(c => c.character_id));
              const rels = chars.length > 0 ? relsForScene(s.story_time!, charIdSet) : [];
              return (
                <div key={s.id} className="relative flex items-start gap-4">
                  <div className="relative z-10 flex items-center justify-center w-16 h-16 shrink-0">
                    <div className={`w-4 h-4 rounded-full border-2 ${s.is_written ? 'bg-green-500 border-green-600' : 'bg-white border-gray-300'}`} />
                  </div>
                  <div className="bg-white rounded-xl shadow p-4 flex-1 mb-2">
                    {/* シーン情報 */}
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {s.narrative_order != null && (
                        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">第{s.narrative_order}話</span>
                      )}
                      <h3 className="font-semibold text-gray-900">{s.title}</h3>
                    </div>
                    {s.story_time && <p className="text-xs text-gray-400">⏱ {s.story_time}</p>}
                    {s.location && <p className="text-xs text-gray-400">📍 {s.location}</p>}
                    {(s.protagonist_identity_id || starts.length > 0 || ends.length > 0) && (
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        {s.protagonist_identity_id && (
                          <div className="inline-flex items-center gap-1 text-xs bg-purple-100 text-purple-700 pl-1 pr-2 py-0.5 rounded-full">
                            <Avatar src={charAvatar(s.protagonist_identity_id)} name={charName(s.protagonist_identity_id)} />
                            🧠 {charName(s.protagonist_identity_id)}
                          </div>
                        )}
                        {starts.map(sw => (
                          <div key={`start-${sw.id}`} className="inline-flex items-center gap-1 bg-red-50 border border-red-200 rounded-lg px-2 py-0.5">
                            <span className="text-xs font-medium text-red-600 shrink-0">⇄</span>
                            <Avatar src={charAvatar(sw.from_character_id)} name={sw.from_name ?? charName(sw.from_character_id)} />
                            <span className="text-xs text-gray-700">{sw.from_name ?? charName(sw.from_character_id)}</span>
                            <span className="text-xs text-gray-400">→</span>
                            <Avatar src={charAvatar(sw.to_character_id)} name={sw.to_name ?? charName(sw.to_character_id)} />
                            <span className="text-xs text-gray-700">{sw.to_name ?? charName(sw.to_character_id)}</span>
                          </div>
                        ))}
                        {ends.map(sw => (
                          <div key={`end-${sw.id}`} className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 rounded-lg px-2 py-0.5">
                            <span className="text-xs font-medium text-blue-600 shrink-0">↩</span>
                            <Avatar src={charAvatar(sw.from_character_id)} name={sw.from_name ?? charName(sw.from_character_id)} />
                            <span className="text-xs text-gray-700">{sw.from_name ?? charName(sw.from_character_id)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {chars.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {chars.map(sc => (
                          <span key={sc.character_id} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 pl-1 pr-2 py-0.5 rounded-full">
                            <Avatar src={charAvatar(sc.character_id)} name={sc.name} />
                            {sc.name}
                          </span>
                        ))}
                      </div>
                    )}
                    {rels.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {rels.map(r => (
                          <span key={r.id} className={`text-xs px-2 py-0.5 rounded-full border ${r.is_public ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                            {r.name_a ?? charName(r.character_id_a)} ↔ {r.name_b ?? charName(r.character_id_b)}: {r.relation_type}
                            {!r.is_public && ' 🔒'}
                          </span>
                        ))}
                      </div>
                    )}
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
