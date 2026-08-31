# hazy API — Flutter クライアント向けリファレンス

Flutter 版 **hazy** アプリが叩くバックエンドは `apps/api`（`hazy-api`、Hono の
Cloudflare Worker）。このディレクトリはその `/v1/**` JSON API を
**ジャンル別**にまとめたもの。ワイヤ契約の一次ソースは
`packages/api-client/src/types.ts`（TypeScript DTO）— 変更時はそちらと同時に更新する。

> `apps/hazy-note` には別系統の `/api/*`（Next の Route Handler）があるが、
> あれは hazy-note 専用。Flutter の hazy アプリが使うのは **この `apps/api` だけ**。

## ベース URL

| 環境 | URL |
|---|---|
| 本番 | `https://api.hz.nknighta.me` |
| ローカル | `http://localhost:8787`（`bun run dev --filter=api`） |

パスは常に `<baseUrl>/v1/...`。`GET /health`（`/v1` の外）だけ認証不要。

## 共通の約束

### レスポンス封筒

成功:
```json
{ "data": <T> }
```
失敗（`apps/api/src/lib/api/response.ts`）:
```json
{ "error": { "code": "not_found", "message": "Saved URL not found.", "details": null } }
```
`details` はバリデーションエラー時のみ（Zod の `flatten()`）。

### 認証

`/v1/**`（webhook を除く）はすべて **Clerk セッション JWT** を要求する:
```
Authorization: Bearer <clerk-session-token>
```
取得方法・401 の扱いは [`auth.md`](./auth.md)。

### エラーコード / HTTP ステータス

一覧は [`errors.md`](./errors.md)。要点だけ:

| code | status | 意味 |
|---|---|---|
| `unauthorized` | 401 | トークンなし / 失効 |
| `not_found` | 404 | 対象なし、または他ユーザーの所有物 |
| `validation_error` | 400 | リクエストボディ / クエリが不正（`details` あり） |
| `service_not_configured` | 503 | その機能の環境変数が未設定（例: OpenRouter 未設定で要約を叩いた） |
| `internal_error` | 500 | 予期しないエラー |

### 日付・ID

- 日時はすべて **ISO 8601 文字列**（`2026-08-31T12:00:00.000Z`）。
- ID は UUID v4 文字列。
- 一覧はカーソルページング（`nextCursor` が `null` なら終端）。詳細は各ページ。

### CORS

CORS はブラウザだけの制約。Flutter（モバイル / デスクトップ）からは
関係なく、`Authorization` ヘッダーを付けて直接叩けばよい。Web で動かす場合は
`CORS_ALLOWED_ORIGINS` にオリジンを足す必要がある（`apps/api` の env）。

## ジャンル別ドキュメント

| ファイル | 対象 | 主なユースケース |
|---|---|---|
| [`auth.md`](./auth.md) | 認証 | サインイン、トークン取得、401 リカバリ |
| [`errors.md`](./errors.md) | エラー | `code` 一覧、Dart での分岐 |
| [`models.md`](./models.md) | DTO | 全レスポンス型の Dart 対応表 |
| [`items.md`](./items.md) | 保存 URL | URL 保存、一覧、編集、再取得、AI 要約 |
| [`collections.md`](./collections.md) | コレクション | 束ねる、メンバー操作、コレクション要約 |
| [`ask.md`](./ask.md) | Ask（RAG） | 自分の保存記事に質問、スレッド継続 |
| [`read-later.md`](./read-later.md) | あとで読む | 今日の3本 / 5分 / じっくり、既読化、週次統計 |
| [`search.md`](./search.md) | 検索 | キーワード + `domain:` / `tag:` フィルタ |
| [`me.md`](./me.md) | プロフィール | 自分の情報、UI 言語・通知設定 |

## 最小の疎通確認（Dart）

```dart
final res = await http.get(
  Uri.parse('$baseUrl/v1/me'),
  headers: {'Authorization': 'Bearer $token'},
);
final body = jsonDecode(res.body) as Map<String, dynamic>;
if (res.statusCode == 200) {
  final me = body['data'] as Map<String, dynamic>;
} else {
  final err = body['error'] as Map<String, dynamic>;
  // err['code'], err['message']
}
```
