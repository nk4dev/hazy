# 認証

hazy API は **Clerk** のセッション JWT を Bearer トークンとして受け取る
（`apps/api/src/lib/auth/current-user.ts` → `clerk().authenticateRequest`）。

```
Authorization: Bearer <clerk-session-token>
```

トークンが無い / 失効していると `401 { "error": { "code": "unauthorized" } }`。

## Flutter でのサインイン

Clerk 公式の Flutter SDK を使う:

- `clerk_flutter` — ウィジェット（`ClerkAuthentication` など）
- `clerk_auth` — 低レベル（`ClerkAuth` インスタンス、`sessionToken` の取得）

```yaml
# pubspec.yaml
dependencies:
  clerk_flutter: ^0.0.9   # 最新版は pub.dev で確認
```

Publishable key は `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`（`apps/hazy-note/.env.local`
等にある dev インスタンスのもの。本番用は別途 Clerk ダッシュボードから）。

```dart
final clerkAuth = ClerkAuth(
  config: ClerkAuthConfig(publishableKey: clerkPublishableKey),
);
await clerkAuth.initialize();
```

### 有効な OAuth プロバイダ

現状の dev インスタンスは **OAuth のみ**（GitHub / Google / MetaMask）。
メール + パスワードは無効。Flutter でも同じプロバイダでサインインさせる。

## トークンの取り回し

Clerk のセッショントークンは **短命（約60秒）**。毎リクエストで最新を取得するのが安全:

```dart
Future<http.Response> apiGet(String path) async {
  final token = await clerkAuth.session?.getToken();   // 毎回取り直す
  return http.get(
    Uri.parse('$baseUrl/v1$path'),
    headers: {
      if (token != null) 'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    },
  );
}
```

`http` の代わりに `dio` を使うなら、`getToken()` を呼ぶ
`InterceptorsWrapper` を1つ噛ませる。

## `authorizedParties`

`apps/api` は `authenticateRequest` に `authorizedParties` を渡して検証している
（`NEXT_PUBLIC_APP_URL` / `localhost:3100` / `CORS_ALLOWED_ORIGINS`）。
ネイティブアプリのトークンは `azp` クレームを持たないので基本問題ないが、
本番で 401 が続くなら Worker 側の `CORS_ALLOWED_ORIGINS` にアプリの
オリジン（Web 版がある場合）を追加する。

## 初回リクエストの副作用

`GET /v1/me` を含む最初の認証付きリクエストで、Clerk ユーザーに対応する
内部 `users` 行と `user_preferences` 行が**自動作成**される
（`resolveUser`）。Flutter 側で明示的なサインアップ API を叩く必要はない。

## 401 リカバリ

1. `getToken()` で再取得してリトライ（トークン失効が大半）。
2. それでも 401 なら `clerkAuth.signOut()` → サインイン画面へ。

## サーバー間 webhook（参考）

`POST /v1/webhooks/clerk` は Clerk → サーバーの user ライフサイクル同期用
（Svix 署名検証、認証ミドルウェア対象外）。**Flutter クライアントは触らない。**
Clerk ダッシュボードのエンドポイントを
`https://api.hz.nknighta.me/v1/webhooks/clerk` に向ける運用タスク。
