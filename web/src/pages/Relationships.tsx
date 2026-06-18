import { useEffect, useState } from 'react';
import { api, Character, Relationship, Scene } from '../api';
import { genId } from '../utils';

const emptyForm = { character_id_a: '', character_id_b: '', relation_type: '', is_public: 0, valid_from_scene: '', valid_to_scene: '', notes: '' };

function SceneSelect({ value, onChange, scenes, placeholder }: { value: string; onChange: (v: string) => void; scenes: Scene[]; placeholder: string }) {
  const sorted = [...scenes].filter(s => s.story_time).sort((a, b) => (a.narrative_order ?? 9999) - (b.narrative_order ?? 9999));
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm">
      <option value="">{placeholder}</option>
      {sorted.map(s => (
        <option key={s.id} value={s.story_time!}>
          {s.narrative_order != null ? `#${s.narrative_order} ` : ''}{s.title}
        </option>
      ))}
    </select>
  );
}

function sceneTitle(storyTime: string | null, scenes: Scene[]) {
  if (!storyTime) return null;
  const s = scenes.find(sc => sc.story_time === storyTime);
  return s ? `#${s.narrative_order ?? '-'} ${s.title}` : storyTime;
}

export default function Relationships() {
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const [r, c, s] = await Promise.all([api.relationships.list(), api.characters.list(), api.scenes.list()]);
      setRelationships(r.relationships);
      setCharacters(c.characters);
      setScenes(s.scenes);
    } catch (e) { setError(String(e)); }
  };

  useEffect(() => { load(); }, []);

  const charLabel = (c: Character) => c.name + (c.aliases ? `（${c.aliases}）` : '');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.relationships.create({
        id: genId(),
        character_id_a: form.character_id_a,
        character_id_b: form.character_id_b,
        relation_type: form.relation_type,
        is_public: form.is_public,
        valid_from: form.valid_from_scene || undefined,
        valid_to: form.valid_to_scene || undefined,
        notes: form.notes || undefined,
      });
      setShowAdd(false);
      setForm(emptyForm);
      load();
    } catch (e) { setError(String(e)); }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId) return;
    try {
      await api.relationships.update(editId, {
        relation_type: editForm.relation_type,
        is_public: editForm.is_public,
        valid_from: editForm.valid_from_scene || null,
        valid_to: editForm.valid_to_scene || null,
        notes: editForm.notes || null,
      });
      setEditId(null);
      load();
    } catch (e) { setError(String(e)); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('削除しますか？')) return;
    try {
      await api.relationships.delete(id);
      load();
    } catch (e) { setError(String(e)); }
  };

  const openEdit = (r: Relationship) => {
    setEditId(r.id);
    setEditForm({ character_id_a: r.character_id_a, character_id_b: r.character_id_b, relation_type: r.relation_type, is_public: r.is_public, valid_from_scene: r.valid_from ?? '', valid_to_scene: r.valid_to ?? '', notes: r.notes ?? '' });
  };

  if (error) return <div className="text-red-500">Error: {error}</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">関係性</h2>
        <button onClick={() => setShowAdd(!showAdd)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm">
          + 関係性追加
        </button>
      </div>

      {showAdd && (
        <div className="bg-white rounded-xl shadow p-4 mb-4">
          <h3 className="font-semibold text-gray-700 mb-3 text-sm">新規追加</h3>
          <form onSubmit={handleAdd} className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">キャラA (必須)</label>
                <select required value={form.character_id_a} onChange={e => setForm({...form, character_id_a: e.target.value})} className="w-full border rounded px-2 py-1.5 text-sm">
                  <option value="">選択</option>
                  {characters.map(c => <option key={c.id} value={c.id}>{charLabel(c)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">キャラB (必須)</label>
                <select required value={form.character_id_b} onChange={e => setForm({...form, character_id_b: e.target.value})} className="w-full border rounded px-2 py-1.5 text-sm">
                  <option value="">選択</option>
                  {characters.map(c => <option key={c.id} value={c.id}>{charLabel(c)}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">関係の種類 (必須)</label>
              <input required value={form.relation_type} onChange={e => setForm({...form, relation_type: e.target.value})} className="w-full border rounded px-2 py-1.5 text-sm" placeholder="例: 幼馴染、師弟、恋人、敵対" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">有効開始シーン</label>
                <SceneSelect value={form.valid_from_scene} onChange={v => setForm({...form, valid_from_scene: v})} scenes={scenes} placeholder="（最初から）" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">有効終了シーン</label>
                <SceneSelect value={form.valid_to_scene} onChange={v => setForm({...form, valid_to_scene: v})} scenes={scenes} placeholder="（現在も有効）" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_public_add" checked={form.is_public === 1} onChange={e => setForm({...form, is_public: e.target.checked ? 1 : 0})} className="rounded" />
              <label htmlFor="is_public_add" className="text-xs text-gray-600">公開情報（読者に開示済み）</label>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">メモ</label>
              <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full border rounded px-2 py-1 text-sm" rows={2} />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-sm text-gray-600">キャンセル</button>
              <button type="submit" className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700">追加</button>
            </div>
          </form>
        </div>
      )}

      {relationships.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400">関係性が登録されていません</div>
      ) : (
        <div className="space-y-2">
          {relationships.map(r => (
            <div key={r.id} className="bg-white rounded-xl shadow p-4">
              {editId === r.id ? (
                <form onSubmit={handleEdit} className="space-y-3 text-sm">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">関係の種類</label>
                    <input required value={editForm.relation_type} onChange={e => setEditForm({...editForm, relation_type: e.target.value})} className="w-full border rounded px-2 py-1.5 text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">有効開始シーン</label>
                      <SceneSelect value={editForm.valid_from_scene} onChange={v => setEditForm({...editForm, valid_from_scene: v})} scenes={scenes} placeholder="（最初から）" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">有効終了シーン</label>
                      <SceneSelect value={editForm.valid_to_scene} onChange={v => setEditForm({...editForm, valid_to_scene: v})} scenes={scenes} placeholder="（現在も有効）" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={editForm.is_public === 1} onChange={e => setEditForm({...editForm, is_public: e.target.checked ? 1 : 0})} className="rounded" />
                    <span className="text-xs text-gray-600">公開情報</span>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">メモ</label>
                    <textarea value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value})} className="w-full border rounded px-2 py-1 text-sm" rows={2} />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setEditId(null)} className="px-3 py-1 text-sm text-gray-600">キャンセル</button>
                    <button type="submit" className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700">保存</button>
                  </div>
                </form>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{r.name_a}</span>
                      <span className="text-sm text-indigo-600 font-medium">⇔ {r.relation_type}</span>
                      <span className="font-medium text-gray-900">{r.name_b}</span>
                      {r.is_public ? (
                        <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">公開</span>
                      ) : (
                        <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">非公開</span>
                      )}
                    </div>
                    {(r.valid_from || r.valid_to) && (
                      <p className="text-xs text-gray-400">
                        {r.valid_from ? sceneTitle(r.valid_from, scenes) : '最初から'} 〜 {r.valid_to ? sceneTitle(r.valid_to, scenes) : '現在も有効'}
                      </p>
                    )}
                    {r.notes && <p className="text-xs text-gray-500 mt-1">{r.notes}</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => openEdit(r)} className="text-xs text-indigo-500 hover:text-indigo-700">編集</button>
                    <button onClick={() => handleDelete(r.id)} className="text-xs text-red-400 hover:text-red-600">削除</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
