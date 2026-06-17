export interface Env {
  DB: D1Database;
}

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

const TOOLS = [
  {
    name: "get_character",
    description: "Get a character and their state at a given story time",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Character slug ID" },
        scene_time: { type: "string", description: "ISO8601 story time (optional)" },
      },
      required: ["id"],
    },
  },
  {
    name: "list_characters",
    description: "List all characters (id, name, aliases, role)",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_scene_context",
    description: "Get scene info, character states valid at story_time, and world rules",
    inputSchema: {
      type: "object",
      properties: {
        scene_id: { type: "string", description: "Scene ID" },
      },
      required: ["scene_id"],
    },
  },
  {
    name: "check_conflict",
    description: "Check for conflicts in a description against character states and world rules",
    inputSchema: {
      type: "object",
      properties: {
        description: { type: "string", description: "Description to check for conflicts" },
        scene_time: { type: "string", description: "ISO8601 story time" },
      },
      required: ["description", "scene_time"],
    },
  },
  {
    name: "get_disclosure_level",
    description: "Get disclosure notes and relationship visibility for a scene",
    inputSchema: {
      type: "object",
      properties: {
        scene_id: { type: "string", description: "Scene ID" },
      },
      required: ["scene_id"],
    },
  },
];

async function getCharacter(db: D1Database, args: { id: string; scene_time?: string }): Promise<unknown> {
  const character = await db.prepare("SELECT * FROM characters WHERE id = ?").bind(args.id).first();
  if (!character) return { error: `Character '${args.id}' not found` };

  const state = args.scene_time
    ? await db
        .prepare(
          `SELECT * FROM character_states WHERE character_id = ? AND valid_from <= ? AND (valid_to IS NULL OR valid_to > ?) ORDER BY valid_from DESC LIMIT 1`
        )
        .bind(args.id, args.scene_time, args.scene_time)
        .first()
    : await db
        .prepare(`SELECT * FROM character_states WHERE character_id = ? AND valid_to IS NULL ORDER BY valid_from DESC LIMIT 1`)
        .bind(args.id)
        .first();

  return { character, state };
}

async function listCharacters(db: D1Database): Promise<unknown> {
  const result = await db.prepare("SELECT id, name, aliases, role FROM characters ORDER BY name").all();
  return { characters: result.results };
}

async function getSceneContext(db: D1Database, args: { scene_id: string }): Promise<unknown> {
  const scene = await db.prepare("SELECT * FROM scenes WHERE id = ?").bind(args.scene_id).first();
  if (!scene) return { error: `Scene '${args.scene_id}' not found` };

  const storyTime = scene.story_time as string | null;
  const t = storyTime ?? "9999-99-99";

  const characterStates = storyTime
    ? (
        await db
          .prepare(
            `SELECT cs.*, c.name, c.role FROM character_states cs JOIN characters c ON cs.character_id = c.id WHERE cs.valid_from <= ? AND (cs.valid_to IS NULL OR cs.valid_to > ?) ORDER BY c.name`
          )
          .bind(t, t)
          .all()
      ).results
    : [];

  const worldRules = (
    await db.prepare(`SELECT * FROM world_rules WHERE applies_from IS NULL OR applies_from <= ? ORDER BY category`).bind(t).all()
  ).results;

  return { scene, character_states: characterStates, world_rules: worldRules };
}

async function checkConflict(db: D1Database, args: { description: string; scene_time: string }): Promise<unknown> {
  const states = (
    await db
      .prepare(
        `SELECT cs.*, c.name FROM character_states cs JOIN characters c ON cs.character_id = c.id WHERE cs.valid_from <= ? AND (cs.valid_to IS NULL OR cs.valid_to > ?) ORDER BY c.name`
      )
      .bind(args.scene_time, args.scene_time)
      .all()
  ).results as Array<Record<string, unknown>>;

  const rules = (
    await db.prepare(`SELECT * FROM world_rules WHERE applies_from IS NULL OR applies_from <= ?`).bind(args.scene_time).all()
  ).results;

  const conflicts: string[] = [];
  const desc = args.description.toLowerCase();

  for (const state of states) {
    const name = (state.name as string).toLowerCase();
    if (desc.includes(name) && state.status === "dead") {
      if (desc.includes("speaks") || desc.includes("walks") || desc.includes("appears") || desc.includes("says")) {
        conflicts.push(`Conflict: ${state.name} is dead at ${args.scene_time} but description implies they are alive`);
      }
    }
  }

  return {
    conflicts,
    character_states_checked: states.length,
    world_rules_checked: rules.length,
    note: "Basic keyword check. Review manually for complex conflicts.",
  };
}

async function getDisclosureLevel(db: D1Database, args: { scene_id: string }): Promise<unknown> {
  const scene = await db
    .prepare("SELECT id, title, story_time, disclosure_notes FROM scenes WHERE id = ?")
    .bind(args.scene_id)
    .first();
  if (!scene) return { error: `Scene '${args.scene_id}' not found` };

  const storyTime = scene.story_time as string | null;
  const relationships = storyTime
    ? (
        await db
          .prepare(
            `SELECT r.*, ca.name as name_a, cb.name as name_b FROM relationships r JOIN characters ca ON r.character_id_a = ca.id JOIN characters cb ON r.character_id_b = cb.id WHERE (r.valid_from IS NULL OR r.valid_from <= ?) AND (r.valid_to IS NULL OR r.valid_to > ?) ORDER BY r.is_public, ca.name`
          )
          .bind(storyTime, storyTime)
          .all()
      ).results
    : [];

  return { scene_id: args.scene_id, title: scene.title, story_time: scene.story_time, disclosure_notes: scene.disclosure_notes, relationships };
}

async function handleRpc(req: JsonRpcRequest, env: Env): Promise<JsonRpcResponse> {
  const { id, method, params = {} } = req;
  try {
    switch (method) {
      case "initialize":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2025-03-26",
            capabilities: { tools: {} },
            serverInfo: { name: "novelsync-mcp", version: "0.1.0" },
          },
        };
      case "notifications/initialized":
        return { jsonrpc: "2.0", id, result: {} };
      case "ping":
        return { jsonrpc: "2.0", id, result: {} };
      case "tools/list":
        return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
      case "tools/call": {
        const toolName = params.name as string;
        const toolArgs = (params.arguments ?? {}) as Record<string, unknown>;
        let toolResult: unknown;
        switch (toolName) {
          case "get_character":
            toolResult = await getCharacter(env.DB, toolArgs as { id: string; scene_time?: string });
            break;
          case "list_characters":
            toolResult = await listCharacters(env.DB);
            break;
          case "get_scene_context":
            toolResult = await getSceneContext(env.DB, toolArgs as { scene_id: string });
            break;
          case "check_conflict":
            toolResult = await checkConflict(env.DB, toolArgs as { description: string; scene_time: string });
            break;
          case "get_disclosure_level":
            toolResult = await getDisclosureLevel(env.DB, toolArgs as { scene_id: string });
            break;
          default:
            return { jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown tool: ${toolName}` } };
        }
        return {
          jsonrpc: "2.0",
          id,
          result: { content: [{ type: "text", text: JSON.stringify(toolResult, null, 2) }] },
        };
      }
      default:
        return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
    }
  } catch (err) {
    return { jsonrpc: "2.0", id, error: { code: -32603, message: "Internal error", data: String(err) } };
  }
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Session-Id",
};

async function handleRestApi(request: Request, env: Env, url: URL): Promise<Response> {
  const parts = url.pathname.split('/').filter(Boolean); // ['api', 'characters', 'id']
  const resource = parts[1];
  const id = parts[2];
  const method = request.method;

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

  try {
    if (resource === 'dashboard') {
      const charCount = await env.DB.prepare("SELECT COUNT(*) as n FROM characters").first<{n:number}>();
      const sceneCount = await env.DB.prepare("SELECT COUNT(*) as n FROM scenes").first<{n:number}>();
      const writtenCount = await env.DB.prepare("SELECT COUNT(*) as n FROM scenes WHERE is_written = 1").first<{n:number}>();
      const unwritten = await env.DB.prepare("SELECT id, title, narrative_order FROM scenes WHERE is_written = 0 ORDER BY narrative_order ASC").all();
      return json({ characters: charCount?.n ?? 0, scenes: sceneCount?.n ?? 0, written: writtenCount?.n ?? 0, unwritten_scenes: unwritten.results });
    }

    if (resource === 'characters') {
      if (method === 'GET') {
        const result = await env.DB.prepare("SELECT * FROM characters ORDER BY name").all();
        return json({ characters: result.results });
      }
      if (method === 'POST') {
        const body = await request.json() as {id:string;name:string;aliases?:string;role?:string;description?:string;secret?:string};
        await env.DB.prepare("INSERT INTO characters (id, name, aliases, role, description, secret) VALUES (?, ?, ?, ?, ?, ?)")
          .bind(body.id, body.name, body.aliases ?? null, body.role ?? null, body.description ?? null, body.secret ?? null).run();
        return json({ ok: true });
      }
      if (method === 'PUT' && id) {
        const body = await request.json() as {name?:string;aliases?:string;role?:string;description?:string;secret?:string};
        await env.DB.prepare("UPDATE characters SET name=COALESCE(?,name), aliases=COALESCE(?,aliases), role=COALESCE(?,role), description=COALESCE(?,description), secret=COALESCE(?,secret) WHERE id=?")
          .bind(body.name ?? null, body.aliases ?? null, body.role ?? null, body.description ?? null, body.secret ?? null, id).run();
        return json({ ok: true });
      }
    }

    if (resource === 'scenes') {
      if (method === 'GET') {
        const result = await env.DB.prepare("SELECT * FROM scenes ORDER BY narrative_order ASC").all();
        return json({ scenes: result.results });
      }
      if (method === 'POST') {
        const body = await request.json() as {id:string;title:string;story_time?:string;narrative_order?:number;location?:string;disclosure_notes?:string};
        await env.DB.prepare("INSERT INTO scenes (id, title, story_time, narrative_order, location, disclosure_notes) VALUES (?, ?, ?, ?, ?, ?)")
          .bind(body.id, body.title, body.story_time ?? null, body.narrative_order ?? null, body.location ?? null, body.disclosure_notes ?? null).run();
        return json({ ok: true });
      }
      if (method === 'PUT' && id) {
        const body = await request.json() as {title?:string;story_time?:string;narrative_order?:number;location?:string;disclosure_notes?:string;is_written?:number};
        await env.DB.prepare("UPDATE scenes SET title=COALESCE(?,title), story_time=COALESCE(?,story_time), narrative_order=COALESCE(?,narrative_order), location=COALESCE(?,location), disclosure_notes=COALESCE(?,disclosure_notes), is_written=COALESCE(?,is_written) WHERE id=?")
          .bind(body.title ?? null, body.story_time ?? null, body.narrative_order ?? null, body.location ?? null, body.disclosure_notes ?? null, body.is_written ?? null, id).run();
        return json({ ok: true });
      }
    }

    if (resource === 'rules') {
      if (method === 'GET') {
        const result = await env.DB.prepare("SELECT * FROM world_rules ORDER BY category").all();
        return json({ rules: result.results });
      }
      if (method === 'POST') {
        const body = await request.json() as {id:string;category:string;rule:string;applies_from?:string};
        await env.DB.prepare("INSERT INTO world_rules (id, category, rule, applies_from) VALUES (?, ?, ?, ?)")
          .bind(body.id, body.category, body.rule, body.applies_from ?? null).run();
        return json({ ok: true });
      }
      if (method === 'DELETE' && id) {
        await env.DB.prepare("DELETE FROM world_rules WHERE id=?").bind(id).run();
        return json({ ok: true });
      }
    }

    return json({ error: 'Not found' }, 404);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (url.pathname.startsWith('/api')) {
      return handleRestApi(request, env, url);
    }

    // Streamable HTTP transport: single POST endpoint at /
    if (request.method === "POST") {
      let body: JsonRpcRequest | JsonRpcRequest[];
      try {
        body = await request.json() as JsonRpcRequest | JsonRpcRequest[];
      } catch {
        return new Response(
          JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }),
          { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
        );
      }

      // Handle batch requests
      if (Array.isArray(body)) {
        const responses = await Promise.all(body.map((req) => handleRpc(req, env)));
        return new Response(JSON.stringify(responses), {
          headers: { ...CORS, "Content-Type": "application/json" },
        });
      }

      // Notifications have no id — return 202
      if (body.id === undefined || body.id === null) {
        handleRpc(body, env).catch(() => {});
        return new Response(null, { status: 202, headers: CORS });
      }

      const response = await handleRpc(body, env);
      return new Response(JSON.stringify(response), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Health check
    if (request.method === "GET") {
      return new Response(JSON.stringify({ name: "novelsync-mcp", version: "0.1.0", status: "ok" }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    return new Response("Method Not Allowed", { status: 405, headers: CORS });
  },
};
