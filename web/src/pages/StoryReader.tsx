import { useEffect, useRef, useState } from 'react';
import { api, Episode, Scene } from '../api';

type Mode = 'full' | 'single';
type TtsState = 'idle' | 'playing' | 'paused';

// 読み上げ用に文単位で分割（1チャンク約120字。Chromeの長文停止バグ回避も兼ねる）
function splitChunks(text: string, max = 120): string[] {
  const parts = text.replace(/\r/g, '').split(/([。！？\n])/);
  const sentences: string[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const s = (parts[i] ?? '') + (parts[i + 1] ?? '');
    if (s) sentences.push(s);
  }
  const chunks: string[] = [];
  let buf = '';
  for (const s of sentences) {
    if (buf && (buf + s).length > max) { chunks.push(buf); buf = s; }
    else buf += s;
  }
  if (buf.trim()) chunks.push(buf);
  return chunks.map(c => c.trim()).filter(Boolean);
}

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
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const [episodes, setEpisodes] = useState<Episode[]>([]);

  // 読み上げ（Web Speech API・ブラウザ内蔵の音声合成）
  const [ttsState, setTtsState] = useState<TtsState>('idle');
  const [ttsRate, setTtsRate] = useState(1.0);
  const [ttsVoices, setTtsVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [ttsVoiceName, setTtsVoiceName] = useState('');
  const [ttsContinuous, setTtsContinuous] = useState(true);
  const ttsRef = useRef({ stop: false, rate: 1.0, voiceName: '', continuous: true });
  ttsRef.current.rate = ttsRate;
  ttsRef.current.voiceName = ttsVoiceName;
  ttsRef.current.continuous = ttsContinuous;

  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const loadVoices = () => {
      const ja = synth.getVoices().filter(v => v.lang.startsWith('ja'));
      setTtsVoices(ja);
      setTtsVoiceName(prev => prev || (ja[0]?.name ?? ''));
    };
    loadVoices();
    synth.addEventListener?.('voiceschanged', loadVoices);
    return () => {
      synth.cancel();
      synth.removeEventListener?.('voiceschanged', loadVoices);
    };
  }, []);

  useEffect(() => {
    Promise.all([api.scenes.list(), api.episodes.list().catch(() => ({ episodes: [] as Episode[] }))]).then(([res, eps]) => {
      const sorted = [...res.scenes].sort((a, b) => {
        const ao = a.narrative_order ?? 9999;
        const bo = b.narrative_order ?? 9999;
        return ao - bo;
      });
      setScenes(sorted);
      setEpisodes(eps.episodes);
      setLoading(false);
    }).catch((e: Error) => {
      setError(e.message);
      setLoading(false);
    });
  }, []);

  // 直前のシーンと話が変わる位置に「第N話」見出しを出す
  const episodeHeading = (scene: Scene, prev: Scene | null): string | null => {
    if (!scene.episode_id) return null;
    if (prev && prev.episode_id === scene.episode_id) return null;
    const ep = episodes.find(e => e.id === scene.episode_id);
    if (!ep) return null;
    return `第${ep.episode_number ?? '?'}話　${ep.title}`;
  };

  const scrollToScene = (id: string) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // --- 読み上げ制御 ---
  const stopTts = () => {
    ttsRef.current.stop = true;
    window.speechSynthesis?.cancel();
    setTtsState('idle');
  };

  const speakSceneAt = (index: number, sceneList: Scene[]) => {
    const synth = window.speechSynthesis;
    if (!synth) { alert('このブラウザは読み上げに対応していません'); return; }
    synth.cancel();
    ttsRef.current.stop = false;
    const scene = sceneList[index];
    if (!scene?.body) {
      // 未執筆ならスキップして次へ
      const next = sceneList.findIndex((s, i) => i > index && s.body);
      if (next >= 0) { setCurrentIndex(next); speakSceneAt(next, sceneList); }
      else setTtsState('idle');
      return;
    }
    const chunks = splitChunks(`${scene.title}。${scene.body}`);
    let i = 0;
    const speakNext = () => {
      if (ttsRef.current.stop) return;
      if (i >= chunks.length) {
        const next = sceneList.findIndex((s, idx) => idx > index && s.body);
        if (ttsRef.current.continuous && next >= 0) {
          setCurrentIndex(next);
          speakSceneAt(next, sceneList);
        } else {
          setTtsState('idle');
        }
        return;
      }
      const u = new SpeechSynthesisUtterance(chunks[i++]);
      u.lang = 'ja-JP';
      const voice = synth.getVoices().find(v => v.name === ttsRef.current.voiceName);
      if (voice) u.voice = voice;
      u.rate = ttsRef.current.rate;
      u.onend = speakNext;
      u.onerror = () => { if (!ttsRef.current.stop) setTtsState('idle'); };
      synth.speak(u);
    };
    setTtsState('playing');
    speakNext();
  };

  const pauseTts = () => {
    window.speechSynthesis?.pause();
    setTtsState('paused');
  };
  const resumeTts = () => {
    window.speechSynthesis?.resume();
    setTtsState('playing');
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">読み込み中…</div>;
  }

  if (error) {
    return <div className="text-red-500 py-8">読み込みエラー: {error}</div>;
  }

  if (scenes.length === 0) {
    return <div className="text-center text-gray-500 py-16">シーンがまだ登録されていません。</div>;
  }

  const currentScene = scenes[currentIndex];
  const writtenCount = scenes.filter(s => s.body).length;
  const totalChars = scenes.reduce((sum, s) => sum + (s.body?.length ?? 0), 0);

  const downloadTxt = () => {
    const written = scenes.filter(s => s.body);
    const parts: string[] = [];
    written.forEach((s, i) => {
      const heading = episodeHeading(s, i > 0 ? written[i - 1] : null);
      if (heading) parts.push(`■ ${heading}`);
      parts.push(`${s.title}\n\n${s.body}`);
    });
    const text = parts.join('\n\n\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `novelsync-story-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">本文閲覧</h1>
          <p className="text-xs text-gray-400 mt-1">
            執筆済み {writtenCount} / {scenes.length} シーン ・ 計 {totalChars.toLocaleString()} 文字
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          {writtenCount > 0 && (
            <button
              onClick={downloadTxt}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
              title="執筆済みの本文をテキストファイルでダウンロード"
            >⬇ txt</button>
          )}
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
            {scenes.map((s, i) => {
              const heading = episodeHeading(s, i > 0 ? scenes[i - 1] : null);
              return (
                <section
                  key={s.id}
                  ref={el => { sectionRefs.current[s.id] = el; }}
                  className="scroll-mt-8"
                >
                  {heading && (
                    <h2 className="text-xl font-bold text-indigo-900 bg-indigo-50 rounded-lg px-4 py-3 mb-8">
                      {heading}
                    </h2>
                  )}
                  <div className="flex items-baseline gap-3 mb-4 border-b border-gray-200 pb-3">
                    <span className="text-xs text-gray-400 tabular-nums w-6 text-right">{i + 1}</span>
                    <h2 className="text-lg font-bold text-gray-900">{s.title}</h2>
                  </div>
                  <div className="pl-9">
                    <SceneBody scene={s} />
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}

      {/* シーン単独表示モード */}
      {mode === 'single' && (
        <div>
          {/* シーン選択 */}
          <div className="mb-4">
            <select
              value={currentIndex}
              onChange={e => { stopTts(); setCurrentIndex(Number(e.target.value)); }}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm bg-white shadow-sm"
            >
              {scenes.map((s, i) => (
                <option key={s.id} value={i}>
                  {i + 1}. {s.title}{!s.body ? '（未執筆）' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 読み上げコントロール */}
          <div className="mb-6 bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center gap-3 flex-wrap">
            {ttsState === 'idle' && (
              <button
                onClick={() => speakSceneAt(currentIndex, scenes)}
                disabled={!currentScene?.body}
                className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40"
              >▶ 読み上げ</button>
            )}
            {ttsState === 'playing' && (
              <button onClick={pauseTts} className="px-4 py-1.5 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600">⏸ 一時停止</button>
            )}
            {ttsState === 'paused' && (
              <button onClick={resumeTts} className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">▶ 再開</button>
            )}
            {ttsState !== 'idle' && (
              <button onClick={stopTts} className="px-4 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">⏹ 停止</button>
            )}
            <label className="flex items-center gap-1.5 text-xs text-gray-600">
              速度
              <select
                value={ttsRate}
                onChange={e => setTtsRate(Number(e.target.value))}
                className="border rounded px-2 py-1 text-xs bg-white"
              >
                <option value={0.8}>0.8x</option>
                <option value={1}>1.0x</option>
                <option value={1.2}>1.2x</option>
                <option value={1.5}>1.5x</option>
                <option value={2}>2.0x</option>
              </select>
            </label>
            {ttsVoices.length > 1 && (
              <label className="flex items-center gap-1.5 text-xs text-gray-600">
                声
                <select
                  value={ttsVoiceName}
                  onChange={e => setTtsVoiceName(e.target.value)}
                  className="border rounded px-2 py-1 text-xs bg-white max-w-40"
                >
                  {ttsVoices.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                </select>
              </label>
            )}
            <label className="flex items-center gap-1.5 text-xs text-gray-600">
              <input type="checkbox" checked={ttsContinuous} onChange={e => setTtsContinuous(e.target.checked)} />
              次のシーンへ自動継続
            </label>
            {ttsState === 'playing' && <span className="text-xs text-indigo-500 animate-pulse">🔊 再生中</span>}
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
              onClick={() => { stopTts(); setCurrentIndex(i => Math.max(0, i - 1)); }}
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
              onClick={() => { stopTts(); setCurrentIndex(i => Math.min(scenes.length - 1, i + 1)); }}
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
