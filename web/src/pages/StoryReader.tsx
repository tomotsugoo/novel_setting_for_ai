import { useEffect, useRef, useState } from 'react';
import { api, Scene } from '../api';

type Mode = 'full' | 'single';

function formatStoryTime(s: string | null): string {
  if (!s) return '';
  const m = s.match(/^(\d+)-(\d+)-(\d+)T(\d+):(\d+)/);
  if (!m) return s;
  return `${m[1]}年${parseInt(m[2])}月${parseInt(m[3])}日 ${m[4]}:${m[5]}`;
}

function SceneBody({ scene }: { scene: Scene }) {
  const meta: string[] = [];
  if (scene.story_time) meta.push(formatStoryTime(scene.story_time));
  if (scene.location) meta.push(scene.location);

  return (
    <div>
      {meta.length > 0 && (
        <p className="text-xs text-gray-400 mb-3">{meta.join('　／　')}</p>
      )}
      {scene.body ? (
        <div
          className="text-gray-900 leading-relaxed whitespace-pre-wrap"
          style={{ fontFamily: '"Noto Serif JP", "ヒラギノ明朝 ProN", serif', fontSize: '1rem', lineHeight: '2' }}
        >
          {scene.body}
        </div>
      ) : (
        <p className="text-gray-400 italic text-sm border border-dashed border-gray-300 rounded-lg p-6 text-center">
          （未執筆）
        </p>
      )}
    </div>
  );
}

export default function StoryReader() {
  const [mode, setMode] = useState<Mode>('full');
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    api.scenes.list().then(res => {
      const sorted = [...res.scenes].sort((a, b) => {
        const ao = a.narrative_order ?? 9999;
        const bo = b.narrative_order ?? 9999;
        return ao - bo;
      });
      setScenes(sorted);
      setLoading(false);
    });
  }, []);

  const scrollToScene = (id: string) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">読み込み中…</div>;
  }

  if (scenes.length === 0) {
    return <div className="text-center text-gray-500 py-16">シーンがまだ登録されていません。</div>;
  }

  const currentScene = scenes[currentIndex];

  return (
    <div className="max-w-4xl mx-auto">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">本文閲覧</h1>
        <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
          {(['full', 'single'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-4 py-2 transition-colors ${
                mode === m
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {m === 'full' ? '全文通し読み' : 'シーン単独表示'}
            </button>
          ))}
        </div>
      </div>

      {/* 全文通し読みモード */}
      {mode === 'full' && (
        <div>
          {/* 目次 */}
          <div className="mb-8 bg-gray-50 rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">目次</p>
            <ol className="space-y-1">
              {scenes.map((s, i) => (
                <li key={s.id}>
                  <button
                    onClick={() => scrollToScene(s.id)}
                    className="text-left text-sm text-indigo-700 hover:text-indigo-900 hover:underline"
                  >
                    <span className="text-gray-400 mr-2 tabular-nums">{i + 1}.</span>
                    {s.title}
                    {!s.body && <span className="ml-2 text-gray-400 text-xs">（未執筆）</span>}
                  </button>
                </li>
              ))}
            </ol>
          </div>

          {/* 全シーン本文 */}
          <div className="space-y-16">
            {scenes.map((s, i) => (
              <section
                key={s.id}
                ref={el => { sectionRefs.current[s.id] = el; }}
                className="scroll-mt-8"
              >
                <div className="flex items-baseline gap-3 mb-4 border-b border-gray-200 pb-3">
                  <span className="text-xs text-gray-400 tabular-nums w-6 text-right">{i + 1}</span>
                  <h2 className="text-lg font-bold text-gray-900">{s.title}</h2>
                </div>
                <div className="pl-9">
                  <SceneBody scene={s} />
                </div>
              </section>
            ))}
          </div>
        </div>
      )}

      {/* シーン単独表示モード */}
      {mode === 'single' && (
        <div>
          {/* シーン選択 */}
          <div className="mb-6">
            <select
              value={currentIndex}
              onChange={e => setCurrentIndex(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm bg-white shadow-sm"
            >
              {scenes.map((s, i) => (
                <option key={s.id} value={i}>
                  {i + 1}. {s.title}{!s.body ? '（未執筆）' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 本文カード */}
          {currentScene && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 md:p-12 min-h-64">
              <h2 className="text-xl font-bold text-gray-900 mb-6 pb-4 border-b border-gray-100">
                {currentScene.title}
              </h2>
              <SceneBody scene={currentScene} />
            </div>
          )}

          {/* 前後ナビ */}
          <div className="flex items-center justify-between mt-6 gap-4">
            <button
              onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="hidden sm:inline">{currentIndex > 0 ? scenes[currentIndex - 1].title : ''}</span>
              <span className="sm:hidden">前へ</span>
            </button>

            <span className="text-sm text-gray-400 tabular-nums">
              {currentIndex + 1} / {scenes.length}
            </span>

            <button
              onClick={() => setCurrentIndex(i => Math.min(scenes.length - 1, i + 1))}
              disabled={currentIndex === scenes.length - 1}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <span className="hidden sm:inline">{currentIndex < scenes.length - 1 ? scenes[currentIndex + 1].title : ''}</span>
              <span className="sm:hidden">次へ</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
