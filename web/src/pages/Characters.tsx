import { useEffect, useState } from 'react';
import { api, Character } from '../api';
import Modal from '../components/Modal';
import Badge from '../components/Badge';

export default function Characters() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<Character | null>(null);
  const [form, setForm] = useState({ id: '', name: '', role: 'supporting', description: '', secret: '' });
  const [error, setError] = useState<string | null>(null);

  const load = () => api.characters.list().then(r => setCharacters(r.characters)).catch((e: Error) => setError(e.message));

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.characters.create(form);
      setShowAdd(false);
      setForm({ id: '', name: '', role: 'supporting', description: '', secret: '' });
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
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">名前</th>
              <th className="px-4 py-3 text-left">役割</th>
              <th className="px-4 py-3 text-left">説明</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {characters.map(c => (
              <tr key={c.id} onClick={() => setSelected(c)} className="hover:bg-gray-50 cursor-pointer">
                <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                <td className="px-4 py-3"><Badge role={c.role} /></td>
                <td className="px-4 py-3 text-gray-500">{c.description ? c.description.slice(0, 50) + (c.description.length > 50 ? '...' : '') : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {characters.length === 0 && <p className="text-gray-500 text-center py-8">キャラクターがいません</p>}
      </div>

      {showAdd && (
        <Modal title="キャラクター追加" onClose={() => setShowAdd(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ID (必須)</label>
              <input required value={form.id} onChange={e => setForm({...form, id: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
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
