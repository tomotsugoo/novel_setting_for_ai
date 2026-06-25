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
    name: "list_scenes",
    description: "全シーン一覧を取得する（id・タイトル・執筆順・物語時間・執筆済みフラグ）。シーンIDを調べるときに使う。",
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
  {
    name: "check_all_consistency",
    description: "全データを横断して整合性・矛盾をチェックする。意識入れ替わりの時系列矛盾、シーンのprotagonist_identity_idとswapの整合性、孤立キャラ・孤立シーン、narrative_orderの重複・欠番を検出する。",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "save_scene_body",
    description: "シーンの本文を保存する。執筆した本文テキストをシーンIDを指定してDBに書き込む。is_writtenも同時にtrueにする。",
    inputSchema: {
      type: "object",
      properties: {
        scene_id: { type: "string", description: "シーンID" },
        body: { type: "string", description: "本文テキスト" },
      },
      required: ["scene_id", "body"],
    },
  },
  {
    name: "update_scene",
    description: "シーンのメタ情報（タイトル・場所・開示メモ等）を更新する。",
    inputSchema: {
      type: "object",
      properties: {
        scene_id: { type: "string", description: "シーンID" },
        title: { type: "string", description: "タイトル" },
        location: { type: "string", description: "場所" },
        disclosure_notes: { type: "string", description: "開示メモ（読者への開示状況メモ）" },
      },
      required: ["scene_id"],
    },
  },
  {
    name: "create_character",
    description: "新しいキャラクターをDBに登録する。",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "キャラクターID（英数字・ハイフン）" },
        name: { type: "string", description: "名前" },
        aliases: { type: "string", description: "別名・呼び名（複数あればカンマ区切り）" },
        role: { type: "string", description: "役割: protagonist / antagonist / supporting" },
        description: { type: "string", description: "説明・プロフィール" },
        secret: { type: "string", description: "秘密・読者非開示情報" },
      },
      required: ["id", "name"],
    },
  },
  {
    name: "add_character_state",
    description: "キャラクターの状態変化（外見・生死・メモ）をシーン時点で記録する。意識入れ替わりや変身・変装などの変化を記録するのに使う。",
    inputSchema: {
      type: "object",
      properties: {
        character_id: { type: "string", description: "キャラクターID" },
        scene_id: { type: "string", description: "この状態になるシーンID（valid_fromに使用）" },
        appearance: { type: "string", description: "外見の説明" },
        status: { type: "string", description: "状態（例: 生存、死亡、負傷）" },
        notes: { type: "string", description: "メモ" },
      },
      required: ["character_id", "scene_id"],
    },
  },
  {
    name: "add_relationship",
    description: "キャラクター間の関係性を登録する。",
    inputSchema: {
      type: "object",
      properties: {
        character_id_a: { type: "string", description: "キャラクターAのID" },
        character_id_b: { type: "string", description: "キャラクターBのID" },
        relation_type: { type: "string", description: "関係の種類（例: 幼馴染、師弟、恋人、敵対）" },
        is_public: { type: "boolean", description: "読者に開示済みかどうか" },
        from_scene_id: { type: "string", description: "この関係が始まるシーンID（省略可）" },
        notes: { type: "string", description: "メモ" },
      },
      required: ["character_id_a", "character_id_b", "relation_type"],
    },
  },
];

async function getConsciousness(db: D1Database, characterId: string, sceneTime?: string): Promise<unknown> {
  const t = sceneTime ?? "9999-99-99";
  // この体に誰かの意識が入っているか（to_character_id = この体の持ち主）
  const swapIn = await db.prepare(
    `SELECT cs.*, c_from.name as owner_name, c_from.id as owner_id
     FROM consciousness_swaps cs
     JOIN characters c_from ON cs.from_character_id = c_from.id
     WHERE cs.to_character_id = ?
       AND cs.swapped_at <= ?
       AND (cs.resolved_at IS NULL OR cs.resolved_at > ?)
     ORDER BY cs.swapped_at DESC LIMIT 1`
  ).bind(characterId, t, t).first() as Record<string, unknown> | null;

  // この意識がどこかの体に入っているか（from_character_id = この意識の持ち主）
  const swapOut = await db.prepare(
    `SELECT cs.*, c_to.name as body_name, c_to.id as body_id
     FROM consciousness_swaps cs
     JOIN characters c_to ON cs.to_character_id = c_to.id
     WHERE cs.from_character_id = ?
       AND cs.swapped_at <= ?
       AND (cs.resolved_at IS NULL OR cs.resolved_at > ?)
     ORDER BY cs.swapped_at DESC LIMIT 1`
  ).bind(characterId, t, t).first() as Record<string, unknown> | null;

  if (!swapIn && !swapOut) return null;

  if (swapIn) {
    return {
      type: "inhabited_by",
      owner_id: swapIn.owner_id,
      owner_name: swapIn.owner_name,
      trigger_event: swapIn.trigger_event,
      notes: swapIn.notes,
      swapped_at: swapIn.swapped_at,
    };
  }

  if (swapOut) {
    return {
      type: "consciousness_displaced",
      current_body_id: swapOut.body_id,
      current_body_name: swapOut.body_name,
      trigger_event: swapOut.trigger_event,
      notes: swapOut.notes,
      swapped_at: swapOut.swapped_at,
    };
  }

  return null;
}

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

  const consciousness = await getConsciousness(db, args.id, args.scene_time);

  return { character, state, consciousness };
}

async function listCharacters(db: D1Database): Promise<unknown> {
  const result = await db.prepare("SELECT id, name, aliases, role FROM characters ORDER BY name").all();
  return { characters: result.results };
}

async function listScenes(db: D1Database): Promise<unknown> {
  const result = await db.prepare(
    "SELECT id, title, narrative_order, story_time, location, is_written FROM scenes ORDER BY narrative_order ASC, story_time ASC"
  ).all();
  return { scenes: result.results };
}

async function getSceneContext(db: D1Database, args: { scene_id: string }): Promise<unknown> {
  const scene = await db.prepare("SELECT * FROM scenes WHERE id = ?").bind(args.scene_id).first();
  if (!scene) return { error: `Scene '${args.scene_id}' not found` };

  const storyTime = scene.story_time as string | null;
  const narrativeOrder = scene.narrative_order as number | null;
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

  // 意識入れ替わり情報
  const swaps = storyTime ? (
    await db.prepare(
      `SELECT cs.*,
        c_from.name as from_name, c_to.name as to_name
       FROM consciousness_swaps cs
       JOIN characters c_from ON cs.from_character_id = c_from.id
       JOIN characters c_to ON cs.to_character_id = c_to.id
       WHERE cs.swapped_at <= ?
         AND (cs.resolved_at IS NULL OR cs.resolved_at > ?)
       ORDER BY cs.swapped_at DESC`
    ).bind(t, t).all()
  ).results : [];

  // 登場人物（基本情報）
  const sceneCharacters = (
    await db.prepare(
      `SELECT sc.*, c.name, c.role, c.aliases, c.description, c.secret
       FROM scene_characters sc JOIN characters c ON sc.character_id = c.id
       WHERE sc.scene_id = ? ORDER BY sc.role_in_scene`
    ).bind(args.scene_id).all()
  ).results as Array<Record<string, unknown>>;

  // 登場キャラごとに現在の状態・意識を統合（D1は逐次処理）
  const charactersInScene: Array<Record<string, unknown>> = [];
  for (const sc of sceneCharacters) {
    const charId = sc.character_id as string;

    // このシーン時点での外見・状態
    const charState = storyTime
      ? await db.prepare(
          `SELECT appearance, status, notes FROM character_states WHERE character_id=? AND valid_from <= ? AND (valid_to IS NULL OR valid_to > ?) ORDER BY valid_from DESC LIMIT 1`
        ).bind(charId, t, t).first() as { appearance: string | null; status: string | null; notes: string | null } | null
      : null;

    // 意識の入れ替わり（このキャラの意識がどこかに移っているか）
    const swapOut = swaps.find((s: Record<string, unknown>) => s.from_character_id === charId) as Record<string, unknown> | undefined;
    // このキャラの体に誰かの意識が入っているか
    const swapIn = swaps.find((s: Record<string, unknown>) => s.to_character_id === charId) as Record<string, unknown> | undefined;

    let consciousnessNote: string | null = null;
    if (swapOut) {
      consciousnessNote = `【意識退出】この体の本来の持ち主だが、意識は「${swapOut.to_name}」の体に移っている`;
    } else if (swapIn) {
      consciousnessNote = `【意識受入】この体には「${swapIn.from_name}」の意識が入っている（外見はこのキャラだが、中身は別人）`;
    }

    charactersInScene.push({
      character_id: charId,
      name: sc.name,
      aliases: sc.aliases,
      role: sc.role,
      role_in_scene: sc.role_in_scene,
      description: sc.description,
      secret: sc.secret,
      current_appearance: charState?.appearance ?? null,
      current_status: charState?.status ?? null,
      state_notes: charState?.notes ?? null,
      consciousness_note: consciousnessNote,
    });
  }

  // 関係性（このシーン時点で有効）
  const relationships = storyTime ? (
    await db.prepare(
      `SELECT r.*, ca.name as name_a, cb.name as name_b
       FROM relationships r
       JOIN characters ca ON r.character_id_a = ca.id
       JOIN characters cb ON r.character_id_b = cb.id
       WHERE (r.valid_from IS NULL OR r.valid_from <= ?)
         AND (r.valid_to IS NULL OR r.valid_to > ?)
       ORDER BY r.is_public DESC, ca.name`
    ).bind(t, t).all()
  ).results : (
    await db.prepare(
      `SELECT r.*, ca.name as name_a, cb.name as name_b
       FROM relationships r
       JOIN characters ca ON r.character_id_a = ca.id
       JOIN characters cb ON r.character_id_b = cb.id
       ORDER BY r.is_public DESC, ca.name`
    ).all()
  ).results;

  // 前後のシーン（物語順）
  const prevScene = narrativeOrder != null
    ? await db.prepare(`SELECT id, title, narrative_order, story_time, location FROM scenes WHERE narrative_order < ? ORDER BY narrative_order DESC LIMIT 1`).bind(narrativeOrder).first()
    : null;
  const nextScene = narrativeOrder != null
    ? await db.prepare(`SELECT id, title, narrative_order, story_time, location FROM scenes WHERE narrative_order > ? ORDER BY narrative_order ASC LIMIT 1`).bind(narrativeOrder).first()
    : null;

  // 主人公ステータスを合成（意識の主 × 体の持ち主 × 外見状態）
  let protagonistStatus: Record<string, unknown> | null = null;
  const protagonistId = scene.protagonist_identity_id as string | null;
  if (protagonistId) {
    const identityChar = await db.prepare("SELECT id, name, role FROM characters WHERE id=?").bind(protagonistId).first() as { id: string; name: string; role: string } | null;

    // この意識がどこかの体に入っているか
    const swapOut = swaps.find((s: Record<string, unknown>) => s.from_character_id === protagonistId) as Record<string, unknown> | undefined;
    // この意識の体（入れ替わりがあれば相手の体、なければ自分の体）
    const bodyId = swapOut ? (swapOut.to_character_id as string) : protagonistId;
    const bodyChar = bodyId !== protagonistId
      ? await db.prepare("SELECT id, name FROM characters WHERE id=?").bind(bodyId).first() as { id: string; name: string } | null
      : null;

    // 体の外見状態
    const bodyState = storyTime
      ? await db.prepare(
          `SELECT appearance, status, notes FROM character_states WHERE character_id=? AND valid_from <= ? AND (valid_to IS NULL OR valid_to > ?) ORDER BY valid_from DESC LIMIT 1`
        ).bind(bodyId, t, t).first() as { appearance: string | null; status: string | null; notes: string | null } | null
      : null;

    // 意識の元々の外見状態（参考用）
    const identityState = storyTime && bodyId !== protagonistId
      ? await db.prepare(
          `SELECT appearance, status FROM character_states WHERE character_id=? AND valid_from <= ? AND (valid_to IS NULL OR valid_to > ?) ORDER BY valid_from DESC LIMIT 1`
        ).bind(protagonistId, t, t).first() as { appearance: string | null; status: string | null } | null
      : null;

    const sourceBodyId = swapOut ? ((swapOut.source_body_id as string | null) ?? protagonistId) : protagonistId;
    const sourceBodyChar = sourceBodyId !== protagonistId
      ? await db.prepare("SELECT id, name FROM characters WHERE id=?").bind(sourceBodyId).first() as { id: string; name: string } | null
      : null;

    protagonistStatus = {
      summary: swapOut
        ? `【意識】${identityChar?.name}が【元の体】${sourceBodyChar?.name ?? identityChar?.name}から【現在の体】${bodyChar?.name}に乗り移っている状態`
        : `【意識・体とも】${identityChar?.name}本人（入れ替わりなし）`,
      consciousness: {
        character_id: protagonistId,
        name: identityChar?.name,
        note: "物語の内面視点・思考・感情はこのキャラのもの",
      },
      source_body: {
        character_id: sourceBodyId,
        name: sourceBodyChar?.name ?? identityChar?.name,
        note: "意識が元いた体",
        original_appearance: identityState?.appearance ?? null,
      },
      body: {
        character_id: bodyId,
        name: bodyChar?.name ?? identityChar?.name,
        note: "読者・他キャラからはこの外見に見える",
        current_appearance: bodyState?.appearance ?? null,
        current_status: bodyState?.status ?? null,
        appearance_notes: bodyState?.notes ?? null,
      },
      swap_active: !!swapOut,
      ego_recovered_at: swapOut ? (swapOut.ego_recovered_at ?? null) : null,
    };
  }

  return {
    scene,
    protagonist_status: protagonistStatus,
    characters_in_scene: charactersInScene,
    previous_scene: prevScene,
    next_scene: nextScene,
    relationships,
    world_rules: worldRules,
  };
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

async function checkAllConsistency(db: D1Database): Promise<unknown> {
  const issues: { severity: "error" | "warning" | "info"; category: string; message: string }[] = [];

  const characters = (await db.prepare("SELECT id, name FROM characters").all()).results as Array<{ id: string; name: string }>;
  const scenes = (await db.prepare("SELECT id, title, story_time, narrative_order, protagonist_identity_id FROM scenes ORDER BY story_time").all()).results as Array<{ id: string; title: string; story_time: string | null; narrative_order: number | null; protagonist_identity_id: string | null }>;
  const swaps = (await db.prepare("SELECT * FROM consciousness_swaps ORDER BY swapped_at").all()).results as Array<{ id: string; from_character_id: string; to_character_id: string; swapped_at: string; resolved_at: string | null; trigger_event: string | null; notes: string | null }>;
  const sceneChars = (await db.prepare("SELECT scene_id, character_id FROM scene_characters").all()).results as Array<{ scene_id: string; character_id: string }>;

  const charIds = new Set(characters.map(c => c.id));
  const charName = (id: string) => characters.find(c => c.id === id)?.name ?? id;

  // 1. 意識入れ替わりの時系列矛盾
  for (const sw of swaps) {
    if (sw.resolved_at && sw.resolved_at <= sw.swapped_at) {
      issues.push({ severity: "error", category: "意識入れ替わり", message: `「${charName(sw.from_character_id)}→${charName(sw.to_character_id)}」の解決日時(${sw.resolved_at})が入れ替わり日時(${sw.swapped_at})以前です` });
    }
  }

  // 2. 同一キャラが同時期に複数の入れ替わりに関与
  for (let i = 0; i < swaps.length; i++) {
    for (let j = i + 1; j < swaps.length; j++) {
      const a = swaps[i], b = swaps[j];
      const aEnd = a.resolved_at ?? "9999-99-99";
      const bEnd = b.resolved_at ?? "9999-99-99";
      const overlap = a.swapped_at < bEnd && b.swapped_at < aEnd;
      if (!overlap) continue;
      const aChars = new Set([a.from_character_id, a.to_character_id]);
      const bChars = new Set([b.from_character_id, b.to_character_id]);
      for (const cid of aChars) {
        if (bChars.has(cid)) {
          issues.push({ severity: "error", category: "意識入れ替わり", message: `「${charName(cid)}」が同時期に複数の入れ替わりに関与しています（ID: ${a.id} と ${b.id}）` });
        }
      }
    }
  }

  // 3. 入れ替わりに存在しないキャラIDが使われている
  for (const sw of swaps) {
    if (!charIds.has(sw.from_character_id)) {
      issues.push({ severity: "error", category: "参照整合性", message: `入れ替わり(${sw.id})のfrom_character_id「${sw.from_character_id}」はキャラとして登録されていません` });
    }
    if (!charIds.has(sw.to_character_id)) {
      issues.push({ severity: "error", category: "参照整合性", message: `入れ替わり(${sw.id})のto_character_id「${sw.to_character_id}」はキャラとして登録されていません` });
    }
  }

  // 4. シーンのprotagonist_identity_idとその時刻のswapが一致しているか
  for (const scene of scenes) {
    if (!scene.protagonist_identity_id || !scene.story_time) continue;
    const t = scene.story_time;
    const activeSwap = swaps.find(sw =>
      sw.swapped_at <= t && (sw.resolved_at == null || sw.resolved_at > t) &&
      (sw.from_character_id === scene.protagonist_identity_id || sw.to_character_id === scene.protagonist_identity_id)
    );
    if (!activeSwap && !charIds.has(scene.protagonist_identity_id)) {
      issues.push({ severity: "error", category: "シーン自認", message: `シーン「${scene.title}」のprotagonist_identity_id「${scene.protagonist_identity_id}」はキャラ未登録です` });
    }
  }

  // 5. narrative_orderの重複
  const orders = scenes.map(s => s.narrative_order).filter(o => o != null) as number[];
  const orderCount: Record<number, number> = {};
  for (const o of orders) orderCount[o] = (orderCount[o] ?? 0) + 1;
  for (const [o, count] of Object.entries(orderCount)) {
    if (count > 1) {
      const dups = scenes.filter(s => s.narrative_order === Number(o)).map(s => `「${s.title}」`).join(", ");
      issues.push({ severity: "error", category: "シーン順序", message: `第${o}話が重複しています: ${dups}` });
    }
  }

  // 6. narrative_orderの欠番
  if (orders.length > 0) {
    const max = Math.max(...orders);
    for (let i = 1; i <= max; i++) {
      if (!orderCount[i]) {
        issues.push({ severity: "warning", category: "シーン順序", message: `第${i}話が欠番です` });
      }
    }
  }

  // 7. どのシーンにも登場しないキャラ
  const appearedChars = new Set(sceneChars.map(sc => sc.character_id));
  for (const c of characters) {
    if (!appearedChars.has(c.id)) {
      issues.push({ severity: "info", category: "孤立データ", message: `キャラ「${c.name}」はどのシーンにも登場していません` });
    }
  }

  // 8. story_timeのないシーンの数
  const noTimeScenes = scenes.filter(s => !s.story_time);
  if (noTimeScenes.length > 0) {
    issues.push({ severity: "info", category: "シーン情報", message: `物語時間が未設定のシーンが${noTimeScenes.length}件あります: ${noTimeScenes.map(s => `「${s.title}」`).join(", ")}` });
  }

  const errors = issues.filter(i => i.severity === "error");
  const warnings = issues.filter(i => i.severity === "warning");
  const infos = issues.filter(i => i.severity === "info");

  return {
    summary: {
      errors: errors.length,
      warnings: warnings.length,
      info: infos.length,
      total_issues: issues.length,
    },
    issues,
    stats: {
      characters: characters.length,
      scenes: scenes.length,
      swaps: swaps.length,
    },
    scene_list: scenes.map(s => ({ id: s.id, title: s.title, narrative_order: s.narrative_order, story_time: s.story_time })),
  };
}

async function saveSceneBody(db: D1Database, args: { scene_id: string; body: string }): Promise<unknown> {
  const scene = await db.prepare("SELECT id, title FROM scenes WHERE id=?").bind(args.scene_id).first();
  if (!scene) return { error: `Scene '${args.scene_id}' not found` };
  await db.prepare("UPDATE scenes SET body=?, is_written=1 WHERE id=?").bind(args.body, args.scene_id).run();
  return { ok: true, scene_id: args.scene_id, title: scene.title, characters: args.body.length };
}

async function updateScene(db: D1Database, args: { scene_id: string; title?: string; location?: string; disclosure_notes?: string }): Promise<unknown> {
  const scene = await db.prepare("SELECT id FROM scenes WHERE id=?").bind(args.scene_id).first();
  if (!scene) return { error: `Scene '${args.scene_id}' not found` };
  await db.prepare(
    "UPDATE scenes SET title=COALESCE(?,title), location=COALESCE(?,location), disclosure_notes=COALESCE(?,disclosure_notes) WHERE id=?"
  ).bind(args.title ?? null, args.location ?? null, args.disclosure_notes ?? null, args.scene_id).run();
  return { ok: true, scene_id: args.scene_id };
}

async function createCharacter(db: D1Database, args: { id: string; name: string; aliases?: string; role?: string; description?: string; secret?: string }): Promise<unknown> {
  const exists = await db.prepare("SELECT id FROM characters WHERE id=?").bind(args.id).first();
  if (exists) return { error: `Character '${args.id}' already exists` };
  await db.prepare("INSERT INTO characters (id,name,aliases,role,description,secret) VALUES (?,?,?,?,?,?)")
    .bind(args.id, args.name, args.aliases ?? null, args.role ?? 'supporting', args.description ?? null, args.secret ?? null).run();
  return { ok: true, id: args.id, name: args.name };
}

async function addCharacterState(db: D1Database, args: { character_id: string; scene_id: string; appearance?: string; status?: string; notes?: string }): Promise<unknown> {
  const scene = await db.prepare("SELECT story_time, title FROM scenes WHERE id=?").bind(args.scene_id).first() as { story_time: string | null; title: string } | null;
  if (!scene) return { error: `Scene '${args.scene_id}' not found` };
  if (!scene.story_time) return { error: `Scene '${args.scene_id}' has no story_time set` };
  const char = await db.prepare("SELECT id FROM characters WHERE id=?").bind(args.character_id).first();
  if (!char) return { error: `Character '${args.character_id}' not found` };
  const id = crypto.randomUUID();
  await db.prepare("INSERT INTO character_states (id,character_id,valid_from,appearance,status,notes) VALUES (?,?,?,?,?,?)")
    .bind(id, args.character_id, scene.story_time, args.appearance ?? null, args.status ?? null, args.notes ?? null).run();
  return { ok: true, id, character_id: args.character_id, valid_from: scene.story_time, scene_title: scene.title };
}

async function addRelationship(db: D1Database, args: { character_id_a: string; character_id_b: string; relation_type: string; is_public?: boolean; from_scene_id?: string; notes?: string }): Promise<unknown> {
  let validFrom: string | null = null;
  if (args.from_scene_id) {
    const scene = await db.prepare("SELECT story_time FROM scenes WHERE id=?").bind(args.from_scene_id).first() as { story_time: string | null } | null;
    if (!scene) return { error: `Scene '${args.from_scene_id}' not found` };
    validFrom = scene.story_time;
  }
  const id = crypto.randomUUID();
  await db.prepare("INSERT INTO relationships (id,character_id_a,character_id_b,relation_type,is_public,valid_from,notes) VALUES (?,?,?,?,?,?,?)")
    .bind(id, args.character_id_a, args.character_id_b, args.relation_type, args.is_public ? 1 : 0, validFrom, args.notes ?? null).run();
  return { ok: true, id };
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
          case "list_scenes":
            toolResult = await listScenes(env.DB);
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
          case "check_all_consistency":
            toolResult = await checkAllConsistency(env.DB);
            break;
          case "save_scene_body":
            toolResult = await saveSceneBody(env.DB, toolArgs as { scene_id: string; body: string });
            break;
          case "update_scene":
            toolResult = await updateScene(env.DB, toolArgs as { scene_id: string; title?: string; location?: string; disclosure_notes?: string });
            break;
          case "create_character":
            toolResult = await createCharacter(env.DB, toolArgs as { id: string; name: string; aliases?: string; role?: string; description?: string; secret?: string });
            break;
          case "add_character_state":
            toolResult = await addCharacterState(env.DB, toolArgs as { character_id: string; scene_id: string; appearance?: string; status?: string; notes?: string });
            break;
          case "add_relationship":
            toolResult = await addRelationship(env.DB, toolArgs as { character_id_a: string; character_id_b: string; relation_type: string; is_public?: boolean; from_scene_id?: string; notes?: string });
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
        const body = await request.json() as {name?:string;aliases?:string;role?:string;description?:string;secret?:string;avatar?:string|null};
        const hasAvatar = 'avatar' in (body as object);
        await env.DB.prepare(
          "UPDATE characters SET name=COALESCE(?,name), aliases=COALESCE(?,aliases), role=COALESCE(?,role), description=COALESCE(?,description), secret=COALESCE(?,secret), avatar=CASE WHEN ?=1 THEN ? ELSE avatar END WHERE id=?"
        ).bind(body.name ?? null, body.aliases ?? null, body.role ?? null, body.description ?? null, body.secret ?? null, hasAvatar ? 1 : 0, body.avatar ?? null, id).run();
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
        const body = await request.json() as {title?:string;story_time?:string;narrative_order?:number;location?:string;disclosure_notes?:string;is_written?:number;protagonist_identity_id?:string|null;body?:string|null};
        const hasIdentity = 'protagonist_identity_id' in (body as object);
        const hasBody = 'body' in (body as object);
        await env.DB.prepare(
          "UPDATE scenes SET title=COALESCE(?,title), story_time=COALESCE(?,story_time), narrative_order=COALESCE(?,narrative_order), location=COALESCE(?,location), disclosure_notes=COALESCE(?,disclosure_notes), is_written=COALESCE(?,is_written), protagonist_identity_id=CASE WHEN ?=1 THEN ? ELSE protagonist_identity_id END, body=CASE WHEN ?=1 THEN ? ELSE body END WHERE id=?"
        ).bind(
          body.title ?? null, body.story_time ?? null, body.narrative_order ?? null,
          body.location ?? null, body.disclosure_notes ?? null, body.is_written ?? null,
          hasIdentity ? 1 : 0, body.protagonist_identity_id ?? null,
          hasBody ? 1 : 0, body.body ?? null, id
        ).run();
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

    if (resource === 'scene_characters') {
      if (method === 'GET') {
        const sceneId = parts[2];
        if (sceneId) {
          const result = await env.DB.prepare(
            `SELECT sc.*, c.name, c.role FROM scene_characters sc JOIN characters c ON sc.character_id = c.id WHERE sc.scene_id = ? ORDER BY sc.role_in_scene`
          ).bind(sceneId).all();
          return json({ scene_characters: result.results });
        }
        const result = await env.DB.prepare("SELECT * FROM scene_characters").all();
        return json({ scene_characters: result.results });
      }
      if (method === 'POST') {
        const body = await request.json() as {scene_id:string;character_id:string;role_in_scene?:string;notes?:string};
        await env.DB.prepare("INSERT OR REPLACE INTO scene_characters (scene_id, character_id, role_in_scene, notes) VALUES (?, ?, ?, ?)")
          .bind(body.scene_id, body.character_id, body.role_in_scene ?? 'sub', body.notes ?? null).run();
        return json({ ok: true });
      }
      if (method === 'DELETE') {
        const sceneId = parts[2];
        const characterId = parts[3];
        if (sceneId && characterId) {
          await env.DB.prepare("DELETE FROM scene_characters WHERE scene_id=? AND character_id=?").bind(sceneId, characterId).run();
          return json({ ok: true });
        }
      }
    }

    if (resource === 'consciousness_swaps') {
      if (method === 'GET') {
        const result = await env.DB.prepare(
          `SELECT cs.*, c_from.name as from_name, c_to.name as to_name
           FROM consciousness_swaps cs
           JOIN characters c_from ON cs.from_character_id = c_from.id
           JOIN characters c_to ON cs.to_character_id = c_to.id
           ORDER BY cs.swapped_at DESC`
        ).all();
        return json({ swaps: result.results });
      }
      if (method === 'POST') {
        const body = await request.json() as {
          id: string; from_character_id: string; source_body_id?: string; to_character_id: string;
          swapped_at: string; resolved_at?: string; ego_recovered_at?: string;
          trigger_event?: string; notes?: string;
        };
        await env.DB.prepare(
          `INSERT INTO consciousness_swaps (id, from_character_id, source_body_id, to_character_id, swapped_at, resolved_at, ego_recovered_at, trigger_event, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          body.id, body.from_character_id, body.source_body_id ?? null,
          body.to_character_id,
          body.swapped_at, body.resolved_at ?? null,
          body.ego_recovered_at ?? null,
          body.trigger_event ?? null, body.notes ?? null
        ).run();
        return json({ ok: true });
      }
      if (method === 'PUT' && id) {
        const body = await request.json() as {from_character_id?: string; source_body_id?: string | null; to_character_id?: string; swapped_at?: string; resolved_at?: string | null; ego_recovered_at?: string | null; trigger_event?: string | null; notes?: string | null};
        await env.DB.prepare(
          `UPDATE consciousness_swaps SET
            from_character_id=COALESCE(?,from_character_id),
            source_body_id=CASE WHEN ?=1 THEN ? ELSE source_body_id END,
            to_character_id=COALESCE(?,to_character_id),
            swapped_at=COALESCE(?,swapped_at),
            resolved_at=CASE WHEN ?=1 THEN ? ELSE resolved_at END,
            ego_recovered_at=CASE WHEN ?=1 THEN ? ELSE ego_recovered_at END,
            trigger_event=CASE WHEN ?=1 THEN ? ELSE trigger_event END,
            notes=CASE WHEN ?=1 THEN ? ELSE notes END
           WHERE id=?`
        ).bind(
          body.from_character_id ?? null,
          'source_body_id' in body ? 1 : 0, body.source_body_id ?? null,
          body.to_character_id ?? null,
          body.swapped_at ?? null,
          'resolved_at' in body ? 1 : 0, body.resolved_at ?? null,
          'ego_recovered_at' in body ? 1 : 0, body.ego_recovered_at ?? null,
          'trigger_event' in body ? 1 : 0, body.trigger_event ?? null,
          'notes' in body ? 1 : 0, body.notes ?? null,
          id
        ).run();
        return json({ ok: true });
      }
      if (method === 'DELETE' && id) {
        await env.DB.prepare("DELETE FROM consciousness_swaps WHERE id=?").bind(id).run();
        return json({ ok: true });
      }
    }

    if (resource === 'character_states') {
      const charId = parts[2];
      if (method === 'GET' && charId) {
        const result = await env.DB.prepare("SELECT * FROM character_states WHERE character_id=? ORDER BY valid_from DESC").bind(charId).all();
        return json({ states: result.results });
      }
      if (method === 'POST') {
        const body = await request.json() as {id:string;character_id:string;valid_from:string;valid_to?:string;appearance?:string;status?:string;notes?:string};
        await env.DB.prepare("INSERT INTO character_states (id,character_id,valid_from,valid_to,appearance,status,notes) VALUES (?,?,?,?,?,?,?)")
          .bind(body.id,body.character_id,body.valid_from,body.valid_to??null,body.appearance??null,body.status??null,body.notes??null).run();
        return json({ ok: true });
      }
      if (method === 'PUT' && charId) {
        const body = await request.json() as {valid_from?:string;valid_to?:string|null;appearance?:string|null;status?:string|null;notes?:string|null};
        await env.DB.prepare(
          "UPDATE character_states SET valid_from=COALESCE(?,valid_from), valid_to=CASE WHEN ?=1 THEN ? ELSE valid_to END, appearance=CASE WHEN ?=1 THEN ? ELSE appearance END, status=CASE WHEN ?=1 THEN ? ELSE status END, notes=CASE WHEN ?=1 THEN ? ELSE notes END WHERE id=?"
        ).bind(
          body.valid_from??null,
          'valid_to' in body?1:0, body.valid_to??null,
          'appearance' in body?1:0, body.appearance??null,
          'status' in body?1:0, body.status??null,
          'notes' in body?1:0, body.notes??null,
          charId
        ).run();
        return json({ ok: true });
      }
      if (method === 'DELETE' && charId) {
        await env.DB.prepare("DELETE FROM character_states WHERE id=?").bind(charId).run();
        return json({ ok: true });
      }
    }

    if (resource === 'relationships') {
      if (method === 'GET') {
        const result = await env.DB.prepare(
          `SELECT r.*, ca.name as name_a, cb.name as name_b FROM relationships r
           JOIN characters ca ON r.character_id_a=ca.id
           JOIN characters cb ON r.character_id_b=cb.id
           ORDER BY ca.name, cb.name`
        ).all();
        return json({ relationships: result.results });
      }
      if (method === 'POST') {
        const body = await request.json() as {id:string;character_id_a:string;character_id_b:string;relation_type:string;is_public?:number|boolean;valid_from?:string;valid_to?:string;notes?:string};
        const isPublic = body.is_public ? 1 : 0;
        await env.DB.prepare("INSERT INTO relationships (id,character_id_a,character_id_b,relation_type,is_public,valid_from,valid_to,notes) VALUES (?,?,?,?,?,?,?,?)")
          .bind(body.id,body.character_id_a,body.character_id_b,body.relation_type,isPublic,body.valid_from??null,body.valid_to??null,body.notes??null).run();
        return json({ ok: true });
      }
      if (method === 'PUT' && id) {
        const body = await request.json() as {relation_type?:string;is_public?:number|boolean;valid_from?:string|null;valid_to?:string|null;notes?:string|null};
        const isPublic = body.is_public != null ? (body.is_public ? 1 : 0) : null;
        await env.DB.prepare(
          "UPDATE relationships SET relation_type=COALESCE(?,relation_type), is_public=COALESCE(?,is_public), valid_from=COALESCE(?,valid_from), valid_to=CASE WHEN ?=1 THEN ? ELSE valid_to END, notes=CASE WHEN ?=1 THEN ? ELSE notes END WHERE id=?"
        ).bind(
          body.relation_type??null, isPublic, body.valid_from??null,
          'valid_to' in body?1:0, body.valid_to??null,
          'notes' in body?1:0, body.notes??null,
          id
        ).run();
        return json({ ok: true });
      }
      if (method === 'DELETE' && id) {
        await env.DB.prepare("DELETE FROM relationships WHERE id=?").bind(id).run();
        return json({ ok: true });
      }
    }

    if (resource === 'migrate' && method === 'POST') {
      const migrations: string[] = [
        `CREATE TABLE IF NOT EXISTS scene_characters (
          scene_id TEXT NOT NULL REFERENCES scenes(id),
          character_id TEXT NOT NULL REFERENCES characters(id),
          role_in_scene TEXT CHECK(role_in_scene IN ('main','sub','mentioned')) DEFAULT 'sub',
          notes TEXT,
          PRIMARY KEY (scene_id, character_id)
        )`,
        `CREATE TABLE IF NOT EXISTS consciousness_swaps_new (
          id TEXT PRIMARY KEY,
          from_character_id TEXT NOT NULL REFERENCES characters(id),
          to_character_id TEXT NOT NULL REFERENCES characters(id),
          swapped_at TEXT NOT NULL,
          resolved_at TEXT NULL,
          trigger_event TEXT,
          notes TEXT
        )`,
        `INSERT OR IGNORE INTO consciousness_swaps_new (id, from_character_id, to_character_id, swapped_at, resolved_at, trigger_event, notes)
         SELECT id, from_character_id, to_character_id, swapped_at, resolved_at, trigger_event, notes FROM consciousness_swaps`,
        `DROP TABLE IF EXISTS consciousness_swaps`,
        `ALTER TABLE consciousness_swaps_new RENAME TO consciousness_swaps`,
        `ALTER TABLE scenes ADD COLUMN protagonist_identity_id TEXT REFERENCES characters(id)`,
        `ALTER TABLE characters ADD COLUMN avatar TEXT`,
        `ALTER TABLE scenes ADD COLUMN body TEXT`,
        `CREATE TABLE IF NOT EXISTS character_states (
          id TEXT PRIMARY KEY,
          character_id TEXT NOT NULL REFERENCES characters(id),
          valid_from TEXT NOT NULL,
          valid_to TEXT,
          appearance TEXT,
          status TEXT,
          notes TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS relationships (
          id TEXT PRIMARY KEY,
          character_id_a TEXT NOT NULL REFERENCES characters(id),
          character_id_b TEXT NOT NULL REFERENCES characters(id),
          relation_type TEXT NOT NULL,
          is_public INTEGER NOT NULL DEFAULT 0,
          valid_from TEXT,
          valid_to TEXT,
          notes TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS relationships_new (
          id TEXT PRIMARY KEY,
          character_id_a TEXT NOT NULL REFERENCES characters(id),
          character_id_b TEXT NOT NULL REFERENCES characters(id),
          relation_type TEXT NOT NULL,
          is_public INTEGER NOT NULL DEFAULT 0,
          valid_from TEXT,
          valid_to TEXT,
          notes TEXT
        )`,
        `INSERT OR IGNORE INTO relationships_new SELECT id,character_id_a,character_id_b,relation_type,is_public,valid_from,valid_to,notes FROM relationships`,
        `DROP TABLE IF EXISTS relationships`,
        `ALTER TABLE relationships_new RENAME TO relationships`,
        `ALTER TABLE consciousness_swaps ADD COLUMN ego_recovered_at TEXT NULL`,
        `ALTER TABLE consciousness_swaps ADD COLUMN source_body_id TEXT REFERENCES characters(id)`,
        `INSERT OR IGNORE INTO characters (id, name, aliases, role, description, secret)
         VALUES (
           'hoshifune-inori',
           '星船イノリ',
           '',
           'protagonist',
           '日本の大学生。異世界に召喚された際に死亡。',
           '異世界召喚時に死亡しており、意識は別の体に移っている可能性がある。'
         )`,
      ];
      const results: string[] = [];
      for (const sql of migrations) {
        try {
          await env.DB.prepare(sql).run();
          results.push(`OK: ${sql.slice(0, 60)}...`);
        } catch (e) {
          const msg = String(e);
          // カラム重複・テーブル既存は冪等なので警告扱い
          if (msg.includes('duplicate column') || msg.includes('already exists')) {
            results.push(`SKIP (already applied): ${sql.slice(0, 60)}...`);
          } else {
            results.push(`ERR: ${msg}`);
          }
        }
      }
      return json({ results });
    }

    return json({ error: 'Not found' }, 404);
  } catch (err) {
    return json({ error: String(err), detail: err instanceof Error ? err.stack : undefined }, 500);
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
