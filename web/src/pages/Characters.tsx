import { useEffect, useState } from 'react';
import { listCharacters, createCharacter, updateCharacter, Character } from '../api';
import Modal from '../components/Modal';
import Badge from '../components/Badge';

const emptyForm = { name: '', role: '', aliases: '', description: '', secret: '' };

export default function Characters() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<Character | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    listCharacters()
      .then((r) => { setCharacters(r.characters); setLoading(false); })
      .catch((e) => { setError(String(e)); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm(emptyForm); setShowAdd(true); };
  const openDetail = (c: Character) => {
    setSelected(c);
    setForm({ name: c.name, role: c.role ?? '', aliases: c.aliases ?? '', description: c.description ?? '', secret: c.secret ?? '' });
  };

  const handleAdd = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      await createCharacter(form);
      setShowAdd(false);
      load();
    } catch (e) { setError(String(e)); }
    setSaving(false);
  };

  const handleUpdate = async () => {
    if (!selected || !form.name) return;
    setSaving(true);
    try {
      await updateCharacter(selected.id, form);
      setSelected(null);
      load();
    } catch (e) { setError(String(e)); }
    setSaving(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">キャラクター</h2>
        <button onClick={openAdd} className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700">
          + 追加
        </button>
      </div>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      {loading ? (
        <p className="text-gray-400">読み込み中...</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">名前</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">役割</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">別名</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {characters.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openDetail(c)}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.name}</td>
                  <td className="px-4 py-3 text-sm"><Badge role={c.role} /></td>
                  <td className="px-4 py-3 text-sm text-gray-500">{c.aliases ?? '-'}</td>
                </tr>
              ))}
              {characters.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400">キャラクターがいません</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="キャラクター追加">
        <CharacterForm form={form} onChange={setForm} />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">キャンセル</button>
          <button onClick={handleAdd} disabled={saving} className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {saving ? '保存中...' : '追加'}
          </button>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.name ?? ''}>
        <CharacterForm form={form} onChange={setForm} />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setSelected(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">キャンセル</button>
          <button onClick={handleUpdate} disabled={saving} className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {saving ? '保存中...' : '更新'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function CharacterForm({ form, onChange }: { form: Record<string, string>; onChange: (f: Record<string, string>) => void }) {
  const field = (key: string, label: string, placeholder = '', textarea = false) => (
    <div className="mb-3">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {textarea ? (
        <textarea
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          rows={3}
          placeholder={placeholder}
          value={form[key]}
          onChange={(e) => onChange({ ...form, [key]: e.target.value })}
        />
      ) : (
        <input
          type="text"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          placeholder={placeholder}
          value={form[key]}
          onChange={(e) => onChange({ ...form, [key]: e.target.value })}
        />
      )}
    </div>
  );
  return (
    <>
      {field('name', '名前 *', '例: 田中一郎')}
      {field('role', '役割', '例: 主人公')}
      {field('aliases', '別名', '例: 一郎, タナカ')}
      {field('description', '説明', 'キャラクターの説明...', true)}
      {field('secret', '秘密', '読者に非公開の情報...', true)}
    </>
  );
}
