# Items — 保存 URL

`saved_urls` テーブルの CRUD。すべて認証必須、すべて当該ユーザーの所有物のみ。
DTO は [`models.md` › SavedUrlDTO](./models.md#savedurldto--保存-url)。
ソース: `apps/api/src/routes/items.ts`。

---

## GET `/v1/items` — 一覧（カーソルページング）

### クエリ
| パラメータ | 型 | 既定 | 備考 |
|---|---|---|---|
| `cursor` | UUID | — | 前ページ末尾の `nextCursor` |
| `limit` | int 1–100 | `30` | |
| `sort` | `newest` \| `oldest` | `newest` | `createdAt` 基準 |

### レスポンス `data`
```json
{ "items": [ SavedUrlDTO ], "nextCursor": "uuid" | null }
```

```dart
Future<(List<SavedUrl>, String?)> listItems({String? cursor, int limit = 30}) async {
  final res = await apiGet('/items?limit=$limit${cursor != null ? "&cursor=$cursor" : ""}');
  final data = unwrap(res, (d) => d as Map<String, dynamic>);
  final items = (data['items'] as List)
      .map((e) => SavedUrl.fromJson(e as Map<String, dynamic>))
      .toList();
  return (items, data['nextCursor'] as String?);
}
```

---

## POST `/v1/items` — URL を保存

### ボディ
```json
{ "url": "https://example.com/article" }
```

サーバーが URL を正規化し、その場でメタデータ（title / description / favicon /
og:image / 本文抜粋 / 読了目安）を取得する。既に同じ正規化 URL を保存済みなら
**その既存行を `200`** で返す（重複作成しない）。新規なら `201`。
`readLaterState` 行（`status: "inbox"`）も同時に作られる。

メタ取得に失敗しても行は作られる（`fetchStatus: "error"`, `fetchError` に理由）。

### レスポンス `data`
`SavedUrlDTO`（新規は 201、既存は 200）。

---

## GET `/v1/items/:id` — 1 件取得

`data`: `SavedUrlDTO`（`readLaterStatus` 込み）。無い / 他人の → `404 not_found`。

---

## PATCH `/v1/items/:id` — 編集

### ボディ（すべて任意、指定した項目だけ更新）
| フィールド | 型 | 備考 |
|---|---|---|
| `title` | `String?` | 最大 500。`null` でクリア |
| `summary` | `String?` | 最大 4000。手書き要約の上書きにも使える |
| `tags` | `List<String>` | 最大 100 送れるが、保存時に小文字・trim・重複除去して**最大 30** |

`data`: 更新後の `SavedUrlDTO`。

---

## DELETE `/v1/items/:id`

`data`: `{ "id": "..." }`。`collection_items` / `read_later_state` はカスケード削除。

---

## POST `/v1/items/:id/refetch` — メタデータ再取得

本文・タイトル等をもう一度取りに行って上書き。成功で `fetchStatus: "success"`
＋ `fetchError: null`、失敗で `error`。`data`: `SavedUrlDTO`。

「取得に失敗した記事のリトライ」「内容が更新された記事の再読込」に使う。

---

## POST `/v1/items/:id/summarize` — AI 要約

OpenRouter で本文を要約し、`savedUrls.summary` に保存。`data`: 要約が入った
`SavedUrlDTO`。

- OpenRouter 未設定 → `503 service_not_configured`（`details.service == "openrouter"`）。
- 本文が薄い記事では短い要約 / 失敗しうる。UI ではローディングを長め（数秒〜十数秒）に。

```dart
Future<SavedUrl> summarize(String id) async {
  final res = await apiPost('/items/$id/summarize', null);
  return unwrap(res, (d) => SavedUrl.fromJson(d as Map<String, dynamic>));
}
```

---

## 典型フロー

1. ユーザーが URL を貼る → `POST /v1/items` → カードに追加。
2. カードを開く → `title`/`description` はもうある。要約ボタン → `POST /:id/summarize`。
3. 取得エラーのカード → `POST /:id/refetch`。
4. タグ編集 → `PATCH /:id { tags: [...] }`。
