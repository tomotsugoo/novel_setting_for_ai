const BASE = 'https://novelsync-mcp.tomotsugoo.workers.dev';

export interface Character {
  id: string;
  name: string;
  aliases: string | null;
  role: string | null;
  description: string | null;
  secret: string | null;
}

export interface CharacterState {
  id: number;
  character_id: string;
  valid_from: string;
  valid_to: string | null;
  status: string | null;
  location: string | null;
  notes: string | null;
}

export interface Scene {
  id: string;
  title: string;
  narrative_order: number;
  story_time: string | null;
  location: string | null;
  synopsis: string | null;
  is_written: number;
  disclosure_notes: string | null;
}

export interface WorldRule {
  id: number;
  category: string;
  rule_text: string;
  applies_from: string | null;
}

export interface DashboardData {
  character_count: number;
  scene_count: number;
  written_scene_count: number;
  unwritten_scenes: Partial<Scene>[];
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<T>;
}

// Dashboard
export const getDashboard = () => request<DashboardData>('/api/dashboard');

// Characters
export const listCharacters = () => request<{ characters: Character[] }>('/api/characters');
export const getCharacter = (id: string) => request<{ character: Character; character_states: CharacterState[] }>(`/api/characters/${id}`);
export const createCharacter = (data: Partial<Character>) =>
  request<{ character: Character }>('/api/characters', { method: 'POST', body: JSON.stringify(data) });
export const updateCharacter = (id: string, data: Partial<Character>) =>
  request<{ character: Character }>(`/api/characters/${id}`, { method: 'PUT', body: JSON.stringify(data) });

// Scenes
export const listScenes = () => request<{ scenes: Scene[] }>('/api/scenes');
export const createScene = (data: Partial<Scene>) =>
  request<{ scene: Scene }>('/api/scenes', { method: 'POST', body: JSON.stringify(data) });
export const updateScene = (id: string, data: Partial<Scene>) =>
  request<{ scene: Scene }>(`/api/scenes/${id}`, { method: 'PUT', body: JSON.stringify(data) });

// Rules
export const listRules = () => request<{ rules: WorldRule[] }>('/api/rules');
export const createRule = (data: Partial<WorldRule>) =>
  request<{ id: number }>('/api/rules', { method: 'POST', body: JSON.stringify(data) });
export const deleteRule = (id: number) =>
  request<{ ok: boolean }>(`/api/rules/${id}`, { method: 'DELETE' });
