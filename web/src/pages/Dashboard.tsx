import { useEffect, useState } from 'react';
import { api, DashboardData } from '../api';

const MANUAL = [
  {
    title: '① 設定登録',
    color: 'indigo',
    steps: [
      '「キャラクター」ページでキャラを登録（名前・役割・説明・秘密・別名）',
      'アバター画像をアップロード（任意）',
      '「シーン」ページでシーンを登録（タイトル・物語時間・場所・執筆順）',
      'シーン詳細で登場人物を紐付け',
      '「世界ルール」ページでルールを登録',
      '「意識の入れ替わり」ページで入れ替わり設定',
      '「関係性」ページでキャラ間の関係を登録',
    ],
  },
  {
    title: '② 本文執筆（MCPあり）',
    color: 'purple',
    steps: [
      'シーン詳細でシーンIDをコピー',
      'AIに「シーンID [xxxx] のコンテキストを取得して」と指示',
      '→ get_scene_context が登場人物・関係性・前後シーン・世界ルールを一括取得',
      'AIに「このシーンの本文を書いて」と指示',
      '気に入ったら「この内容を保存して」と指示',
      '→ save_scene_body で自動的にDBに保存・執筆済みフラグON',
    ],
  },
  {
    title: '③ 執筆後の設定反映（MCPあり）',
    color: 'green',
    steps: [
      '新キャラが登場 → 「キャラ[名前]をIDは[id]で登録して」',
      '外見・状態が変わった → 「[キャラ]の外見が変わったので記録して」→ add_character_state',
      '関係性が生まれた → 「AとBが[関係]になったので登録して」→ add_relationship',
      '場所・メモを更新したい → 「このシーンの場所を[場所]に更新して」→ update_scene',
    ],
  },
  {
    title: '④ 整合性チェック',
    color: 'orange',
    steps: [
      'AIに「全体の整合性チェックをして」と指示',
      '→ check_all_consistency が時系列矛盾・欠番・孤立データを検出',
      '「シーン[id]の記述に矛盾がないか確認して」→ check_conflict',
      'タイムラインページで意識入れ替わりの流れを視覚確認',
      '相関図ページでキャラ関係を視覚確認',
    ],
  },
];

const colorMap: Record<string, string> = {
  indigo: 'bg-indigo-600',
  purple: 'bg-purple-600',
  green: 'bg-green-600',
  orange: 'bg-orange-500',
};
const lightMap: Record<string, string> = {
  indigo: 'bg-indigo-50 border-indigo-100',
  purple: 'bg-purple-50 border-purple-100',
  green: 'bg-green-50 border-green-100',
  orange: 'bg-orange-50 border-orange-100',
};
const textMap: Record<string, string> = {
  indigo: 'text-indigo-700',
  purple: 'text-purple-700',
  green: 'text-green-700',
  orange: 'text-orange-700',
};

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'dashboard' | 'manual'>('dashboard');

  useEffect(() => {
    api.dashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">ダッシュボード</h2>
        <div className="flex border rounded-lg overflow-hidden text-sm">
          <button onClick={() => setTab('dashboard')} className={`px-4 py-2 ${tab === 'dashboard' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>概要</button>
          <button onClick={() => setTab('manual')} className={`px-4 py-2 ${tab === 'manual' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>作業マニュアル</button>
        </div>
      </div>

      {tab === 'dashboard' ? (
        <>
          {error && <div className="text-red-500 mb-4">Error: {error}</div>}
          {!data ? <div className="text-gray-500">読み込み中...</div> : (
            <>
              <div className="grid grid-cols-3 gap-3 md:gap-6 mb-6 md:mb-8">
                <div className="bg-white rounded-xl shadow p-3 md:p-6">
                  <div className="text-xs md:text-sm text-gray-500 mb-1">キャラクター数</div>
                  <div className="text-2xl md:text-3xl font-bold text-indigo-600">{data.characters}</div>
                </div>
                <div className="bg-white rounded-xl shadow p-3 md:p-6">
                  <div className="text-xs md:text-sm text-gray-500 mb-1">シーン数</div>
                  <div className="text-2xl md:text-3xl font-bold text-indigo-600">{data.scenes}</div>
                </div>
                <div className="bg-white rounded-xl shadow p-3 md:p-6">
                  <div className="text-xs md:text-sm text-gray-500 mb-1">執筆済み</div>
                  <div className="text-2xl md:text-3xl font-bold text-green-600">{data.written}</div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">未執筆シーン</h3>
                {data.unwritten_scenes.length === 0 ? (
                  <p className="text-gray-500">未執筆シーンはありません</p>
                ) : (
                  <ul className="space-y-2">
                    {data.unwritten_scenes.map(s => (
                      <li key={s.id} className="flex items-center gap-3 text-gray-700">
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">#{s.narrative_order}</span>
                        <span>{s.title}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </>
      ) : (
        <div className="space-y-4">
          {MANUAL.map(section => (
            <div key={section.title} className={`rounded-xl border p-5 ${lightMap[section.color]}`}>
              <div className="flex items-center gap-3 mb-3">
                <span className={`text-white text-xs font-bold px-3 py-1 rounded-full ${colorMap[section.color]}`}>{section.title}</span>
              </div>
              <ol className="space-y-2">
                {section.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white mt-0.5 ${colorMap[section.color]}`}>{i + 1}</span>
                    <span className={step.startsWith('→') ? `${textMap[section.color]} font-medium` : 'text-gray-700'}>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}

          <div className="bg-gray-50 border rounded-xl p-5">
            <h3 className="font-semibold text-gray-700 mb-3 text-sm">MCPコマンド早見表</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {[
                ['get_scene_context', 'シーン全情報を取得'],
                ['list_characters', '全キャラ一覧'],
                ['get_character', 'キャラ詳細＋意識状態'],
                ['check_conflict', '記述の矛盾チェック'],
                ['check_all_consistency', '全体整合性チェック'],
                ['get_disclosure_level', '開示状態確認'],
                ['save_scene_body', '本文を保存 ✍️'],
                ['update_scene', 'シーン情報を更新 ✍️'],
                ['create_character', 'キャラを新規登録 ✍️'],
                ['add_character_state', 'キャラ状態変化を記録 ✍️'],
                ['add_relationship', '関係性を追加 ✍️'],
              ].map(([cmd, desc]) => (
                <div key={cmd} className="flex items-start gap-2">
                  <code className="bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded text-xs shrink-0">{cmd}</code>
                  <span className="text-gray-500">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
