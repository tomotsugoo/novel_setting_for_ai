import { useEffect, useState } from 'react';
import { api, Character } from '../api';
import Modal from '../components/Modal';
import Badge from '../components/Badge';
import { genId } from '../utils';

export default function Characters() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<Character | null>(null);
  const [form, setForm] = useState({ id: genId(), name: '', role: 'supporting', description: '', secret: '' });
  const [error, setError] = useState<string | null>(null);

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

  if (error) return <div className="text-red-500">Error: {error}</div>;

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
              <div className="flex items-center gap-2 mb-2">
                <span className="font-semibold text-gray-900 flex-1">{c.name}</span>
                <Badge role={c.role} />
              </div>
              {c.description && (
                <p className="text-sm text-gray-500 line-clamp-2">{c.description}</p>
              )}
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
          <div className="space-y-3 text-sm">
            <div><span className="font-medium text-gray-700">ID: </span><span className="text-gray-600">{selected.id}</span></div>
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
