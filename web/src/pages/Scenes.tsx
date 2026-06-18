import { useEffect, useState } from 'react';
import { api, Scene, Character, SceneCharacter } from '../api';
import Modal from '../components/Modal';
import Badge from '../components/Badge';
import { genId } from '../utils';

const roleInSceneLabels: Record<string, string> = {
  main: 'メイン', sub: 'サブ', mentioned: '言及のみ',
};

// DB形式 "0001-01-01T12:00:00" をパース
function parseStoryTime(s: string) {
  const m = s.match(/^(\d+)-(\d+)-(\d+)T(\d+):(\d+)/);
  if (!m) return { date: '', time: '' };
  const date = `${m[1].padStart(4, '0')}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  const time = `${m[4].padStart(2, '0')}:${m[5].padStart(2, '0')}`;
  return { date, time };
}

function buildStoryTime(date: string, time: string): string {
  if (!date) return '';
  return `${date}T${time || '00:00'}:00`;
}

function nowStoryTime(): string {
  const n = new Date();
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${n.getFullYear()}-${pad(n.getMonth()+1)}-${pad(n.getDate())}T${pad(n.getHours())}:${pad(n.getMinutes())}:00`;
}

function LocationInput({ value, onChange, scenes, excludeId }: { value: string; onChange: (v: string) => void; scenes: Scene[]; excludeId?: string }) {
  const locations = Array.from(new Set(
    scenes.filter(s => s.location && s.id !== excludeId).map(s => s.location!)
  ));
  return (
    <div className="space-y-2">
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border rounded-lg px-3 py-2 text-sm"
        placeholder="場所を入力"
      />
      {locations.length > 0 && (
        <select
          value=""
          onChange={e => { if (e.target.value) onChange(e.target.value); }}
          className="w-full border rounded-lg px-3 py-2 text-sm text-gray-600 bg-gray-50"
        >
          <option value="">▼ 過去のシーンから選択…</option>
          {locations.map(loc => (
            <option key={loc} value={loc}>{loc}</option>
          ))}
        </select>
      )}
    </div>
  );
}

function StoryTimeInput({ value, onChange, scenes, excludeId }: { value: string; onChange: (v: string) => void; scenes: Scene[]; excludeId?: string }) {
  const { date, time } = parseStoryTime(value);
  const sceneOptions = scenes.filter(s => s.story_time && s.id !== excludeId);
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="date"
          value={date}
          onChange={e => onChange(buildStoryTime(e.target.value, time))}
          className="flex-1 border rounded-lg px-3 py-2 text-sm min-w-0"
        />
        <input
          type="time"
          value={time}
          onChange={e => onChange(buildStoryTime(date, e.target.value))}
          className="w-28 border rounded-lg px-3 py-2 text-sm"
        />
      </div>
      <select
        value=""
        onChange={e => {
          const v = e.target.value;
          if (v === '__today__') onChange(nowStoryTime());
          else if (v === '__clear__') onChange('');
          else if (v) onChange(v);
        }}
        className="w-full border rounded-lg px-3 py-2 text-sm text-gray-600 bg-gray-50"
      >
        <option value="">▼ 既存の日時から選択…</option>
        <option value="__today__">今日（現在日時）</option>
        {sceneOptions.map(s => (
          <option key={s.id} value={s.story_time!}>
            {s.narrative_order != null ? `#${s.narrative_order} ` : ''}{s.title}（{s.story_time}）
          </option>
        ))}
        {value && <option value="__clear__">クリア</option>}
      </select>
    </div>
  );
}

export default function Scenes() {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [detailScene, setDetailScene] = useState<Scene | null>(null);
  const [sceneChars, setSceneChars] = useState<SceneCharacter[]>([]);
  const [addCharForm, setAddCharForm] = useState({ character_id: '', role_in_scene: 'sub', notes: '' });
  const [form, setForm] = useState({ id: genId(), title: '', story_time: '', narrative_order: '', location: '', disclosure_notes: '' });
  const [editingScene, setEditingScene] = useState(false);
  const [editSceneForm, setEditSceneForm] = useState({ title: '', story_time: '', narrative_order: '', location: '', disclosure_notes: '' });
  const [sceneTab, setSceneTab] = useState<'info' | 'body'>('info');
  const [bodyText, setBodyText] = useState('');
  const [bodySaving, setBodySaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => api.scenes.list().then(r => setScenes(r.scenes)).catch((e: Error) => setError(e.message));

  useEffect(() => {
    load();
    api.characters.list().then(r => setCharacters(r.characters));
  }, []);

  const openDetail = async (scene: Scene) => {
    setDetailScene(scene);
    setEditingScene(false);
    setSceneTab('info');
    setBodyText(scene.body ?? '');
    setEditSceneForm({
      title: scene.title,
      story_time: scene.story_time ?? '',
      narrative_order: scene.narrative_order != null ? String(scene.narrative_order) : '',
      location: scene.location ?? '',
      disclosure_notes: scene.disclosure_notes ?? '',
    });
    const r = await api.sceneCharacters.list(scene.id);
    setSceneChars(r.scene_characters);
  };

  const handleSaveBody = async () => {
    if (!detailScene) return;
    setBodySaving(true);
    try {
      await api.scenes.update(detailScene.id, { body: bodyText || null });
      setDetailScene({ ...detailScene, body: bodyText || null });
      setScenes(ss => ss.map(s => s.id === detailScene.id ? { ...s, body: bodyText || null } : s));
    } catch (e) { setError(String(e)); }
    setBodySaving(false);
  };

  const handleEditScene = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailScene) return;
    try {
      const data = {
        title: editSceneForm.title,
        story_time: editSceneForm.story_time || null,
        narrative_order: editSceneForm.narrative_order ? Number(editSceneForm.narrative_order) : null,
        location: editSceneForm.location || null,
        disclosure_notes: editSceneForm.disclosure_notes || null,
      };
      await api.scenes.update(detailScene.id, data);
      const updated = { ...detailScene, ...data };
      setDetailScene(updated);
      setScenes(ss => ss.map(s => s.id === detailScene.id ? updated : s));
      setEditingScene(false);
    } catch (e) { setError(String(e)); }
  };

  const toggleWritten = async (scene: Scene, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.scenes.update(scene.id, { is_written: scene.is_written ? 0 : 1 });
      load();
    } catch (e) { setError(String(e)); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.scenes.create({
        ...form,
        story_time: form.story_time || undefined,
        narrative_order: form.narrative_order ? Number(form.narrative_order) : undefined,
      });
      setShowAdd(false);
      setForm({ id: genId(), title: '', story_time: '', narrative_order: '', location: '', disclosure_notes: '' });
      load();
    } catch (e) { setError(String(e)); }
  };

  const handleAddChar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailScene || !addCharForm.character_id) return;
    try {
      await api.sceneCharacters.add({ scene_id: detailScene.id, ...addCharForm });
      const r = await api.sceneCharacters.list(detailScene.id);
      setSceneChars(r.scene_characters);
      setAddCharForm({ character_id: '', role_in_scene: 'sub', notes: '' });
    } catch (e) { setError(String(e)); }
  };

  const handleRemoveChar = async (sceneId: string, characterId: string) => {
    try {
      await api.sceneCharacters.remove(sceneId, characterId);
      const r = await api.sceneCharacters.list(sceneId);
      setSceneChars(r.scene_characters);
    } catch (e) { setError(String(e)); }
  };

  const moveScene = async (idx: number, dir: -1 | 1, sorted: Scene[], e: React.MouseEvent) => {
    e.stopPropagation();
    if (idx + dir < 0 || idx + dir >= sorted.length) return;
    const reordered = [...sorted];
    [reordered[idx], reordered[idx + dir]] = [reordered[idx + dir], reordered[idx]];
    try {
      for (let i = 0; i < reordered.length; i++) {
        await api.scenes.update(reordered[i].id, { narrative_order: i + 1 });
      }
      load();
    } catch (e) { setError(String(e)); }
  };

  if (error) return <div className="text-red-500">Error: {error}</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">シーン</h2>
        <button onClick={() => setShowAdd(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm">
          + シーン追加
        </button>
      </div>
      {scenes.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400">シーンがありません</div>
      ) : (() => {
        const sorted = [...scenes].sort((a, b) => (a.narrative_order ?? 9999) - (b.narrative_order ?? 9999));
        return (
          <div className="space-y-2">
            {sorted.map((s, idx) => (
              <div
                key={s.id}
                className="bg-white rounded-xl shadow p-4 cursor-pointer hover:shadow-md active:bg-gray-50 transition-shadow"
                onClick={() => openDetail(s)}
              >
                <div className="flex items-start gap-2">
                  {/* 上下ボタン */}
                  <div className="flex flex-col gap-0.5 shrink-0 mt-0.5" onClick={e => e.stopPropagation()}>
                    <button
                      disabled={idx === 0}
                      onClick={e => moveScene(idx, -1, sorted, e)}
                      className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:bg-gray-100 disabled:opacity-20 text-xs"
                    >▲</button>
                    <button
                      disabled={idx === sorted.length - 1}
                      onClick={e => moveScene(idx, 1, sorted, e)}
                      className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:bg-gray-100 disabled:opacity-20 text-xs"
                    >▼</button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {s.narrative_order != null && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded shrink-0">#{s.narrative_order}</span>
                      )}
                      <span className="font-medium text-gray-900 truncate">{s.title}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-400">
                      {s.story_time && <span>⏱ {s.story_time}</span>}
                      {s.location && <span>📍 {s.location}</span>}
                    </div>
                  </div>
                  <button
                    onClick={e => toggleWritten(s, e)}
                    className={`shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-colors ${
                      s.is_written
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'bg-white border-gray-300 text-gray-300'
                    }`}
                    title="クリックで執筆済み切替"
                  >
                    {s.is_written ? '✓' : ''}
                  </button>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* シーン詳細モーダル */}
      {detailScene && (
        <Modal title={detailScene.title} onClose={() => setDetailScene(null)}>
          {/* タブ */}
          <div className="flex border-b mb-4">
            <button
              onClick={() => setSceneTab('info')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${sceneTab === 'info' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >設定</button>
            <button
              onClick={() => setSceneTab('body')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${sceneTab === 'body' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >本文</button>
          </div>
          {sceneTab === 'body' ? (
            <div className="space-y-3">
              <textarea
                value={bodyText}
                onChange={e => setBodyText(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono leading-relaxed resize-none"
                rows={20}
                placeholder="本文を入力..."
              />
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">{bodyText.length} 文字</span>
                <button
                  onClick={handleSaveBody}
                  disabled={bodySaving}
                  className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >{bodySaving ? '保存中…' : '保存'}</button>
              </div>
            </div>
          ) : (
          <div className="space-y-4">
            {editingScene ? (
              <form onSubmit={handleEditScene} className="space-y-3 text-sm">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">タイトル</label>
                  <input required value={editSceneForm.title} onChange={e => setEditSceneForm({...editSceneForm, title: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">物語内時間</label>
                  <StoryTimeInput value={editSceneForm.story_time} onChange={v => setEditSceneForm({...editSceneForm, story_time: v})} scenes={scenes} excludeId={detailScene.id} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">物語上の順番</label>
                  <input type="number" value={editSceneForm.narrative_order} onChange={e => setEditSceneForm({...editSceneForm, narrative_order: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">場所</label>
                  <LocationInput value={editSceneForm.location} onChange={v => setEditSceneForm({...editSceneForm, location: v})} scenes={scenes} excludeId={detailScene.id} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">開示メモ</label>
                  <textarea value={editSceneForm.disclosure_notes} onChange={e => setEditSceneForm({...editSceneForm, disclosure_notes: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} />
                </div>
                <div className="flex justify-end gap-3 pt-1">
                  <button type="button" onClick={() => setEditingScene(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">キャンセル</button>
                  <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">保存</button>
                </div>
              </form>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500">場所</span><p className="font-medium">{detailScene.location ?? '-'}</p></div>
                  <div><span className="text-gray-500">物語時間</span><p className="font-medium">{detailScene.story_time ?? '-'}</p></div>
                </div>
                {detailScene.disclosure_notes && (
                  <div className="text-sm">
                    <span className="text-gray-500">開示メモ</span>
                    <p className="mt-1 text-gray-700 bg-yellow-50 rounded p-2">{detailScene.disclosure_notes}</p>
                  </div>
                )}
                <div className="flex justify-end">
                  <button onClick={() => setEditingScene(true)} className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">編集</button>
                </div>
              </>
            )}

            {/* 主人公の自認キャラクター */}
            <div className="text-sm">
              <label className="block text-gray-500 mb-1">主人公の自認（意識レベル）</label>
              <select
                value={detailScene.protagonist_identity_id ?? ''}
                onChange={e => {
                  const val = e.target.value || null;
                  const updated = { ...detailScene, protagonist_identity_id: val };
                  setDetailScene(updated);
                  api.scenes.update(detailScene.id, { protagonist_identity_id: val })
                    .then(() => load())
                    .catch(err => setError(String(err)));
                }}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">（未設定）</option>
                {characters.map(c => (
                  <option key={c.id} value={c.id}>{c.name}{c.aliases ? `（${c.aliases}）` : ''}</option>
                ))}
              </select>
            </div>

            {/* 登場人物 */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">登場人物</h4>
              {sceneChars.length === 0 ? (
                <p className="text-gray-400 text-sm">まだ登録されていません</p>
              ) : (
                <ul className="space-y-1">
                  {sceneChars.map(sc => (
                    <li key={sc.character_id} className="flex items-center gap-2 text-sm">
                      <Badge role={sc.role} />
                      <span className="font-medium">{sc.name}</span>
                      <span className="text-xs text-gray-400">({roleInSceneLabels[sc.role_in_scene] ?? sc.role_in_scene})</span>
                      {sc.notes && <span className="text-xs text-gray-500">— {sc.notes}</span>}
                      <button
                        onClick={() => handleRemoveChar(detailScene.id, sc.character_id)}
                        className="ml-auto text-red-400 hover:text-red-600 text-xs"
                      >削除</button>
                    </li>
                  ))}
                </ul>
              )}

              {/* 登場人物追加フォーム */}
              <form onSubmit={handleAddChar} className="mt-3 flex flex-col sm:flex-row gap-2">
                <select
                  value={addCharForm.character_id}
                  onChange={e => setAddCharForm({...addCharForm, character_id: e.target.value})}
                  className="border rounded px-2 py-1 text-sm flex-1"
                  required
                >
                  <option value="">キャラクターを選択</option>
                  {characters.map(c => (
                    <option key={c.id} value={c.id}>{c.name}{c.aliases ? `（${c.aliases}）` : ''}</option>
                  ))}
                </select>
                <select
                  value={addCharForm.role_in_scene}
                  onChange={e => setAddCharForm({...addCharForm, role_in_scene: e.target.value})}
                  className="border rounded px-2 py-1 text-sm"
                >
                  <option value="main">メイン</option>
                  <option value="sub">サブ</option>
                  <option value="mentioned">言及のみ</option>
                </select>
                <button type="submit" className="px-3 py-1 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700">追加</button>
              </form>
            </div>
          </div>
          )}
        </Modal>
      )}

      {/* シーン追加モーダル */}
      {showAdd && (
        <Modal title="シーン追加" onClose={() => setShowAdd(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">タイトル (必須)</label>
              <input required value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">物語内時間</label>
              <StoryTimeInput value={form.story_time} onChange={v => setForm({...form, story_time: v})} scenes={scenes} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">物語上の順番</label>
              <input type="number" value={form.narrative_order} onChange={e => setForm({...form, narrative_order: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">場所</label>
              <LocationInput value={form.location} onChange={v => setForm({...form, location: v})} scenes={scenes} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">開示メモ</label>
              <textarea value={form.disclosure_notes} onChange={e => setForm({...form, disclosure_notes: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} />
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
