import { useEffect, useState } from 'react';
import { listScenes, createScene, updateScene, Scene } from '../api';
import Modal from '../components/Modal';

const emptyForm = { title: '', narrative_order: '0', story_time: '', location: '', synopsis: '', is_written: false };

export default function Scenes() {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<Scene | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    listScenes()
      .then((r) => { setScenes(r.scenes); setLoading(false); })
      .catch((e) => { setError(String(e)); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm(emptyForm); setShowAdd(true); };
  const openDetail = (s: Scene) => {
    setSelected(s);
    setForm({
      title: s.title,
      narrative_order: String(s.narrative_order),
      story_time: s.story_time ?? '',
      location: s.location ?? '',
      synopsis: s.synopsis ?? '',
      is_written: !!s.is_written,
    });
  };

  const handleAdd = async () => {
    if (!form.title) return;
    setSaving(true);
    try {
      await createScene({ ...form, narrative_order: Number(form.narrative_order) });
      setShowAdd(false);
      load();
    } catch (e) { setError(String(e)); }
    setSaving(false);
  };

  const handleUpdate = async () => {
    if (!selected || !form.title) return;
    setSaving(true);
    try {
      await updateScene(selected.id, { ...form, narrative_order: Number(form.narrative_order) });
      setSelected(null);
      load();
    } catch (e) { setError(String(e)); }
    setSaving(false);
  };

  const toggleWritten = async (s: Scene, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateScene(s.id, { ...s, is_written: s.is_written ? 0 : 1 });
      load();
    } catch (err) { setError(String(err)); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">シーン</h2>
        <button onClick={openAdd} className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700">
          + 追加
        </button>
      </div>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      {loading ? (
        <p className="text-gray-400">読み込み中...</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">タイトル</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">物語時間</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">場所</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">執筆済み</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {scenes.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openDetail(s)}>
                  <td className="px-4 py-3 text-sm text-gray-500">{s.narrative_order}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.title}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{s.story_time ?? '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{s.location ?? '-'}</td>
                  <td className="px-4 py-3 text-sm">
                    <button
                      onClick={(e) => toggleWritten(s, e)}
                      className={`px-2 py-1 rounded text-xs font-medium ${s.is_written ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      {s.is_written ? '✓ 完了' : '未完了'}
                    </button>
                  </td>
                </tr>
              ))}
              {scenes.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">シーンがありません</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="シーン追加">
        <SceneForm form={form} onChange={setForm} />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-600">キャンセル</button>
          <button onClick={handleAdd} disabled={saving} className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {saving ? '保存中...' : '追加'}
          </button>
        </div>
      </Modal>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.title ?? ''}>
        <SceneForm form={form} onChange={setForm} />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setSelected(null)} className="px-4 py-2 text-sm text-gray-600">キャンセル</button>
          <button onClick={handleUpdate} disabled={saving} className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {saving ? '保存中...' : '更新'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function SceneForm({ form, onChange }: { form: Record<string, string | boolean>; onChange: (f: Record<string, string | boolean>) => void }) {
  return (
    <>
      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-700 mb-1">タイトル *</label>
        <input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          value={form.title as string} onChange={(e) => onChange({ ...form, title: e.target.value })} />
      </div>
      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-700 mb-1">順序</label>
        <input type="number" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          value={form.narrative_order as string} onChange={(e) => onChange({ ...form, narrative_order: e.target.value })} />
      </div>
      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-700 mb-1">物語時間</label>
        <input type="text" placeholder="例: 2045-03-15" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          value={form.story_time as string} onChange={(e) => onChange({ ...form, story_time: e.target.value })} />
      </div>
      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-700 mb-1">場所</label>
        <input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          value={form.location as string} onChange={(e) => onChange({ ...form, location: e.target.value })} />
      </div>
      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-700 mb-1">あらすじ</label>
        <textarea rows={3} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          value={form.synopsis as string} onChange={(e) => onChange({ ...form, synopsis: e.target.value })} />
      </div>
      <div className="mb-3 flex items-center gap-2">
        <input type="checkbox" id="is_written" checked={!!form.is_written}
          onChange={(e) => onChange({ ...form, is_written: e.target.checked })} className="rounded" />
        <label htmlFor="is_written" className="text-sm font-medium text-gray-700">執筆済み</label>
      </div>
    </>
  );
}
