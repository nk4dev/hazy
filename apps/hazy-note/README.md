# hazy note

Claude Design のモックアップ (`design-source/Hazy Note.dc.html`) を Next.js アプリ化したもの。
URLの霧を、自分の言葉に落とすまでの一本道 — 取り込み → 整理 → 考えを書く → 外に出す。
**ノート (`/notes`) が主役**（サインイン後・ルートの遷移先、サイドバー最上部）。
残りの画面は素材をノートに集めるための補助。Turborepo (`hazy-repo/`) の `apps/hazy-note`。

## 技術構成

- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript**
- **Tailwind CSS v4** — Nocturne デザイントークンを `app/globals.css` の `@theme` に移植。
  DS のコンポーネントクラス (`.btn` / `.card` / `.tag` / `.seg` / `.table` …) は
  トークンベースのまま `@layer components` にポート。
- **バックエンド** — `/app/api/*` の Route Handlers + Postgres。スキーマとクライアントは
  `@repo/db`（`packages/db`）。`lib/db/repo.ts` が旧 `lib/store.ts` の置き換え（関数名・
  返り値そのまま、裏が Postgres）。「AI」は `OPENROUTER_API_KEY` があればモデル、
  無ければ固定文にフォールバック。
- **hazy アプリと DB を共有** — 同じ Clerk・同じ `users` / `saved_urls` / `collections`。
  hazy で保存した URL が hazy-note の `/library` に出る（逆も）。スキーマは 1 つ
  （`@repo/db`）。詳細・マイグレーション手順は `packages/db/README.md`。
  開発中は `.env.local` の `DATABASE_URL` をローカル PG に向ければ連携を切って隔離できる。
- **デプロイ** — OpenNext で Cloudflare Workers（`wrangler.jsonc` / `open-next.config.ts`）。

## 起動

```bash
# リポジトリルートで
bun install
bun run dev                    # turbo: hazy-note :3000 / hazy :3100
bun run dev --filter=hazy-note # この app だけ
```

`next/font/google`（Inter / Noto Sans JP）の取得にネットワークが要ります。

## 画面（デザインドキュメントの s1–s6 に対応）

| ルート | 元 | 内容 |
| --- | --- | --- |
| `/library` , `/library/[id]` | s1 | 受信箱。URL入力→取り込み、カード/リスト表示、タグ絞り込み。アイテムをクリックすると概要ページ（AIは走らない・要約は明示ボタン） |
| `/capture` | s2 | 取り込みの3コマ（読み取り中 → 要約とタグの提案 → 保存後の次の一手）。`URL` タブ＝新規URL、`Hazyから追加` タブ＝接続中のDB(`saved_urls`)に入っている自分のURL一覧から選ぶ |
| `/projects/[id]` | — | プロジェクト＝アイデアを練る場。hazy-note 専用の `projects` テーブル（hazy の `collections` とは別）。ユーザーが自分で作成し、`description` を書き、出典を集め（`saved_urls.project_id`）、ノートを紐づける（`notes.project_id`）。タグからの自動生成・自動振り分けは廃止 |
| `/notes` , `/notes/[id]` | s3 | **主要機能。** Quill（bubble テーマ）のリッチテキストエディタ。本文は Delta として `notes.body` に保存（旧 `blocks` のノートは開いた時に変換）。`@` で保存済み URL を引用（リンク挿入＋出典登録）、タグ・状態編集、AI 提案は右サイドバー（本文に採る／消す） |
| `/compare` | s4 | 比較ボード。出典×軸の表、食い違いだけアクセント、差分のまとめ |
| `/export` | s6 | 書き出す。形式切替（ブログ／メモ／要点）、どこから来たかの対応表 |

> `/graph`（s5「つながり」）はいったん廃止（新機能のため）。`graph_snapshots`
> テーブルとスキーマは残置。

## API

```
GET    /api/items                     取り込み一覧
GET    /api/items/importable          接続中DBにある自分のURL（「Hazyから追加」候補・未取込を上に）
POST   /api/items          {url}      取り込み開始（status: reading）
GET    /api/items/:id
PATCH  /api/items/:id      {tags,projectId,...}
DELETE /api/items/:id
POST   /api/items/:id/read            読み取り完了（取得＋要約を流し込む）
GET    /api/projects                  プロジェクト一覧
POST   /api/projects       {name,description?}
GET    /api/projects/:id              プロジェクト詳細（出典・ノート込み）
PATCH  /api/projects/:id   {name?,description?,tone?}
DELETE /api/projects/:id
GET    /api/tags
GET    /api/notes  /api/notes/:id
PATCH  /api/notes/:id  {text}                 段落を追記
PATCH  /api/notes/:id  {body,suggestions,...} ノート本文（Quill Delta）ほかを更新
POST   /api/notes/:id/suggestion  {id, action: "accept"|"dismiss"}
GET    /api/compare                   比較ボード
POST   /api/compare                   差分のまとめ（固定文）
GET    /api/export?noteId=&format=blog|memo|bullets
POST   /api/export        {noteId,format}
```

## ディレクトリ

```
app/            ルートとレイアウト、API Route Handlers
components/      Sidebar, UI プリミティブ (Button/Tag/Seg), Icon
lib/            types / ai / extract / api(クライアント fetch)
lib/db/         index.ts (= @repo/db の getDb) / repo.ts / current-user.ts / seed.ts
design-source/  元の Claude Design プロジェクト（Hazy Note.dc.html ほか）
scripts/localdb.sh       隔離開発用のローカル PG（`127.0.0.1:5433`）
scripts/sync-from-neon.sh  Neon（本番）のデータをローカル DB にコピー（`NEON_DATABASE_URL=… bun run db:sync-from-neon`）
```

スキーマ・マイグレーション・`db:*` スクリプトは `packages/db`（`packages/db/README.md`）。
