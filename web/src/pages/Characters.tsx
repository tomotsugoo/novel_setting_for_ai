import { useEffect, useState } from 'react';
import { api, Character, CharacterState, Scene } from '../api';
import Modal from '../components/Modal';
import Badge from '../components/Badge';
import { genId, resizeImageToBase64 } from '../utils';

function Avatar({ src, name, size = 'md' }: { src: string | null; name: string; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-20 h-20 text-2xl' : 'w-10 h-10 text-sm';
  if (src) return <img src={src} alt={name} className={`${sz} rounded-full object-cover shrink-0`} />;
  return (
    <div className={`${sz} rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold shrink-0`}>
      {name.slice(0, 1)}
    </div>
  );
}

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

function StateForm({ f, setF, onSubmit, onClose, label, scenes }: {
  f: { valid_from: string; valid_to: string; appearance: string; status: string; notes: string };
  setF: (v: typeof f) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  label: string;
  scenes: Scene[];
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3 text-sm border-t pt-3 mt-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">この状態になるシーン (必須)</label>
          <SceneSelect value={f.valid_from} onChange={v => setF({...f, valid_from: v})} scenes={scenes} placeholder="シーンを選択" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">この状態が終わるシーン</label>
          <SceneSelect value={f.valid_to} onChange={v => setF({...f, valid_to: v})} scenes={scenes} placeholder="（ずっと有効）" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">外見</label>
        <textarea value={f.appearance} onChange={e => setF({...f, appearance: e.target.value})} className="w-full border rounded px-2 py-1 text-sm" rows={2} />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">生死・状態</label>
        <input value={f.status} onChange={e => setF({...f, status: e.target.value})} className="w-full border rounded px-2 py-1 text-sm" placeholder="例: 生存、死亡、負傷" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">メモ</label>
        <textarea value={f.notes} onChange={e => setF({...f, notes: e.target.value})} className="w-full border rounded px-2 py-1 text-sm" rows={2} />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-3 py-1 text-sm text-gray-600">キャンセル</button>
        <button type="submit" className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700">{label}</button>
      </div>
    </form>
  );
}

const emptyStateForm = { valid_from: '', valid_to: '', appearance: '', status: '', notes: '' };

export default function Characters() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<Character | null>(null);
  const [charTab, setCharTab] = useState<'info' | 'states'>('info');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', role: 'supporting', description: '', secret: '', aliases: '' });
  const [form, setForm] = useState({ id: genId(), name: '', role: 'supporting', description: '', secret: '' });
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [states, setStates] = useState<CharacterState[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [showAddState, setShowAddState] = useState(false);
  const [addStateForm, setAddStateForm] = useState(emptyStateForm);
  const [editStateId, setEditStateId] = useState<string | null>(null);
  const [editStateForm, setEditStateForm] = useState(emptyStateForm);

  const load = () => api.characters.list().then(r => setCharacters(r.characters)).catch((e: Error) => setError(e.message));

  useEffect(() => {
    load();
    api.scenes.list().then(r => setScenes(r.scenes));
  }, []);

  const loadStates = (charId: string) =>
    api.characterStates.list(charId).then(r => setStates(r.states)).catch(() => setStates([]));

  const openSelected = (c: Character) => {
    setSelected(c);
    setCharTab('info');
    setEditing(false);
    setEditForm({ name: c.name, role: c.role, description: c.description ?? '', secret: c.secret ?? '', aliases: c.aliases ?? '' });
    loadStates(c.id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.characters.create(form);
      setShowAdd(false);
      setForm({ id: genId(), name: '', role: 'supporting', description: '', secret: '' });
      load();
    } catch (e) { setError(String(e)); }
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    try {
      await api.characters.update(selected.id, editForm);
      const updated = { ...selected, ...editForm };
      setSelected(updated);
      setCharacters(cs => cs.map(c => c.id === selected.id ? updated : c));
      setEditing(false);
    } catch (e) { setError(String(e)); }
  };

  const handleAvatarUpload = async (file: File) => {
    if (!selected) return;
    setUploading(true);
    setError(null);
    try {
      const base64 = await resizeImageToBase64(file, 256);
      await api.characters.update(selected.id, { avatar: base64 });
      const updated = { ...selected, avatar: base64 };
      setSelected(updated);
      setCharacters(cs => cs.map(c => c.id === selected.id ? updated : c));
    } catch (e) {
      alert('画像アップロード失敗: ' + String(e));
      setError(String(e));
    } finally { setUploading(false); }
  };

  const handleAddState = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    try {
      await api.characterStates.create({ id: genId(), character_id: selected.id, valid_from: addStateForm.valid_from, valid_to: addStateForm.valid_to || undefined, appearance: addStateForm.appearance || undefined, status: addStateForm.status || undefined, notes: addStateForm.notes || undefined });
      setShowAddState(false);
      setAddStateForm(emptyStateForm);
      loadStates(selected.id);
    } catch (e) { setError(String(e)); }
  };

  const handleEditState = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStateId || !selected) return;
    try {
      await api.characterStates.update(editStateId, { valid_from: editStateForm.valid_from, valid_to: editStateForm.valid_to || null, appearance: editStateForm.appearance || null, status: editStateForm.status || null, notes: editStateForm.notes || null });
      setEditStateId(null);
      loadStates(selected.id);
    } catch (e) { setError(String(e)); }
  };

  const handleDeleteState = async (id: string) => {
    if (!selected || !confirm('削除しますか？')) return;
    try {
      await api.characterStates.delete(id);
      loadStates(selected.id);
    } catch (e) { setError(String(e)); }
  };

  const openEditState = (s: CharacterState) => {
    setEditStateId(s.id);
    setEditStateForm({ valid_from: s.valid_from, valid_to: s.valid_to ?? '', appearance: s.appearance ?? '', status: s.status ?? '', notes: s.notes ?? '' });
  };

  if (error && !selected) return <div className="text-red-500">Error: {error}</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">キャラクター</h2>
        <button onClick={() => setShowAdd(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm">
          + キャラクター追加
        </button>
      </div>
      {characters.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400">キャラクターがいません</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {characters.map(c => (
            <div key={c.id} onClick={() => openSelected(c)} className="bg-white rounded-xl shadow p-4 cursor-pointer hover:shadow-md active:bg-gray-50 transition-shadow">
              <div className="flex items-center gap-3 mb-2">
                <Avatar src={c.avatar} name={c.name} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 truncate">{c.name}</span>
                    <Badge role={c.role} />
                  </div>
                  {c.description && <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{c.description}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <Modal title="キャラクター追加" onClose={() => setShowAdd(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">名前 (必須)</label>
              <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">役割</label>
              <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="protagonist">主人公</option>
                <option value="antagonist">敵</option>
                <option value="supporting">サブ</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
              <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" rows={3} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">秘密</label>
              <textarea value={form.secret} onChange={e => setForm({...form, secret: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">キャンセル</button>
              <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">追加</button>
            </div>
          </form>
        </Modal>
      )}

      {selected && (
        <Modal title={selected.name} onClose={() => setSelected(null)}>
          {/* タブ */}
          <div className="flex border-b mb-4">
            <button onClick={() => setCharTab('info')} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${charTab === 'info' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>基本情報</button>
            <button onClick={() => setCharTab('states')} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${charTab === 'states' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              外見・状態履歴{states.length > 0 ? `（${states.length}）` : ''}
            </button>
          </div>

          {charTab === 'states' ? (
            <div className="space-y-3 text-sm">
              {states.length === 0 ? (
                <p className="text-gray-400 text-center py-4">状態が登録されていません</p>
              ) : (
                <div className="space-y-2">
                  {states.map(s => (
                    <div key={s.id} className="border rounded-lg p-3 bg-gray-50">
                      {editStateId === s.id ? (
                        <StateForm f={editStateForm} setF={setEditStateForm} onSubmit={handleEditState} onClose={() => setEditStateId(null)} label="保存" scenes={scenes} />
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <span className="text-xs text-gray-500">{sceneTitle(s.valid_from, scenes) ?? s.valid_from} 〜 {s.valid_to ? (sceneTitle(s.valid_to, scenes) ?? s.valid_to) : 'ずっと有効'}</span>
                            <div className="flex gap-2 shrink-0">
                              <button onClick={() => openEditState(s)} className="text-xs text-indigo-500 hover:text-indigo-700">編集</button>
                              <button onClick={() => handleDeleteState(s.id)} className="text-xs text-red-400 hover:text-red-600">削除</button>
                            </div>
                          </div>
                          {s.status && <p className="text-xs"><span className="text-gray-500">状態: </span>{s.status}</p>}
                          {s.appearance && <p className="text-xs mt-1"><span className="text-gray-500">外見: </span>{s.appearance}</p>}
                          {s.notes && <p className="text-xs mt-1 text-gray-500">{s.notes}</p>}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {showAddState ? (
                <StateForm f={addStateForm} setF={setAddStateForm} onSubmit={handleAddState} onClose={() => setShowAddState(false)} label="追加" scenes={scenes} />
              ) : (
                <button onClick={() => setShowAddState(true)} className="w-full py-2 text-sm text-indigo-600 border border-dashed border-indigo-300 rounded-lg hover:bg-indigo-50">+ 状態を追加</button>
              )}
            </div>
          ) : (
            <div className="space-y-4 text-sm">
              {/* アイコン */}
              <div className="flex items-center gap-4">
                <Avatar src={selected.avatar} name={selected.name} size="lg" />
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <span className="px-3 py-1.5 text-xs bg-gray-100 rounded-lg text-gray-700 select-none">
                      {uploading ? 'アップロード中...' : '画像を変更'}
                    </span>
                    <input type="file" accept="image/*" disabled={uploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={e => { const file = e.target.files?.[0]; if (file) handleAvatarUpload(file); e.target.value = ''; }} />
                  </div>
                  {selected.avatar && (
                    <button onClick={async () => { await api.characters.update(selected.id, { avatar: null }); const updated = { ...selected, avatar: null }; setSelected(updated); setCharacters(cs => cs.map(c => c.id === selected.id ? updated : c)); }} className="px-3 py-1.5 text-xs text-red-400 hover:text-red-600">削除</button>
                  )}
                </div>
              </div>

              {editing ? (
                <form onSubmit={handleEditSave} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">名前</label>
                    <input required value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">役割</label>
                    <select value={editForm.role} onChange={e => setEditForm({...editForm, role: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                      <option value="protagonist">主人公</option>
                      <option value="antagonist">敵</option>
                      <option value="supporting">サブ</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">別名</label>
                    <input value={editForm.aliases} onChange={e => setEditForm({...editForm, aliases: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">説明</label>
                    <textarea value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" rows={3} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">秘密</label>
                    <textarea value={editForm.secret} onChange={e => setEditForm({...editForm, secret: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} />
                  </div>
                  <div className="flex justify-end gap-3 pt-1">
                    <button type="button" onClick={() => setEditing(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">キャンセル</button>
                    <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">保存</button>
                  </div>
                </form>
              ) : (
                <>
                  <div><span className="font-medium text-gray-700">役割: </span><Badge role={selected.role} /></div>
                  {selected.aliases && <div><span className="font-medium text-gray-700">別名: </span><span className="text-gray-600">{selected.aliases}</span></div>}
                  {selected.description && <div><span className="font-medium text-gray-700">説明: </span><p className="text-gray-600 mt-1">{selected.description}</p></div>}
                  {selected.secret && <div><span className="font-medium text-gray-700">秘密: </span><p className="text-gray-600 mt-1 bg-yellow-50 p-2 rounded">{selected.secret}</p></div>}
                  <div className="flex justify-end pt-1">
                    <button onClick={() => setEditing(true)} className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">編集</button>
                  </div>
                </>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
