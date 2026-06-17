import { useEffect, useState } from 'react';
import { api, ConsciousnessSwap, Character, Scene } from '../api';
import Modal from '../components/Modal';

export default function ConsciousnessSwaps() {
  const [swaps, setSwaps] = useState<ConsciousnessSwap[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    id: '', from_character_id: '', to_character_id: '',
    swapped_at_scene: '', resolved_at_scene: '',
    trigger_event: '', notes: '',
  });

  const load = () => api.consciousnessSwaps.list().then(r => setSwaps(r.swaps)).catch((e: Error) => setError(e.message));

  useEffect(() => {
    load();
    api.characters.list().then(r => setCharacters(r.characters));
    api.scenes.list().then(r => setScenes(r.scenes));
  }, []);

  const charName = (id: string) => characters.find(c => c.id === id)?.name ?? id;
  const sceneTime = (sceneId: string) => scenes.find(s => s.id === sceneId)?.story_time ?? '';
  const sceneLabel = (s: Scene) => `#${s.narrative_order} ${s.title}`;

  const handleDelete = async (id: string) => {
    if (!confirm('削除しますか？')) return;
    try {
      await api.consciousnessSwaps.delete(id);
      load();
    } catch (e) { setError(String(e)); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const swapped_at = sceneTime(form.swapped_at_scene);
    if (!swapped_at) { setError('シーンの物語時刻が取得できません'); return; }
    const resolved_at = form.resolved_at_scene ? sceneTime(form.resolved_at_scene) : undefined;
    try {
      await api.consciousnessSwaps.create({
        id: form.id,
        from_character_id: form.from_character_id,
        to_character_id: form.to_character_id,
        swapped_at,
        resolved_at: resolved_at || undefined,
        is_suppressed: 1,
        trigger_event: form.trigger_event || undefined,
        notes: form.notes || undefined,
      });
      setShowAdd(false);
      setForm({ id: '', from_character_id: '', to_character_id: '', swapped_at_scene: '', resolved_at_scene: '', trigger_event: '', notes: '' });
      load();
    } catch (e) { setError(String(e)); }
  };

  // 自我回復をシーン選択で行うモーダル用
  const [resolveSwap, setResolveSwap] = useState<ConsciousnessSwap | null>(null);
  const [resolveSceneId, setResolveSceneId] = useState('');

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolveSwap) return;
    const t = sceneTime(resolveSceneId);
    if (!t) { alert('シーンの物語時刻が取得できません'); return; }
    try {
      await api.consciousnessSwaps.update(resolveSwap.id, { resolved_at: t, is_suppressed: 0 });
      setResolveSwap(null);
      setResolveSceneId('');
      load();
    } catch (e) { setError(String(e)); }
  };

  if (error) return <div className="text-red-500">Error: {error}</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">意識の入れ替わり</h2>
          <p className="text-sm text-gray-500 mt-1">体と意識が一致しない状態を管理します</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm">
          + 入れ替わりを記録
        </button>
      </div>

      {swaps.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400">入れ替わりの記録がありません</div>
      ) : (
        <div className="space-y-4">
          {swaps.map(swap => {
            const active = !swap.resolved_at;
            const fromScene = scenes.find(s => s.story_time === swap.swapped_at);
            const toScene = swap.resolved_at ? scenes.find(s => s.story_time === swap.resolved_at) : null;
            return (
              <div key={swap.id} className={`bg-white rounded-xl shadow p-5 border-l-4 ${active ? 'border-red-400' : 'border-gray-300'}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {active && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-medium">進行中</span>}
                    </div>
                    <p className="font-semibold text-gray-900">
                      <span className="text-indigo-600">{swap.from_name ?? charName(swap.from_character_id)}</span>
                      <span className="text-gray-400 mx-2">の意識</span>
                      →
                      <span className="text-red-600 mx-2">{swap.to_name ?? charName(swap.to_character_id)}</span>
                      <span className="text-gray-400">の体に入っている</span>
                    </p>
                    {swap.trigger_event && <p className="text-sm text-gray-500 mt-1">原因: {swap.trigger_event}</p>}
                    {swap.notes && <p className="text-sm text-gray-400 mt-1">{swap.notes}</p>}
                    <p className="text-xs text-gray-400 mt-2">
                      開始シーン: {fromScene ? sceneLabel(fromScene) : swap.swapped_at}
                      {swap.resolved_at && (
                        <span className="ml-3">解消シーン: {toScene ? sceneLabel(toScene) : swap.resolved_at}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4 flex-shrink-0">
                    {active && (
                      <button
                        onClick={() => setResolveSwap(swap)}
                        className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                      >自我回復</button>
                    )}
                    <button onClick={() => handleDelete(swap.id)} className="text-xs px-3 py-1 text-red-400 hover:text-red-600 border border-red-200 rounded">削除</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 自我回復モーダル */}
      {resolveSwap && (
        <Modal title="自我回復を記録" onClose={() => setResolveSwap(null)}>
          <form onSubmit={handleResolveSubmit} className="space-y-4">
            <p className="text-sm text-gray-600">
              <span className="font-semibold">{resolveSwap.from_name ?? charName(resolveSwap.from_character_id)}</span> の自我が回復するシーンを選択してください。
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">自我回復シーン</label>
              <select required value={resolveSceneId} onChange={e => setResolveSceneId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">シーンを選択</option>
                {scenes.map(s => <option key={s.id} value={s.id}>{sceneLabel(s)}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setResolveSwap(null)} className="px-4 py-2 text-sm text-gray-600">キャンセル</button>
              <button type="submit" className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">記録する</button>
            </div>
          </form>
        </Modal>
      )}

      {/* 入れ替わり追加モーダル */}
      {showAdd && (
        <Modal title="意識の入れ替わりを記録" onClose={() => setShowAdd(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ID (必須)</label>
              <input required value={form.id} onChange={e => setForm({...form, id: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="swap-erushii-fana-01" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">入れ替わった意識の持ち主（FROM）</label>
              <select required value={form.from_character_id} onChange={e => setForm({...form, from_character_id: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">選択</option>
                {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">乗り移った体の持ち主（TO）</label>
              <select required value={form.to_character_id} onChange={e => setForm({...form, to_character_id: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">選択</option>
                {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">入れ替わったシーン</label>
              <select required value={form.swapped_at_scene} onChange={e => setForm({...form, swapped_at_scene: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">シーンを選択</option>
                {scenes.map(s => <option key={s.id} value={s.id}>{sceneLabel(s)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">原因となった出来事</label>
              <input value={form.trigger_event} onChange={e => setForm({...form, trigger_event: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="例: ファナによるエルシィ暗殺" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">メモ</label>
              <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-600">キャンセル</button>
              <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">記録する</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
