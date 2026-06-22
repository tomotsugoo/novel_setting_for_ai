# CLAUDE.md

このファイルは Claude Code がこのリポジトリで作業するときの前提知識をまとめたものです。

## プロジェクト概要

**NovelSync** — 異世界転生小説の設定管理ツール（AI執筆支援用）。
キャラクター・シーン・世界ルール・意識の入れ替わりを管理する。

- フロントエンド: React + TypeScript + Vite + Tailwind CSS（GitHub Pages SPA、HashRouter）
- API / MCPサーバー: Cloudflare Workers（REST API + MCPサーバー `novelsync-mcp`）
- DB: Cloudflare D1（SQLite）`novelsync-db`

## ディレクトリ構成

- `web/` — フロントエンド（GitHub Pages）
- `mcp-server/` — Cloudflare Workers（REST API + MCP）。`src/index.ts` が本体

## デプロイ（重要）

**両方とも push で自動デプロイされる。手動デプロイは不要。**

| 対象 | 仕組み | トリガー |
|---|---|---|
| `web/` | GitHub Actions (`.github/workflows/deploy-web.yml`) | `main` への push（`web/**` 変更時） |
| `mcp-server/` | **Cloudflare 側の「Workers Builds」Git連携**（GitHub Actionsではない） | `main` への push |

⚠️ 注意: `mcp-server/` の自動デプロイは **Cloudflareダッシュボード側の設定**で動いている。
`.github/workflows/` には Cloudflare 用ワークフローが存在しないが、それは手動デプロイという意味ではない。
Workers Builds の設定:
- ルートディレクトリ: `/mcp-server`
- ビルドコマンド: `npm install && npm run build`
- デプロイコマンド: `npx wrangler deploy`
- プロダクションブランチ: `main`

デプロイ状況は Cloudflare ダッシュボードの「Workers Builds」ログで確認できる。

## DB / マイグレーション

- D1（SQLite）は **同時書き込みでレースコンディションが起きる**。一括更新は `Promise.all` ではなく逐次 `await` ループで行うこと。
- スキーマ変更は `POST /api/migrate`（`mcp-server/src/index.ts` 内の `migrations` 配列）で適用。冪等（カラム重複・テーブル既存は SKIP 扱い）。

## MCP ツール一覧（`mcp-server/src/index.ts` の `TOOLS`）

| ツール | 引数 | 説明 |
|---|---|---|
| `list_scenes` | なし | 全シーン一覧（ID・タイトル・執筆順・執筆済みフラグ） |
| `list_characters` | なし | 全キャラ一覧 |
| `get_scene_context` | `scene_id` | シーン情報＋登場キャラ詳細（外見・意識統合）＋関係性＋世界ルール |
| `get_character` | `id`, `scene_time?` | キャラ情報＋指定時刻での意識状態 |
| `check_conflict` | `description`, `scene_time` | 特定記述×特定時刻の矛盾チェック |
| `get_disclosure_level` | `scene_id` | 開示ノート・関係性の可視状態 |
| `check_all_consistency` | なし | 全データ横断の整合性チェック（時系列矛盾・参照整合性・順序重複/欠番・孤立データ） |

## REST API（`mcp-server/src/index.ts` の `handleRestApi`）

- `GET/POST /api/characters`、`PUT /api/characters/:id`
- `GET/POST /api/scenes`、`PUT /api/scenes/:id`
- `GET/POST /api/rules`、`DELETE /api/rules/:id`
- `GET/POST /api/scene_characters/:sceneId`、`DELETE /api/scene_characters/:sceneId/:characterId`
- `GET/POST /api/consciousness_swaps`、`PUT/DELETE /api/consciousness_swaps/:id`
- `POST /api/migrate`、`GET /api/dashboard`

## フロントエンドの注意点（過去のハマりどころ）

- 認証は `web/src/auth.ts`。`localStorage` で永続化（`sessionStorage` だとタブを閉じる/バックグラウンドでログアウトされる）。
- **React コンポーネントを親コンポーネントの内側で定義しない**。毎レンダーで remount され「1文字ずつしか入力できない」バグになる。モジュールトップレベルで定義し props で渡す。
- iOS Safari: `type="date"` の programmatic な値更新は反映されないことがある。`type="date"` + `type="time"` の分割＋既存シーンからの選択ドロップダウンで回避している。
- nullable フィールドの部分更新は `CASE WHEN ?=1 THEN ? ELSE col END` パターン（`'field' in body` で送信判定）。

## Git 運用

- 開発・push 先ブランチはタスクごとに指定される。指定が無ければ `main`。
- コミットメッセージは簡潔・説明的に。
