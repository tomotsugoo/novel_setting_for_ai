import { useEffect, useState } from 'react';
import { api, Character } from '../api';
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

export default function Characters() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<Character | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', role: 'supporting', description: '', secret: '', aliases: '' });
  const [form, setForm] = useState({ id: genId(), name: '', role: 'supporting', description: '', secret: '' });
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = () => api.characters.list().then(r => setCharacters(r.characters)).catch((e: Error) => setError(e.message));

  useEffect(() => { load(); }, []);

  const openSelected = (c: Character) => {
    setSelected(c);
    setEditing(false);
    setEditForm({ name: c.name, role: c.role, description: c.description ?? '', secret: c.secret ?? '', aliases: c.aliases ?? '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.characters.create(form);
      setShowAdd(false);
      setForm({ id: genId(), name: '', role: 'supporting', description: '', secret: '' });
      load();
    } catch (e) {
      setError(String(e));
    }
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
    } catch (e) {
      setError(String(e));
    }
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
    } finally {
      setUploading(false);
    }
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
            <div
              key={c.id}
              onClick={() => openSelected(c)}
              className="bg-white rounded-xl shadow p-4 cursor-pointer hover:shadow-md active:bg-gray-50 transition-shadow"
            >
              <div className="flex items-center gap-3 mb-2">
                <Avatar src={c.avatar} name={c.name} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 truncate">{c.name}</span>
                    <Badge role={c.role} />
                  </div>
                  {c.description && (
                    <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{c.description}</p>
                  )}
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
          <div className="space-y-4 text-sm">
            {/* アイコン */}
            <div className="flex items-center gap-4">
              <Avatar src={selected.avatar} name={selected.name} size="lg" />
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <span className="px-3 py-1.5 text-xs bg-gray-100 rounded-lg text-gray-700 select-none">
                    {uploading ? 'アップロード中...' : '画像を変更'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploading}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleAvatarUpload(file);
                      e.target.value = '';
                    }}
                  />
                </div>
                {selected.avatar && (
                  <button
                    onClick={async () => {
                      await api.characters.update(selected.id, { avatar: null });
                      const updated = { ...selected, avatar: null };
                      setSelected(updated);
                      setCharacters(cs => cs.map(c => c.id === selected.id ? updated : c));
                    }}
                    className="px-3 py-1.5 text-xs text-red-400 hover:text-red-600"
                  >削除</button>
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
        </Modal>
      )}
    </div>
  );
}
