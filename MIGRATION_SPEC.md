# Hazy（hazy-repo）現行システム仕様書

本リポジトリ（`package.json`）は **Turborepo + Bun Workspaces** 構成のモノレポであり、同一の Clerk テナント・同一の PostgreSQL (Neon) データベースを共有する **4つのアプリ** と **2つの共通パッケージ** から構成されています。

- `apps/api`: Hono バックエンド Worker（`api.hz.nknighta.me`）
- `apps/hazy`: メイン Web フロントエンド（Next.js 16、`hz.nknighta.me`、DB非保持・`apps/api` 利用）
- `apps/hazy-note`: ノート・分析・書き出し用 Web アプリ（Next.js 16、`note.hz.nknighta.me`、独自の Next.js API Routes + DB直接続）
- `apps/hazy-dash`: ホーム画面ダッシュボード（Next.js 16、`dash.hz.nknighta.me`、サードパーティ連携クライアント）
- `packages/db` (`@repo/db`): 単一 Drizzle スキーマ・DBクライアント・マイグレーション・全文検索トリガー
- `packages/api-client` (`@repo/api-client`): `apps/api` 用型付きクライアント & DTO 型定義

---

## 1. 基本構成・技術スタック

- **フレームワーク / ランタイム**:
  - **モノレポ管理**: Turborepo (`turbo@^2`) / Bun Workspaces (`bun@1.4.0`)
  - **`apps/api`**: Hono `^4.10.4`（本番: Cloudflare Workers `workerd` + `nodejs_compat`、ローカル開発: Node.js + `@hono/node-server@^1.14.0` + `tsx@^4.19.2`）
  - **`apps/hazy` / `apps/hazy-note` / `apps/hazy-dash`**: Next.js `16.3.0` (App Router + Turbopack + React Compiler `babel-plugin-react-compiler@1.0.0`) / React `19.2.8`
- **言語 / 主要ライブラリ**:
  - TypeScript `^5`（`hazy-note` は `^5.7.3`）、リンター/フォーマッターは Biome `2.5.9`
  - **`apps/api`**: `@clerk/backend@^3.16.13`, `drizzle-orm@^0.45.2`, `@neondatabase/serverless@^1.1.0`, `postgres@^3.4.9`, `openai@^7.4.0`（OpenRouter 経由）, `cheerio@^1.2.0`（`cheerio/slim` 使用）, `zod@^4.4.3`
  - **`apps/hazy`**: `@clerk/nextjs@^7.8.3`, `@tanstack/react-query@^5.101.4`, `next-intl@^4.13.5`, `next-themes@^0.4.6`, `radix-ui@^1.6.7`, `shadcn@^4.16.2`, `lucide-react@^1.30.0`, `sonner@^2.0.7`, `date-fns@^4.4.0`, `zod@^4.4.3`
  - **`apps/hazy-note`**: `@clerk/nextjs@^7.8.3`, `@base-ui/react@^1.7.0`, `drizzle-orm@^0.45.2`, `@neondatabase/serverless@^1.1.0`, `postgres@^3.4.9`, `quill@^2.0.3`, `quilljs-markdown@^1.2.0`, `@ternlight/base@^0.1.1`（オンデバイス意味検索）, `@phosphor-icons/web@^2.1.1`, `@hugeicons/react@^1.1.10`, `shadcn@^4.19.0`
  - **`apps/hazy-dash`**: `@repo/api-client`, `@tanstack/react-query@^5.101.4`, `lucide-react@^1.30.0`
- **状態管理 / データフェッチ**:
  - **`apps/hazy`**: TanStack Query v5 (`@tanstack/react-query`) + `@repo/api-client` (`useHazyClient`) によるクライアントフェッチ。一覧表示モードのみ `localStorage` + `useState`。
  - **`apps/hazy-dash`**: TanStack Query v5 + `createHazyClient` + React Context (`DashProvider`) + `useSyncExternalStore`（`localStorage` 購読）。天気取得も `useQuery` + `fetch`。
  - **`apps/hazy-note`**: `useEffect` + `fetch`（`apps/hazy-note/lib/api.ts` の独自 fetch ラッパー）+ React `useState`。TanStack Query 未使用。
- **スタイリング / UIライブラリ**:
  - 全フロントエンドで **Tailwind CSS v4** (`@tailwindcss/postcss@^4`) + 共通のダーク専用デザインシステム「**Nocturne**」を採用。
  - `apps/hazy`: Tailwind v4 + shadcn/ui (Radix UI ベース) + `tw-animate-css` + `class-variance-authority`。
  - `apps/hazy-note`: Tailwind v4 + 独自 CSS コンポーネントクラス（`.btn`, `.card`, `.tag`, `.seg`, `.table` 等）+ `@base-ui/react` + Quill bubble テーマ用カスタム CSS。
  - `apps/hazy-dash`: Tailwind v4 + `apps/hazy` と同一の Nocturne トークン CSS（shadcn/ui コンポーネントなし）。
- **デプロイ先 / インフラ構成**:
  - **4つの独立した Cloudflare Workers**（各 `wrangler.jsonc` で管理、`compatibility_date: "2026-08-14"`, `compatibility_flags: ["nodejs_compat", "global_fetch_strictly_public"]`）:
    - `hazy-api` (`apps/api`) → `api.hz.nknighta.me`（純粋な Hono Worker）
    - `hazy` (`apps/hazy`) → `hz.nknighta.me`（`@opennextjs/cloudflare@^1.20.2`、ASSETS / IMAGES バインディング）
    - `hazy-note` (`apps/hazy-note`) → `note.hz.nknighta.me`（`@opennextjs/cloudflare`、ASSETS / IMAGES バインディング）
    - `hazy-dash` (`apps/hazy-dash`) → `dash.hz.nknighta.me`（`@opennextjs/cloudflare`、ASSETS バインディング）。また `.github/workflows/export-hazy-dash.yml` により `nk4dev/hazy-dash` リポジトリへ自動ミラーリング。
  - **データベース**: 本番は **Neon PostgreSQL**（HTTP ドライバ）、ローカル開発はユーザー所有 PostgreSQL 18（`127.0.0.1:5433`、`postgres.js` TCP ドライバ）。
  - **ドキュメントサイト**: `docs/` を GitHub Pages (`https://apps.nknighta.me/hazy/`) で配信。

---

## 2. 画面・ルーティング一覧

### 2.1 `apps/hazy`（`next-intl` により全画面が `/[locale]` (`en` | `ja`) 配下）

| パス | ファイルパス | 認証要否 | レンダリング方式 / 特徴 | 画面の概要 |
| :--- | :--- | :--- | :--- | :--- |
| `/[locale]` | `apps/hazy/src/app/[locale]/page.tsx` | 不要 | Server Component（`auth()` 確認後リダイレクト） | 環境未設定時はセットアップ案内表示。ログイン済なら `/library`、未ログインなら `/sign-in` へリダイレクト |
| `/[locale]/sign-in/[[...sign-in]]` | `apps/hazy/src/app/[locale]/(auth)/sign-in/[[...sign-in]]/page.tsx` | 不要 | Server Component + Clerk `<SignIn />` | Clerk サインイン画面 |
| `/[locale]/sign-up/[[...sign-up]]` | `apps/hazy/src/app/[locale]/(auth)/sign-up/[[...sign-up]]/page.tsx` | 不要 | Server Component + Clerk `<SignUp />` | Clerk サインアップ画面 |
| `/[locale]/docs` | `apps/hazy/src/app/[locale]/docs/page.tsx` | 不要 | Server Component（静的コンテンツ） | 外部クライアント向け公開 API リファレンス |
| `/[locale]/connector` | `apps/hazy/src/app/[locale]/(connect)/connector/page.tsx` | 不要 | Server Component（リダイレクトのみ） | `/settings/connections` へリダイレクト |
| `/[locale]/connector/add` | `apps/hazy/src/app/[locale]/(connect)/connector/add/page.tsx` | 要（未認証時はクエリ保持して `/sign-in` へ） | SC（認証ゲート）+ CSR (`ConnectApprovalView`) | "Connect with Hazy" PKCE 認可承認画面（クリックジャッキング防止ヘッダー付与） |
| `/[locale]/library` | `apps/hazy/src/app/[locale]/(app)/library/page.tsx` | 要（`(app)/layout.tsx` でゲート） | SC（`searchParams` 読み取り）+ CSR (`LibraryView`) | 保存済み URL 一覧・キーワード検索・グリッド/リスト切替 |
| `/[locale]/item/[id]` | `apps/hazy/src/app/[locale]/(app)/item/[id]/page.tsx` | 要 | SC（`params` 渡しのみ）+ CSR (`ItemDetailView`) | アイテム詳細・編集・AI要約・再取得・タグ編集・コレクション追加・画像DL・「Noteで開く」リンク |
| `/[locale]/collections` | `apps/hazy/src/app/[locale]/(app)/collections/page.tsx` | 要 | SC ラッパー + CSR (`CollectionsView`) | コレクション一覧・新規作成 |
| `/[locale]/collections/[id]` | `apps/hazy/src/app/[locale]/(app)/collections/[id]/page.tsx` | 要 | SC（`params` 渡しのみ）+ CSR (`CollectionDetailView`) | コレクション詳細・所属アイテム一覧・AI要約生成 |
| `/[locale]/ask` | `apps/hazy/src/app/[locale]/(app)/ask/page.tsx` | 要 | SC ラッパー + CSR (`AskView`) | 保存リンクを引用する AI 質問入力・スレッド一覧（`@` でコレクションメンション対応） |
| `/[locale]/ask/[threadId]` | `apps/hazy/src/app/[locale]/(app)/ask/[threadId]/page.tsx` | 要 | SC（`params` 渡しのみ）+ CSR (`AskThreadView`) | AI 質問スレッド詳細・追加質問・引用元表示 |
| `/[locale]/read-later` | `apps/hazy/src/app/[locale]/(app)/read-later/page.tsx` | 要 | SC ラッパー + CSR (`ReadLaterView`) | 後で読むキュー（今日の3件 / 5分で読める / じっくり読む）と週間統計 |
| `/[locale]/settings/language` | `apps/hazy/src/app/[locale]/(app)/settings/language/page.tsx` | 要 | SC ラッパー + CSR (`LanguageSettingsView`) | UI 言語・AI 回答言語モード・通知設定 |
| `/[locale]/settings/connections` | `apps/hazy/src/app/[locale]/(app)/settings/connections/page.tsx` | 要 | SC ラッパー + CSR (`ConnectedAppsView`) | Connect with Hazy で連携中の外部アプリ一覧・トークン失効 |

### 2.2 `apps/hazy-note`

| パス | ファイルパス | 認証要否 | レンダリング方式 / 特徴 | 画面の概要 |
| :--- | :--- | :--- | :--- | :--- |
| `/` | `apps/hazy-note/app/(app)/page.tsx` | 要（`middleware.ts` で全保護） | Server Component（`redirect("/notes")` のみ） | `/notes` へリダイレクト |
| `/sign-in/[[...sign-in]]` | `apps/hazy-note/app/sign-in/[[...sign-in]]/page.tsx` | 不要 | SC + Clerk `<SignIn />` | サインイン画面 |
| `/sign-up/[[...sign-up]]` | `apps/hazy-note/app/sign-up/[[...sign-up]]/page.tsx` | 不要 | SC + Clerk `<SignUp />` | サインアップ画面 |
| `/notes` | `apps/hazy-note/app/(app)/notes/page.tsx` | 要 | SC (`Suspense`) + CSR (`NotesClient`) | ノート一覧（タグ・ステータスフィルタ） |
| `/notes/new` | `apps/hazy-note/app/(app)/notes/new/page.tsx` | 要 | SC ラッパー + CSR (`NoteClient`) | 新規ノート作成（初回編集時までメモリ保持） |
| `/notes/[id]` | `apps/hazy-note/app/(app)/notes/[id]/page.tsx` | 要 | SC（`params` 渡しのみ）+ CSR (`NoteClient`) | Quill リッチテキストエディタ、AI 提案の採用/却下、引用元管理 |
| `/library` | `apps/hazy-note/app/(app)/library/page.tsx` | 要 | SC (`Suspense`) + CSR (`LibraryClient`) | 受信箱（保存済み URL / メモ一覧・プロジェクト振り分け） |
| `/library/[id]` | `apps/hazy-note/app/(app)/library/[id]/page.tsx` | 要 | SC（`params` 渡しのみ）+ CSR (`ItemDetailClient`) | ソース詳細・要約・論点・タグ・関連ノート遷移 |
| `/capture` | `apps/hazy-note/app/(app)/capture/page.tsx` | 要 | SC (`Suspense`) + CSR (`CaptureClient`) | URL / テキストメモの新規取り込み、および Hazy 未整理 URL のインポート |
| `/projects/[id]` | `apps/hazy-note/app/(app)/projects/[id]/page.tsx` | 要 | SC（`params` 渡しのみ）+ CSR (`ProjectClient`) | プロジェクト詳細（紐づくソース・ノート一覧・メタ編集） |
| `/search` | `apps/hazy-note/app/(app)/search/page.tsx` | 要 | CSR (`"use client"`) | 4モード検索（クライアント全文 / タグ / オンデバイス意味検索 `@ternlight/base` / LLM チャット検索） |
| `/analyze` | `apps/hazy-note/app/(app)/analyze/page.tsx` | 要 | CSR (`"use client"`) | ユーザー全体またはプロジェクト単位の傾向分析・統計表示 |
| `/export` | `apps/hazy-note/app/(app)/export/page.tsx` | 要 | SC (`Suspense`) + CSR (`ExportClient`) | ノートの出力ドラフト生成（ブログ記事 / 社内共有メモ / 箇条書き） |
| `/tags` | `apps/hazy-note/app/(app)/tags/page.tsx` | 要 | CSR (`"use client"`) | URL・ノート横断のタグ一覧 |

### 2.3 `apps/hazy-dash`

| パス | ファイルパス | 認証要否 | レンダリング方式 / 特徴 | 画面の概要 |
| :--- | :--- | :--- | :--- | :--- |
| `/` | `apps/hazy-dash/src/app/page.tsx` | 連携トークン (`hz_…`) 要 | CSR (`"use client"`) | 未連携時は `ConnectScreen`。連携済は天気・週間統計・クイック保存・今日の3件・インライン Ask・最近の保存を表示 |
| `/callback` | `apps/hazy-dash/src/app/callback/page.tsx` | 不要（OAuth コールバック） | CSR (`"use client"`) | PKCE 認可コードを `POST /v1/connect/token` で交換し、`localStorage` に保存後 `/` へ遷移 |

---

## 3. API エンドポイント・サーバー処理一覧

※ リポジトリ全体で Next.js Server Actions (`"use server"`) の利用は **0件** です。

### 3.1 `apps/api`（Hono バックエンド: `api.hz.nknighta.me`）

成功レスポンスは画像ストリームとヘルスチェック/Webhook を除き `{ data: T }`、エラー時は `{ error: { code, message, details? } }` 形式（`apps/api/src/lib/api/response.ts`）。

| メソッド / 種別 | パス / 関数名 | 認証要否 | リクエスト（入力型・バリデーション） | レスポンス（出力型） | 処理内容の要約 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| GET (Hono) | `/health` | 不要 | なし | `{ ok: true }` | ヘルスチェック |
| POST (Hono) | `/v1/webhooks/clerk` | Svix 署名検証 | Clerk `WebhookEvent` JSON | `text/plain` (`"OK"` / エラー文) | `user.created`/`updated`/`deleted` を `users`・`user_preferences` へ同期 |
| POST (Hono) | `/v1/connect/token` | 不要（PKCE検証） | Zod: `{ code, codeVerifier, redirectUri }` | `{ data: ConnectTokenDTO }` | 単発認可コードを検証・削除し、`hz_…` 長期 Bearer トークンを発行 |
| GET (Hono) | `/v1/items` | 要 (Clerk / `hz_`) | Query Zod: `{ cursor?: uuid, limit?: 1-100 (30), sort?: "newest"\|"oldest" }` | `{ data: PaginatedResponse<SavedUrlDTO> }` | 保存済み URL のカーソルページネーション一覧 |
| POST (Hono) | `/v1/items` | 要 (Clerk / `hz_`) | Body Zod: `{ url: string, collectionIds?: uuid[] (≤100) }` | `{ data: SavedUrlDTO }` (200/201) | URL 正規化・重複チェック・メタデータ取得（`cheerio/slim`）・保存・ReadLater 初期化 |
| GET (Hono) | `/v1/items/:id` | 要 (Clerk / `hz_`) | Path: `id` | `{ data: SavedUrlDTO }` | 単一アイテム取得 |
| PATCH (Hono) | `/v1/items/:id` | 要 (Clerk / `hz_`) | Body Zod: `{ title?, domain?, summary?, tags? }` | `{ data: SavedUrlDTO }` | タイトル・ドメイン・要約・タグ（正規化あり）更新 |
| DELETE (Hono) | `/v1/items/:id` | 要 (Clerk / `hz_`) | Path: `id` | `{ data: { id: string } }` | アイテム削除 |
| POST (Hono) | `/v1/items/:id/refetch` | 要 (Clerk / `hz_`) | Path: `id` | `{ data: SavedUrlDTO }` | URL メタデータ・本文の再取得 |
| PUT (Hono) | `/v1/items/:id/collections` | 要 (Clerk / `hz_`) | Body Zod: `{ collectionIds: uuid[] (≤100) }` | `{ data: ItemCollectionsDTO }` | アイテムの所属コレクションを一括置換 |
| POST (Hono) | `/v1/items/:id/summarize` | 要 (Clerk / `hz_`) | Path: `id` | `{ data: SavedUrlDTO }` | OpenRouter による個別アイテム AI 要約生成 |
| GET (Hono) | `/v1/items/:id/image` | 要 (Clerk / `hz_`) | Path: `id` | Binary stream (`Content-Disposition: attachment`) | `ogImageUrl`（X/Twitter は `fxtwitter.com` フォールバック）をプロキシ配信 |
| GET (Hono) | `/v1/collections` | 要 (Clerk / `hz_`) | なし | `{ data: { items: CollectionDTO[] } }` | コレクション一覧（件数・最大4件のプレビュー画像付き） |
| POST (Hono) | `/v1/collections` | 要 (Clerk / `hz_`) | Body Zod: `{ name (1-255), description? (≤1000), color? (≤32) }` | `{ data: CollectionDTO }` (201) | コレクション作成 |
| GET (Hono) | `/v1/collections/:id` | 要 (Clerk / `hz_`) | Path: `id` | `{ data: CollectionDetailDTO }` | コレクション詳細と所属アイテム一覧 |
| PATCH (Hono) | `/v1/collections/:id` | 要 (Clerk / `hz_`) | Body Zod: `{ name?, description?, color? }` | `{ data: CollectionDTO }` | コレクション更新 |
| DELETE (Hono) | `/v1/collections/:id` | 要 (Clerk / `hz_`) | Path: `id` | `{ data: { id: string } }` | コレクション削除（アイテム本体は残存） |
| POST (Hono) | `/v1/collections/:id/items` | 要 (Clerk / `hz_`) | Body Zod: `{ savedUrlId: uuid }` | `{ data: CollectionItemRefDTO }` (201) | コレクションへアイテム追加（冪等） |
| DELETE (Hono) | `/v1/collections/:id/items/:savedUrlId` | 要 (Clerk / `hz_`) | Path: `id`, `savedUrlId` | `{ data: CollectionItemRefDTO }` | コレクションからアイテム除外 |
| POST (Hono) | `/v1/collections/:id/summarize` | 要 (Clerk / `hz_`) | Body Zod: `{ locale?: "en"\|"ja" }` | `{ data: CollectionSummaryDTO }` | コレクション全体の AI 概要生成 |
| POST (Hono) | `/v1/ask` | 要 (Clerk / `hz_`) | Body Zod: `{ question (1-2000), answerLanguageOverride?, collectionIds? (≤5) }` | `{ data: AskResponseDTO }` (201) | 新規スレッド作成＋ツール呼び出し付き RAG 回答生成（AI不可時はキーワード検索フォールバック） |
| GET (Hono) | `/v1/ask/threads` | 要 (Clerk / `hz_`) | なし | `{ data: AskThreadListDTO }` | 質問スレッド一覧（最新50件） |
| GET (Hono) | `/v1/ask/threads/:id` | 要 (Clerk / `hz_`) | Path: `id` | `{ data: AskThreadDetailDTO }` | スレッド詳細と全メッセージ・引用元一覧 |
| DELETE (Hono) | `/v1/ask/threads/:id` | 要 (Clerk / `hz_`) | Path: `id` | `{ data: { id: string } }` | スレッド削除 |
| POST (Hono) | `/v1/ask/threads/:id/messages` | 要 (Clerk / `hz_`) | Body Zod: `{ question (1-2000), answerLanguageOverride?, collectionIds? (≤5) }` | `{ data: AskResponseDTO }` (201) | 既存スレッドへの追質問 |
| GET (Hono) | `/v1/read-later` | 要 (Clerk / `hz_`) | なし | `{ data: ReadLaterQueueDTO }` | 未読キューを読了時間別にバケツ分類して返却 |
| GET (Hono) | `/v1/read-later/stats` | 要 (Clerk / `hz_`) | なし | `{ data: ReadLaterStatsDTO }` | 過去7日間の既読数・保存数統計 |
| PATCH (Hono) | `/v1/read-later/:itemId` | 要 (Clerk / `hz_`) | Body Zod: `{ status: "inbox"\|"snoozed"\|"read"\|"archived", snoozedUntil?: datetime }` | `{ data: ReadLaterStateDTO }` | 後で読むステータス更新（upsert） |
| GET (Hono) | `/v1/search` | 要 (Clerk / `hz_`) | Query Zod: `{ q: string (≥1), limit?: 1-50 (20) }` | `{ data: SearchResponseDTO }` | PostgreSQL `tsvector` 全文検索（AI不使用） |
| GET (Hono) | `/v1/me` | 要 (Clerk / `hz_`) | なし | `{ data: MeDTO }` | ユーザープロフィールと設定取得 |
| PATCH (Hono) | `/v1/me` | 要 (Clerk / `hz_`) | Body Zod: `{ interfaceLocale?, answerLanguageMode?, notifyReadLaterDigest?, notifyWeeklyStats? }` | `{ data: UserPreferencesDTO }` | ユーザー設定更新（upsert） |
| POST (Hono) | `/v1/connect/authorize` | 要 (**Clerkのみ**, `hz_` は 403) | Body Zod: `{ clientName, redirectUri, codeChallenge, codeChallengeMethod: "S256" }` | `{ data: ConnectCodeDTO }` (201) | 5分有効なワンタイム認可コード発行 |
| GET (Hono) | `/v1/connect/apps` | 要 (**Clerkのみ**) | なし | `{ data: { items: ConnectedAppDTO[] } }` | 有効な連携アプリ一覧 |
| DELETE (Hono) | `/v1/connect/apps/:id` | 要 (**Clerkのみ**) | Path: `id` | `{ data: { id: string } }` | 連携トークンの失効 (`revoked_at` 設定) |

### 3.2 `apps/hazy-note`（Next.js Route Handlers: `app/api/*`）

すべて `dynamic = "force-dynamic"`、Clerk セッション認証必須（`middleware.ts` + `requireAppUser()`）。`apps/api` のような `{ data }` ラッパーはなく、生の JSON を返却。バリデーションは Zod ではなく手動の `typeof` チェック。

| メソッド / 種別 | パス / 関数名 | 認証要否 | リクエスト（入力型・バリデーション） | レスポンス（出力型） | 処理内容の要約 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| GET (Next API) | `/api/items` | 要 (Clerk) | なし | `Item[]` | ユーザーのソース一覧取得 |
| POST (Next API) | `/api/items` | 要 (Clerk) | `{ url?: string, text?: string }` | `Item` (201) | URL 取り込み（本文抽出+LLM要約）またはテキストメモ作成 |
| GET (Next API) | `/api/items/importable` | 要 (Clerk) | なし | `Item[]` | Hazy で保存され `hazy-note` プロジェクト未所属の URL 一覧 |
| GET (Next API) | `/api/items/:id` | 要 (Clerk) | Path: `id` | `Item` | 単一ソース取得 |
| PATCH (Next API) | `/api/items/:id` | 要 (Clerk) | 任意の Item 部分更新オブジェクト | `Item` | ソース更新（タグ、プロジェクト移動等） |
| DELETE (Next API) | `/api/items/:id` | 要 (Clerk) | Path: `id` | `{ ok: boolean }` | ソース削除 |
| POST (Next API) | `/api/items/:id/read` | 要 (Clerk) | Path: `id` | `Item` | 読み取り完了処理（ステータス更新・要約反映） |
| GET (Next API) | `/api/notes` | 要 (Clerk) | なし | `Note[]` | ノート一覧取得 |
| POST (Next API) | `/api/notes` | 要 (Clerk) | `{ title?, projectId?, text?, body?: DeltaOp[], suggestions?, tags?, sources?, status? }` | `Note` (201) | ノート新規作成 |
| GET (Next API) | `/api/notes/:id` | 要 (Clerk) | Path: `id` | `Note` | 単一ノート取得（旧 `blocks` 形式は読み取り時に Quill Delta へ変換） |
| PATCH (Next API) | `/api/notes/:id` | 要 (Clerk) | `{ text }`（段落追記）または `{ title?, status?, projectId?, body?, suggestions?, tags?, sources? }` | `Note` | ノート更新または段落追記 |
| DELETE (Next API) | `/api/notes/:id` | 要 (Clerk) | Path: `id` | `{ ok: boolean }` | ノート削除 |
| POST (Next API) | `/api/notes/:id/suggestion` | 要 (Clerk) | `{ id: string, action: "accept" \| "dismiss" }` | `Note` | AI 下書き提案の本文採用または却下 |
| GET (Next API) | `/api/projects` | 要 (Clerk) | なし | `Project[]` | プロジェクト一覧取得 |
| POST (Next API) | `/api/projects` | 要 (Clerk) | `{ name: string, tone?: "accent"\|"neutral", description?: string }` | `Project` (201) | プロジェクト作成 |
| GET (Next API) | `/api/projects/:id` | 要 (Clerk) | Path: `id` | `ProjectDetail` | プロジェクト詳細（所属ソース・ノート含む） |
| PATCH (Next API) | `/api/projects/:id` | 要 (Clerk) | `{ name?, description?, tone? }` | `Project` | プロジェクト更新 |
| DELETE (Next API) | `/api/projects/:id` | 要 (Clerk) | Path: `id` | `{ ok: boolean }` | プロジェクト削除 |
| GET (Next API) | `/api/tags` | 要 (Clerk) | なし | `Tag[]` | ソース・ノート横断タグ集計一覧 |
| POST (Next API) | `/api/search/chat` | 要 (Clerk) | `{ query?: string, history?: { role, content }[] }` | `SearchChatAnswer` | ノート・ソースをコンテキストにした OpenRouter チャット検索（最大直近6ターン） |
| GET (Next API) | `/api/analyze` | 要 (Clerk) | Query: `project?: string` | `InsightProfile` | キャッシュ済み傾向分析プロフィール取得 |
| POST (Next API) | `/api/analyze` | 要 (Clerk) | `{ projectId?: string }` | `InsightProfile` | 統計集計＋OpenRouter による傾向分析の再生成・DB保存 |
| GET (Next API) | `/api/export` | 要 (Clerk) | Query: `noteId`, `format?: "blog"\|"memo"\|"bullets"` | `ExportDraft` | ノートの指定フォーマット書き出しプレビュー生成 |
| POST (Next API) | `/api/export` | 要 (Clerk) | `{ noteId?: string, format?: "blog"\|"memo"\|"bullets" }` | `ExportDraft & { exportedTo: string }` | 書き出し実行（ドラフト生成＋出力先メタ返却） |

---

## 4. データベース・ストレージ・外部連携

- **DB種別 / ORM**:
  - **PostgreSQL**（本番: Neon Serverless、ローカル: PG 18） / **Drizzle ORM** (`drizzle-orm@^0.45.2`)
  - 接続クライアント（`packages/db/src/client.ts`）は URL が `localhost` / `127.0.0.1` / `::1` の場合 `postgres.js` (TCP)、それ以外は `@neondatabase/serverless` (`neon-http`) を自動選択。
  - **カスタムトリガー**: `packages/db/sql/search-vector-trigger.sql` により、`saved_urls` の `title`, `tags` (weight A), `description`, `summary` (weight B), `extracted_text` (weight C) から `search_vector (tsvector)` を自動更新する PostgreSQL トリガーが設定されている。

- **テーブル / スキーマ定義**（`packages/db/src/schema.ts`）:
  - **Enums**:
    - `locale`: `"en" | "ja"`
    - `answer_language_mode`: `"interface" | "source"`
    - `fetch_status`: `"pending" | "success" | "error"`
    - `read_later_status`: `"inbox" | "snoozed" | "read" | "archived"`
    - `ask_role`: `"user" | "assistant"`
    - `source_kind`: `"article" | "pdf" | "video" | "thread" | "note"`
    - `note_status`: `"draft" | "done"`
  - **主要テーブル（全16テーブル）**:
    1. `users`: `id (uuid PK)`, `clerk_id (varchar 191 unique)`, `email`, `display_name`, `avatar_url`, `created_at`, `updated_at`
    2. `user_preferences`: `user_id (uuid PK FK→users)`, `interface_locale`, `answer_language_mode`, `notify_read_later_digest`, `notify_weekly_stats`, `updated_at`
    3. `saved_urls`: `id (uuid PK)`, `user_id (FK→users)`, `url`, `normalized_url`, `domain`, `title`, `description`, `favicon_url`, `og_image_url`, `summary`, `tags (text[])`, `extracted_text`, `content_language`, `estimated_read_minutes`, `fetch_status`, `fetch_error`, `search_vector (tsvector, GIN)`, `created_at`, `updated_at` ＋ **`hazy-note` 追加カラム**: `kind`, `points (text[])`, `suggested_tags (text[])`, `duration_label`, `quote_candidates`, `related_note_id (FK→notes)`, `project_id (FK→projects)`, `summary_lines (text[])`。（Unique: `(user_id, normalized_url)`、GIN Index: `search_vector`, `tags`）
    4. `read_later_state`: `id (uuid PK)`, `user_id (FK→users)`, `saved_url_id (FK→saved_urls)`, `status`, `snoozed_until`, `marked_read_at`, `created_at`, `updated_at`。（Unique: `(user_id, saved_url_id)`）
    5. `collections`: `id (uuid PK)`, `user_id (FK→users)`, `name`, `description`, `color`, `summary`, `summary_updated_at`, `tone`（レガシー）, `created_at`, `updated_at`
    6. `collection_items`: `id (uuid PK)`, `collection_id (FK→collections)`, `saved_url_id (FK→saved_urls)`, `created_at`。（Unique: `(collection_id, saved_url_id)`）
    7. `projects` (`hazy-note` 専用): `id (uuid PK)`, `user_id (FK→users)`, `name`, `description`, `tone`, `created_at`, `updated_at`
    8. `ask_threads`: `id (uuid PK)`, `user_id (FK→users)`, `title`, `created_at`, `updated_at`
    9. `ask_messages`: `id (uuid PK)`, `thread_id (FK→ask_threads)`, `role`, `content`, `model_id`, `used_fallback`, `created_at`
    10. `ask_message_citations`: `id (uuid PK)`, `message_id (FK→ask_messages)`, `saved_url_id (FK→saved_urls)`, `rank`, `snippet`
    11. `notes` (`hazy-note` 専用): `id (uuid PK)`, `user_id (FK→users)`, `collection_id (deprecated)`, `project_id (FK→projects)`, `title`, `status`, `tags (jsonb)`, `blocks (jsonb, legacy)`, `body (jsonb: DeltaOp[])`, `suggestions (jsonb)`, `sources (jsonb)`, `links (jsonb)`, `flags (jsonb)`, `created_at`, `updated_at`
    12. `compare_boards` (`hazy-note` 用・現在UI未露出/レガシー): `id (uuid PK)`, `user_id`, `collection_id`, `project_id`, `sources (text[])`, `axes (jsonb)`, `summary`, `candidate_axes (text[])`, `updated_at`
    13. `insight_profiles` (`hazy-note` 専用): `id (uuid PK)`, `user_id`, `project_id (FK→projects)`, `stats (jsonb)`, `profile`, `themes (jsonb)`, `leanings (jsonb)`, `blind_spots (jsonb)`, `next_steps (jsonb)`, `llm (bool)`, `created_at`, `updated_at`
    14. `graph_snapshots` (`hazy-note` 用): `user_id (PK FK→users)`, `nodes (jsonb)`, `edges (jsonb)`, `isolated (jsonb)`, `updated_at`
    15. `connect_codes`: `code_hash (varchar 64 PK)`, `user_id (FK→users)`, `client_name`, `redirect_uri`, `code_challenge`, `expires_at`, `created_at`
    16. `api_tokens`: `id (uuid PK)`, `user_id (FK→users)`, `token_hash (varchar 64 unique)`, `client_name`, `client_origin`, `last_used_at`, `revoked_at`, `created_at`

- **外部サービス / API連携**:
  - **Clerk**: 認証・ユーザー管理・Webhook (`POST /v1/webhooks/clerk`)
  - **OpenRouter API** (`https://openrouter.ai/api/v1`):
    - `apps/api`: `openai` SDK 経由（デフォルトモデル `google/gemma-4-26b-a4b-it:free`、ツール呼び出し対応、429/5xx 1回リトライ）
    - `apps/hazy-note`: 独自 `fetch` 経由（デフォルトモデル `mistralai/mistral-small-2603`、`json_object` モード対応）
  - **任意外部 URL フェッチ & fxtwitter.com**: `apps/api` の `fetchUrlMetadata` / `GET /v1/items/:id/image`（X/Twitter の OGP 取得フォールバックとして `fxtwitter.com` へアクセス）および `apps/hazy-note/lib/extract.ts`。
  - **Open-Meteo API** (`api.open-meteo.com`, `geocoding-api.open-meteo.com`): `apps/hazy-dash` からブラウザ直接呼び出し（APIキー不要）。
  - **Google Fonts**: `apps/hazy-dash` は `<link>` タグ経由、`apps/hazy` / `apps/hazy-note` は `next/font/google` 経由。

- **ローカルストレージ / SessionStorage / Cookie の利用箇所**:
  - `localStorage` (`apps/hazy`):
    - `hazy:library-view-mode`: ライブラリのリスト/グリッド表示切替
    - `hazy:collection-detail-view-mode`: コレクション詳細のリスト/グリッド表示切替
  - `localStorage` (`apps/hazy-note`):
    - `hazy-note:density`: 表示密度 (`"compact"` 等、初回ペイント前インライン `<script>` でも参照)
  - `localStorage` (`apps/hazy-dash`):
    - `hazy-dash:token`: Connect with Hazy で取得した `hz_…` Bearer トークン
    - `hazy-dash:place`: 天気カードで選択した都市名・緯度経度 JSON
  - `sessionStorage` (`apps/hazy-dash`):
    - `hazy-dash:connect`: PKCE 認可フロー中の一時 `{ verifier, state }`（コールバック時に即削除）
  - **Cookie**: 独自 Cookie の読み書きはなし（Clerk のセッション Cookie および `next-intl` のロケール Cookie のみフレームワーク側で利用）。

---

## 5. 認証・認可の仕組み

- **認証基盤**: 全アプリ共通で **Clerk**（単一テナント）を採用。
  - 内部 DB の `users` テーブルとは `users.clerk_id` で紐付け、初回リクエスト時に遅延作成（`resolveUser` / `requireAppUser`）＋ Clerk Webhook で同期。
- **`apps/api`（Hono）の認証ミドルウェア**（`apps/api/src/middleware/auth.ts`）:
  - `/health`, `/v1/webhooks/*`, `/v1/connect/token` を除く全 `/v1/*` に適用。
  - `Authorization: Bearer <token>` を検査し、2種類のトークンを判別:
    1. `hz_` プレフィックス付き → **Connect with Hazy トークン**（SHA-256 ハッシュを `api_tokens` と照合、`revoked_at IS NULL` を確認、`authVia: "api_token"`）。
    2. それ以外 → **Clerk セッション JWT**（`@clerk/backend` の `authenticateRequest` で検証、`authorizedParties` 検証はネイティブアプリ対応のため意図的に無効化、`authVia: "clerk"`）。
  - `/v1/connect/*`（認可・連携アプリ一覧・失効）は `requireClerkSession` ミドルウェアで `authVia === "clerk"` を強制し、連携アプリ (`hz_`) からの操作は `403 forbidden` で拒否。
  - **動的 CORS**（`apps/api/src/app.ts`）: 許可オリジン一覧に加え、`/v1/connect/token` は任意オリジン許可、さらに `api_tokens` に有効なトークンを持つ `client_origin` も動的に許可。
- **`apps/hazy` のミドルウェア・アクセス制御**:
  - `apps/hazy/src/middleware.ts`: `clerkMiddleware` 内で `next-intl` の `intlMiddleware` を実行。
  - 実際のログイン強制は `(app)/layout.tsx` および `(connect)/connector/add/page.tsx` の Server Component 内で `await auth()` を呼び出し未認証時に `/sign-in` へリダイレクトする方式。
- **`apps/hazy-note` のミドルウェア・アクセス制御**:
  - `apps/hazy-note/middleware.ts`: `/sign-in(.*)`, `/sign-up(.*)` 以外の全ページおよび `/(api|trpc)(.*)` に対して `await auth.protect()` を実行。
  - さらに各 API Route 内で `requireAppUser()` を呼び出し、全クエリを `user.id` でスコープ制限。
- **`apps/hazy-dash` の認証**:
  - Clerk 不使用。OAuth 2.0 Authorization Code + PKCE (S256) 互換の「Connect with Hazy」フローで取得した `hz_…` トークンを `localStorage` に保持し、`Authorization: Bearer hz_…` で `apps/api` へリクエスト。401 応答時は自動ログアウトし接続画面へ戻す。

---

## 6. UI・レイアウト・共通コンポーネント構成

- **全体レイアウト構造**:
  - **`apps/hazy`**:
    - ルート: `apps/hazy/src/app/[locale]/layout.tsx`（`ClerkProvider` → `NextIntlClientProvider` → `QueryProvider` → `TooltipProvider` → `Toaster`）
    - アプリシェル: `apps/hazy/src/app/[locale]/(app)/layout.tsx`（デスクトップ: スティッキー上部 `Header`（`NavLinks`: Ask / Library / Collections / Read Later + 設定 + URL保存ダイアログ + Clerk `UserButton`）、モバイル: 下部固定 `MobileTabBar`）。
  - **`apps/hazy-note`**:
    - ルート: `apps/hazy-note/app/layout.tsx`（`ClerkProvider` + `density-compact` 事前適用インラインスクリプト）
    - アプリシェル: `apps/hazy-note/components/app-shell.tsx` + `apps/hazy-note/components/sidebar.tsx`（`lg` 以上: 左固定 220px サイドバー、`lg` 未満: 上部ヘッダー＋オフキャンバスドロワー。上部にパンくずリスト `Breadcrumbs`）。
  - **`apps/hazy-dash`**:
    - 単一画面 3 カラムレスポンシブグリッド（`apps/hazy-dash/src/app/page.tsx`）。ヘッダーに挨拶・日時・Hazy リンク・切断ボタン。
- **再利用されている独自 UI コンポーネント一覧**:
  - **`apps/hazy/src/components/ui/`**（shadcn/ui ベース 21 種）: `avatar`, `badge`, `button`, `card`, `checkbox`, `dialog`, `dropdown-menu`, `input`, `label`, `radio-group`, `scroll-area`, `select`, `separator`, `sheet`, `skeleton`, `sonner`, `switch`, `tabs`, `textarea`, `tooltip`, `view-mode-toggle`
  - **`apps/hazy` 共通パーツ**: `HazyMark`, `Favicon`, `SaveUrlDialog`, `EditableField`, `AddToCollectionButton`, `ItemTagsEditor`, `SetupRequired`
  - **`apps/hazy-note/components/`**: `ui.tsx`（`Button`, `LinkButton`, `Tag`, `Kicker`, `Seg`）, `ui/button.tsx`（shadcn/Base UI）, `Icon`（Phosphor Icons ラッパー）, `NoteEditor`（Quill 2 + `quilljs-markdown`）, `NewProjectDialog`, `DensityToggle`, `Breadcrumbs`, `Loading` / `Spinner` / `SkeletonLines`
  - **`apps/hazy-dash/src/components/`**: `HazyMark`, `ConnectScreen`, `WeatherCard`, `HazyWidgets`（`QuickSave`, `TodaysThree`, `WeekStats`, `RecentSaves`, `AskBox`）
- **テーマカラー・フォント・カスタム CSS 変数**:
  - **テーマ**: 全アプリ共通の常時ダークテーマ「**Nocturne**」（ライトモードなし、`color-scheme: dark`）。
  - **主要カラー**（`apps/hazy` / `apps/hazy-dash` の `:root`、および `apps/hazy-note` の `@theme`）:
    - 背景: `#0f101a`（`hazy-note` は `--color-bg: #161826`）
    - カード/サーフェス: `#161826`（`hazy-note` は `--color-surface: #232532`）
    - 前景文字: `#e9e9ed`
    - プライマリ/アクセント: `#9184d9`（セカンダリラベンダー `--accent-2: #a7a1db`）
    - セカンダリ/ミュート: `#232532`
    - ボーダー: `color-mix(in srgb, #e9e9ed 16%, transparent)`
  - **フォント**: `Inter` + `Noto Sans JP`（`hazy` / `hazy-note` は `next/font/google`、`hazy-dash` は Google Fonts `<link>`）
  - **独自ユーティリティ/クラス**: `hazy` / `hazy-dash` の `.hz-page`, `.hz-surface`, `.hz-eyebrow`, `.hz-interactive`, `.hz-reveal`, `.hz-rule`、`hazy-note` の `.density-compact` と Quill ダークテーマ上書きスタイル。

---

## 7. 環境変数一覧

ローカル開発時は `scripts/load-env.ts` の `loadMonorepoEnv()` により「シェル環境変数 → 各アプリ配下の `.env.local` / `.dev.vars` / `.env` → ルート `.env.local` / `.env`」の優先順で自動ロードされます。

| 変数名 | クライアント公開可否 (`NEXT_PUBLIC_` / `VITE_`) | 用途 |
| :--- | :--- | :--- |
| `DATABASE_URL` | 非公開（サーバー専用） | PostgreSQL (Neon / ローカル PG) 接続文字列（`apps/api`, `apps/hazy-note`, `packages/db`） |
| `CLERK_SECRET_KEY` | 非公開（サーバー専用） | Clerk バックエンド SDK シークレットキー（`apps/api`, `apps/hazy`, `apps/hazy-note`, E2E） |
| `CLERK_WEBHOOK_SIGNING_SECRET` | 非公開（サーバー専用） | Clerk Webhook (Svix) 署名検証シークレット（`apps/api`） |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | 公開 (`NEXT_PUBLIC_`) | Clerk フロントエンド初期化および `apps/api` の `createClerkClient` 初期化 |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | 公開 (`NEXT_PUBLIC_`) | `hazy-note` の Clerk サインイン URL（`/sign-in`） |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | 公開 (`NEXT_PUBLIC_`) | `hazy-note` の Clerk サインアップ URL（`/sign-up`） |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL` | 公開 (`NEXT_PUBLIC_`) | `hazy-note` サインイン後遷移先（`/notes`） |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL` | 公開 (`NEXT_PUBLIC_`) | `hazy-note` サインアップ後遷移先（`/notes`） |
| `NEXT_PUBLIC_API_URL` | 公開 (`NEXT_PUBLIC_`) | `apps/api` のベース URL（`apps/hazy`, `apps/hazy-dash`, `packages/api-client`） |
| `NEXT_PUBLIC_APP_URL` | 公開 (`NEXT_PUBLIC_`) | 各アプリの公開 URL。`apps/api` では CORS 許可オリジンにも使用 |
| `NEXT_PUBLIC_HAZY_URL` | 公開 (`NEXT_PUBLIC_`) | `apps/hazy-dash` から参照する Hazy 本体の URL（`/connector/add` 遷移先等） |
| `NEXT_PUBLIC_HAZY_NOTE_URL` | 公開 (`NEXT_PUBLIC_`) | `apps/hazy` のアイテム詳細画面から「Noteで開く」ディープリンク先 URL |
| `CORS_ALLOWED_ORIGINS` | 非公開（サーバー専用） | `apps/api` の追加 CORS 許可オリジン（カンマ区切り） |
| `OPENROUTER_API_KEY` | 非公開（サーバー専用） | OpenRouter LLM API キー（`apps/api`, `apps/hazy-note`） |
| `OPENROUTER_MODEL_ID` | 非公開（サーバー専用） | 使用モデル ID（`api` 既定: `google/gemma-4-26b-a4b-it:free`、`hazy-note` 既定: `mistralai/mistral-small-2603`） |
| `OPENROUTER_SITE_URL` | 非公開（サーバー専用） | OpenRouter `HTTP-Referer` ヘッダー値 |
| `OPENROUTER_APP_NAME` | 非公開（サーバー専用） | OpenRouter `X-Title` ヘッダー値 |
| `PORT` | 非公開（サーバー専用） | `apps/api` ローカル Node 開発サーバーのポート番号（既定 `8787`） |
| `E2E_CLERK_USER_EMAIL` / `E2E_CHAT` / `CI` | 非公開（テスト/CI専用） | Playwright E2E テスト用（`apps/hazy-note/e2e/`） |

---

## 8. 統合・移行にあたっての注意点（エージェント所見）

このリポジトリはすでに **`apps/api`（Hono）＋ 複数フロントエンド** への過渡期にあり、移行先の「単一 Hono バックエンド ＋ 複数 React (Vite) フロントエンド」と極めて親和性が高い一方、以下の点が具体的な移行ネック・設計上の注意点となります。

1. **`apps/hazy-note` のバックエンド処理（13個の Next.js Route Handlers）の Hono 移植が必要**
   - `apps/hazy` と `apps/hazy-dash` はすでに DB 非保持の純粋フロントエンドですが、`apps/hazy-note` だけは `app/api/*` から `@repo/db` と OpenRouter を直接叩いています。
   - **レスポンス形式の不統一**: `apps/api` は `{ data: T }` / `{ error: { code, message } }` エンベロープ＋Zod バリデーションですが、`apps/hazy-note/app/api/*` は生 JSON 返却＋手動バリデーションです。統合 Hono 側で `/v1/note/*`（または `/v1/*` に統合）へ移植する際、クライアント側（`hazy-note/lib/api.ts`）と合わせてレスポンス形式を統一するか、互換レイヤーを挟む必要があります。
   - **OpenRouter モデルの分離**: `apps/api` は `google/gemma-4-26b-a4b-it:free`（OpenAI SDK）、`apps/hazy-note` は `mistralai/mistral-small-2603`（生 `fetch` + `json_object`）と異なるモデル・クライアント実装を使っているため、統合時は環境変数名（例: `OPENROUTER_NOTE_MODEL_ID`）や共通クライアントの整理が必要です。
   - **Clerk 認証方式の違い**: `hazy-note` の API は現在ブラウザの Clerk Cookie に依存しています。Vite SPA 化＋クロスオリジン Hono 統合後は、`hazy` と同様に `Authorization: Bearer <clerk_session_token>` へ切り替える必要があります。

2. **Next.js 固有機能（`next-intl`, `next/font`, `next/navigation`, `@clerk/nextjs`）の置換**
   - **`next/image` は実質未使用**（外部 OGP 画像や Favicon は意図的に `<img>` を使用）であり、画像周りの移行コストは低いです。
   - **`next-intl`（`apps/hazy` のみ）**: ルーティング（`/[locale]/...`）、`getTranslations`（Server Components）、`useTranslations`（Client Components）、`Link`/`useRouter`/`redirect` が強く結合しています。Vite + React Router / TanStack Router へ移行する際は、`react-i18next` 等へ置換し、ロケールプレフィックスルーティング（特に `/connector/add` へのロケールなしアクセス時のクエリ保持リダイレクト）をクライアントルーター側で再現する必要があります。
   - **`next/font/google`（`hazy` / `hazy-note`）**: `apps/hazy-dash` で既に実施されている通り、`index.html` での Google Fonts `<link>` 読み込みまたは `@fontsource` パッケージへ置換します。
   - **`@clerk/nextjs` → `@clerk/clerk-react`**: `packages/api-client/src/react.ts` の `useHazyClient` も `@clerk/nextjs` の `useAuth` と `process.env.NEXT_PUBLIC_API_URL` を直接参照しているため、Vite 移行時は `@clerk/clerk-react`（または `getToken` 注入）＋ `import.meta.env.VITE_*` へ書き換える必要があります。
   - **Server Components の依存度**: 全3フロントエンドとも実質的な UI・データ取得はほぼ CSR（Client Components）で実装されており、Server Components は「初期認証リダイレクト」「`params` / `searchParams` の受け渡し」「`next-intl` メッセージ読み込み」程度に限定されているため、**CSR (Vite) 移行の難易度は比較的低い**です。

3. **DB テーブル名・API パスの衝突リスク（他アプリとの統合時）**
   - 単一 DB・単一 Hono バックエンドに別リポジトリの他アプリと同居させる場合、以下の汎用的なテーブル名・Enum 名は衝突リスクが高いです:
     - テーブル名: `users`, `user_preferences`, `projects`, `notes`, `collections`, `collection_items`, `api_tokens`
     - Enum 名: `locale`, `fetch_status`, `note_status`
     - API パス: `/v1/me`, `/v1/search`, `/v1/items`, `/v1/collections`, `/v1/webhooks/clerk`
   - PostgreSQL の別スキーマ（例: `hazy.*`）へ分離するか、テーブルプレフィックス／API プレフィックス（例: `/api/hazy/v1/*`）の設計検討を推奨します。
   - また、`saved_urls` には **Drizzle マイグレーション外の手動 SQL トリガー**（`packages/db/sql/search-vector-trigger.sql`）が必須であるため、移行先の DB セットアップ手順にトリガー適用を組み込み忘れないよう注意が必要です。

4. **セキュリティ・インフラ固有の注意点**
   - **SSRF 対策**: `apps/api` の `fetchUrlMetadata` と `GET /v1/items/:id/image`（および `hazy-note` の `lib/extract.ts`）はユーザー指定の任意 URL へサーバーから `fetch` します。現行は Cloudflare Workers の `global_fetch_strictly_public` フラグに SSRF ガードを依存しているため、もし統合先 Hono バックエンドが Node.js / Docker / VPS 等で稼働する場合は、プライベート IP 帯へのアクセスを明示的にブロックする SSRF 対策の実装が必須です。
   - **クリックジャッキング対策ヘッダー**: `apps/hazy/next.config.ts` で `/connector/add` に設定されている `Content-Security-Policy: frame-ancestors 'none'` と `X-Frame-Options: DENY` は、Vite 静的配信（Cloudflare Pages / Workers Assets / Nginx 等）の `_headers` や配信設定へ必ず引き継ぐ必要があります。
   - **オンデバイス意味検索（`@ternlight/base`）**: `apps/hazy-note/app/(app)/search/page.tsx` で利用しており、ブラウザ側での WASM / モデルロードを伴うため、Vite バンドル時の `optimizeDeps.exclude` やアセット配信設定の動作確認が必要です。
   - **CSS トークンの微妙な差異**: `apps/hazy`（`--background: #0f101a`）と `apps/hazy-note`（`--color-bg: #161826` + 独自クラス `.btn`, `.card` 等）で Nocturne トークンの命名と一部色値が異なるため、共通 UI パッケージ化する場合は差異の整理が必要です。
