import { useState } from 'react';
import { api } from '../api';

export default function Migrate() {
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const r = await api.migrate();
      setResults(r.results);
      setDone(true);
    } catch (e) {
      setResults([`エラー: ${String(e)}`]);
    }
    setLoading(false);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-2">DBマイグレーション</h2>
      <p className="text-gray-500 text-sm mb-6">新しいテーブルや変更をDBに適用します。何度実行しても安全です（IF NOT EXISTS）。</p>

      {!done ? (
        <button
          onClick={run}
          disabled={loading}
          className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
        >
          {loading ? '実行中...' : 'マイグレーションを実行'}
        </button>
      ) : (
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="font-semibold text-gray-800 mb-3">結果</h3>
          <ul className="space-y-1">
            {results.map((r, i) => (
              <li key={i} className={`text-sm font-mono px-3 py-1 rounded ${r.startsWith('OK') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                {r}
              </li>
            ))}
          </ul>
          <p className="text-gray-500 text-sm mt-4">完了しました。このページは不要になれば使わなくて大丈夫です。</p>
        </div>
      )}
    </div>
  );
}
