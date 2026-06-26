const BASE = 'https://novelsync-mcp.tomotsugoo.workers.dev';

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
};

export interface Character {
  id: string; name: string; aliases: string; role: string;
  is_twin: number; twin_of: string | null; secret: string | null;
  description: string | null; avatar: string | null; created_at: string;
}
export interface Scene {
  id: string; title: string; story_time: string | null;
  narrative_order: number | null; location: string | null;
  timeline_branch_id: string | null; disclosure_notes: string | null;
  is_written: number; protagonist_identity_id: string | null;
  body: string | null; created_at: string;
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
