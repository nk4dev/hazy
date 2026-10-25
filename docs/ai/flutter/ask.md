# Ask — 保存記事への質問（RAG）

自分が保存した記事だけを資料に、LLM が質問へ答える。回答には出典
（`citations`）が付く。会話はスレッドとして継続できる。
テーブル: `ask_threads` / `ask_messages` / `ask_message_citations`。
DTO は [`models.md` › Ask 系](./models.md#ask-系)。
ソース: `apps/api/src/routes/ask.ts` / `lib/ai/ask-pipeline.ts`。

すべて **OpenRouter 必須** — 未設定なら `503 service_not_configured`。

---

## POST `/v1/ask` — 新規スレッドで質問

### ボディ
| フィールド | 型 | 備考 |
|---|---|---|
| `question` | `String` | 必須、1–2000 |
| `answerLanguageOverride` | `"en"` \| `"ja"` | 省略時は出典の言語 / ユーザー設定から自動 |
| `collectionIds` | `List<String>` | 最大 5。指定すると検索範囲をそのコレクション群に限定 |

### レスポンス `data`（`AskResponseDTO`、`201`）
```json
{
  "thread":   { "id": "...", "title": "質問から生成", "createdAt": "...", "updatedAt": "..." },
  "message":  { "id": "...", "role": "assistant", "content": "回答本文",
                "modelId": "google/…", "usedFallback": false, "createdAt": "...",
                "citations": [ … ] },
  "citations": [
    { "savedUrlId": "...", "title": "...", "domain": "...", "url": "...",
      "faviconUrl": "...", "snippet": "…240字以内…", "rank": 1 }
  ],
  "meta": { "sourceCount": 3 }
}
```

- `usedFallback: true` … 主モデルが失敗してフォールバックモデルで答えた。
- `meta.sourceCount == 0` … 関連記事が見つからず、一般知識で答えた可能性。UI で注意表示。
- 回答本文中の `[1]` `[2]` は `citations[].rank` に対応。

```dart
Future<AskResponse> ask(String question, {List<String>? collectionIds}) async {
  final res = await apiPost('/ask', {
    'question': question,
    if (collectionIds != null) 'collectionIds': collectionIds,
  });
  return unwrap(res, (d) => AskResponse.fromJson(d as Map<String, dynamic>));
}
```

---

## GET `/v1/ask/threads` — スレッド一覧

`data`: `{ "items": [ AskThreadDTO ] }`（`updatedAt` 降順、最大 50）。

---

## GET `/v1/ask/threads/:id` — スレッド詳細（全メッセージ）

`data`: `AskThreadDetailDTO`
```json
{ "thread": { AskThreadDTO }, "messages": [ AskMessageDTO ] }   // createdAt 昇順
```
`messages` は user / assistant 交互。assistant 側に `citations` が付く。

---

## POST `/v1/ask/threads/:id/messages` — スレッドを続ける

ボディは `POST /v1/ask` と同じ（`question` 必須、`answerLanguageOverride?`,
`collectionIds?`）。会話履歴を踏まえて答える。
`data`: `AskResponseDTO`（`201`）。存在しない thread → `400 validation_error`（"Thread not found"）。

---

## DELETE `/v1/ask/threads/:id`

`data`: `{ "id": "..." }`。メッセージ・引用はカスケード削除。

---

## 典型フロー（チャット UI）

1. 初回送信 → `POST /v1/ask { question }` → `thread.id` を保持。
2. 2 通目以降 → `POST /v1/ask/threads/:threadId/messages { question }`。
3. 履歴画面 → `GET /v1/ask/threads` → タップで `GET /v1/ask/threads/:id`。
4. 各回答の下に `citations` をカード表示。`url` で外部ブラウザ、
   `savedUrlId` で [items](./items.md) の詳細へ。
