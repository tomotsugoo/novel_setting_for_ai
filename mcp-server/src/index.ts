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

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function handleApi(request: Request, env: Env, pathname: string, method: string): Promise<Response> {
  const db = env.DB;

  // GET /api/characters
  if (method === "GET" && pathname === "/api/characters") {
    const result = await db.prepare("SELECT * FROM characters ORDER BY name").all();
    return json({ characters: result.results });
  }

  // POST /api/characters
  if (method === "POST" && pathname === "/api/characters") {
    const body = await request.json() as Record<string, unknown>;
    const id = (body.id as string) || (body.name as string).toLowerCase().replace(/\s+/g, "_");
    await db
      .prepare("INSERT INTO characters (id, name, aliases, role, description, secret) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(id, body.name, body.aliases ?? null, body.role ?? null, body.description ?? null, body.secret ?? null)
      .run();
    const created = await db.prepare("SELECT * FROM characters WHERE id = ?").bind(id).first();
    return json({ character: created }, 201);
  }

  // GET /api/characters/:id  or  PUT /api/characters/:id
  const charMatch = pathname.match(/^\/api\/characters\/([^/]+)$/);
  if (charMatch) {
    const id = charMatch[1];
    if (method === "GET") {
      const character = await db.prepare("SELECT * FROM characters WHERE id = ?").bind(id).first();
      if (!character) return json({ error: "Not found" }, 404);
      const states = (await db.prepare("SELECT * FROM character_states WHERE character_id = ? ORDER BY valid_from").bind(id).all()).results;
      return json({ character, character_states: states });
    }
    if (method === "PUT") {
      const body = await request.json() as Record<string, unknown>;
      await db
        .prepare("UPDATE characters SET name=?, aliases=?, role=?, description=?, secret=? WHERE id=?")
        .bind(body.name, body.aliases ?? null, body.role ?? null, body.description ?? null, body.secret ?? null, id)
        .run();
      const updated = await db.prepare("SELECT * FROM characters WHERE id = ?").bind(id).first();
      return json({ character: updated });
    }
  }

  // GET /api/scenes
  if (method === "GET" && pathname === "/api/scenes") {
    const result = await db.prepare("SELECT * FROM scenes ORDER BY narrative_order").all();
    return json({ scenes: result.results });
  }

  // POST /api/scenes
  if (method === "POST" && pathname === "/api/scenes") {
    const body = await request.json() as Record<string, unknown>;
    const id = (body.id as string) || `scene_${Date.now()}`;
    await db
      .prepare("INSERT INTO scenes (id, title, narrative_order, story_time, location, synopsis, is_written, disclosure_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, body.title, body.narrative_order ?? 0, body.story_time ?? null, body.location ?? null, body.synopsis ?? null, body.is_written ? 1 : 0, body.disclosure_notes ?? null)
      .run();
    const created = await db.prepare("SELECT * FROM scenes WHERE id = ?").bind(id).first();
    return json({ scene: created }, 201);
  }

  // PUT /api/scenes/:id
  const sceneMatch = pathname.match(/^\/api\/scenes\/([^/]+)$/);
  if (sceneMatch && method === "PUT") {
    const id = sceneMatch[1];
    const body = await request.json() as Record<string, unknown>;
    await db
      .prepare("UPDATE scenes SET title=?, narrative_order=?, story_time=?, location=?, synopsis=?, is_written=?, disclosure_notes=? WHERE id=?")
      .bind(body.title, body.narrative_order ?? 0, body.story_time ?? null, body.location ?? null, body.synopsis ?? null, body.is_written ? 1 : 0, body.disclosure_notes ?? null, id)
      .run();
    const updated = await db.prepare("SELECT * FROM scenes WHERE id = ?").bind(id).first();
    return json({ scene: updated });
  }

  // GET /api/rules
  if (method === "GET" && pathname === "/api/rules") {
    const result = await db.prepare("SELECT * FROM world_rules ORDER BY category, id").all();
    return json({ rules: result.results });
  }

  // POST /api/rules
  if (method === "POST" && pathname === "/api/rules") {
    const body = await request.json() as Record<string, unknown>;
    const result = await db
      .prepare("INSERT INTO world_rules (category, rule_text, applies_from) VALUES (?, ?, ?)")
      .bind(body.category, body.rule_text, body.applies_from ?? null)
      .run();
    return json({ id: result.meta.last_row_id }, 201);
  }

  // DELETE /api/rules/:id
  const ruleMatch = pathname.match(/^\/api\/rules\/([^/]+)$/);
  if (ruleMatch && method === "DELETE") {
    await db.prepare("DELETE FROM world_rules WHERE id = ?").bind(ruleMatch[1]).run();
    return json({ ok: true });
  }

  // GET /api/dashboard
  if (method === "GET" && pathname === "/api/dashboard") {
    const charCount = (await db.prepare("SELECT COUNT(*) as cnt FROM characters").first()) as { cnt: number };
    const sceneCount = (await db.prepare("SELECT COUNT(*) as cnt FROM scenes").first()) as { cnt: number };
    const writtenCount = (await db.prepare("SELECT COUNT(*) as cnt FROM scenes WHERE is_written = 1").first()) as { cnt: number };
    const unwritten = (await db.prepare("SELECT id, title, narrative_order, story_time, location FROM scenes WHERE is_written = 0 ORDER BY narrative_order").all()).results;
    return json({
      character_count: charCount.cnt,
      scene_count: sceneCount.cnt,
      written_scene_count: writtenCount.cnt,
      unwritten_scenes: unwritten,
    });
  }

  return json({ error: "Not found" }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);

    // REST API routes
    if (url.pathname.startsWith("/api")) {
      return handleApi(request, env, url.pathname, request.method);
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
      return json({ name: "novelsync-mcp", version: "0.1.0", status: "ok" });
    }

    return new Response("Method Not Allowed", { status: 405, headers: CORS });
  },
};
