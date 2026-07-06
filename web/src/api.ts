const BASE = 'https://novelsync-mcp.tomotsugoo.workers.dev';

// avatarカラムの値を表示用URLに解決する。
// 新形式: "/api/avatars/:id?v=..."（画像専用テーブルから配信） ／ 旧形式: "data:..."（base64埋め込み・移行前）
export function avatarUrl(avatar: string | null | undefined): string | null {
  if (!avatar) return null;
  if (avatar.startsWith('/')) return `${BASE}${avatar}`;
  return avatar;
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const api = {
  dashboard: () => apiFetch<DashboardData>('/api/dashboard'),
  characters: {
    list: () => apiFetch<{characters: Character[]}>('/api/characters'),
    create: (data: Partial<Character>) => apiFetch('/api/characters', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Character>) => apiFetch(`/api/characters/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    uploadAvatar: async (id: string, blob: Blob): Promise<{ok: boolean; avatar: string}> => {
      const res = await fetch(`${BASE}/api/avatars/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': blob.type || 'image/jpeg' },
        body: blob,
      });
      if (!res.ok) {
        const detail = await res.json().then(d => (d as {error?: string}).error).catch(() => null);
        throw new Error(detail ?? `API error: ${res.status}`);
      }
      return res.json();
    },
    deleteAvatar: (id: string) => apiFetch(`/api/avatars/${id}`, { method: 'DELETE' }),
    migrateAvatars: () => apiFetch<{migrated: string[]}>('/api/avatars/migrate-from-db', { method: 'POST' }),
  },
  scenes: {
    list: () => apiFetch<{scenes: Scene[]}>('/api/scenes'),
    create: (data: Partial<Scene>) => apiFetch('/api/scenes', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Scene>) => apiFetch(`/api/scenes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  },
  rules: {
    list: () => apiFetch<{rules: WorldRule[]}>('/api/rules'),
    create: (data: Partial<WorldRule>) => apiFetch('/api/rules', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch(`/api/rules/${id}`, { method: 'DELETE' }),
  },
  sceneCharacters: {
    list: (sceneId: string) => apiFetch<{scene_characters: SceneCharacter[]}>(`/api/scene_characters/${sceneId}`),
    add: (data: {scene_id: string; character_id: string; role_in_scene: string; is_pov?: boolean; notes?: string}) =>
      apiFetch('/api/scene_characters', { method: 'POST', body: JSON.stringify(data) }),
    remove: (sceneId: string, characterId: string) =>
      apiFetch(`/api/scene_characters/${sceneId}/${characterId}`, { method: 'DELETE' }),
  },
  migrate: () => apiFetch<{results: string[]}>('/api/migrate', { method: 'POST' }),
  consciousnessSwaps: {
    list: () => apiFetch<{swaps: ConsciousnessSwap[]}>('/api/consciousness_swaps'),
    create: (data: Partial<ConsciousnessSwap>) => apiFetch('/api/consciousness_swaps', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<ConsciousnessSwap>) => apiFetch(`/api/consciousness_swaps/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch(`/api/consciousness_swaps/${id}`, { method: 'DELETE' }),
  },
  characterStates: {
    list: (characterId: string) => apiFetch<{states: CharacterState[]}>(`/api/character_states/${characterId}`),
    create: (data: Partial<CharacterState>) => apiFetch('/api/character_states', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<CharacterState>) => apiFetch(`/api/character_states/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch(`/api/character_states/${id}`, { method: 'DELETE' }),
  },
  relationships: {
    list: () => apiFetch<{relationships: Relationship[]}>('/api/relationships'),
    create: (data: Partial<Relationship>) => apiFetch('/api/relationships', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Relationship>) => apiFetch(`/api/relationships/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch(`/api/relationships/${id}`, { method: 'DELETE' }),
  },
  episodes: {
    list: () => apiFetch<{episodes: Episode[]}>('/api/episodes'),
    create: (data: Partial<Episode>) => apiFetch('/api/episodes', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Episode>) => apiFetch(`/api/episodes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch(`/api/episodes/${id}`, { method: 'DELETE' }),
  },
  foreshadowings: {
    list: () => apiFetch<{foreshadowings: Foreshadowing[]}>('/api/foreshadowings'),
    create: (data: Partial<Foreshadowing>) => apiFetch('/api/foreshadowings', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Foreshadowing>) => apiFetch(`/api/foreshadowings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch(`/api/foreshadowings/${id}`, { method: 'DELETE' }),
  },
  styles: {
    list: () => apiFetch<{styles: StyleGuide[]}>('/api/styles'),
    create: (data: Partial<StyleGuide>) => apiFetch('/api/styles', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<StyleGuide>) => apiFetch(`/api/styles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch(`/api/styles/${id}`, { method: 'DELETE' }),
  },
  sceneRevisions: {
    list: (sceneId: string) => apiFetch<{revisions: SceneBodyRevision[]}>(`/api/scene_revisions/${sceneId}`),
    delete: (id: string) => apiFetch(`/api/scene_revisions/${id}`, { method: 'DELETE' }),
  },
  exportAll: () => apiFetch<{exported_at: string; version: string; tables: Record<string, unknown[]>}>('/api/export'),
};

export interface Character {
  id: string; name: string; aliases: string; role: string;
  is_twin: number; twin_of: string | null; secret: string | null;
  description: string | null; avatar: string | null;
  speech_style: string | null; created_at: string;
}
export interface Scene {
  id: string; title: string; story_time: string | null;
  narrative_order: number | null; location: string | null;
  timeline_branch_id: string | null; disclosure_notes: string | null;
  is_written: number; protagonist_identity_id: string | null;
  body: string | null; synopsis: string | null; reader_goal: string | null;
  episode_id: string | null; created_at: string;
}
export interface EpisodeScene {
  id: string; title: string; narrative_order: number | null;
  is_written: number; char_count: number;
}
export interface Episode {
  id: string; episode_number: number | null; title: string;
  hook: string | null; notes: string | null;
  status: 'draft' | 'published'; created_at: string | null;
  scenes?: EpisodeScene[]; scene_count?: number;
  written_count?: number; total_chars?: number;
}
export interface Foreshadowing {
  id: string; title: string; detail: string | null;
  planted_scene_id: string | null; payoff_scene_id: string | null;
  status: 'open' | 'resolved' | 'dropped';
  reader_effect: string | null; notes: string | null; created_at: string | null;
  planted_scene_title?: string | null; payoff_scene_title?: string | null;
}
export interface WorldRule {
  id: string; category: string; rule: string; applies_from: string | null;
}
export interface SceneCharacter {
  scene_id: string; character_id: string;
  role_in_scene: string; is_pov: number;
  notes: string | null; name: string; role: string;
}
export interface ConsciousnessSwap {
  id: string;
  from_character_id: string; from_name?: string;
  source_body_id: string | null; source_body_name?: string;
  to_character_id: string; to_name?: string;
  swapped_at: string; resolved_at: string | null; ego_recovered_at: string | null;
  trigger_event: string | null; notes: string | null;
}
export interface StyleGuide {
  id: string; category: string; title: string | null;
  content: string; sort_order: number | null;
}
export interface SceneBodyRevision {
  id: string; scene_id: string; saved_at: string;
  char_count: number; body: string;
}
export interface CharacterState {
  id: string; character_id: string; valid_from: string; valid_to: string | null;
  appearance: string | null; status: string | null; notes: string | null;
}
export interface Relationship {
  id: string; character_id_a: string; character_id_b: string;
  relation_type: string; is_public: number;
  valid_from: string | null; valid_to: string | null; notes: string | null;
  name_a?: string; name_b?: string;
}
export interface DashboardData {
  characters: number; scenes: number; written: number;
  unwritten_scenes: {id: string; title: string; narrative_order: number}[];
}
