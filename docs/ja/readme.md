# Hazy — 保存したURLの記憶

リンクを保存し、自分の読書履歴を検索し、それについて質問し、あとでまとめて
追いつく。Next.js (App Router, TypeScript)、任意のPostgresデータベース +
Drizzle、Clerk認証、そしてAIによる回答生成にOpenRouterを使って構築されて
います。次はFlutter製のモバイルクライアントを予定していて、このWebアプリが
既に使っている同じ `/api/v1/*` HTTP APIに対して動作させる計画です。

## 技術スタックと選定理由

| 関心事 | 選択 | 補足 |
|---|---|---|
| フレームワーク | Next.js 16 (App Router), TypeScript | |
| データベース | **任意のPostgres**、Drizzle ORM + 素の `postgres` ドライバ経由 | Neon、Supabase、RDS、ローカルのDocker/Postgres.appなど — `DATABASE_URL` が指す先ならどこでも。無料で一番手軽に始められるのはNeonの無料枠 |
| 認証 | [Clerk](https://clerk.com) | 無料のHobbyティア — 下記「認証のフォールバック」参照 |
| AI | [OpenRouter](https://openrouter.ai)、無料の `:free` モデル | 無料モデルのラインナップは入れ替わる。`.env.example` を参照 |
| 多言語対応 (i18n) | `next-intl`、英語 + 日本語 | `/en/...` と `/ja/...` のルート |
| 検索 | PostgresのFull-Text Search（AI不要） | APIキーを一切設定していなくても動作する |

### データベース: Neon専用ではなく、任意のPostgresで動く

`src/db/index.ts` は素の `postgres` (postgres.js) ドライバを使い、標準的な
TCP接続文字列で接続しています。同じコードパスがNeon、Supabase、Amazon RDS、
ローカルのDockerコンテナ、Postgres.appのどれに対しても動きます。SSLは
自動で処理され（`src/db/connection-options.ts`）、マネージドサービスの
接続文字列には既に `?sslmode=require` が含まれているのでそのまま尊重され、
素の `localhost` 文字列の場合はSSLが無効化されるため、ローカル開発では
追加設定が不要です。Neon固有の要素は何もなく、`DATABASE_URL` をPostgres
14以降の任意の接続文字列に差し替えれば動作します。

一つ知っておくべきトレードオフとして、これはNeonのHTTPベースの
サーバーレスドライバ（エッジ/サーバーレス環境でのTCP接続数上限の問題を
回避できる）を、可搬性のために手放していることになります。実運用規模の
サーバーレスプラットフォームにデプロイする場合は、`DATABASE_URL` を
プロバイダの*プーリング*接続文字列（NeonもSupabaseも、例えばPgBouncer
経由のものを提供しています）に向けるか、`src/db/index.ts` の `max`
（現在は5）を低く保ってください。

### 認証: もしClerkが使えなくなったら?

Clerkの無料/Hobbyティアは、メール認証とソーシャルログインを寛大な
MAU（月間アクティブユーザー）上限まで無制限にカバーしており、この
プロジェクトには十分ですが、カスタムドメイン、エンタープライズ
SSO/SAML、大量のトランザクションSMSは有料プランの向こう側にあります
（Clerkの現在の料金ページで確認してください、変わることがあります）。
もしClerkが使えなくなった場合、想定しているフォールバックは同じ
Neonデータベースに対する **Auth.js (NextAuth v5) + `@auth/drizzle-adapter`**
です — 完全にセルフホストで追加コストはかかりませんが、Clerkのホスト型
コンポーネントの代わりにサインイン/サインアップUIを自前で作る必要が
あります。これはまだ実装されておらず、必要になった時のための計画に
とどまっています。

## セットアップ

このアプリは**キーが一つもない状態でも起動**し、何が足りないかを示す
「セットアップが必要です」画面を表示します — クラッシュはしません。
サービスは一つずつ追加していけます。

1. **envファイルをコピーする**

   ```bash
   cp .env.example .env.local
   ```

2. **データベース（任意のPostgres、無料枠あり）** — 一番手軽な無料の道は
   [neon.tech](https://neon.tech) → プロジェクトを作成 → 接続文字列を
   コピー → `DATABASE_URL` に貼り付け。他のPostgres（Supabase、RDS、
   ローカルDockerなど）も同じ要領で、接続文字列を貼り付けるだけです。
   その後:

   ```bash
   npm run db:setup   # drizzle-kit push + search_vector トリガーの適用
   ```

3. **Clerk（認証、無料）** — [clerk.com](https://clerk.com) → アプリを
   作成 → API Keysページ → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` と
   `CLERK_SECRET_KEY` を `.env.local` にコピー。これらを設定すれば
   サインイン/サインアップがすぐに動作します。

   任意設定: Clerk → データベースのユーザー同期Webhookを使う場合は、
   Clerkダッシュボードで `/api/v1/webhooks/clerk` を指すエンドポイントを
   追加し（開発中は `ngrok http 3000` などで公開URLが必要です）、署名
   シークレットを `CLERK_WEBHOOK_SIGNING_SECRET` にコピーしてください。
   これは任意です — Webhookがなくても、初回サインイン時にアプリが
   ユーザーレコードをupsertします。

4. **OpenRouter（AIによる回答、無料）** —
   [openrouter.ai](https://openrouter.ai) → キーを作成（`:free` 接尾辞の
   モデルにはカード登録不要）→ `OPENROUTER_API_KEY` を設定。無料モデルの
   ラインナップは入れ替わるため、
   [openrouter.ai/models?max_price=0](https://openrouter.ai/models?max_price=0)
   を確認し、デフォルトが廃止されていたら `OPENROUTER_MODEL_ID` を
   更新してください。**このキーがなくても検索は動作します**（保存した
   URLに対する単純なキーワード検索）— AIが合成する「Ask」の回答のみ、
   「一致したものはこちらです」という素朴な応答にフォールバックします。

5. **実行する**

   ```bash
   npm install
   npm run dev
   ```

## スクリプト

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバーを起動 |
| `npm run build` / `npm run start` | 本番ビルド / 実行 |
| `npm run lint` | ESLint |
| `npm run db:generate` | スキーマの変更からDrizzleマイグレーションを生成 |
| `npm run db:push` | スキーマを `DATABASE_URL` に直接反映（開発時のワークフロー） |
| `npm run db:studio` | Drizzle Studioを開く |
| `npm run db:trigger` | `search_vector` トリガーを（再）適用 — 下記参照 |
| `npm run db:setup` | `db:push` と `db:trigger` をまとめて実行 |

## 手動のSQLトリガーがある理由

`saved_urls.search_vector`（PostgresのGINインデックス付き `tsvector`）が
Full-Text Searchを支えています。`src/db/schema.ts` で宣言されたカラムと
インデックスはDrizzleが管理しますが、insert/update時にそれを*更新し続ける*
のはトリガーの役目であり、これは `drizzle-kit push` では表現できない
ものです。そのため `src/db/sql/search-vector-trigger.sql` に置かれ、
`npm run db:trigger` で適用されます。データベースをリセットしたときは
いつでも再実行してください。

## APIの形（将来のFlutterクライアントのために）

Webアプリが必要とする読み書きはすべて、素のJSON Route Handlerとして
`/api/v1/**` 以下に置かれています — Next.jsのServer Actionsは決して
使いません — これは将来ネイティブのFlutterクライアントが、バックエンド側の
作り直しなしに同じエンドポイントを利用できるようにするためです。
レスポンスは成功時が `{ data }`、失敗時が
`{ error: { code, message, details? } }` という形です。共有される
レスポンスの型は `src/types/api.ts`、各ハンドラは `src/app/api/v1/**`
を参照してください。

## プロジェクト構成

```
src/
  app/[locale]/            # ページ（en/ja）、(auth) と (app) のルートグループ
  app/api/v1/               # JSON API — 上記参照
  components/                # 機能ごとにまとめたUI
  db/schema.ts               # Drizzleスキーマ（単一の情報源）
  lib/                       # env、認証、メタデータ取得、検索、AIなど
  i18n/, messages/           # next-intlの設定 + en.json/ja.json
  types/api.ts                # 共有APIコントラクトの型
```

## まだ作られていないもの

- Flutterモバイルアプリ（次に着手予定、既存の `/api/v1/*` APIに対して）
- バックグラウンド/非同期でのメタデータ取得（現在の保存フローは
  インラインで取得しタイムアウトは約8秒 — 現在の規模では問題ないが、
  より大きな規模ではキューに移行する想定）
- 後で読むダイジェストのプッシュ/メール通知（設定トグル自体は存在し
  保存されるが、まだ何も送信しない）
