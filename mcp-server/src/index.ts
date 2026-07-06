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

const VERSION = "0.12.1";

const TOOLS = [
  {
    name: "help",
    description: "このMCP（novelsync-mcp）の使い方を返す。全ツール・各統合ツールのaction一覧・引数・執筆時のコツ（同時刻シーンの扱い、整合性チェック、意識入れ替わりの編集方法など）をまとめて返す。どのツールを使えばよいか分からないときは最初にこれを呼ぶ。",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
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
    name: "list_overview",
    description: "全シーン一覧と全キャラクター一覧をまとめて取得する。scenes（id・タイトル・執筆順・物語時間・場所・執筆済みフラグ）と characters（id・名前・別名・役割）を返す。シーンIDやキャラIDを調べる最初のオリエンテーションに使う。",
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
    name: "manage_scene",
    description: "シーンの作成・更新・削除・本文保存・並べ替え・本文履歴・伏線・話（エピソード）をまとめて行う。actionで操作を指定する。create=新規作成（id,title必須）、update=メタ情報更新（scene_id必須・synopsis/reader_goal/episode_idもここで設定）、delete=削除（scene_id必須）、save_body=本文保存（scene_id,body必須・上書き前の本文は自動で履歴に退避）、insert_at=シーンを指定順序の位置へ移動し全体を1..Nで自動リナンバー（scene_id,narrative_order必須）、list_revisions=本文履歴一覧（scene_id必須）、restore_revision=履歴から本文復元（revision_id必須）、foreshadow_list/foreshadow_set/foreshadow_delete=伏線管理、episode_list=話一覧（所属シーン・合計文字数つき）、episode_set=話の作成/更新（新規はtitle必須・更新はepisode_id必須）、episode_delete=話削除（episode_id必須・シーンは残り紐付けだけ外れる）。話＝Web連載の投稿単位（複数シーンの束）。シーンの話への所属は update の episode_id で設定。",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", description: "操作: create / update / delete / save_body / insert_at / list_revisions / restore_revision / foreshadow_list / foreshadow_set / foreshadow_delete / episode_list / episode_set / episode_delete" },
        id: { type: "string", description: "シーンID（action=create時）" },
        scene_id: { type: "string", description: "シーンID（update/delete/save_body/insert_at/list_revisions時）" },
        title: { type: "string", description: "タイトル（シーンまたは伏線の要約）" },
        story_time: { type: "string", description: "物語内時刻（ISO8601）。updateでnullを渡すと削除" },
        narrative_order: { type: "number", description: "執筆順（話数）。updateでnullを渡すとクリア。insert_atでは移動先の話数" },
        location: { type: "string", description: "場所" },
        disclosure_notes: { type: "string", description: "開示メモ" },
        synopsis: { type: "string", description: "あらすじ＝このシーンで起きる出来事（create/update時）。nullでクリア" },
        reader_goal: { type: "string", description: "読者への狙い＝このシーンで読者に生じさせたい効果（例:「エルシィの様子がおかしい」と違和感を持たせる）（create/update時）。nullでクリア" },
        protagonist_identity_id: { type: "string", description: "主人公の自認＝語り手の意識のキャラID（update時）。入れ替わり中は「中身」のキャラを指定する（体の視点is_povとは別）。nullでクリア" },
        body: { type: "string", description: "本文テキスト（save_body時）" },
        revision_id: { type: "string", description: "本文履歴ID（restore_revision時）" },
        foreshadow_id: { type: "string", description: "伏線ID（foreshadow_set更新/foreshadow_delete時）" },
        detail: { type: "string", description: "伏線の詳細（foreshadow_set時・任意）" },
        planted_scene_id: { type: "string", description: "伏線を張るシーンID（foreshadow_set時・任意）" },
        payoff_scene_id: { type: "string", description: "伏線を回収する予定のシーンID（foreshadow_set時・任意）" },
        status: { type: "string", description: "状態。伏線: open（未回収）/ resolved（回収済み）/ dropped（破棄） ／ 話: draft（下書き）/ published（公開済み）" },
        reader_effect: { type: "string", description: "回収時に読者に感じさせたい効果（foreshadow_set時・任意）" },
        notes: { type: "string", description: "メモ（foreshadow_set / episode_set時・任意）" },
        episode_id: { type: "string", description: "話ID（update時=シーンの所属話・nullで解除 ／ episode_set更新・episode_delete時=対象の話）" },
        episode_number: { type: "number", description: "話数（episode_set時。第N話のN）" },
        hook: { type: "string", description: "この話の引き＝末尾で読者を次話へ引っ張る要素（episode_set時・任意）" },
      },
      required: ["action"],
    },
  },
  {
    name: "manage_character",
    description: "キャラクターと意識入れ替わり（consciousness_swaps）の管理をまとめて行う。actionで操作を指定する。create=新規作成（id,name必須）、update=情報更新（id必須）、delete=削除（id必須・swapに参照があるとエラー）、add_state=状態変化（外見・生死・メモ）をシーン時点で記録（character_id,scene_id必須・変身の記録に使う）、add_swap=意識入れ替わりイベント作成（swap_id,from_character_id,to_character_id,swapped_at必須）、update_swap=入れ替わり更新（swap_id必須）、delete_swap=入れ替わり削除（swap_id必須）。",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", description: "操作: create / update / delete / add_state / add_swap / update_swap / delete_swap" },
        id: { type: "string", description: "キャラクターID（create/update/delete時）" },
        name: { type: "string", description: "名前" },
        aliases: { type: "string", description: "別名・呼び名（カンマ区切り）。updateでnullクリア" },
        role: { type: "string", description: "役割: protagonist / antagonist / supporting" },
        description: { type: "string", description: "説明・プロフィール。updateでnullクリア" },
        secret: { type: "string", description: "秘密・読者非開示情報。updateでnullクリア" },
        speech_style: { type: "string", description: "口調設定（一人称・二人称・口癖・語尾など。例: 一人称「私」、砕けた口調で「〜じゃん」を多用）。updateでnullクリア" },
        gender: { type: "string", description: "性別（例: 男性, 女性, その他・自由記述可）。updateでnullクリア" },
        character_id: { type: "string", description: "キャラクターID（add_state時）" },
        scene_id: { type: "string", description: "状態が始まるシーンID（add_state時・valid_fromに使用）" },
        appearance: { type: "string", description: "外見の説明（add_state時）" },
        status: { type: "string", description: "状態（例: 生存、死亡、負傷）（add_state時）" },
        notes: { type: "string", description: "メモ（add_state / swap系で使用）。swap更新でnullクリア" },
        swap_id: { type: "string", description: "入れ替わりID（add_swap/update_swap/delete_swap時）" },
        from_character_id: { type: "string", description: "入れ替わる意識（自我）の元キャラID（add_swap/update_swap時）" },
        to_character_id: { type: "string", description: "意識が入る先の身体キャラID（add_swap/update_swap時）" },
        source_body_id: { type: "string", description: "自我が元々入っていた身体キャラID（swap系・任意）。updateでnullクリア" },
        swapped_at: { type: "string", description: "入れ替わり発生時刻（ISO8601）（add_swap必須/update_swap任意）" },
        resolved_at: { type: "string", description: "入れ替わりが解消した時刻（ISO8601・任意）。updateでnullクリア" },
        ego_recovered_at: { type: "string", description: "自我が元に戻った時刻（ISO8601・任意）。updateでnullクリア" },
        trigger_event: { type: "string", description: "入れ替わりのきっかけ（任意）。updateでnullクリア" },
      },
      required: ["action"],
    },
  },
  {
    name: "manage_relationship",
    description: "キャラクター間の関係性の作成・更新・削除をまとめて行う。actionで操作を指定する。create=新規登録（character_id_a,character_id_b,relation_type必須）、update=更新（id必須）、delete=削除（id必須）。",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", description: "操作: create / update / delete" },
        id: { type: "string", description: "関係性ID（update/delete時）" },
        character_id_a: { type: "string", description: "キャラクターAのID（create時）" },
        character_id_b: { type: "string", description: "キャラクターBのID（create時）" },
        relation_type: { type: "string", description: "関係の種類（例: 幼馴染、師弟、恋人、敵対）" },
        is_public: { type: "boolean", description: "読者に開示済みかどうか" },
        from_scene_id: { type: "string", description: "この関係が始まるシーンID（create時・省略可）" },
        notes: { type: "string", description: "メモ。updateでnullクリア" },
      },
      required: ["action"],
    },
  },
  {
    name: "manage_world_rule",
    description: "世界設定ルールと執筆スタイル（文体・描写の流儀）の管理をまとめて行う。actionで操作を指定する。create=世界ルール新規登録（id,category,rule必須）、update=世界ルール更新（id必須）、delete=世界ルール削除（id必須）、style_set=執筆スタイル登録/上書き（category,rule必須・idを渡すと更新）、style_delete=執筆スタイル削除（id必須）。スタイルは get_scene_context の style_guide に常に含まれ、執筆時の文体指針になる（例: 三人称一元視点、地の文は常体、戦闘描写は短文でテンポ重視、禁止表現など）。",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", description: "操作: create / update / delete / style_set / style_delete" },
        id: { type: "string", description: "ルールID / スタイルID（style_setでは省略時に自動採番）" },
        category: { type: "string", description: "カテゴリ（世界ルール例: 能力, 制約, 用語 ／ スタイル例: 文体, 視点, 描写, 台詞, 禁則）" },
        rule: { type: "string", description: "本文（世界ルールの内容、またはスタイルの内容）" },
        applies_from: { type: "string", description: "適用開始時刻（ISO8601・世界ルールのみ）。updateでnullクリア" },
        title: { type: "string", description: "スタイルの見出し（style_set時・任意）" },
        sort_order: { type: "number", description: "スタイルの表示順（style_set時・任意・小さいほど先）" },
      },
      required: ["action"],
    },
  },
];

// スキーマ拡張（v0.11.0: シーンのあらすじ・読者への狙い、キャラ口調、伏線テーブル）。
// 初回アクセス時に自動適用し、isolateごとに1回だけ実行する。
let schemaExtensionsEnsured = false;
async function ensureSchemaExtensions(db: D1Database): Promise<void> {
  if (schemaExtensionsEnsured) return;
  for (const sql of [
    "ALTER TABLE scenes ADD COLUMN synopsis TEXT",
    "ALTER TABLE scenes ADD COLUMN reader_goal TEXT",
    "ALTER TABLE scenes ADD COLUMN episode_id TEXT",
    "ALTER TABLE characters ADD COLUMN speech_style TEXT",
    "ALTER TABLE characters ADD COLUMN gender TEXT",
    `CREATE TABLE IF NOT EXISTS episodes (
      id TEXT PRIMARY KEY,
      episode_number INTEGER,
      title TEXT NOT NULL,
      hook TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS foreshadowings (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      detail TEXT,
      planted_scene_id TEXT,
      payoff_scene_id TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      reader_effect TEXT,
      notes TEXT,
      created_at TEXT
    )`,
  ]) {
    try { await db.prepare(sql).run(); } catch { /* カラム既存など */ }
  }
  schemaExtensionsEnsured = true;
}

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
    "SELECT id, title, narrative_order, story_time, location, is_written, episode_id FROM scenes ORDER BY narrative_order ASC, story_time ASC"
  ).all();
  return { scenes: result.results };
}

async function listOverview(db: D1Database): Promise<unknown> {
  const scenes = (await listScenes(db)) as { scenes: unknown[] };
  const characters = (await listCharacters(db)) as { characters: unknown[] };
  const episodes = (await listEpisodes(db)).map(ep => ({
    id: ep.id, episode_number: ep.episode_number, title: ep.title, status: ep.status,
    scene_count: ep.scene_count, written_count: ep.written_count, total_chars: ep.total_chars,
  }));
  return { episodes, scenes: scenes.scenes, characters: characters.characters };
}

function getHelp(): unknown {
  return {
    server: "novelsync-mcp",
    version: VERSION,
    overview:
      "異世界転生小説の設定管理MCP。キャラクター・シーン・世界ルール・意識の入れ替わりを管理し、執筆時の整合性（時系列・参照・開示状態）を保つ。",
    tool_count: TOOLS.length,
    design_note:
      "ツール総数は12以下に保つ（一部のMCPクライアントが tools/list を先頭12件で打ち切るため）。書き込み系は action 引数で操作を切り替える統合ツールに集約している。読み取り系を配列の先頭に置く。",
    tools: TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      args: Object.keys((t.inputSchema as { properties?: Record<string, unknown> }).properties ?? {}),
      required: (t.inputSchema as { required?: string[] }).required ?? [],
    })),
    write_actions: {
      manage_scene: {
        create: "新規シーン作成。id・title 必須（story_time/narrative_order/location/disclosure_notes/synopsis/reader_goal 任意）",
        update: "メタ情報更新。scene_id 必須。story_time・narrative_order・protagonist_identity_id・synopsis（あらすじ）・reader_goal（読者への狙い）も変更可（null でクリア）",
        delete: "シーン削除。scene_id 必須（scene_characters も同時削除）",
        save_body: "本文保存。scene_id・body 必須（is_written が true になる）。上書き前の本文は自動で履歴に退避（直近20件）",
        insert_at: "シーンを指定話数の位置へ移動。scene_id・narrative_order 必須。全シーンを1..Nで振り直すので重複・欠番も解消される",
        list_revisions: "本文の履歴一覧。scene_id 必須（各履歴のid・保存日時・文字数を返す）",
        restore_revision: "履歴から本文を復元。revision_id 必須（復元前の本文も履歴に退避される）",
        foreshadow_list: "伏線一覧（張った/回収シーン名・状態つき）",
        foreshadow_set: "伏線の作成/更新。新規は title 必須（detail/planted_scene_id/payoff_scene_id/status/reader_effect/notes 任意）。更新は foreshadow_id 必須。status: open=未回収 / resolved=回収済み / dropped=破棄",
        foreshadow_delete: "伏線削除。foreshadow_id 必須",
        episode_list: "話（エピソード）一覧。所属シーン・執筆済み数・合計文字数つき",
        episode_set: "話の作成/更新。新規は title 必須（episode_number/hook=引き/notes/status 任意）。更新は episode_id 必須。status: draft=下書き / published=公開済み",
        episode_delete: "話削除。episode_id 必須（所属シーンは削除されず紐付けだけ外れる）",
      },
      manage_character: {
        create: "新規キャラ作成。id・name 必須",
        update: "情報更新。id 必須（aliases/description/secret は null でクリア）",
        delete: "キャラ削除。id 必須（consciousness_swaps に参照があるとエラー）",
        add_state: "状態変化（外見・生死・メモ）をシーン時点で記録。character_id・scene_id 必須。変身/負傷の記録に使う",
        add_swap: "意識入れ替わりイベント作成。swap_id・from_character_id（自我）・to_character_id（入る身体）・swapped_at 必須",
        update_swap: "入れ替わり更新。swap_id 必須（resolved_at/ego_recovered_at/trigger_event/notes は null でクリア）",
        delete_swap: "入れ替わり削除。swap_id 必須",
      },
      manage_relationship: {
        create: "関係性登録。character_id_a・character_id_b・relation_type 必須",
        update: "関係性更新。id 必須",
        delete: "関係性削除。id 必須",
      },
      manage_world_rule: {
        create: "世界ルール登録。id・category・rule 必須",
        update: "世界ルール更新。id 必須",
        delete: "世界ルール削除。id 必須",
        style_set: "執筆スタイル（文体・描写の流儀）の登録/上書き。category・rule 必須（title・sort_order 任意、id省略で新規）",
        style_delete: "執筆スタイル削除。id 必須",
      },
    },
    tips: [
      "最初のオリエンテーションは list_overview（全シーン＋全キャラ一覧）。個別は get_scene_context(scene_id) と get_character(id)。",
      "同時刻の並行シーンは同じ story_time を与え、narrative_order だけ別番号にする（order の重複・欠番は check_all_consistency がエラー扱い）。",
      "シーンの追加・削除・並べ替え・時刻変更はすべて manage_scene で可能。話の間に挿入したいときは insert_at（自動リナンバー）を使うと重複・欠番が起きない。",
      "本文の書き込みは manage_scene{action:'save_body', scene_id, body}。上書き前の本文は自動で履歴に残る。書き直しに失敗したら list_revisions → restore_revision で戻せる。",
      "大きな再構成のあとは必ず check_all_consistency で時系列・参照整合・順序を確認する。",
      "意識入れ替わり（consciousness_swaps）は manage_character の add_swap/update_swap/delete_swap で管理できる（from=自我、to=入る身体）。シーンの視点は manage_scene{action:'update', protagonist_identity_id}で設定。Web UI / REST API（/api/consciousness_swaps）でも編集可。",
      "文体・描写の流儀は執筆スタイル（style_guides）に保存でき、get_scene_context の style_guide に常に含まれる。本文を書くときは必ずこれに従う。登録・編集は manage_world_rule{action:'style_set', category, rule}（例: category='視点', rule='三人称一元視点。地の文は常体'）。",
      "本文を書く前に、そのシーンの writing_direction（synopsis=出来事、reader_goal=読者に生じさせたい効果）を確認する。未設定なら manage_scene{action:'update', synopsis, reader_goal} で先に設計するとよい。reader_goal は本文に直接書かず、効果が生まれる構成にする。",
      "伏線は manage_scene の foreshadow_set/foreshadow_list/foreshadow_delete で管理。get_scene_context にそのシーンで張る伏線・回収する伏線・未回収一覧が含まれる。回収を書いたら status を resolved に更新する。check_all_consistency が回収漏れを警告する。",
      "キャラの口調（一人称・口癖・語尾）は characters.speech_style に保存でき、get_scene_context の登場キャラ情報に含まれる。セリフはこれに従う。",
      "話（エピソード）＝Web連載の投稿単位（1話2,000〜4,000字目安・複数シーンの束）。manage_scene の episode_set で話を作り、update{scene_id, episode_id} でシーンを所属させる。get_scene_context の episode に話タイトル・引き（hook）・話内の位置が含まれ、話の最後のシーンでは引きを入れるよう指示される。",
    ],
  };
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
      `SELECT sc.*, c.name, c.role, c.aliases, c.description, c.secret, c.speech_style, c.gender
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
      gender: sc.gender ?? null,
      role_in_scene: sc.role_in_scene,
      description: sc.description,
      secret: sc.secret,
      speech_style: sc.speech_style ?? null,
      current_appearance: charState?.appearance ?? null,
      current_status: charState?.status ?? null,
      state_notes: charState?.notes ?? null,
      consciousness_note: consciousnessNote,
    });
  }

  // 関係性（このシーン時点で有効 かつ 登場キャラが絡むもの）
  const sceneCharacterIds = new Set(sceneCharacters.map((sc: Record<string, unknown>) => sc.character_id as string));
  const allRelationships = storyTime ? (
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
  const relationships = sceneCharacterIds.size > 0
    ? (allRelationships as Array<Record<string, unknown>>).filter(r =>
        sceneCharacterIds.has(r.character_id_a as string) || sceneCharacterIds.has(r.character_id_b as string)
      )
    : allRelationships;

  // 前後のシーン（物語順）
  const prevScene = narrativeOrder != null
    ? await db.prepare(`SELECT id, title, narrative_order, story_time, location FROM scenes WHERE narrative_order < ? ORDER BY narrative_order DESC LIMIT 1`).bind(narrativeOrder).first()
    : null;
  const nextScene = narrativeOrder != null
    ? await db.prepare(`SELECT id, title, narrative_order, story_time, location FROM scenes WHERE narrative_order > ? ORDER BY narrative_order ASC LIMIT 1`).bind(narrativeOrder).first()
    : null;

  // 主人公ステータスを合成（自認の意識 × 体の持ち主 × 外見状態）
  let protagonistStatus: Record<string, unknown> | null = null;
  const povChar = sceneCharacters.find((sc: Record<string, unknown>) => sc.is_pov === 1);
  // protagonist_identity_id（意識レベルの主人公）を優先。未設定なら is_pov キャラにフォールバック
  const protagonistId = (scene.protagonist_identity_id as string | null | undefined)
    ?? (povChar ? (povChar.character_id as string) : null);
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
      identity_self_recognition: scene.protagonist_identity_id ?? null,
      ...(storyTime ? {} : { caution: "このシーンは story_time 未設定のため、意識入れ替わりの判定は行われていません（swap_active は信頼できません）" }),
    };
  }

  // 執筆スタイル（文体・描写の流儀）。登録があれば常に添付する
  const styleGuide = await listStyleGuides(db);

  // 執筆指針（あらすじ＋読者への狙い）
  const synopsis = (scene.synopsis as string | null) ?? null;
  const readerGoal = (scene.reader_goal as string | null) ?? null;
  const writingDirection = (synopsis || readerGoal) ? {
    synopsis,
    reader_goal: readerGoal,
    note: "synopsis=このシーンで起きる出来事。reader_goal=読者に生じさせたい効果（例: 違和感を持たせる、驚かせる）。reader_goal は本文に直接書く内容ではない——『驚いた』と書くのではなく、驚きが生まれる構成・情報の出し方にすること",
  } : null;

  // 伏線（このシーンで張る・回収する・未回収一覧）
  const allForeshadows = await listForeshadows(db);
  const plantedHere = allForeshadows.filter(f => f.planted_scene_id === args.scene_id);
  const payoffHere = allForeshadows.filter(f => f.payoff_scene_id === args.scene_id);
  const openForeshadows = allForeshadows.filter(f => f.status === 'open');
  const foreshadowing = (plantedHere.length || payoffHere.length || openForeshadows.length) ? {
    plant_in_this_scene: plantedHere,
    payoff_in_this_scene: payoffHere,
    open_foreshadows: openForeshadows,
    note: "plant_in_this_scene=このシーンで張る伏線（さりげなく仕込む）。payoff_in_this_scene=このシーンで回収する伏線（回収を書いたら manage_scene{action:'foreshadow_set', foreshadow_id, status:'resolved'} で更新）。open_foreshadows=未回収の伏線一覧（矛盾する記述をしないこと）",
  } : null;

  // 所属する話（エピソード）情報
  let episodeInfo: Record<string, unknown> | null = null;
  const episodeId = scene.episode_id as string | null;
  if (episodeId) {
    const ep = await db.prepare("SELECT * FROM episodes WHERE id=?").bind(episodeId).first() as Record<string, unknown> | null;
    if (ep) {
      const epScenes = (
        await db.prepare("SELECT id, title, narrative_order, is_written, length(COALESCE(body,'')) as char_count FROM scenes WHERE episode_id=? ORDER BY narrative_order ASC").bind(episodeId).all()
      ).results as Array<Record<string, unknown>>;
      const idx = epScenes.findIndex(s => s.id === args.scene_id);
      const isLast = idx === epScenes.length - 1;
      episodeInfo = {
        id: ep.id,
        episode_number: ep.episode_number,
        title: ep.title,
        status: ep.status,
        hook: ep.hook,
        notes: ep.notes,
        scenes_in_episode: epScenes,
        position_in_episode: idx >= 0 ? `${idx + 1}/${epScenes.length}` : null,
        total_chars: epScenes.reduce((sum, s) => sum + (s.char_count as number), 0),
        note: isLast
          ? "このシーンはこの話の最後のシーン。話の終わりには「引き」（hook）を必ず入れること"
          : "この話にはまだ後続シーンがある。話の途中なので引きは不要だが、次シーンへ自然に繋ぐこと",
      };
    }
  }

  return {
    scene,
    episode: episodeInfo,
    writing_direction: writingDirection,
    protagonist_status: protagonistStatus,
    characters_in_scene: charactersInScene,
    previous_scene: prevScene,
    next_scene: nextScene,
    relationships,
    world_rules: worldRules,
    foreshadowing,
    style_guide: styleGuide.length > 0 ? styleGuide : null,
    style_note: styleGuide.length > 0 ? "本文執筆時は style_guide の文体・描写ルールに従うこと" : null,
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
  const deadStatuses = ["dead", "死亡", "死んでいる", "故人"];
  const aliveVerbs = [
    "speaks", "walks", "appears", "says",
    "話す", "話し", "言う", "言っ", "喋", "歩", "現れ", "立ち上が", "笑", "叫", "答え", "動",
  ];

  for (const state of states) {
    const name = (state.name as string).toLowerCase();
    const status = ((state.status as string | null) ?? "").toLowerCase();
    if (desc.includes(name) && deadStatuses.some(d => status.includes(d))) {
      if (aliveVerbs.some(v => desc.includes(v))) {
        conflicts.push(`矛盾の可能性: 「${state.name}」は ${args.scene_time} 時点で「${state.status}」ですが、記述では生きて行動しているように見えます`);
      }
    }
  }

  return {
    conflicts,
    character_states_checked: states.length,
    world_rules_checked: rules.length,
    note: "キーワードベースの簡易チェックです。複雑な矛盾は get_scene_context の内容と照らして手動確認してください。",
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
  const scenes = (await db.prepare("SELECT id, title, story_time, narrative_order, protagonist_identity_id, is_written, episode_id FROM scenes ORDER BY story_time").all()).results as Array<{ id: string; title: string; story_time: string | null; narrative_order: number | null; protagonist_identity_id: string | null; is_written: number; episode_id: string | null }>;
  const swaps = (await db.prepare("SELECT * FROM consciousness_swaps ORDER BY swapped_at").all()).results as Array<{ id: string; from_character_id: string; to_character_id: string; swapped_at: string; resolved_at: string | null; trigger_event: string | null; notes: string | null }>;
  const sceneChars = (await db.prepare("SELECT scene_id, character_id, is_pov FROM scene_characters").all()).results as Array<{ scene_id: string; character_id: string; is_pov: number }>;

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

  // 4. シーンのprotagonist_identity_id（自認）の検証
  for (const scene of scenes) {
    if (!scene.protagonist_identity_id) continue;
    if (!charIds.has(scene.protagonist_identity_id)) {
      issues.push({ severity: "error", category: "シーン自認", message: `シーン「${scene.title}」のprotagonist_identity_id「${scene.protagonist_identity_id}」はキャラ未登録です` });
      continue;
    }
    if (!scene.story_time) continue;
    const t = scene.story_time;
    const povChar = sceneChars.find(sc => sc.scene_id === scene.id && sc.is_pov === 1);
    // 自認と視点キャラ（体）が異なるのに、その時刻に有効な入れ替わり（自認の意識→視点キャラの体）が無ければ警告
    if (povChar && povChar.character_id !== scene.protagonist_identity_id) {
      const activeSwap = swaps.find(sw =>
        sw.swapped_at <= t && (sw.resolved_at == null || sw.resolved_at > t) &&
        sw.from_character_id === scene.protagonist_identity_id && sw.to_character_id === povChar.character_id
      );
      if (!activeSwap) {
        issues.push({ severity: "warning", category: "シーン自認", message: `シーン「${scene.title}」は自認「${charName(scene.protagonist_identity_id)}」と視点キャラ「${charName(povChar.character_id)}」が異なりますが、この時刻に有効な入れ替わり（from=${charName(scene.protagonist_identity_id)}, to=${charName(povChar.character_id)}）が登録されていません` });
      }
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

  // 9. 伏線の整合性
  const foreshadows = await listForeshadows(db);
  const sceneIdSet = new Set(scenes.map(s => s.id));
  for (const f of foreshadows) {
    const fTitle = f.title as string;
    if (f.planted_scene_id && !sceneIdSet.has(f.planted_scene_id as string)) {
      issues.push({ severity: "error", category: "伏線", message: `伏線「${fTitle}」を張るシーン '${f.planted_scene_id}' が存在しません` });
    }
    if (f.payoff_scene_id && !sceneIdSet.has(f.payoff_scene_id as string)) {
      issues.push({ severity: "error", category: "伏線", message: `伏線「${fTitle}」の回収シーン '${f.payoff_scene_id}' が存在しません` });
    }
    if (f.status === 'open' && f.payoff_scene_id) {
      const payoffScene = scenes.find(s => s.id === f.payoff_scene_id);
      if (payoffScene?.is_written) {
        issues.push({ severity: "warning", category: "伏線", message: `伏線「${fTitle}」の回収予定シーン「${payoffScene.title}」は執筆済みですが、伏線が未回収（open）のままです。回収を書き忘れたか、statusの更新忘れです` });
      }
    }
    if (f.status === 'resolved' && !f.payoff_scene_id) {
      issues.push({ severity: "info", category: "伏線", message: `伏線「${fTitle}」は回収済みですが、どのシーンで回収したか（payoff_scene_id）が未記録です` });
    }
  }
  const openCount = foreshadows.filter(f => f.status === 'open').length;
  if (openCount > 0) {
    issues.push({ severity: "info", category: "伏線", message: `未回収の伏線が${openCount}件あります: ${foreshadows.filter(f => f.status === 'open').map(f => `「${f.title}」`).join(", ")}` });
  }

  // 10. 話（エピソード）の整合性
  const episodes = await listEpisodes(db);
  const epNumbers: Record<number, string[]> = {};
  for (const ep of episodes) {
    if (ep.episode_number != null) {
      const n = ep.episode_number as number;
      (epNumbers[n] = epNumbers[n] ?? []).push(ep.title as string);
    }
    if ((ep.scene_count as number) === 0) {
      issues.push({ severity: "info", category: "話", message: `第${ep.episode_number ?? '?'}話「${ep.title}」にはシーンが1つも紐付いていません` });
    }
    // 話の中でシーンのnarrative_orderが連続しているか（間に別の話のシーンが挟まっていないか）
    const epScenes = ep.scenes as Array<{ narrative_order: number | null; title: string }>;
    const orders = epScenes.map(s => s.narrative_order).filter((o): o is number => o != null).sort((a, b) => a - b);
    if (orders.length >= 2 && orders[orders.length - 1] - orders[0] + 1 !== orders.length) {
      issues.push({ severity: "warning", category: "話", message: `第${ep.episode_number ?? '?'}話「${ep.title}」のシーンの執筆順が飛び飛びです（間に別の話のシーンが挟まっています）: order ${orders.join(', ')}` });
    }
  }
  for (const [n, titles] of Object.entries(epNumbers)) {
    if (titles.length > 1) {
      issues.push({ severity: "error", category: "話", message: `話数 ${n} が重複しています: ${titles.map(t => `「${t}」`).join(", ")}` });
    }
  }
  if (episodes.length > 0) {
    const unassigned = scenes.filter(s => !s.episode_id);
    if (unassigned.length > 0) {
      issues.push({ severity: "info", category: "話", message: `どの話にも紐付いていないシーンが${unassigned.length}件あります: ${unassigned.map(s => `「${s.title}」`).join(", ")}` });
    }
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

async function createScene(db: D1Database, args: { id: string; title: string; story_time?: string; narrative_order?: number; location?: string; disclosure_notes?: string; synopsis?: string; reader_goal?: string }): Promise<unknown> {
  const exists = await db.prepare("SELECT id FROM scenes WHERE id=?").bind(args.id).first();
  if (exists) return { error: `Scene '${args.id}' already exists` };
  await db.prepare("INSERT INTO scenes (id, title, story_time, narrative_order, location, disclosure_notes, synopsis, reader_goal) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(args.id, args.title, args.story_time ?? null, args.narrative_order ?? null, args.location ?? null, args.disclosure_notes ?? null, args.synopsis ?? null, args.reader_goal ?? null).run();
  return { ok: true, id: args.id, title: args.title };
}

async function deleteScene(db: D1Database, args: { scene_id: string }): Promise<unknown> {
  const scene = await db.prepare("SELECT id, title FROM scenes WHERE id=?").bind(args.scene_id).first() as { id: string; title: string } | null;
  if (!scene) return { error: `Scene '${args.scene_id}' not found` };
  await db.prepare("DELETE FROM scene_characters WHERE scene_id=?").bind(args.scene_id).run();
  try { await db.prepare("DELETE FROM scene_body_revisions WHERE scene_id=?").bind(args.scene_id).run(); } catch { /* テーブル未作成なら無視 */ }
  await db.prepare("DELETE FROM scenes WHERE id=?").bind(args.scene_id).run();
  return { ok: true, scene_id: args.scene_id, title: scene.title };
}

// 履歴テーブルは初回アクセス時に自動作成する（POST /api/migrate 不要）
async function ensureRevisionsTable(db: D1Database): Promise<void> {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS scene_body_revisions (
      id TEXT PRIMARY KEY,
      scene_id TEXT NOT NULL REFERENCES scenes(id),
      body TEXT NOT NULL,
      saved_at TEXT NOT NULL
    )`
  ).run();
}

// 上書き前の本文を履歴に退避する（シーンごとに直近20件保持）。
// 履歴の退避に失敗しても本文保存自体は止めない。
const REVISIONS_KEPT = 20;
async function archiveBodyRevision(db: D1Database, sceneId: string, currentBody: string | null, newBody: string | null): Promise<boolean> {
  if (!currentBody || currentBody === newBody) return false;
  try {
    await ensureRevisionsTable(db);
    await db.prepare("INSERT INTO scene_body_revisions (id, scene_id, body, saved_at) VALUES (?, ?, ?, ?)")
      .bind(crypto.randomUUID(), sceneId, currentBody, new Date().toISOString()).run();
    await db.prepare(
      `DELETE FROM scene_body_revisions WHERE scene_id=? AND id NOT IN (
         SELECT id FROM scene_body_revisions WHERE scene_id=? ORDER BY saved_at DESC LIMIT ?)`
    ).bind(sceneId, sceneId, REVISIONS_KEPT).run();
    return true;
  } catch {
    return false;
  }
}

async function saveSceneBody(db: D1Database, args: { scene_id: string; body: string }): Promise<unknown> {
  const scene = await db.prepare("SELECT id, title, body FROM scenes WHERE id=?").bind(args.scene_id).first() as { id: string; title: string; body: string | null } | null;
  if (!scene) return { error: `Scene '${args.scene_id}' not found` };
  const archived = await archiveBodyRevision(db, args.scene_id, scene.body, args.body);
  await db.prepare("UPDATE scenes SET body=?, is_written=1 WHERE id=?").bind(args.body, args.scene_id).run();
  return { ok: true, scene_id: args.scene_id, title: scene.title, characters: args.body.length, previous_body_archived: archived };
}

async function listBodyRevisions(db: D1Database, args: { scene_id: string }): Promise<unknown> {
  const scene = await db.prepare("SELECT id, title FROM scenes WHERE id=?").bind(args.scene_id).first();
  if (!scene) return { error: `Scene '${args.scene_id}' not found` };
  await ensureRevisionsTable(db);
  const rows = (
    await db.prepare("SELECT id, saved_at, length(body) as char_count FROM scene_body_revisions WHERE scene_id=? ORDER BY saved_at DESC").bind(args.scene_id).all()
  ).results;
  return { scene_id: args.scene_id, title: scene.title, revisions: rows };
}

async function restoreBodyRevision(db: D1Database, args: { revision_id: string }): Promise<unknown> {
  await ensureRevisionsTable(db);
  const rev = await db.prepare("SELECT * FROM scene_body_revisions WHERE id=?").bind(args.revision_id).first() as { id: string; scene_id: string; body: string; saved_at: string } | null;
  if (!rev) return { error: `Revision '${args.revision_id}' not found` };
  const cur = await db.prepare("SELECT body FROM scenes WHERE id=?").bind(rev.scene_id).first() as { body: string | null } | null;
  await archiveBodyRevision(db, rev.scene_id, cur?.body ?? null, rev.body);
  await db.prepare("UPDATE scenes SET body=?, is_written=1 WHERE id=?").bind(rev.body, rev.scene_id).run();
  return { ok: true, scene_id: rev.scene_id, restored_from: rev.saved_at, char_count: rev.body.length };
}

async function insertSceneAt(db: D1Database, args: { scene_id: string; narrative_order: number }): Promise<unknown> {
  const scene = await db.prepare("SELECT id, title FROM scenes WHERE id=?").bind(args.scene_id).first() as { id: string; title: string } | null;
  if (!scene) return { error: `Scene '${args.scene_id}' not found` };
  if (!args.narrative_order || args.narrative_order < 1) return { error: "narrative_order は1以上で指定してください" };
  const ordered = (
    await db.prepare("SELECT id, title, narrative_order FROM scenes WHERE narrative_order IS NOT NULL AND id != ? ORDER BY narrative_order ASC").bind(args.scene_id).all()
  ).results as Array<{ id: string; title: string; narrative_order: number }>;
  const pos = Math.min(args.narrative_order, ordered.length + 1);
  ordered.splice(pos - 1, 0, { id: scene.id, title: scene.title, narrative_order: -1 });
  // 全体を1..Nで振り直す（重複・欠番もここで解消）。D1のレース回避のため逐次await
  const renumbered: string[] = [];
  for (let i = 0; i < ordered.length; i++) {
    if (ordered[i].narrative_order !== i + 1) {
      await db.prepare("UPDATE scenes SET narrative_order=? WHERE id=?").bind(i + 1, ordered[i].id).run();
      renumbered.push(`第${i + 1}話 ← 「${ordered[i].title}」`);
    }
  }
  return { ok: true, scene_id: scene.id, title: scene.title, new_order: pos, renumbered };
}

async function updateScene(db: D1Database, args: { scene_id: string; title?: string; story_time?: string | null; narrative_order?: number | null; location?: string; disclosure_notes?: string; protagonist_identity_id?: string | null; synopsis?: string | null; reader_goal?: string | null; episode_id?: string | null }): Promise<unknown> {
  const scene = await db.prepare("SELECT id FROM scenes WHERE id=?").bind(args.scene_id).first();
  if (!scene) return { error: `Scene '${args.scene_id}' not found` };
  if ('episode_id' in args && args.episode_id) {
    const ep = await db.prepare("SELECT id FROM episodes WHERE id=?").bind(args.episode_id).first();
    if (!ep) return { error: `Episode '${args.episode_id}' not found` };
  }
  const hasStoryTime = 'story_time' in args;
  const hasOrder = 'narrative_order' in args;
  const hasIdentity = 'protagonist_identity_id' in args;
  await db.prepare(
    `UPDATE scenes SET
      title=COALESCE(?,title),
      story_time=CASE WHEN ?=1 THEN ? ELSE story_time END,
      narrative_order=CASE WHEN ?=1 THEN ? ELSE narrative_order END,
      location=COALESCE(?,location),
      disclosure_notes=COALESCE(?,disclosure_notes),
      protagonist_identity_id=CASE WHEN ?=1 THEN ? ELSE protagonist_identity_id END,
      synopsis=CASE WHEN ?=1 THEN ? ELSE synopsis END,
      reader_goal=CASE WHEN ?=1 THEN ? ELSE reader_goal END,
      episode_id=CASE WHEN ?=1 THEN ? ELSE episode_id END
     WHERE id=?`
  ).bind(
    args.title ?? null,
    hasStoryTime ? 1 : 0, args.story_time ?? null,
    hasOrder ? 1 : 0, args.narrative_order ?? null,
    args.location ?? null,
    args.disclosure_notes ?? null,
    hasIdentity ? 1 : 0, args.protagonist_identity_id ?? null,
    'synopsis' in args ? 1 : 0, args.synopsis ?? null,
    'reader_goal' in args ? 1 : 0, args.reader_goal ?? null,
    'episode_id' in args ? 1 : 0, args.episode_id ?? null,
    args.scene_id
  ).run();
  return { ok: true, scene_id: args.scene_id };
}

async function createCharacter(db: D1Database, args: { id: string; name: string; aliases?: string; role?: string; description?: string; secret?: string; speech_style?: string; gender?: string }): Promise<unknown> {
  const exists = await db.prepare("SELECT id FROM characters WHERE id=?").bind(args.id).first();
  if (exists) return { error: `Character '${args.id}' already exists` };
  await db.prepare("INSERT INTO characters (id,name,aliases,role,description,secret,speech_style,gender) VALUES (?,?,?,?,?,?,?,?)")
    .bind(args.id, args.name, args.aliases ?? null, args.role ?? 'supporting', args.description ?? null, args.secret ?? null, args.speech_style ?? null, args.gender ?? null).run();
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

async function updateCharacter(db: D1Database, args: { id: string; name?: string; aliases?: string | null; role?: string; description?: string | null; secret?: string | null; speech_style?: string | null; gender?: string | null }): Promise<unknown> {
  const char = await db.prepare("SELECT id FROM characters WHERE id=?").bind(args.id).first();
  if (!char) return { error: `Character '${args.id}' not found` };
  await db.prepare(
    `UPDATE characters SET
      name=COALESCE(?,name),
      aliases=CASE WHEN ?=1 THEN ? ELSE aliases END,
      role=COALESCE(?,role),
      description=CASE WHEN ?=1 THEN ? ELSE description END,
      secret=CASE WHEN ?=1 THEN ? ELSE secret END,
      speech_style=CASE WHEN ?=1 THEN ? ELSE speech_style END,
      gender=CASE WHEN ?=1 THEN ? ELSE gender END
     WHERE id=?`
  ).bind(
    args.name ?? null,
    'aliases' in args ? 1 : 0, args.aliases ?? null,
    args.role ?? null,
    'description' in args ? 1 : 0, args.description ?? null,
    'secret' in args ? 1 : 0, args.secret ?? null,
    'speech_style' in args ? 1 : 0, args.speech_style ?? null,
    'gender' in args ? 1 : 0, args.gender ?? null,
    args.id
  ).run();
  return { ok: true, id: args.id };
}

async function createSwap(db: D1Database, args: { id: string; from_character_id: string; source_body_id?: string; to_character_id: string; swapped_at: string; resolved_at?: string; ego_recovered_at?: string; trigger_event?: string; notes?: string }): Promise<unknown> {
  if (!args.id || !args.from_character_id || !args.to_character_id || !args.swapped_at) {
    return { error: "id, from_character_id, to_character_id, swapped_at は必須です" };
  }
  const from = await db.prepare("SELECT id FROM characters WHERE id=?").bind(args.from_character_id).first();
  if (!from) return { error: `Character (from) '${args.from_character_id}' not found` };
  const to = await db.prepare("SELECT id FROM characters WHERE id=?").bind(args.to_character_id).first();
  if (!to) return { error: `Character (to) '${args.to_character_id}' not found` };
  await db.prepare(
    `INSERT INTO consciousness_swaps (id, from_character_id, source_body_id, to_character_id, swapped_at, resolved_at, ego_recovered_at, trigger_event, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    args.id, args.from_character_id, args.source_body_id ?? null, args.to_character_id,
    args.swapped_at, args.resolved_at ?? null, args.ego_recovered_at ?? null,
    args.trigger_event ?? null, args.notes ?? null
  ).run();
  return { ok: true, id: args.id };
}

async function updateSwap(db: D1Database, args: { id: string; from_character_id?: string; source_body_id?: string | null; to_character_id?: string; swapped_at?: string; resolved_at?: string | null; ego_recovered_at?: string | null; trigger_event?: string | null; notes?: string | null }): Promise<unknown> {
  if (!args.id) return { error: "id は必須です" };
  const exists = await db.prepare("SELECT id FROM consciousness_swaps WHERE id=?").bind(args.id).first();
  if (!exists) return { error: `Swap '${args.id}' not found` };
  await db.prepare(
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
    args.from_character_id ?? null,
    'source_body_id' in args ? 1 : 0, args.source_body_id ?? null,
    args.to_character_id ?? null,
    args.swapped_at ?? null,
    'resolved_at' in args ? 1 : 0, args.resolved_at ?? null,
    'ego_recovered_at' in args ? 1 : 0, args.ego_recovered_at ?? null,
    'trigger_event' in args ? 1 : 0, args.trigger_event ?? null,
    'notes' in args ? 1 : 0, args.notes ?? null,
    args.id
  ).run();
  return { ok: true, id: args.id };
}

async function deleteSwap(db: D1Database, args: { id: string }): Promise<unknown> {
  if (!args.id) return { error: "id は必須です" };
  await db.prepare("DELETE FROM consciousness_swaps WHERE id=?").bind(args.id).run();
  return { ok: true, id: args.id };
}

async function deleteCharacter(db: D1Database, args: { id: string }): Promise<unknown> {
  const char = await db.prepare("SELECT id, name FROM characters WHERE id=?").bind(args.id).first() as { id: string; name: string } | null;
  if (!char) return { error: `Character '${args.id}' not found` };
  const inSwap = await db.prepare("SELECT COUNT(*) as n FROM consciousness_swaps WHERE from_character_id=? OR to_character_id=?").bind(args.id, args.id).first<{ n: number }>();
  if (inSwap && inSwap.n > 0) return { error: `キャラ「${char.name}」は意識入れ替わりレコード ${inSwap.n} 件に参照されています。先に入れ替わりを削除してください。` };
  await db.prepare("DELETE FROM scene_characters WHERE character_id=?").bind(args.id).run();
  await db.prepare("DELETE FROM character_states WHERE character_id=?").bind(args.id).run();
  await db.prepare("DELETE FROM relationships WHERE character_id_a=? OR character_id_b=?").bind(args.id, args.id).run();
  await db.prepare("DELETE FROM characters WHERE id=?").bind(args.id).run();
  return { ok: true, id: args.id, name: char.name };
}

async function updateRelationship(db: D1Database, args: { id: string; relation_type?: string; is_public?: boolean; notes?: string | null }): Promise<unknown> {
  const rel = await db.prepare("SELECT id FROM relationships WHERE id=?").bind(args.id).first();
  if (!rel) return { error: `Relationship '${args.id}' not found` };
  await db.prepare(
    `UPDATE relationships SET
      relation_type=COALESCE(?,relation_type),
      is_public=COALESCE(?,is_public),
      notes=CASE WHEN ?=1 THEN ? ELSE notes END
     WHERE id=?`
  ).bind(
    args.relation_type ?? null,
    args.is_public != null ? (args.is_public ? 1 : 0) : null,
    'notes' in args ? 1 : 0, args.notes ?? null,
    args.id
  ).run();
  return { ok: true, id: args.id };
}

async function deleteRelationship(db: D1Database, args: { id: string }): Promise<unknown> {
  const rel = await db.prepare("SELECT id FROM relationships WHERE id=?").bind(args.id).first();
  if (!rel) return { error: `Relationship '${args.id}' not found` };
  await db.prepare("DELETE FROM relationships WHERE id=?").bind(args.id).run();
  return { ok: true, id: args.id };
}

async function addWorldRule(db: D1Database, args: { id: string; category: string; rule: string; applies_from?: string }): Promise<unknown> {
  const exists = await db.prepare("SELECT id FROM world_rules WHERE id=?").bind(args.id).first();
  if (exists) return { error: `World rule '${args.id}' already exists` };
  await db.prepare("INSERT INTO world_rules (id, category, rule, applies_from) VALUES (?, ?, ?, ?)")
    .bind(args.id, args.category, args.rule, args.applies_from ?? null).run();
  return { ok: true, id: args.id, category: args.category };
}

async function updateWorldRule(db: D1Database, args: { id: string; category?: string; rule?: string; applies_from?: string | null }): Promise<unknown> {
  const existing = await db.prepare("SELECT id FROM world_rules WHERE id=?").bind(args.id).first();
  if (!existing) return { error: `World rule '${args.id}' not found` };
  await db.prepare(
    `UPDATE world_rules SET
      category=COALESCE(?,category),
      rule=COALESCE(?,rule),
      applies_from=CASE WHEN ?=1 THEN ? ELSE applies_from END
     WHERE id=?`
  ).bind(
    args.category ?? null,
    args.rule ?? null,
    'applies_from' in args ? 1 : 0, args.applies_from ?? null,
    args.id
  ).run();
  return { ok: true, id: args.id };
}

async function deleteWorldRule(db: D1Database, args: { id: string }): Promise<unknown> {
  const existing = await db.prepare("SELECT id FROM world_rules WHERE id=?").bind(args.id).first();
  if (!existing) return { error: `World rule '${args.id}' not found` };
  await db.prepare("DELETE FROM world_rules WHERE id=?").bind(args.id).run();
  return { ok: true, id: args.id };
}

// 話（エピソード）管理。Web連載の投稿単位で、複数シーンをまとめる。
async function listEpisodes(db: D1Database): Promise<Array<Record<string, unknown>>> {
  try {
    const episodes = (
      await db.prepare("SELECT * FROM episodes ORDER BY COALESCE(episode_number, 9999), created_at").all()
    ).results as Array<Record<string, unknown>>;
    const scenes = (
      await db.prepare("SELECT id, title, narrative_order, is_written, episode_id, length(COALESCE(body,'')) as char_count FROM scenes ORDER BY narrative_order ASC").all()
    ).results as Array<Record<string, unknown>>;
    return episodes.map(ep => {
      const epScenes = scenes.filter(s => s.episode_id === ep.id);
      return {
        ...ep,
        scenes: epScenes.map(s => ({ id: s.id, title: s.title, narrative_order: s.narrative_order, is_written: s.is_written, char_count: s.char_count })),
        scene_count: epScenes.length,
        written_count: epScenes.filter(s => s.is_written === 1).length,
        total_chars: epScenes.reduce((sum, s) => sum + (s.char_count as number), 0),
      };
    });
  } catch {
    return [];
  }
}

async function setEpisode(db: D1Database, args: { id?: string; episode_number?: number | null; title?: string; hook?: string | null; notes?: string | null; status?: string }): Promise<unknown> {
  if (args.status && !['draft', 'published'].includes(args.status)) {
    return { error: "status は draft（下書き）/ published（公開済み）のいずれかです" };
  }
  const existing = args.id
    ? await db.prepare("SELECT id FROM episodes WHERE id=?").bind(args.id).first()
    : null;
  if (existing) {
    await db.prepare(
      `UPDATE episodes SET
        episode_number=CASE WHEN ?=1 THEN ? ELSE episode_number END,
        title=COALESCE(?,title),
        hook=CASE WHEN ?=1 THEN ? ELSE hook END,
        notes=CASE WHEN ?=1 THEN ? ELSE notes END,
        status=COALESCE(?,status)
       WHERE id=?`
    ).bind(
      'episode_number' in args ? 1 : 0, args.episode_number ?? null,
      args.title ?? null,
      'hook' in args ? 1 : 0, args.hook ?? null,
      'notes' in args ? 1 : 0, args.notes ?? null,
      args.status ?? null,
      args.id
    ).run();
    return { ok: true, id: args.id, updated: true };
  }
  if (!args.title) return { error: "新規作成には title（話のタイトル）が必須です" };
  const id = args.id ?? crypto.randomUUID();
  await db.prepare(
    "INSERT INTO episodes (id, episode_number, title, hook, notes, status, created_at) VALUES (?,?,?,?,?,?,?)"
  ).bind(id, args.episode_number ?? null, args.title, args.hook ?? null, args.notes ?? null, args.status ?? 'draft', new Date().toISOString()).run();
  return { ok: true, id, created: true };
}

async function deleteEpisode(db: D1Database, args: { id: string }): Promise<unknown> {
  if (!args.id) return { error: "id は必須です" };
  // 所属シーンは削除せず、話への紐付けだけ外す
  await db.prepare("UPDATE scenes SET episode_id=NULL WHERE episode_id=?").bind(args.id).run();
  await db.prepare("DELETE FROM episodes WHERE id=?").bind(args.id).run();
  return { ok: true, id: args.id };
}

// 伏線管理
async function listForeshadows(db: D1Database): Promise<Array<Record<string, unknown>>> {
  try {
    return (
      await db.prepare(
        `SELECT f.*, sp.title as planted_scene_title, pp.title as payoff_scene_title
         FROM foreshadowings f
         LEFT JOIN scenes sp ON f.planted_scene_id = sp.id
         LEFT JOIN scenes pp ON f.payoff_scene_id = pp.id
         ORDER BY CASE f.status WHEN 'open' THEN 0 WHEN 'resolved' THEN 1 ELSE 2 END, f.created_at`
      ).all()
    ).results as Array<Record<string, unknown>>;
  } catch {
    return [];
  }
}

async function setForeshadow(db: D1Database, args: { id?: string; title?: string; detail?: string | null; planted_scene_id?: string | null; payoff_scene_id?: string | null; status?: string; reader_effect?: string | null; notes?: string | null }): Promise<unknown> {
  if (args.status && !['open', 'resolved', 'dropped'].includes(args.status)) {
    return { error: "status は open（未回収）/ resolved（回収済み）/ dropped（破棄）のいずれかです" };
  }
  for (const key of ['planted_scene_id', 'payoff_scene_id'] as const) {
    const sceneId = args[key];
    if (sceneId) {
      const scene = await db.prepare("SELECT id FROM scenes WHERE id=?").bind(sceneId).first();
      if (!scene) return { error: `${key} のシーン '${sceneId}' が存在しません` };
    }
  }
  const existing = args.id
    ? await db.prepare("SELECT id FROM foreshadowings WHERE id=?").bind(args.id).first()
    : null;
  if (existing) {
    await db.prepare(
      `UPDATE foreshadowings SET
        title=COALESCE(?,title),
        detail=CASE WHEN ?=1 THEN ? ELSE detail END,
        planted_scene_id=CASE WHEN ?=1 THEN ? ELSE planted_scene_id END,
        payoff_scene_id=CASE WHEN ?=1 THEN ? ELSE payoff_scene_id END,
        status=COALESCE(?,status),
        reader_effect=CASE WHEN ?=1 THEN ? ELSE reader_effect END,
        notes=CASE WHEN ?=1 THEN ? ELSE notes END
       WHERE id=?`
    ).bind(
      args.title ?? null,
      'detail' in args ? 1 : 0, args.detail ?? null,
      'planted_scene_id' in args ? 1 : 0, args.planted_scene_id ?? null,
      'payoff_scene_id' in args ? 1 : 0, args.payoff_scene_id ?? null,
      args.status ?? null,
      'reader_effect' in args ? 1 : 0, args.reader_effect ?? null,
      'notes' in args ? 1 : 0, args.notes ?? null,
      args.id
    ).run();
    return { ok: true, id: args.id, updated: true };
  }
  if (!args.title) return { error: "新規作成には title（伏線の内容の要約）が必須です" };
  const id = args.id ?? crypto.randomUUID();
  await db.prepare(
    "INSERT INTO foreshadowings (id, title, detail, planted_scene_id, payoff_scene_id, status, reader_effect, notes, created_at) VALUES (?,?,?,?,?,?,?,?,?)"
  ).bind(
    id, args.title, args.detail ?? null, args.planted_scene_id ?? null, args.payoff_scene_id ?? null,
    args.status ?? 'open', args.reader_effect ?? null, args.notes ?? null, new Date().toISOString()
  ).run();
  return { ok: true, id, created: true };
}

async function deleteForeshadow(db: D1Database, args: { id: string }): Promise<unknown> {
  if (!args.id) return { error: "id は必須です" };
  await db.prepare("DELETE FROM foreshadowings WHERE id=?").bind(args.id).run();
  return { ok: true, id: args.id };
}

// 執筆スタイル（文体・描写の流儀）。テーブルは初回アクセス時に自動作成。
async function ensureStyleTable(db: D1Database): Promise<void> {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS style_guides (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      title TEXT,
      content TEXT NOT NULL,
      sort_order INTEGER,
      updated_at TEXT
    )`
  ).run();
}

async function listStyleGuides(db: D1Database): Promise<Array<Record<string, unknown>>> {
  try {
    return (
      await db.prepare("SELECT id, category, title, content, sort_order FROM style_guides ORDER BY COALESCE(sort_order, 9999), category, title").all()
    ).results as Array<Record<string, unknown>>;
  } catch {
    return []; // テーブル未作成
  }
}

async function setStyleGuide(db: D1Database, args: { id?: string; category?: string; content?: string; title?: string; sort_order?: number }): Promise<unknown> {
  if (!args.category || !args.content) return { error: "category と rule（スタイル内容）は必須です" };
  await ensureStyleTable(db);
  const id = args.id ?? crypto.randomUUID();
  await db.prepare(
    `INSERT INTO style_guides (id, category, title, content, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET category=excluded.category, title=excluded.title, content=excluded.content, sort_order=excluded.sort_order, updated_at=excluded.updated_at`
  ).bind(id, args.category, args.title ?? null, args.content, args.sort_order ?? null, new Date().toISOString()).run();
  return { ok: true, id, category: args.category };
}

async function deleteStyleGuide(db: D1Database, args: { id: string }): Promise<unknown> {
  if (!args.id) return { error: "id は必須です" };
  await ensureStyleTable(db);
  await db.prepare("DELETE FROM style_guides WHERE id=?").bind(args.id).run();
  return { ok: true, id: args.id };
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
            serverInfo: { name: "novelsync-mcp", version: VERSION },
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
        await ensureSchemaExtensions(env.DB);
        let toolResult: unknown;
        switch (toolName) {
          case "help":
            toolResult = getHelp();
            break;
          case "get_character":
            toolResult = await getCharacter(env.DB, toolArgs as { id: string; scene_time?: string });
            break;
          case "list_overview":
            toolResult = await listOverview(env.DB);
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
          case "manage_scene": {
            const a = toolArgs as Record<string, unknown>;
            const action = a.action as string;
            const sceneId = (a.scene_id ?? a.id) as string;
            switch (action) {
              case "create":
                toolResult = await createScene(env.DB, { id: (a.id ?? a.scene_id) as string, title: a.title as string, story_time: a.story_time as string | undefined, narrative_order: a.narrative_order as number | undefined, location: a.location as string | undefined, disclosure_notes: a.disclosure_notes as string | undefined, synopsis: a.synopsis as string | undefined, reader_goal: a.reader_goal as string | undefined });
                break;
              case "update": {
                const upd: Parameters<typeof updateScene>[1] = { scene_id: sceneId, title: a.title as string | undefined, location: a.location as string | undefined, disclosure_notes: a.disclosure_notes as string | undefined };
                if ('story_time' in a) upd.story_time = a.story_time as string | null;
                if ('narrative_order' in a) upd.narrative_order = a.narrative_order as number | null;
                if ('protagonist_identity_id' in a) upd.protagonist_identity_id = a.protagonist_identity_id as string | null;
                if ('synopsis' in a) upd.synopsis = a.synopsis as string | null;
                if ('reader_goal' in a) upd.reader_goal = a.reader_goal as string | null;
                if ('episode_id' in a) upd.episode_id = a.episode_id as string | null;
                toolResult = await updateScene(env.DB, upd);
                break;
              }
              case "delete":
                toolResult = await deleteScene(env.DB, { scene_id: sceneId });
                break;
              case "save_body":
                toolResult = await saveSceneBody(env.DB, { scene_id: sceneId, body: a.body as string });
                break;
              case "insert_at":
                toolResult = await insertSceneAt(env.DB, { scene_id: sceneId, narrative_order: a.narrative_order as number });
                break;
              case "list_revisions":
                toolResult = await listBodyRevisions(env.DB, { scene_id: sceneId });
                break;
              case "restore_revision":
                toolResult = await restoreBodyRevision(env.DB, { revision_id: a.revision_id as string });
                break;
              case "foreshadow_list":
                toolResult = { foreshadows: await listForeshadows(env.DB) };
                break;
              case "foreshadow_set": {
                const fs: Parameters<typeof setForeshadow>[1] = { id: (a.foreshadow_id ?? a.id) as string | undefined, title: a.title as string | undefined, status: a.status as string | undefined };
                if ('detail' in a) fs.detail = a.detail as string | null;
                if ('planted_scene_id' in a) fs.planted_scene_id = a.planted_scene_id as string | null;
                if ('payoff_scene_id' in a) fs.payoff_scene_id = a.payoff_scene_id as string | null;
                if ('reader_effect' in a) fs.reader_effect = a.reader_effect as string | null;
                if ('notes' in a) fs.notes = a.notes as string | null;
                toolResult = await setForeshadow(env.DB, fs);
                break;
              }
              case "foreshadow_delete":
                toolResult = await deleteForeshadow(env.DB, { id: (a.foreshadow_id ?? a.id) as string });
                break;
              case "episode_list":
                toolResult = { episodes: await listEpisodes(env.DB) };
                break;
              case "episode_set": {
                const ep: Parameters<typeof setEpisode>[1] = { id: (a.episode_id ?? a.id) as string | undefined, title: a.title as string | undefined, status: a.status as string | undefined };
                if ('episode_number' in a) ep.episode_number = a.episode_number as number | null;
                if ('hook' in a) ep.hook = a.hook as string | null;
                if ('notes' in a) ep.notes = a.notes as string | null;
                toolResult = await setEpisode(env.DB, ep);
                break;
              }
              case "episode_delete":
                toolResult = await deleteEpisode(env.DB, { id: (a.episode_id ?? a.id) as string });
                break;
              default:
                return { jsonrpc: "2.0", id, error: { code: -32602, message: `manage_scene: unknown action '${action}' (create/update/delete/save_body/insert_at/list_revisions/restore_revision/foreshadow_list/foreshadow_set/foreshadow_delete/episode_list/episode_set/episode_delete)` } };
            }
            break;
          }
          case "manage_character": {
            const a = toolArgs as Record<string, unknown>;
            const action = a.action as string;
            switch (action) {
              case "create":
                toolResult = await createCharacter(env.DB, { id: a.id as string, name: a.name as string, aliases: a.aliases as string | undefined, role: a.role as string | undefined, description: a.description as string | undefined, secret: a.secret as string | undefined, speech_style: a.speech_style as string | undefined, gender: a.gender as string | undefined });
                break;
              case "update": {
                const upd: Parameters<typeof updateCharacter>[1] = { id: a.id as string, name: a.name as string | undefined, role: a.role as string | undefined };
                if ('aliases' in a) upd.aliases = a.aliases as string | null;
                if ('description' in a) upd.description = a.description as string | null;
                if ('secret' in a) upd.secret = a.secret as string | null;
                if ('speech_style' in a) upd.speech_style = a.speech_style as string | null;
                if ('gender' in a) upd.gender = a.gender as string | null;
                toolResult = await updateCharacter(env.DB, upd);
                break;
              }
              case "delete":
                toolResult = await deleteCharacter(env.DB, { id: a.id as string });
                break;
              case "add_state":
                toolResult = await addCharacterState(env.DB, { character_id: (a.character_id ?? a.id) as string, scene_id: a.scene_id as string, appearance: a.appearance as string | undefined, status: a.status as string | undefined, notes: a.notes as string | undefined });
                break;
              case "add_swap":
                toolResult = await createSwap(env.DB, { id: (a.swap_id ?? a.id) as string, from_character_id: a.from_character_id as string, source_body_id: a.source_body_id as string | undefined, to_character_id: a.to_character_id as string, swapped_at: a.swapped_at as string, resolved_at: a.resolved_at as string | undefined, ego_recovered_at: a.ego_recovered_at as string | undefined, trigger_event: a.trigger_event as string | undefined, notes: a.notes as string | undefined });
                break;
              case "update_swap":
                toolResult = await updateSwap(env.DB, { ...a, id: (a.swap_id ?? a.id) } as unknown as Parameters<typeof updateSwap>[1]);
                break;
              case "delete_swap":
                toolResult = await deleteSwap(env.DB, { id: (a.swap_id ?? a.id) as string });
                break;
              default:
                return { jsonrpc: "2.0", id, error: { code: -32602, message: `manage_character: unknown action '${action}' (create/update/delete/add_state/add_swap/update_swap/delete_swap)` } };
            }
            break;
          }
          case "manage_relationship": {
            const a = toolArgs as Record<string, unknown>;
            const action = a.action as string;
            switch (action) {
              case "create":
                toolResult = await addRelationship(env.DB, { character_id_a: a.character_id_a as string, character_id_b: a.character_id_b as string, relation_type: a.relation_type as string, is_public: a.is_public as boolean | undefined, from_scene_id: a.from_scene_id as string | undefined, notes: a.notes as string | undefined });
                break;
              case "update": {
                const upd: Parameters<typeof updateRelationship>[1] = { id: a.id as string, relation_type: a.relation_type as string | undefined, is_public: a.is_public as boolean | undefined };
                if ('notes' in a) upd.notes = a.notes as string | null;
                toolResult = await updateRelationship(env.DB, upd);
                break;
              }
              case "delete":
                toolResult = await deleteRelationship(env.DB, { id: a.id as string });
                break;
              default:
                return { jsonrpc: "2.0", id, error: { code: -32602, message: `manage_relationship: unknown action '${action}' (create/update/delete)` } };
            }
            break;
          }
          case "manage_world_rule": {
            const a = toolArgs as Record<string, unknown>;
            const action = a.action as string;
            switch (action) {
              case "create":
                toolResult = await addWorldRule(env.DB, { id: a.id as string, category: a.category as string, rule: a.rule as string, applies_from: a.applies_from as string | undefined });
                break;
              case "update": {
                const upd: Parameters<typeof updateWorldRule>[1] = { id: a.id as string, category: a.category as string | undefined, rule: a.rule as string | undefined };
                if ('applies_from' in a) upd.applies_from = a.applies_from as string | null;
                toolResult = await updateWorldRule(env.DB, upd);
                break;
              }
              case "delete":
                toolResult = await deleteWorldRule(env.DB, { id: a.id as string });
                break;
              case "style_set":
                toolResult = await setStyleGuide(env.DB, { id: a.id as string | undefined, category: a.category as string | undefined, content: (a.rule ?? a.content) as string | undefined, title: a.title as string | undefined, sort_order: a.sort_order as number | undefined });
                break;
              case "style_delete":
                toolResult = await deleteStyleGuide(env.DB, { id: a.id as string });
                break;
              default:
                return { jsonrpc: "2.0", id, error: { code: -32602, message: `manage_world_rule: unknown action '${action}' (create/update/delete/style_set/style_delete)` } };
            }
            break;
          }
          // --- 後方互換エイリアス ---
          // 旧ツール名（list_scenes / create_scene / save_scene_body 等、統合前の個別名）を
          // 引き続き受け付ける。ツール一覧をキャッシュしている古いクライアントが旧名で呼んでも
          // Unknown tool にならないようにするための保険。tools/list には出さない（12件制限を維持）。
          case "list_characters":
            toolResult = await listCharacters(env.DB);
            break;
          case "list_scenes":
            toolResult = await listScenes(env.DB);
            break;
          case "create_scene":
            toolResult = await createScene(env.DB, toolArgs as { id: string; title: string; story_time?: string; narrative_order?: number; location?: string; disclosure_notes?: string });
            break;
          case "update_scene":
            toolResult = await updateScene(env.DB, toolArgs as { scene_id: string; title?: string; story_time?: string | null; narrative_order?: number | null; location?: string; disclosure_notes?: string; protagonist_identity_id?: string | null });
            break;
          case "delete_scene":
            toolResult = await deleteScene(env.DB, toolArgs as { scene_id: string });
            break;
          case "save_scene_body":
            toolResult = await saveSceneBody(env.DB, toolArgs as { scene_id: string; body: string });
            break;
          case "create_character":
            toolResult = await createCharacter(env.DB, toolArgs as { id: string; name: string; aliases?: string; role?: string; description?: string; secret?: string });
            break;
          case "update_character":
            toolResult = await updateCharacter(env.DB, toolArgs as { id: string; name?: string; aliases?: string | null; role?: string; description?: string | null; secret?: string | null });
            break;
          case "delete_character":
            toolResult = await deleteCharacter(env.DB, toolArgs as { id: string });
            break;
          case "add_character_state":
            toolResult = await addCharacterState(env.DB, toolArgs as { character_id: string; scene_id: string; appearance?: string; status?: string; notes?: string });
            break;
          case "add_relationship":
            toolResult = await addRelationship(env.DB, toolArgs as { character_id_a: string; character_id_b: string; relation_type: string; is_public?: boolean; from_scene_id?: string; notes?: string });
            break;
          case "update_relationship":
            toolResult = await updateRelationship(env.DB, toolArgs as { id: string; relation_type?: string; is_public?: boolean; notes?: string | null });
            break;
          case "delete_relationship":
            toolResult = await deleteRelationship(env.DB, toolArgs as { id: string });
            break;
          case "add_world_rule":
            toolResult = await addWorldRule(env.DB, toolArgs as { id: string; category: string; rule: string; applies_from?: string });
            break;
          case "update_world_rule":
            toolResult = await updateWorldRule(env.DB, toolArgs as { id: string; category?: string; rule?: string; applies_from?: string | null });
            break;
          case "delete_world_rule":
            toolResult = await deleteWorldRule(env.DB, toolArgs as { id: string });
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
    await ensureSchemaExtensions(env.DB);
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
        const body = await request.json() as {id:string;name:string;aliases?:string;role?:string;description?:string;secret?:string;speech_style?:string;gender?:string};
        await env.DB.prepare("INSERT INTO characters (id, name, aliases, role, description, secret, speech_style, gender) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
          .bind(body.id, body.name, body.aliases ?? null, body.role ?? null, body.description ?? null, body.secret ?? null, body.speech_style ?? null, body.gender ?? null).run();
        return json({ ok: true });
      }
      if (method === 'PUT' && id) {
        const body = await request.json() as {name?:string;aliases?:string;role?:string;description?:string;secret?:string;avatar?:string|null;speech_style?:string|null;gender?:string|null};
        const hasAvatar = 'avatar' in (body as object);
        await env.DB.prepare(
          "UPDATE characters SET name=COALESCE(?,name), aliases=COALESCE(?,aliases), role=COALESCE(?,role), description=COALESCE(?,description), secret=COALESCE(?,secret), avatar=CASE WHEN ?=1 THEN ? ELSE avatar END, speech_style=CASE WHEN ?=1 THEN ? ELSE speech_style END, gender=CASE WHEN ?=1 THEN ? ELSE gender END WHERE id=?"
        ).bind(body.name ?? null, body.aliases ?? null, body.role ?? null, body.description ?? null, body.secret ?? null, hasAvatar ? 1 : 0, body.avatar ?? null, 'speech_style' in body ? 1 : 0, body.speech_style ?? null, 'gender' in body ? 1 : 0, body.gender ?? null, id).run();
        return json({ ok: true });
      }
    }

    if (resource === 'scenes') {
      if (method === 'GET') {
        const result = await env.DB.prepare("SELECT * FROM scenes ORDER BY narrative_order ASC").all();
        return json({ scenes: result.results });
      }
      if (method === 'POST') {
        const body = await request.json() as {id:string;title:string;story_time?:string;narrative_order?:number;location?:string;disclosure_notes?:string;synopsis?:string;reader_goal?:string};
        await env.DB.prepare("INSERT INTO scenes (id, title, story_time, narrative_order, location, disclosure_notes, synopsis, reader_goal) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
          .bind(body.id, body.title, body.story_time ?? null, body.narrative_order ?? null, body.location ?? null, body.disclosure_notes ?? null, body.synopsis || null, body.reader_goal || null).run();
        return json({ ok: true });
      }
      if (method === 'PUT' && id) {
        const body = await request.json() as {title?:string;story_time?:string;narrative_order?:number;location?:string;disclosure_notes?:string;is_written?:number;protagonist_identity_id?:string|null;body?:string|null;synopsis?:string|null;reader_goal?:string|null;episode_id?:string|null};
        const hasIdentity = 'protagonist_identity_id' in (body as object);
        const hasBody = 'body' in (body as object);
        if (hasBody) {
          const cur = await env.DB.prepare("SELECT body FROM scenes WHERE id=?").bind(id).first() as { body: string | null } | null;
          await archiveBodyRevision(env.DB, id, cur?.body ?? null, body.body ?? null);
        }
        await env.DB.prepare(
          "UPDATE scenes SET title=COALESCE(?,title), story_time=COALESCE(?,story_time), narrative_order=COALESCE(?,narrative_order), location=COALESCE(?,location), disclosure_notes=COALESCE(?,disclosure_notes), is_written=COALESCE(?,is_written), protagonist_identity_id=CASE WHEN ?=1 THEN ? ELSE protagonist_identity_id END, body=CASE WHEN ?=1 THEN ? ELSE body END, synopsis=CASE WHEN ?=1 THEN ? ELSE synopsis END, reader_goal=CASE WHEN ?=1 THEN ? ELSE reader_goal END, episode_id=CASE WHEN ?=1 THEN ? ELSE episode_id END WHERE id=?"
        ).bind(
          body.title ?? null, body.story_time ?? null, body.narrative_order ?? null,
          body.location ?? null, body.disclosure_notes ?? null, body.is_written ?? null,
          hasIdentity ? 1 : 0, body.protagonist_identity_id ?? null,
          hasBody ? 1 : 0, body.body ?? null,
          'synopsis' in body ? 1 : 0, body.synopsis ?? null,
          'reader_goal' in body ? 1 : 0, body.reader_goal ?? null,
          'episode_id' in body ? 1 : 0, body.episode_id ?? null,
          id
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
      if (method === 'PUT' && id) {
        const body = await request.json() as { category?: string; rule?: string; applies_from?: string | null };
        await env.DB.prepare(
          `UPDATE world_rules SET category=COALESCE(?,category), rule=COALESCE(?,rule), applies_from=CASE WHEN ?=1 THEN ? ELSE applies_from END WHERE id=?`
        ).bind(
          body.category ?? null,
          body.rule ?? null,
          'applies_from' in body ? 1 : 0, body.applies_from ?? null,
          id
        ).run();
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
        const body = await request.json() as {scene_id:string;character_id:string;role_in_scene?:string;is_pov?:boolean;notes?:string};
        await env.DB.prepare("INSERT OR REPLACE INTO scene_characters (scene_id, character_id, role_in_scene, is_pov, notes) VALUES (?, ?, ?, ?, ?)")
          .bind(body.scene_id, body.character_id, body.role_in_scene ?? 'present', body.is_pov ? 1 : 0, body.notes ?? null).run();
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

    // キャラクター画像。D1の専用テーブル character_avatars に保存し、
    // characters.avatar にはURLパス（/api/avatars/:id?v=...）だけを持たせる。
    // 一覧APIのレスポンスが画像データで肥大化しないようにするための分離。
    if (resource === 'avatars') {
      await env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS character_avatars (
          character_id TEXT PRIMARY KEY REFERENCES characters(id),
          data TEXT NOT NULL,
          content_type TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )`
      ).run();
      if (id === 'migrate-from-db' && method === 'POST') {
        // characters.avatar のbase64を専用テーブルへ移し、avatarカラムをURLパスに置き換える
        const chars = (await env.DB.prepare("SELECT id, avatar FROM characters WHERE avatar LIKE 'data:%'").all()).results as Array<{ id: string; avatar: string }>;
        const results: string[] = [];
        for (const c of chars) {
          const m = c.avatar.match(/^data:([^;]+);base64,(.+)$/);
          if (!m) { results.push(`SKIP ${c.id}: data URI形式を解析できません`); continue; }
          await env.DB.prepare("INSERT OR REPLACE INTO character_avatars (character_id, data, content_type, updated_at) VALUES (?, ?, ?, ?)")
            .bind(c.id, m[2], m[1], new Date().toISOString()).run();
          const path = `/api/avatars/${c.id}?v=${Date.now()}`;
          await env.DB.prepare("UPDATE characters SET avatar=? WHERE id=?").bind(path, c.id).run();
          results.push(`OK ${c.id}: ${(m[2].length * 0.75 / 1024).toFixed(1)}KB を移行`);
        }
        return json({ migrated: results.length === 0 ? ['移行対象（base64画像）はありませんでした'] : results });
      }
      if (!id) return json({ error: 'character id required' }, 400);
      if (method === 'GET') {
        const row = await env.DB.prepare("SELECT data, content_type FROM character_avatars WHERE character_id=?").bind(id).first() as { data: string; content_type: string } | null;
        if (!row) return json({ error: 'Not found' }, 404);
        const bytes = Uint8Array.from(atob(row.data), ch => ch.charCodeAt(0));
        return new Response(bytes, {
          headers: {
            ...CORS,
            'Content-Type': row.content_type,
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        });
      }
      if (method === 'PUT' || method === 'POST') {
        const char = await env.DB.prepare("SELECT id FROM characters WHERE id=?").bind(id).first();
        if (!char) return json({ error: `Character '${id}' not found` }, 404);
        const data = await request.arrayBuffer();
        if (data.byteLength === 0) return json({ error: '画像データが空です' }, 400);
        if (data.byteLength > 900 * 1024) return json({ error: '画像は900KB以下にしてください（アップロード時に自動縮小されます。このエラーが出る場合は画面を再読込してください）' }, 400);
        // ArrayBuffer → base64（チャンク処理でスタック溢れ回避）
        const u8 = new Uint8Array(data);
        let binary = '';
        for (let i = 0; i < u8.length; i += 0x8000) {
          binary += String.fromCharCode(...u8.subarray(i, i + 0x8000));
        }
        const b64 = btoa(binary);
        const contentType = request.headers.get('Content-Type') ?? 'image/jpeg';
        await env.DB.prepare("INSERT OR REPLACE INTO character_avatars (character_id, data, content_type, updated_at) VALUES (?, ?, ?, ?)")
          .bind(id, b64, contentType, new Date().toISOString()).run();
        const path = `/api/avatars/${id}?v=${Date.now()}`;
        await env.DB.prepare("UPDATE characters SET avatar=? WHERE id=?").bind(path, id).run();
        return json({ ok: true, avatar: path });
      }
      if (method === 'DELETE') {
        await env.DB.prepare("DELETE FROM character_avatars WHERE character_id=?").bind(id).run();
        await env.DB.prepare("UPDATE characters SET avatar=NULL WHERE id=?").bind(id).run();
        return json({ ok: true });
      }
    }

    // 話（エピソード）管理
    if (resource === 'episodes') {
      if (method === 'GET') {
        return json({ episodes: await listEpisodes(env.DB) });
      }
      if (method === 'POST') {
        const body = await request.json() as Record<string, unknown>;
        return json(await setEpisode(env.DB, body as Parameters<typeof setEpisode>[1]));
      }
      if (method === 'PUT' && id) {
        const body = await request.json() as Record<string, unknown>;
        return json(await setEpisode(env.DB, { ...(body as Parameters<typeof setEpisode>[1]), id }));
      }
      if (method === 'DELETE' && id) {
        return json(await deleteEpisode(env.DB, { id }));
      }
    }

    // 伏線管理
    if (resource === 'foreshadowings') {
      if (method === 'GET') {
        return json({ foreshadowings: await listForeshadows(env.DB) });
      }
      if (method === 'POST') {
        const body = await request.json() as Record<string, unknown>;
        return json(await setForeshadow(env.DB, body as Parameters<typeof setForeshadow>[1]));
      }
      if (method === 'PUT' && id) {
        const body = await request.json() as Record<string, unknown>;
        return json(await setForeshadow(env.DB, { ...(body as Parameters<typeof setForeshadow>[1]), id }));
      }
      if (method === 'DELETE' && id) {
        return json(await deleteForeshadow(env.DB, { id }));
      }
    }

    // 執筆スタイル（文体・描写の流儀）
    if (resource === 'styles') {
      await ensureStyleTable(env.DB);
      if (method === 'GET') {
        const styles = await listStyleGuides(env.DB);
        return json({ styles });
      }
      if (method === 'POST') {
        const body = await request.json() as { id?: string; category: string; title?: string; content: string; sort_order?: number };
        const result = await setStyleGuide(env.DB, body);
        return json(result);
      }
      if (method === 'PUT' && id) {
        const body = await request.json() as { category?: string; title?: string | null; content?: string; sort_order?: number | null };
        const existing = await env.DB.prepare("SELECT id FROM style_guides WHERE id=?").bind(id).first();
        if (!existing) return json({ error: `Style '${id}' not found` }, 404);
        await env.DB.prepare(
          `UPDATE style_guides SET
            category=COALESCE(?,category),
            title=CASE WHEN ?=1 THEN ? ELSE title END,
            content=COALESCE(?,content),
            sort_order=CASE WHEN ?=1 THEN ? ELSE sort_order END,
            updated_at=?
           WHERE id=?`
        ).bind(
          body.category ?? null,
          'title' in body ? 1 : 0, body.title ?? null,
          body.content ?? null,
          'sort_order' in body ? 1 : 0, body.sort_order ?? null,
          new Date().toISOString(),
          id
        ).run();
        return json({ ok: true });
      }
      if (method === 'DELETE' && id) {
        await env.DB.prepare("DELETE FROM style_guides WHERE id=?").bind(id).run();
        return json({ ok: true });
      }
    }

    if (resource === 'scene_revisions') {
      await ensureRevisionsTable(env.DB);
      if (method === 'GET' && id) {
        // idはscene_id。履歴一覧（本文込み・新しい順）
        const result = await env.DB.prepare(
          "SELECT id, scene_id, saved_at, length(body) as char_count, body FROM scene_body_revisions WHERE scene_id=? ORDER BY saved_at DESC"
        ).bind(id).all();
        return json({ revisions: result.results });
      }
      if (method === 'DELETE' && id) {
        await env.DB.prepare("DELETE FROM scene_body_revisions WHERE id=?").bind(id).run();
        return json({ ok: true });
      }
    }

    if (resource === 'export' && method === 'GET') {
      const tables = ['characters', 'scenes', 'world_rules', 'scene_characters', 'consciousness_swaps', 'character_states', 'relationships', 'scene_body_revisions', 'character_avatars', 'style_guides', 'foreshadowings', 'episodes'];
      const data: Record<string, unknown> = {};
      for (const tbl of tables) {
        try {
          data[tbl] = (await env.DB.prepare(`SELECT * FROM ${tbl}`).all()).results;
        } catch {
          data[tbl] = [];
        }
      }
      return json({ exported_at: new Date().toISOString(), version: VERSION, tables: data });
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
        `CREATE TABLE IF NOT EXISTS scene_characters_new (
          scene_id TEXT NOT NULL REFERENCES scenes(id),
          character_id TEXT NOT NULL REFERENCES characters(id),
          role_in_scene TEXT CHECK(role_in_scene IN ('active','present','mentioned')) DEFAULT 'present',
          is_pov INTEGER NOT NULL DEFAULT 0,
          notes TEXT,
          PRIMARY KEY (scene_id, character_id)
        )`,
        `INSERT OR IGNORE INTO scene_characters_new (scene_id, character_id, role_in_scene, is_pov, notes)
         SELECT scene_id, character_id,
           CASE role_in_scene WHEN 'main' THEN 'active' WHEN 'sub' THEN 'present' ELSE role_in_scene END,
           0, notes FROM scene_characters`,
        `DROP TABLE IF EXISTS scene_characters`,
        `ALTER TABLE scene_characters_new RENAME TO scene_characters`,
        `CREATE TABLE IF NOT EXISTS scene_body_revisions (
          id TEXT PRIMARY KEY,
          scene_id TEXT NOT NULL REFERENCES scenes(id),
          body TEXT NOT NULL,
          saved_at TEXT NOT NULL
        )`,
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
      return new Response(JSON.stringify({ name: "novelsync-mcp", version: VERSION, status: "ok", tool_count: TOOLS.length }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    return new Response("Method Not Allowed", { status: 405, headers: CORS });
  },
};
