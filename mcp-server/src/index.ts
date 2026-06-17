export interface Env {
  DB: D1Database;
}

// JSON-RPC 2.0 types
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

// MCP Tool definitions
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

// Tool handlers
async function getCharacter(
  db: D1Database,
  args: { id: string; scene_time?: string }
): Promise<unknown> {
  const character = await db
    .prepare("SELECT * FROM characters WHERE id = ?")
    .bind(args.id)
    .first();

  if (!character) {
    return { error: `Character '${args.id}' not found` };
  }

  let state = null;
  if (args.scene_time) {
    state = await db
      .prepare(
        `SELECT * FROM character_states
         WHERE character_id = ?
           AND valid_from <= ?
           AND (valid_to IS NULL OR valid_to > ?)
         ORDER BY valid_from DESC
         LIMIT 1`
      )
      .bind(args.id, args.scene_time, args.scene_time)
      .first();
  } else {
    state = await db
      .prepare(
        `SELECT * FROM character_states
         WHERE character_id = ? AND valid_to IS NULL
         ORDER BY valid_from DESC
         LIMIT 1`
      )
      .bind(args.id)
      .first();
  }

  return { character, state };
}

async function listCharacters(db: D1Database): Promise<unknown> {
  const result = await db
    .prepare("SELECT id, name, aliases, role FROM characters ORDER BY name")
    .all();
  return { characters: result.results };
}

async function getSceneContext(
  db: D1Database,
  args: { scene_id: string }
): Promise<unknown> {
  const scene = await db
    .prepare("SELECT * FROM scenes WHERE id = ?")
    .bind(args.scene_id)
    .first();

  if (!scene) {
    return { error: `Scene '${args.scene_id}' not found` };
  }

  const storyTime = scene.story_time as string | null;

  let characterStates: unknown[] = [];
  if (storyTime) {
    const statesResult = await db
      .prepare(
        `SELECT cs.*, c.name, c.role FROM character_states cs
         JOIN characters c ON cs.character_id = c.id
         WHERE cs.valid_from <= ?
           AND (cs.valid_to IS NULL OR cs.valid_to > ?)
         ORDER BY c.name`
      )
      .bind(storyTime, storyTime)
      .all();
    characterStates = statesResult.results;
  }

  const worldRulesResult = await db
    .prepare(
      `SELECT * FROM world_rules
       WHERE applies_from IS NULL OR applies_from <= ?
       ORDER BY category`
    )
    .bind(storyTime ?? "9999-99-99")
    .all();

  return {
    scene,
    character_states: characterStates,
    world_rules: worldRulesResult.results,
  };
}

async function checkConflict(
  db: D1Database,
  args: { description: string; scene_time: string }
): Promise<unknown> {
  const statesResult = await db
    .prepare(
      `SELECT cs.*, c.name FROM character_states cs
       JOIN characters c ON cs.character_id = c.id
       WHERE cs.valid_from <= ?
         AND (cs.valid_to IS NULL OR cs.valid_to > ?)
       ORDER BY c.name`
    )
    .bind(args.scene_time, args.scene_time)
    .all();

  const rulesResult = await db
    .prepare(
      `SELECT * FROM world_rules
       WHERE applies_from IS NULL OR applies_from <= ?`
    )
    .bind(args.scene_time)
    .all();

  const conflicts: string[] = [];
  const desc = args.description.toLowerCase();

  // Check character status conflicts
  for (const state of statesResult.results as Array<Record<string, unknown>>) {
    const name = (state.name as string).toLowerCase();
    if (desc.includes(name)) {
      if (state.status === "dead" && (desc.includes("speaks") || desc.includes("walks") || desc.includes("appears"))) {
        conflicts.push(
          `Possible conflict: ${state.name} is dead at ${args.scene_time} but description may imply they are alive`
        );
      }
    }
  }

  return {
    description: args.description,
    scene_time: args.scene_time,
    conflicts,
    character_states_checked: statesResult.results.length,
    world_rules_checked: rulesResult.results.length,
    note: "This is a basic keyword check. Review manually for complex conflicts.",
  };
}

async function getDisclosureLevel(
  db: D1Database,
  args: { scene_id: string }
): Promise<unknown> {
  const scene = await db
    .prepare("SELECT id, title, story_time, disclosure_notes FROM scenes WHERE id = ?")
    .bind(args.scene_id)
    .first();

  if (!scene) {
    return { error: `Scene '${args.scene_id}' not found` };
  }

  const storyTime = scene.story_time as string | null;

  let relationships: unknown[] = [];
  if (storyTime) {
    const relResult = await db
      .prepare(
        `SELECT r.*, ca.name as name_a, cb.name as name_b
         FROM relationships r
         JOIN characters ca ON r.character_id_a = ca.id
         JOIN characters cb ON r.character_id_b = cb.id
         WHERE (r.valid_from IS NULL OR r.valid_from <= ?)
           AND (r.valid_to IS NULL OR r.valid_to > ?)
         ORDER BY r.is_public, ca.name`
      )
      .bind(storyTime, storyTime)
      .all();
    relationships = relResult.results;
  }

  return {
    scene_id: args.scene_id,
    title: scene.title,
    story_time: scene.story_time,
    disclosure_notes: scene.disclosure_notes,
    relationships,
  };
}

// JSON-RPC dispatcher
async function handleRpc(request: JsonRpcRequest, env: Env): Promise<JsonRpcResponse> {
  const { id, method, params = {} } = request;

  try {
    switch (method) {
      case "initialize":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: { name: "novelsync-mcp", version: "0.1.0" },
          },
        };

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
            return {
              jsonrpc: "2.0",
              id,
              error: { code: -32601, message: `Unknown tool: ${toolName}` },
            };
        }

        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: JSON.stringify(toolResult, null, 2) }],
          },
        };
      }

      default:
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        };
    }
  } catch (err) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32603, message: "Internal error", data: String(err) },
    };
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // SSE endpoint
    if (url.pathname === "/sse" && request.method === "GET") {
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      // Send endpoint event
      const endpointEvent = `event: endpoint\ndata: ${JSON.stringify({ uri: "/message" })}\n\n`;
      writer.write(encoder.encode(endpointEvent));

      return new Response(readable, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // JSON-RPC message endpoint
    if (url.pathname === "/message" && request.method === "POST") {
      let body: JsonRpcRequest;
      try {
        body = await request.json() as JsonRpcRequest;
      } catch {
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: null,
            error: { code: -32700, message: "Parse error" },
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const response = await handleRpc(body, env);
      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },
};
