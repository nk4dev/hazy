# hazy note

URLの霧を、自分の言葉に落とすまでの一本道 — 取り込み → 整理 → 考えを書く → 外に出す。
**ノート (`/notes`) が主役**（サインイン後・ルートの遷移先、サイドバー最上部）。Turborepo (`hazy-repo/`) の `apps/hazy-note`。

## 技術構成

- **React 19 + Vite SPA + TypeScript**
- **TanStack Router + TanStack Query** — ルート単位のコード分割（`lazyRouteComponent`）、`beforeLoad` 認証ガード、`loader` プリフェッチ、キャッシュ無効化・サインアウト／401時キャッシュクリアを統一
- **Tailwind CSS v4 (`@repo/ui`)** — 共有 Nocturne テーマ（`@repo/ui/styles.css`）を継承し、`src/styles/globals.css` でアプリ固有クラス（`.btn` / `.card` / `.density-compact` / Quill スタイル等）を定義
- **認証・バックエンド** — **Better Auth**（サブドメイン共有 `HttpOnly` Cookie、`credentials: "include"`）＋ `apps/api` (`/v1/note/**`) を `@repo/api-client` 経由で呼び出す純フロントエンド。DB 直アクセス・Next.js API Routes は廃止

## 起動

```bash
# リポジトリルートで（API と同時に起動する場合）
op run --env-file=".env.op" -- bun run dev
bun run dev --filter=hazy-note   # Vite :3000 のみ
```

## デプロイ

Vite ビルド成果物 (`dist/`) → Cloudflare Workers Static Assets（`wrangler.jsonc`, `not_found_handling: "single-page-application"`, ドメイン `note.hz.nknighta.me`）。

## 画面

| ルート | 内容 |
| --- | --- |
| `/sign-in` | Better Auth サインイン（GitHub OAuth のみ、`ADMIN_EMAIL` 制限） |
| `/notes`, `/notes/new`, `/notes/$id` | **主要機能。** Quill 2 リッチテキストエディタ、Delta 保存、`@` 引用、右サイドバー AI 提案 |
| `/library`, `/library/$id` | 受信箱。URL 取り込み、カード／リスト表示、明示要約ボタン |
| `/capture` | 取り込みの3コマ（`?id=` 読み取り → 要約とタグ提案 → プロジェクト保存、`Hazyから追加` 対応） |
| `/projects/$id` | プロジェクト＝アイデア・出典・ノートをまとめる作業場 |
| `/search` | **文字列** / **タグ** / **AI検索**（`@ternlight/base/web` 端末内 WASM） / **チャット**（`/v1/note/search/chat`） |
| `/analyze` | 傾向分析（`?project=` 対応） |
| `/export` | 書き出し（ブログ／共有メモ／要点、Markdown ダウンロード・コピー） |
| `/tags` | タグ一覧（出典数・ノート数順） |

## ディレクトリ

```
src/
  main.tsx, App.tsx, router.tsx     Vite エントリ・TanStack Query/Router 構成
  pages/*-page.tsx                  ルートごとのコード分割ページコンポーネント
  components/                       AuthProvider / AccountMenu
  styles/globals.css                Nocturne + アプリ固有コンポーネントスタイル
components/                         AppShell, Sidebar, Breadcrumbs, NoteEditor (Quill 2), UI プリミティブ
lib/                                env, clients (@repo/api-client & Better Auth), api, hooks, search, note-delta, navigation
e2e/                                Playwright（`playwright.config.ts`）
scripts/                            localdb.sh / sync-from-neon.sh
```

## テスト・検証

```bash
bun --filter hazy-note test         # lib/search.test.ts
bun --filter hazy-note check-types
bun --filter hazy-note lint
bun --filter hazy-note build
```
