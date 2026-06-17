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
  const [form, setForm] = useState({ id: genId(), name: '', role: 'supporting', description: '', secret: '' });
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);


  const load = () => api.characters.list().then(r => setCharacters(r.characters)).catch((e: Error) => setError(e.message));

  useEffect(() => { load(); }, []);

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

  const handleAvatarUpload = async (file: File) => {
    if (!selected) return;
    setUploading(true);
    setError(null);
    try {
      const base64 = await resizeImageToBase64(file, 128);
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
              onClick={() => setSelected(c)}
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
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploading}
                  className="text-xs text-gray-600 file:mr-2 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:text-xs file:bg-gray-100 file:text-gray-700 file:cursor-pointer"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleAvatarUpload(file);
                    e.target.value = '';
                  }}
                />
                {uploading && <span className="text-xs text-gray-400">アップロード中...</span>}
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

            <div><span className="font-medium text-gray-700">役割: </span><Badge role={selected.role} /></div>
            {selected.aliases && <div><span className="font-medium text-gray-700">別名: </span><span className="text-gray-600">{selected.aliases}</span></div>}
            {selected.description && <div><span className="font-medium text-gray-700">説明: </span><p className="text-gray-600 mt-1">{selected.description}</p></div>}
            {selected.secret && <div><span className="font-medium text-gray-700">秘密: </span><p className="text-gray-600 mt-1 bg-yellow-50 p-2 rounded">{selected.secret}</p></div>}
          </div>
        </Modal>
      )}
    </div>
  );
}
