import { useEffect, useState } from 'react';
import { api, StyleGuide } from '../api';
import Modal from '../components/Modal';

const CATEGORY_SUGGESTIONS = ['文体', '視点', '描写', '台詞', '禁則', 'その他'];

const EXAMPLES: Array<{ category: string; content: string }> = [
  { category: '視点', content: '三人称一元視点。視点キャラの内面のみ描写し、他キャラの心情は行動・表情から推測させる。' },
  { category: '文体', content: '地の文は常体（だ・である）。一文は短めでテンポを重視。' },
  { category: '描写', content: '戦闘シーンは短文の連続でスピード感を出す。日常シーンは五感描写を多めに。' },
  { category: '台詞', content: 'エルシィは砕けた口調（〜だよ、〜じゃん）。イノリは丁寧語ベース。' },
  { category: '禁則', content: '「〜のだった」の多用禁止。同じ文末を3回以上連続させない。' },
];

type FormState = { category: string; title: string; content: string; sort_order: string };
const emptyForm: FormState = { category: '文体', title: '', content: '', sort_order: '' };

export default function StyleGuidePage() {
  const [styles, setStyles] = useState<StyleGuide[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const load = () => api.styles.list().then(r => setStyles(r.styles)).catch((e: Error) => setError(e.message));

  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm(emptyForm); setEditId(null); setShowAdd(true); };
  const openEdit = (s: StyleGuide) => {
    setForm({ category: s.category, title: s.title ?? '', content: s.content, sort_order: s.sort_order != null ? String(s.sort_order) : '' });
    setEditId(s.id);
    setShowAdd(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      category: form.category,
      title: form.title || null,
      content: form.content,
      sort_order: form.sort_order ? Number(form.sort_order) : null,
    };
    try {
      if (editId) {
        await api.styles.update(editId, data);
      } else {
        await api.styles.create(data);
      }
      setShowAdd(false);
      setForm(emptyForm);
      setEditId(null);
      load();
    } catch (e) { setError(String(e)); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('このスタイルを削除しますか？')) return;
    try {
      await api.styles.delete(id);
      load();
    } catch (e) { setError(String(e)); }
  };

  if (error) return <div className="text-red-500">Error: {error}</div>;

  const categories = [...new Set(styles.map(s => s.category))];

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-bold text-gray-800">文体・描写</h2>
        <button onClick={openAdd} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm">
          + スタイル追加
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        ここに登録した文体・描写の流儀は、AIが本文を書くとき（get_scene_context）に毎回自動で渡されます。
      </p>

      {styles.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-6">
          <p className="text-gray-500 mb-1">まだ登録がありません。</p>
          <p className="text-xs text-gray-400 mb-4">↓は記入例です。「この例で追加」を押すと編集画面に読み込まれ、内容を直してから登録できます。</p>
          <ul className="space-y-2">
            {EXAMPLES.map((ex, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="shrink-0 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded mt-0.5">{ex.category}</span>
                <span className="text-gray-600 flex-1">{ex.content}</span>
                <button
                  onClick={() => {
                    setForm({ ...emptyForm, category: ex.category, content: ex.content });
                    setEditId(null);
                    setShowAdd(true);
                  }}
                  className="shrink-0 text-xs text-indigo-500 hover:text-indigo-700 whitespace-nowrap"
                >この例で追加</button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="space-y-6">
          {categories.map(cat => (
            <div key={cat} className="bg-white rounded-xl shadow p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">{cat}</h3>
              <ul className="space-y-3">
                {styles.filter(s => s.category === cat).map(s => (
                  <li key={s.id} className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {s.title && <p className="text-sm font-medium text-gray-800">{s.title}</p>}
                      <p className="text-gray-700 text-sm whitespace-pre-wrap">{s.content}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => openEdit(s)} className="text-indigo-400 hover:text-indigo-600 text-sm">編集</button>
                      <button onClick={() => handleDelete(s.id)} className="text-gray-300 hover:text-red-500 text-sm">削除</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <Modal title={editId ? 'スタイル編集' : 'スタイル追加'} onClose={() => setShowAdd(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリ (必須)</label>
              <input
                required
                list="style-categories"
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="例: 文体, 視点, 描写, 台詞, 禁則"
              />
              <datalist id="style-categories">
                {CATEGORY_SUGGESTIONS.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">見出し（任意）</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="例: 戦闘シーンの文体" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">内容 (必須)</label>
              <textarea required value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" rows={5} placeholder="例: 三人称一元視点。地の文は常体。戦闘は短文でテンポ重視。" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">表示順（任意・小さいほど先）</label>
              <input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">キャンセル</button>
              <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">{editId ? '保存' : '追加'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
