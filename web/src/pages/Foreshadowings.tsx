import { useEffect, useState } from 'react';
import { api, Foreshadowing, Scene } from '../api';
import Modal from '../components/Modal';

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  open: { label: '未回収', cls: 'bg-amber-100 text-amber-800' },
  resolved: { label: '回収済み', cls: 'bg-green-100 text-green-700' },
  dropped: { label: '破棄', cls: 'bg-gray-100 text-gray-500' },
};

type FormState = {
  title: string; detail: string; planted_scene_id: string;
  payoff_scene_id: string; status: 'open' | 'resolved' | 'dropped';
  reader_effect: string; notes: string;
};
const emptyForm: FormState = { title: '', detail: '', planted_scene_id: '', payoff_scene_id: '', status: 'open', reader_effect: '', notes: '' };

function SceneOption({ scenes }: { scenes: Scene[] }) {
  const sorted = [...scenes].sort((a, b) => (a.narrative_order ?? 9999) - (b.narrative_order ?? 9999));
  return (
    <>
      {sorted.map(s => (
        <option key={s.id} value={s.id}>
          {s.narrative_order != null ? `#${s.narrative_order} ` : ''}{s.title}
        </option>
      ))}
    </>
  );
}

export default function Foreshadowings() {
  const [items, setItems] = useState<Foreshadowing[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved' | 'dropped'>('all');
  const [error, setError] = useState<string | null>(null);

  const load = () => api.foreshadowings.list().then(r => setItems(r.foreshadowings)).catch((e: Error) => setError(e.message));

  useEffect(() => {
    load();
    api.scenes.list().then(r => setScenes(r.scenes));
  }, []);

  const openAdd = () => { setForm(emptyForm); setEditId(null); setShowForm(true); };
  const openEdit = (f: Foreshadowing) => {
    setForm({
      title: f.title, detail: f.detail ?? '', planted_scene_id: f.planted_scene_id ?? '',
      payoff_scene_id: f.payoff_scene_id ?? '', status: f.status,
      reader_effect: f.reader_effect ?? '', notes: f.notes ?? '',
    });
    setEditId(f.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      title: form.title,
      detail: form.detail || null,
      planted_scene_id: form.planted_scene_id || null,
      payoff_scene_id: form.payoff_scene_id || null,
      status: form.status,
      reader_effect: form.reader_effect || null,
      notes: form.notes || null,
    };
    try {
      if (editId) {
        await api.foreshadowings.update(editId, data);
      } else {
        await api.foreshadowings.create(data);
      }
      setShowForm(false);
      setEditId(null);
      setForm(emptyForm);
      load();
    } catch (e) { setError(String(e)); }
  };

  const markResolved = async (f: Foreshadowing) => {
    try {
      await api.foreshadowings.update(f.id, { status: 'resolved' });
      load();
    } catch (e) { setError(String(e)); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('この伏線を削除しますか？')) return;
    try {
      await api.foreshadowings.delete(id);
      load();
    } catch (e) { setError(String(e)); }
  };

  if (error) return <div className="text-red-500">Error: {error}</div>;

  const filtered = filter === 'all' ? items : items.filter(f => f.status === filter);
  const openCount = items.filter(f => f.status === 'open').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-bold text-gray-800">伏線</h2>
        <button onClick={openAdd} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm">
          + 伏線追加
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        未回収 {openCount} 件 ／ 全 {items.length} 件。AIが執筆するとき、そのシーンで張る・回収する伏線が自動で渡されます。
      </p>

      <div className="flex gap-2 mb-4">
        {(['all', 'open', 'resolved', 'dropped'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium ${filter === f ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border'}`}
          >
            {f === 'all' ? 'すべて' : STATUS_LABELS[f].label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400">
          {items.length === 0 ? '伏線がまだ登録されていません。「どこで張って・どこで回収するか」を登録すると、AIの書き忘れ防止と整合性チェックに使われます。' : '該当する伏線がありません'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(f => {
            const st = STATUS_LABELS[f.status] ?? STATUS_LABELS.open;
            return (
              <div key={f.id} className="bg-white rounded-xl shadow p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                      <span className="font-medium text-gray-900">{f.title}</span>
                    </div>
                    {f.detail && <p className="text-sm text-gray-600 whitespace-pre-wrap">{f.detail}</p>}
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-gray-400">
                      {f.planted_scene_title && <span>🌱 張る: {f.planted_scene_title}</span>}
                      {f.payoff_scene_title && <span>🎯 回収: {f.payoff_scene_title}</span>}
                    </div>
                    {f.reader_effect && (
                      <p className="text-xs text-purple-600 mt-1 bg-purple-50 rounded px-2 py-1 inline-block">
                        回収時の狙い: {f.reader_effect}
                      </p>
                    )}
                    {f.notes && <p className="text-xs text-gray-400 mt-1">{f.notes}</p>}
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0 items-end">
                    {f.status === 'open' && (
                      <button onClick={() => markResolved(f)} className="text-xs text-green-600 hover:text-green-800 whitespace-nowrap">✓ 回収済みにする</button>
                    )}
                    <button onClick={() => openEdit(f)} className="text-xs text-indigo-400 hover:text-indigo-600">編集</button>
                    <button onClick={() => handleDelete(f.id)} className="text-xs text-gray-300 hover:text-red-500">削除</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <Modal title={editId ? '伏線編集' : '伏線追加'} onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">伏線の内容 (必須)</label>
              <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="例: ゲズが一切喋らない・汗をかかない" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">詳細（任意）</label>
              <textarea value={form.detail} onChange={e => setForm({ ...form, detail: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" rows={3} placeholder="真相や、どう描写して仕込むかのメモ" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">🌱 張るシーン</label>
                <select value={form.planted_scene_id} onChange={e => setForm({ ...form, planted_scene_id: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">（未定）</option>
                  <SceneOption scenes={scenes} />
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">🎯 回収予定シーン</label>
                <select value={form.payoff_scene_id} onChange={e => setForm({ ...form, payoff_scene_id: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">（未定）</option>
                  <SceneOption scenes={scenes} />
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">回収時に読者に感じさせたい効果（任意）</label>
              <input value={form.reader_effect} onChange={e => setForm({ ...form, reader_effect: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="例: 「そういうことだったのか！」と種明かしの爽快感" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">状態</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as FormState['status'] })} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="open">未回収</option>
                <option value="resolved">回収済み</option>
                <option value="dropped">破棄</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">メモ（任意）</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">キャンセル</button>
              <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">{editId ? '保存' : '追加'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
