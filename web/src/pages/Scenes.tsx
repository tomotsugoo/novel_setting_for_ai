import { useEffect, useState } from 'react';
import { api, Scene, Character, SceneCharacter } from '../api';
import Modal from '../components/Modal';
import Badge from '../components/Badge';
import { genId } from '../utils';

const roleInSceneLabels: Record<string, string> = {
  main: 'メイン', sub: 'サブ', mentioned: '言及のみ',
};

type StoryTime = { year: string; month: string; day: string; hour: string; minute: string };

function parseStoryTime(s: string): StoryTime {
  const m = s.match(/^(\d+)-(\d+)-(\d+)T(\d+):(\d+)/);
  if (m) return { year: m[1], month: m[2], day: m[3], hour: m[4], minute: m[5] };
  return { year: '', month: '', day: '', hour: '', minute: '' };
}

function formatStoryTime(t: StoryTime): string {
  if (t.year === '' && t.month === '' && t.day === '' && t.hour === '' && t.minute === '') return '';
  const y = (t.year || '1').padStart(4, '0');
  const mo = (t.month || '1').padStart(2, '0');
  const d = (t.day || '1').padStart(2, '0');
  const h = (t.hour !== '' ? t.hour : '0').padStart(2, '0');
  const mi = (t.minute !== '' ? t.minute : '0').padStart(2, '0');
  return `${y}-${mo}-${d}T${h}:${mi}:00`;
}

function StoryTimeInput({ value, onChange }: { value: StoryTime; onChange: (v: StoryTime) => void }) {
  const num = (field: keyof StoryTime, placeholder: string, max?: number, width = 'w-14') => (
    <input
      type="number"
      placeholder={placeholder}
      value={value[field]}
      min={0}
      max={max}
      onChange={e => onChange({ ...value, [field]: e.target.value })}
      className={`${width} border rounded-lg px-2 py-2 text-sm text-center`}
    />
  );
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 flex-wrap">
        {num('year', '年', undefined, 'w-20')}
        <span className="text-gray-500 text-sm">年</span>
        {num('month', '月', 12)}
        <span className="text-gray-500 text-sm">月</span>
        {num('day', '日', 31)}
        <span className="text-gray-500 text-sm">日</span>
      </div>
      <div className="flex items-center gap-1">
        {num('hour', '時', 23)}
        <span className="text-gray-500 text-sm">時</span>
        {num('minute', '分', 59)}
        <span className="text-gray-500 text-sm">分</span>
      </div>
      {formatStoryTime(value) && (
        <p className="text-xs text-gray-400">→ {formatStoryTime(value)}</p>
      )}
    </div>
  );
}

const emptyTime = (): StoryTime => ({ year: '', month: '', day: '', hour: '', minute: '' });

export default function Scenes() {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [detailScene, setDetailScene] = useState<Scene | null>(null);
  const [sceneChars, setSceneChars] = useState<SceneCharacter[]>([]);
  const [addCharForm, setAddCharForm] = useState({ character_id: '', role_in_scene: 'sub', notes: '' });
  const [form, setForm] = useState({ id: genId(), title: '', story_time: emptyTime(), narrative_order: '', location: '', disclosure_notes: '' });
  const [editingScene, setEditingScene] = useState(false);
  const [editSceneForm, setEditSceneForm] = useState({ title: '', story_time: emptyTime(), narrative_order: '', location: '', disclosure_notes: '' });
  const [error, setError] = useState<string | null>(null);

  const load = () => api.scenes.list().then(r => setScenes(r.scenes)).catch((e: Error) => setError(e.message));

  useEffect(() => {
    load();
    api.characters.list().then(r => setCharacters(r.characters));
  }, []);

  const openDetail = async (scene: Scene) => {
    setDetailScene(scene);
    setEditingScene(false);
    setEditSceneForm({
      title: scene.title,
      story_time: scene.story_time ? parseStoryTime(scene.story_time) : emptyTime(),
      narrative_order: scene.narrative_order != null ? String(scene.narrative_order) : '',
      location: scene.location ?? '',
      disclosure_notes: scene.disclosure_notes ?? '',
    });
    const r = await api.sceneCharacters.list(scene.id);
    setSceneChars(r.scene_characters);
  };

  const handleEditScene = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailScene) return;
    try {
      const data = {
        title: editSceneForm.title,
        story_time: formatStoryTime(editSceneForm.story_time) || null,
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
        story_time: formatStoryTime(form.story_time) || undefined,
        narrative_order: form.narrative_order ? Number(form.narrative_order) : undefined,
      });
      setShowAdd(false);
      setForm({ id: genId(), title: '', story_time: emptyTime(), narrative_order: '', location: '', disclosure_notes: '' });
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
      ) : (
        <div className="space-y-2">
          {scenes.map(s => (
            <div
              key={s.id}
              className="bg-white rounded-xl shadow p-4 cursor-pointer hover:shadow-md active:bg-gray-50 transition-shadow"
              onClick={() => openDetail(s)}
            >
              <div className="flex items-start gap-3">
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
      )}

      {/* シーン詳細モーダル */}
      {detailScene && (
        <Modal title={detailScene.title} onClose={() => setDetailScene(null)}>
          <div className="space-y-4">
            {editingScene ? (
              <form onSubmit={handleEditScene} className="space-y-3 text-sm">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">タイトル</label>
                  <input required value={editSceneForm.title} onChange={e => setEditSceneForm({...editSceneForm, title: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">物語内時間</label>
                  <StoryTimeInput value={editSceneForm.story_time} onChange={v => setEditSceneForm({...editSceneForm, story_time: v})} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">物語上の順番</label>
                  <input type="number" value={editSceneForm.narrative_order} onChange={e => setEditSceneForm({...editSceneForm, narrative_order: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">場所</label>
                  <input value={editSceneForm.location} onChange={e => setEditSceneForm({...editSceneForm, location: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
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
                  <option key={c.id} value={c.id}>{c.name}</option>
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
                    <option key={c.id} value={c.id}>{c.name}</option>
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
              <StoryTimeInput value={form.story_time} onChange={v => setForm({...form, story_time: v})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">物語上の順番</label>
              <input type="number" value={form.narrative_order} onChange={e => setForm({...form, narrative_order: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">場所</label>
              <input value={form.location} onChange={e => setForm({...form, location: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
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
