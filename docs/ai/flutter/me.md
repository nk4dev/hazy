# Me — プロフィールと設定

サインイン中ユーザーの情報と `user_preferences`。
DTO は [`models.md` › MeDTO](./models.md#medto--userpreferencesdto--getpatch-v1me)。
ソース: `apps/api/src/routes/me.ts`。

---

## GET `/v1/me`

最初の認証付きリクエストで内部 `users` 行 + デフォルト `user_preferences` が
作られる（[auth.md](./auth.md) 参照）。だから起動直後にこれを 1 回叩けば
アカウントの用意が済む。

### レスポンス `data`（`MeDTO`）
```json
{
  "id": "internal-uuid",
  "email": "you@example.com",
  "displayName": "Name",
  "avatarUrl": "https://…",
  "preferences": {
    "interfaceLocale": "en",
    "answerLanguageMode": "interface",
    "notifyReadLaterDigest": true,
    "notifyWeeklyStats": false
  }
}
```
`email` / `displayName` / `avatarUrl` は Clerk 由来で `null` になりうる。
`id` は**内部 UUID**（Clerk の user id ではない）。他 API のオーナー判定はこれ。

---

## PATCH `/v1/me` — 設定変更

### ボディ（すべて任意）
| フィールド | 型 | 意味 |
|---|---|---|
| `interfaceLocale` | `"en"` \| `"ja"` | UI 言語 |
| `answerLanguageMode` | `"interface"` \| `"source"` | Ask の回答言語を UI 言語に合わせるか、出典の言語に合わせるか |
| `notifyReadLaterDigest` | `bool` | あとで読むダイジェスト通知 |
| `notifyWeeklyStats` | `bool` | 週次統計通知 |

### レスポンス `data`
`UserPreferencesDTO`（`preferences` の中身だけ。プロフィールは返らない）。

```dart
Future<Preferences> updatePrefs(Map<String, dynamic> patch) async {
  final res = await apiPatch('/me', patch);
  return unwrap(res, (d) => Preferences.fromJson(d as Map<String, dynamic>));
}
// 例: updatePrefs({'interfaceLocale': 'ja'})
```

---

## 典型フロー

1. アプリ起動・サインイン直後 → `GET /v1/me`（アカウント準備 + プロフィール表示）。
2. 設定画面 → トグル変更ごとに `PATCH /v1/me { …一項目 }`。
3. サインアウトは Clerk SDK 側（API 呼び出し不要）。
