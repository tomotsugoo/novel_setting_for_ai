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
    add: (data: {scene_id: string; character_id: string; role_in_scene: string; notes?: string}) =>
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
};

export interface Character {
  id: string; name: string; aliases: string; role: string;
  is_twin: number; twin_of: string | null; secret: string | null;
  description: string | null; created_at: string;
}
export interface Scene {
  id: string; title: string; story_time: string | null;
  narrative_order: number | null; location: string | null;
  timeline_branch_id: string | null; disclosure_notes: string | null;
  is_written: number; created_at: string;
}
export interface WorldRule {
  id: string; category: string; rule: string; applies_from: string | null;
}
export interface SceneCharacter {
  scene_id: string; character_id: string; role_in_scene: string;
  notes: string | null; name: string; role: string;
}
export interface ConsciousnessSwap {
  id: string;
  from_character_id: string; from_name?: string;
  to_character_id: string; to_name?: string;
  swapped_at: string; resolved_at: string | null;
  is_suppressed: number; trigger_event: string | null; notes: string | null;
}
export interface DashboardData {
  characters: number; scenes: number; written: number;
  unwritten_scenes: {id: string; title: string; narrative_order: number}[];
}
