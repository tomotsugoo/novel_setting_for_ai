import { useEffect, useState } from 'react';
import { api, WorldRule } from '../api';
import Modal from '../components/Modal';
import { genId } from '../utils';

const CATEGORIES = ['magic', 'physics', 'technology', 'society'];
const CATEGORY_LABELS: Record<string, string> = {
  magic: '魔法', physics: '物理法則', technology: '技術', society: '社会',
};

export default function Rules() {
  const [rules, setRules] = useState<WorldRule[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ id: genId(), category: 'magic', rule: '', applies_from: '' });
  const [error, setError] = useState<string | null>(null);

  const load = () => api.rules.list().then(r => setRules(r.rules)).catch((e: Error) => setError(e.message));

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    try {
      await api.rules.delete(id);
      load();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.rules.create({ ...form, applies_from: form.applies_from || undefined });
      setShowAdd(false);
      setForm({ id: genId(), category: 'magic', rule: '', applies_from: '' });
      load();
    } catch (e) {
      setError(String(e));
    }
  };

  if (error) return <div className="text-red-500">Error: {error}</div>;

  const grouped = CATEGORIES.reduce<Record<string, WorldRule[]>>((acc, cat) => {
    acc[cat] = rules.filter(r => r.category === cat);
    return acc;
  }, {});
  const otherCats = [...new Set(rules.filter(r => !CATEGORIES.includes(r.category)).map(r => r.category))];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">世界ルール</h2>
        <button onClick={() => setShowAdd(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm">
          + ルール追加
        </button>
      </div>
      <div className="space-y-6">
        {[...CATEGORIES, ...otherCats].map(cat => {
          const catRules = grouped[cat] ?? rules.filter(r => r.category === cat);
          if (catRules.length === 0) return null;
          return (
            <div key={cat} className="bg-white rounded-xl shadow p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">{CATEGORY_LABELS[cat] ?? cat}</h3>
              <ul className="space-y-3">
                {catRules.map(r => (
                  <li key={r.id} className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-gray-700">{r.rule}</p>
                      {r.applies_from && <p className="text-xs text-gray-400 mt-1">適用開始: {r.applies_from}</p>}
                    </div>
                    <button onClick={() => handleDelete(r.id)} className="text-gray-300 hover:text-red-500 text-sm shrink-0">削除</button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        {rules.length === 0 && <p className="text-gray-500">ルールがありません</p>}
      </div>

      {showAdd && (
        <Modal title="ルール追加" onClose={() => setShowAdd(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリ</label>
              <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ルール (必須)</label>
              <textarea required value={form.rule} onChange={e => setForm({...form, rule: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" rows={3} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">適用開始時間</label>
              <input value={form.applies_from} onChange={e => setForm({...form, applies_from: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="例: 2024-01-01" />
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
