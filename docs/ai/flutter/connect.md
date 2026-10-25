# Connect — 連携アプリの管理

「Connect with Hazy」: 他アプリが PKCE（S256）付きの認可コードフローで
`hz_…` ベアラートークンを得る仕組み。ソース: `apps/api/src/routes/connect.ts`。
DTO は [`models.md` › Connect 系](./models.md#connect-系)。

Flutter の hazy アプリが使うのは**一覧と解除だけ**。コード発行と交換は
Web の承認ページ（`https://hz.nknighta.me/connector/add`）と第三者クライアントの仕事。

---

## GET `/v1/connect/apps` — 連携中アプリ一覧

解除されていないトークンを新しい順に返す。

### レスポンス `data`
```json
{
  "items": [
    {
      "id": "uuid",
      "clientName": "My Dashboard",
      "clientOrigin": "https://dash.example.com",
      "createdAt": "2026-10-26T00:00:00.000Z",
      "lastUsedAt": null
    }
  ]
}
```
`lastUsedAt` は最大 1 時間単位でしか更新されない。

## DELETE `/v1/connect/apps/:id` — 連携解除

`{ "id": "uuid" }` を返す。既に解除済み・他人の行は `404 not_found`。

---

## 認証の注意

- `/v1/connect/*`（`/token` を除く）は **Clerk セッション必須**。`hz_…` トークンで
  呼ぶと `403 forbidden`（連携アプリが自分でトークンを増やしたり消したりできない）。
- `hz_` で始まるベアラーは連携アプリのトークンとして扱われ、それ以外は Clerk JWT。
  Flutter アプリは常に Clerk JWT なので影響なし。

## 第三者クライアント側のフロー（参考）

1. ユーザーを `https://hz.nknighta.me/connector/add?client_name&redirect_uri&code_challenge&code_challenge_method=S256&state` に送る。
2. 承認されると `redirect_uri?code&state`、拒否なら `redirect_uri?error=access_denied&state` に戻る。
3. `POST /v1/connect/token`（認証不要）に `{ code, codeVerifier, redirectUri }` → `{ accessToken: "hz_…", tokenType: "Bearer", clientName }`。
   コードは 5 分有効・1 回限り。不一致は `400 invalid_grant`。
