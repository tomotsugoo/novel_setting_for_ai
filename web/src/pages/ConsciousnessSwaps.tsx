import { useEffect, useState } from 'react';
import { api, ConsciousnessSwap, Character, Scene } from '../api';
import Modal from '../components/Modal';
import { genId } from '../utils';

type SwapFormData = { from_character_id: string; source_body_id: string; to_character_id: string; swapped_at_scene: string; resolved_at_scene: string; ego_recovered_at_scene: string; trigger_event: string; notes: string };

function SwapForm({ f, setF, onSubmit, onClose, submitLabel, characters, scenes }: {
  f: SwapFormData;
  setF: (v: SwapFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  submitLabel: string;
  characters: Character[];
  scenes: Scene[];
}) {
  const sceneLabel = (s: Scene) => `#${s.narrative_order ?? '-'} ${s.title}`;
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">入れ替わった意識の持ち主（FROM）</label>
        <select required value={f.from_character_id} onChange={e => setF({...f, from_character_id: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
          <option value="">選択</option>
          {characters.map(c => <option key={c.id} value={c.id}>{c.name}{c.aliases ? `（${c.aliases}）` : ''}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">元の体の持ち主（意識が出た体）</label>
        <select value={f.source_body_id} onChange={e => setF({...f, source_body_id: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
          <option value="">意識の持ち主と同じ</option>
          {characters.map(c => <option key={c.id} value={c.id}>{c.name}{c.aliases ? `（${c.aliases}）` : ''}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">乗り移った体の持ち主（意識が入った体）</label>
        <select required value={f.to_character_id} onChange={e => setF({...f, to_character_id: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
          <option value="">選択</option>
          {characters.map(c => <option key={c.id} value={c.id}>{c.name}{c.aliases ? `（${c.aliases}）` : ''}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">入れ替わったシーン</label>
        <select required value={f.swapped_at_scene} onChange={e => setF({...f, swapped_at_scene: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
          <option value="">シーンを選択</option>
          {scenes.map(s => <option key={s.id} value={s.id}>{sceneLabel(s)}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">自我回復シーン（任意）※意識の持ち主が自分を認識するシーン</label>
        <select value={f.ego_recovered_at_scene} onChange={e => setF({...f, ego_recovered_at_scene: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
          <option value="">（未回復）</option>
          {scenes.map(s => <option key={s.id} value={s.id}>{sceneLabel(s)}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">入れ替わり終了シーン（任意）※体の死亡・別の体への移動が起きるシーン</label>
        <select value={f.resolved_at_scene} onChange={e => setF({...f, resolved_at_scene: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
          <option value="">（未終了）</option>
          {scenes.map(s => <option key={s.id} value={s.id}>{sceneLabel(s)}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">原因となった出来事</label>
        <input value={f.trigger_event} onChange={e => setF({...f, trigger_event: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="例: ファナによるエルシィ暗殺" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">メモ</label>
        <textarea value={f.notes} onChange={e => setF({...f, notes: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600">キャンセル</button>
        <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">{submitLabel}</button>
      </div>
    </form>
  );
}

export default function ConsciousnessSwaps() {
  const [swaps, setSwaps] = useState<ConsciousnessSwap[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editSwap, setEditSwap] = useState<ConsciousnessSwap | null>(null);
  const [editForm, setEditForm] = useState<SwapFormData>({ from_character_id: '', source_body_id: '', to_character_id: '', swapped_at_scene: '', resolved_at_scene: '', ego_recovered_at_scene: '', trigger_event: '', notes: '' });
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<SwapFormData & { id: string }>({
    id: genId(), from_character_id: '', source_body_id: '', to_character_id: '',
    swapped_at_scene: '', resolved_at_scene: '', ego_recovered_at_scene: '',
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
  const sceneByTime = (t: string) => scenes.find(s => s.story_time === t);
  const sceneLabel = (s: Scene) => `#${s.narrative_order ?? '-'} ${s.title}`;

  const openEdit = (swap: ConsciousnessSwap) => {
    const swappedScene = sceneByTime(swap.swapped_at);
    const resolvedScene = swap.resolved_at ? sceneByTime(swap.resolved_at) : null;
    const egoRecoveredScene = swap.ego_recovered_at ? sceneByTime(swap.ego_recovered_at) : null;
    setEditForm({
      from_character_id: swap.from_character_id,
      source_body_id: swap.source_body_id ?? '',
      to_character_id: swap.to_character_id,
      swapped_at_scene: swappedScene?.id ?? '',
      resolved_at_scene: resolvedScene?.id ?? '',
      ego_recovered_at_scene: egoRecoveredScene?.id ?? '',
      trigger_event: swap.trigger_event ?? '',
      notes: swap.notes ?? '',
    });
    setEditSwap(swap);
  };

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
    const ego_recovered_at = form.ego_recovered_at_scene ? sceneTime(form.ego_recovered_at_scene) : undefined;
    try {
      await api.consciousnessSwaps.create({
        id: form.id,
        from_character_id: form.from_character_id,
        source_body_id: form.source_body_id || null,
        to_character_id: form.to_character_id,
        swapped_at,
        resolved_at: resolved_at || undefined,
        ego_recovered_at: ego_recovered_at || undefined,
        trigger_event: form.trigger_event || undefined,
        notes: form.notes || undefined,
      });
      setShowAdd(false);
      setForm({ id: genId(), from_character_id: '', source_body_id: '', to_character_id: '', swapped_at_scene: '', resolved_at_scene: '', ego_recovered_at_scene: '', trigger_event: '', notes: '' });
      load();
    } catch (e) { setError(String(e)); }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSwap) return;
    const swapped_at = sceneTime(editForm.swapped_at_scene);
    if (!swapped_at) { setError('シーンの物語時刻が取得できません'); return; }
    const resolved_at = editForm.resolved_at_scene ? sceneTime(editForm.resolved_at_scene) : null;
    const ego_recovered_at = editForm.ego_recovered_at_scene ? sceneTime(editForm.ego_recovered_at_scene) : null;
    try {
      await api.consciousnessSwaps.update(editSwap.id, {
        from_character_id: editForm.from_character_id,
        source_body_id: editForm.source_body_id || null,
        to_character_id: editForm.to_character_id,
        swapped_at,
        resolved_at,
        ego_recovered_at,
        trigger_event: editForm.trigger_event || null,
        notes: editForm.notes || null,
      });
      setEditSwap(null);
      load();
    } catch (e) { setError(String(e)); }
  };

  // 自我回復モーダル（ego_recovered_at を設定）
  const [egoRecoverSwap, setEgoRecoverSwap] = useState<ConsciousnessSwap | null>(null);
  const [egoRecoverSceneId, setEgoRecoverSceneId] = useState('');

  const handleEgoRecoverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!egoRecoverSwap) return;
    const t = sceneTime(egoRecoverSceneId);
    if (!t) { alert('シーンの物語時刻が取得できません'); return; }
    try {
      await api.consciousnessSwaps.update(egoRecoverSwap.id, { ego_recovered_at: t });
      setEgoRecoverSwap(null);
      setEgoRecoverSceneId('');
      load();
    } catch (e) { setError(String(e)); }
  };

  // 入れ替わり終了モーダル（resolved_at を設定）
  const [resolveSwap, setResolveSwap] = useState<ConsciousnessSwap | null>(null);
  const [resolveSceneId, setResolveSceneId] = useState('');

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolveSwap) return;
    const t = sceneTime(resolveSceneId);
    if (!t) { alert('シーンの物語時刻が取得できません'); return; }
    try {
      await api.consciousnessSwaps.update(resolveSwap.id, { resolved_at: t });
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
            const fromScene = sceneByTime(swap.swapped_at);
            const toScene = swap.resolved_at ? sceneByTime(swap.resolved_at) : null;
            const egoScene = swap.ego_recovered_at ? sceneByTime(swap.ego_recovered_at) : null;
            return (
              <div key={swap.id} className={`bg-white rounded-xl shadow p-5 border-l-4 ${active ? 'border-red-400' : 'border-gray-300'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {active && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-medium">進行中</span>}
                    </div>
                    <p className="font-semibold text-gray-900">
                      <span className="text-indigo-600">{swap.from_name ?? charName(swap.from_character_id)}</span>
                      <span className="text-gray-400 mx-1">の意識が</span>
                      <span className="text-gray-500">{swap.source_body_name ?? (swap.source_body_id ? charName(swap.source_body_id) : (swap.from_name ?? charName(swap.from_character_id)))}</span>
                      <span className="text-gray-400 mx-1">の体から</span>
                      <span className="text-red-600">{swap.to_name ?? charName(swap.to_character_id)}</span>
                      <span className="text-gray-400 ml-1">の体へ</span>
                    </p>
                    {swap.trigger_event && <p className="text-sm text-gray-500 mt-1">原因: {swap.trigger_event}</p>}
                    {swap.notes && <p className="text-sm text-gray-400 mt-1">{swap.notes}</p>}
                    <p className="text-xs text-gray-400 mt-2">
                      開始シーン: {fromScene ? sceneLabel(fromScene) : swap.swapped_at}
                      {swap.ego_recovered_at && (
                        <span className="ml-3">自我回復: {egoScene ? sceneLabel(egoScene) : swap.ego_recovered_at}</span>
                      )}
                      {swap.resolved_at && (
                        <span className="ml-3">入れ替わり終了: {toScene ? sceneLabel(toScene) : swap.resolved_at}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4 flex-shrink-0 flex-wrap justify-end">
                    {!swap.ego_recovered_at && (
                      <button onClick={() => { setEgoRecoverSwap(swap); setEgoRecoverSceneId(''); }} className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">自我回復を記録</button>
                    )}
                    {active && (
                      <button onClick={() => { setResolveSwap(swap); setResolveSceneId(''); }} className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700">入れ替わり終了</button>
                    )}
                    <button onClick={() => openEdit(swap)} className="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">編集</button>
                    <button onClick={() => handleDelete(swap.id)} className="text-xs px-3 py-1 text-red-400 hover:text-red-600 border border-red-200 rounded">削除</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 編集モーダル */}
      {editSwap && (
        <Modal title="入れ替わりを編集" onClose={() => setEditSwap(null)}>
          <SwapForm f={editForm} setF={setEditForm} onSubmit={handleEditSubmit} onClose={() => setEditSwap(null)} submitLabel="保存" characters={characters} scenes={scenes} />
        </Modal>
      )}

      {/* 自我回復モーダル */}
      {egoRecoverSwap && (
        <Modal title="自我回復を記録" onClose={() => setEgoRecoverSwap(null)}>
          <form onSubmit={handleEgoRecoverSubmit} className="space-y-4">
            <p className="text-sm text-gray-600">
              <span className="font-semibold">{egoRecoverSwap.from_name ?? charName(egoRecoverSwap.from_character_id)}</span> が自分を認識するシーンを選択してください。
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">自我回復シーン</label>
              <select required value={egoRecoverSceneId} onChange={e => setEgoRecoverSceneId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">シーンを選択</option>
                {scenes.map(s => <option key={s.id} value={s.id}>{sceneLabel(s)}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setEgoRecoverSwap(null)} className="px-4 py-2 text-sm text-gray-600">キャンセル</button>
              <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">記録する</button>
            </div>
          </form>
        </Modal>
      )}

      {/* 入れ替わり終了モーダル */}
      {resolveSwap && (
        <Modal title="入れ替わり終了を記録" onClose={() => setResolveSwap(null)}>
          <form onSubmit={handleResolveSubmit} className="space-y-4">
            <p className="text-sm text-gray-600">
              <span className="font-semibold">{resolveSwap.from_name ?? charName(resolveSwap.from_character_id)}</span> の体の死亡・別の体への移動が起きるシーンを選択してください。
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">入れ替わり終了シーン</label>
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
          <SwapForm f={form} setF={v => setForm({ ...v, id: form.id })} onSubmit={handleSubmit} onClose={() => setShowAdd(false)} submitLabel="記録する" characters={characters} scenes={scenes} />
        </Modal>
      )}
    </div>
  );
}
