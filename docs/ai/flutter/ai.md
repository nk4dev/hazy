# AI API (`/v1/ai`)

汎用的な AI チャット補完エンドポイントです。OpenRouter への呼び出しおよび無料モデルの自動フォールバックがサーバー側で集約管理されます。

## エンドポイント一覧

| メソッド | パス | 認証 | 概要 |
|---|---|---|---|
| `POST` | `/v1/ai/chat` | 要 | メッセージ配列を渡し、AI による返答を取得する |

## `POST /v1/ai/chat`

### リクエストボディ

```json
{
  "messages": [
    { "role": "system", "content": "あなたは簡潔に答えるアシスタントです。" },
    { "role": "user", "content": "React 19 の主な変更点は何ですか？" }
  ],
  "temperature": 0.3,
  "model": "meta-llama/llama-3.3-70b-instruct:free"
}
```

- `messages` (必須): `role` (`"system"` | `"user"` | `"assistant"`) と `content` (文字列) の配列。
- `temperature` (任意): 0.0 〜 2.0 の数値。
- `model` (任意): 優先して使用したいモデル ID。未指定時はデフォルトのモデルが使用されます。
- `models` (任意): フォールバックモデルの順序付きリスト。

### レスポンス

`200 OK`

```json
{
  "data": {
    "content": "React 19 では React Compiler や Server Actions の安定化...",
    "model": "meta-llama/llama-3.3-70b-instruct:free"
  }
}
```
