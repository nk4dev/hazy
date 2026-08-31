# エラー

## 封筒

```json
{ "error": { "code": "validation_error", "message": "...", "details": { } } }
```

`ApiError`（`apps/api/src/lib/api/errors.ts`）と `ZodError` はこの形にマップされ、
それ以外は `500 internal_error`（サーバーログに出る）。

## コード一覧

| code | HTTP | 発生源 | Flutter での対応 |
|---|---|---|---|
| `unauthorized` | 401 | トークン無し / 失効 / Clerk 未設定 | トークン再取得 → リトライ → だめならサインアウト |
| `not_found` | 404 | 対象が存在しない、**または他ユーザーの所有物**（所有チェックは 404 を返す） | 「見つかりません」表示。一覧を再取得 |
| `validation_error` | 400 | Zod のボディ / クエリ検証失敗。`details` は `error.flatten()`（`fieldErrors` / `formErrors`） | フォームのフィールドエラーに反映 |
| `service_not_configured` | 503 | その機能の env 未設定。`details.service` に `"openrouter"` 等 | AI 機能を無効表示（`details.service` で判別） |
| `internal_error` | 500 | 予期しない例外 | 「時間をおいて再試行」＋リトライボタン |

`service_not_configured` が出うるエンドポイント: `POST /v1/items/:id/summarize`、
`POST /v1/collections/:id/summarize`、`POST /v1/ask`、`POST /v1/ask/threads/:id/messages`
（いずれも OpenRouter 必須）。

## Dart での扱い

```dart
class HazyApiException implements Exception {
  final String code;
  final String message;
  final int status;
  final Object? details;
  HazyApiException(this.code, this.message, this.status, this.details);

  bool get isAuth => code == 'unauthorized';
  bool get isNotFound => code == 'not_found';
  bool get isValidation => code == 'validation_error';
  bool get isServiceOff => code == 'service_not_configured';
}

T unwrap<T>(http.Response res, T Function(dynamic) fromData) {
  final body = jsonDecode(res.body);
  if (body is Map && body['error'] != null) {
    final e = body['error'] as Map<String, dynamic>;
    throw HazyApiException(
      e['code'] as String? ?? 'internal_error',
      e['message'] as String? ?? 'Request failed',
      res.statusCode,
      e['details'],
    );
  }
  if (res.statusCode ~/ 100 != 2 || body is! Map || body['data'] == null) {
    throw HazyApiException('internal_error', 'Request failed (${res.statusCode})',
        res.statusCode, null);
  }
  return fromData(body['data']);
}
```

## ネットワークエラー

Worker に届かない（オフライン / DNS / TLS）場合は封筒が返らないので、
`SocketException` / `TimeoutException` を UI 層で別枠のリトライ導線にする。
