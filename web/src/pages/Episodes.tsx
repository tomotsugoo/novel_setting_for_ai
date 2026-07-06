import { useEffect, useState } from 'react';
import { api, Episode, Scene } from '../api';
import Modal from '../components/Modal';

type FormState = { episode_number: string; title: string; hook: string; notes: string; status: 'draft' | 'published' };
const emptyForm: FormState = { episode_number: '', title: '', hook: '', notes: '', status: 'draft' };

// 1話の文字数目安（Web連載）
const CHAR_MIN = 2000;
const CHAR_MAX = 4000;

function charCountColor(n: number): string {
  if (n === 0) return 'text-gray-400';
  if (n < CHAR_MIN) return 'text-amber-600';
  if (n > CHAR_MAX * 1.5) return 'text-amber-600';
  return 'text-green-600';
}

export default function Episodes() {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const load = () => Promise.all([api.episodes.list(), api.scenes.list()])
    .then(([e, s]) => { setEpisodes(e.episodes); setScenes(s.scenes); })
    .catch((e: Error) => setError(e.message));

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    const nextNumber = episodes.reduce((max, ep) => Math.max(max, ep.episode_number ?? 0), 0) + 1;
    setForm({ ...emptyForm, episode_number: String(nextNumber) });
    setEditId(null);
    setShowForm(true);
  };
  const openEdit = (ep: Episode) => {
    setForm({
      episode_number: ep.episode_number != null ? String(ep.episode_number) : '',
      title: ep.title, hook: ep.hook ?? '', notes: ep.notes ?? '', status: ep.status,
    });
    setEditId(ep.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      episode_number: form.episode_number ? Number(form.episode_number) : null,
      title: form.title,
      hook: form.hook || null,
      notes: form.notes || null,
      status: form.status,
    };
    try {
      if (editId) {
        await api.episodes.update(editId, data);
      } else {
        await api.episodes.create(data);
      }
      setShowForm(false);
      setEditId(null);
      load();
    } catch (e) { setError(String(e)); }
  };

  const handleDelete = async (ep: Episode) => {
    if (!confirm(`第${ep.episode_number ?? '?'}話「${ep.title}」を削除しますか？\n（所属シーンは削除されず、紐付けだけ外れます）`)) return;
    try {
      await api.episodes.delete(ep.id);
      load();
    } catch (e) { setError(String(e)); }
  };

  const assignScene = async (sceneId: string, episodeId: string | null) => {
    try {
      await api.scenes.update(sceneId, { episode_id: episodeId });
      load();
    } catch (e) { setError(String(e)); }
  };

  if (error) return <div className="text-red-500">Error: {error}</div>;

  const unassigned = [...scenes]
    .filter(s => !s.episode_id)
    .sort((a, b) => (a.narrative_order ?? 9999) - (b.narrative_order ?? 9999));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-bold text-gray-800">話数管理</h2>
        <button onClick={openAdd} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm">
          + 話を追加
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        話＝Web連載の投稿単位（1話 {CHAR_MIN.toLocaleString()}〜{CHAR_MAX.toLocaleString()}字目安）。複数のシーンをまとめます。話の「引き」はAIが最後のシーンを書くときに自動で渡されます。
      </p>

      {episodes.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400">
          話がまだ登録されていません。「+ 話を追加」で第1話を作り、シーンを所属させてください。
        </div>
      ) : (
        <div className="space-y-4">
          {episodes.map(ep => (
            <div key={ep.id} className="bg-white rounded-xl shadow p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold bg-indigo-600 text-white px-2.5 py-0.5 rounded">
                    第{ep.episode_number ?? '?'}話
                  </span>
                  <h3 className="font-semibold text-gray-900">{ep.title}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${ep.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {ep.status === 'published' ? '公開済み' : '下書き'}
                  </span>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => openEdit(ep)} className="text-xs text-indigo-400 hover:text-indigo-600">編集</button>
                  <button onClick={() => handleDelete(ep)} className="text-xs text-gray-300 hover:text-red-500">削除</button>
                </div>
              </div>

              <p className="text-xs mb-3">
                <span className={charCountColor(ep.total_chars ?? 0)}>
                  {(ep.total_chars ?? 0).toLocaleString()} 字
                </span>
                <span className="text-gray-400">
                  {' '}／ 目安 {CHAR_MIN.toLocaleString()}〜{CHAR_MAX.toLocaleString()} 字
                  ・ 執筆 {ep.written_count}/{ep.scene_count} シーン
                </span>
              </p>

              {ep.hook && (
                <p className="text-xs text-purple-700 bg-purple-50 rounded px-2 py-1.5 mb-3">
                  🪝 引き: {ep.hook}
                </p>
              )}

              {(ep.scenes ?? []).length === 0 ? (
                <p className="text-xs text-gray-400 mb-2">シーンが紐付いていません</p>
              ) : (
                <ul className="space-y-1 mb-2">
                  {(ep.scenes ?? []).map(s => (
                    <li key={s.id} className="flex items-center gap-2 text-sm bg-gray-50 rounded px-2 py-1.5">
                      {s.narrative_order != null && <span className="text-xs text-gray-400 tabular-nums">#{s.narrative_order}</span>}
                      <span className="text-gray-800 flex-1 truncate">{s.title}</span>
                      <span className="text-xs text-gray-400">{s.char_count.toLocaleString()}字</span>
                      <span className={`text-xs ${s.is_written ? 'text-green-500' : 'text-gray-300'}`}>{s.is_written ? '✓' : '未'}</span>
                      <button onClick={() => assignScene(s.id, null)} className="text-xs text-gray-300 hover:text-red-500" title="この話から外す">✕</button>
                    </li>
                  ))}
                </ul>
              )}

              {unassigned.length > 0 && (
                <select
                  value=""
                  onChange={e => { if (e.target.value) assignScene(e.target.value, ep.id); }}
                  className="w-full border border-dashed rounded-lg px-3 py-1.5 text-xs text-gray-500 bg-white"
                >
                  <option value="">＋ 未所属のシーンをこの話に追加…</option>
                  {unassigned.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.narrative_order != null ? `#${s.narrative_order} ` : ''}{s.title}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
      )}

      {unassigned.length > 0 && episodes.length > 0 && (
        <p className="text-xs text-gray-400 mt-4">
          未所属のシーン: {unassigned.map(s => s.title).join('、')}
        </p>
      )}

      {showForm && (
        <Modal title={editId ? '話の編集' : '話を追加'} onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">話数</label>
                <input type="number" value={form.episode_number} onChange={e => setForm({ ...form, episode_number: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">タイトル (必須)</label>
                <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="例: 消耗戦の果て" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">引き（この話の最後で読者を次話へ引っ張る要素）</label>
              <textarea value={form.hook} onChange={e => setForm({ ...form, hook: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} placeholder="例: 「本物は、もうすぐそこまで来ている」——ゲズの正体が明かされ、真の敵の接近で終わる" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">状態</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as FormState['status'] })} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="draft">下書き</option>
                <option value="published">公開済み</option>
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
