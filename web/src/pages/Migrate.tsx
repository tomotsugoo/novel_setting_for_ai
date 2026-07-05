import { useState } from 'react';
import { api } from '../api';

export default function Migrate() {
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [avatarResults, setAvatarResults] = useState<string[] | null>(null);
  const [avatarMigrating, setAvatarMigrating] = useState(false);

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

  const exportBackup = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const data = await api.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `novelsync-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(String(e));
    }
    setExporting(false);
  };

  const migrateAvatars = async () => {
    setAvatarMigrating(true);
    try {
      const r = await api.characters.migrateAvatars();
      setAvatarResults(r.migrated);
    } catch (e) {
      setAvatarResults([`エラー: ${String(e)}`]);
    }
    setAvatarMigrating(false);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">画像のファイル保存移行</h2>
        <p className="text-gray-500 text-sm mb-4">
          DBに保存されている旧形式（base64）のキャラクター画像を、ファイルストレージ（R2）へ移行します。一度実行すれば完了です。
        </p>
        <button
          onClick={migrateAvatars}
          disabled={avatarMigrating}
          className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
        >
          {avatarMigrating ? '移行中...' : '🖼 画像をファイル保存へ移行'}
        </button>
        {avatarResults && (
          <ul className="mt-3 space-y-1">
            {avatarResults.map((r, i) => (
              <li key={i} className={`text-sm font-mono px-3 py-1 rounded ${r.startsWith('エラー') || r.startsWith('SKIP') ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>{r}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t pt-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">バックアップ</h2>
        <p className="text-gray-500 text-sm mb-4">
          全データ（キャラクター・シーン・本文・履歴・世界ルール・関係性・意識の入れ替わり）をJSONファイルでダウンロードします。定期的な保存をおすすめします。
        </p>
        <button
          onClick={exportBackup}
          disabled={exporting}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
        >
          {exporting ? '書き出し中...' : '📦 全データをダウンロード'}
        </button>
        {exportError && <p className="text-red-500 text-sm mt-2">エラー: {exportError}</p>}
      </div>

      <div className="border-t pt-8">
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
                <li key={i} className={`text-sm font-mono px-3 py-1 rounded ${r.startsWith('OK') || r.startsWith('SKIP') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                  {r}
                </li>
              ))}
            </ul>
            <p className="text-gray-500 text-sm mt-4">完了しました。</p>
          </div>
        )}
      </div>
    </div>
  );
}
