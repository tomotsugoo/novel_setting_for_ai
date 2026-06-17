import { useEffect, useState } from 'react';
import { api, Scene } from '../api';
import Modal from '../components/Modal';

export default function Scenes() {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ id: '', title: '', story_time: '', narrative_order: '', location: '', disclosure_notes: '' });
  const [error, setError] = useState<string | null>(null);

  const load = () => api.scenes.list().then(r => setScenes(r.scenes)).catch((e: Error) => setError(e.message));

  useEffect(() => { load(); }, []);

  const toggleWritten = async (scene: Scene) => {
    try {
      await api.scenes.update(scene.id, { is_written: scene.is_written ? 0 : 1 });
      load();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.scenes.create({
        ...form,
        narrative_order: form.narrative_order ? Number(form.narrative_order) : undefined,
      });
      setShowAdd(false);
      setForm({ id: '', title: '', story_time: '', narrative_order: '', location: '', disclosure_notes: '' });
      load();
    } catch (e) {
      setError(String(e));
    }
  };

  if (error) return <div className="text-red-500">Error: {error}</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">シーン</h2>
        <button onClick={() => setShowAdd(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm">
          + シーン追加
        </button>
      </div>
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">タイトル</th>
              <th className="px-4 py-3 text-left">物語時間</th>
              <th className="px-4 py-3 text-left">場所</th>
              <th className="px-4 py-3 text-center">執筆済</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {scenes.map(s => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500">{s.narrative_order ?? '-'}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{s.title}</td>
                <td className="px-4 py-3 text-gray-500">{s.story_time ?? '-'}</td>
                <td className="px-4 py-3 text-gray-500">{s.location ?? '-'}</td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => toggleWritten(s)} className="text-lg" title="クリックで切替">
                    {s.is_written ? '✓' : '-'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {scenes.length === 0 && <p className="text-gray-500 text-center py-8">シーンがありません</p>}
      </div>

      {showAdd && (
        <Modal title="シーン追加" onClose={() => setShowAdd(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ID (必須)</label>
              <input required value={form.id} onChange={e => setForm({...form, id: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">タイトル (必須)</label>
              <input required value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">物語内時間</label>
              <input value={form.story_time} onChange={e => setForm({...form, story_time: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="例: 2024-01-15" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">物語上の順番</label>
              <input type="number" value={form.narrative_order} onChange={e => setForm({...form, narrative_order: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">場所</label>
              <input value={form.location} onChange={e => setForm({...form, location: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">開示メモ</label>
              <textarea value={form.disclosure_notes} onChange={e => setForm({...form, disclosure_notes: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">キャンセル</button>
              <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">追加</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
