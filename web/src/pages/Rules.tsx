import { useEffect, useState } from 'react';
import { listRules, createRule, deleteRule, WorldRule } from '../api';

export default function Rules() {
  const [rules, setRules] = useState<WorldRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState('');
  const [newText, setNewText] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    listRules()
      .then((r) => { setRules(r.rules); setLoading(false); })
      .catch((e) => { setError(String(e)); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const grouped = rules.reduce<Record<string, WorldRule[]>>((acc, r) => {
    const cat = r.category || '未分類';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(r);
    return acc;
  }, {});

  const handleAdd = async () => {
    if (!newCategory || !newText) return;
    setSaving(true);
    try {
      await createRule({ category: newCategory, rule_text: newText });
      setNewCategory('');
      setNewText('');
      load();
    } catch (e) { setError(String(e)); }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('このルールを削除しますか？')) return;
    try {
      await deleteRule(id);
      load();
    } catch (e) { setError(String(e)); }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">世界ルール</h2>
      {error && <p className="text-red-500 mb-4">{error}</p>}

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">ルールを追加</h3>
        <div className="flex gap-2 flex-wrap">
          <input type="text" placeholder="カテゴリ" value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          <input type="text" placeholder="ルール内容" value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm flex-1 min-w-48 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          <button onClick={handleAdd} disabled={saving || !newCategory || !newText}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {saving ? '追加中...' : '追加'}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400">読み込み中...</p>
      ) : Object.keys(grouped).length === 0 ? (
        <p className="text-gray-400">ルールがありません</p>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([cat, catRules]) => (
            <div key={cat} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b">
                <h3 className="text-sm font-semibold text-gray-700">{cat}</h3>
              </div>
              <ul className="divide-y divide-gray-100">
                {catRules.map((r) => (
                  <li key={r.id} className="flex items-start justify-between px-4 py-3 hover:bg-gray-50">
                    <p className="text-sm text-gray-800">{r.rule_text}</p>
                    <button onClick={() => handleDelete(r.id)}
                      className="ml-4 text-red-400 hover:text-red-600 text-xs shrink-0">削除</button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
