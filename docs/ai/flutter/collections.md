# Collections — コレクション

保存 URL を束ねるフォルダ的概念（`collections` / `collection_items`）。
DTO は [`models.md` › CollectionDTO](./models.md#collectiondto--collectiondetaildto)。
ソース: `apps/api/src/routes/collections.ts`。

> hazy-note の「プロジェクト」（`projects` テーブル）とは**別物**。Flutter の
> hazy アプリが扱うのはこの `collections`。

---

## GET `/v1/collections` — 一覧

`data`:
```json
{ "items": [ CollectionDTO ] }   // itemCount + previewImages 込み、createdAt 昇順
```
カーソルページングなし（全件）。`previewImages` は各コレクションの直近 og:image 最大 4。

---

## POST `/v1/collections` — 作成

### ボディ
| フィールド | 型 | 備考 |
|---|---|---|
| `name` | `String` | 必須、1–255 |
| `description` | `String?` | 最大 1000 |
| `color` | `String?` | 最大 32（任意の文字列。UI 側の色トークンでよい） |

`data`: `CollectionDTO`（`itemCount: 0`）、`201`。

---

## GET `/v1/collections/:id` — 詳細（メンバー込み）

`data`: `CollectionDetailDTO` = `CollectionDTO` + `items: [ SavedUrlDTO ]`
（メンバーは `createdAt` 降順、各 `readLaterStatus` 込み）。

---

## PATCH `/v1/collections/:id` — 編集

ボディは `name?` / `description?` / `color?`（`null` でクリア可）。
`data`: 更新後の `CollectionDTO`（※ `itemCount` は 0 が返る — 一覧を再取得して補う）。

---

## DELETE `/v1/collections/:id`

`data`: `{ "id": "..." }`。`collection_items` はカスケード削除（保存 URL 自体は残る）。

---

## POST `/v1/collections/:id/items` — メンバー追加

### ボディ
```json
{ "savedUrlId": "uuid" }
```
既に入っていれば何もしない（冪等）。コレクション or 保存 URL が他人の / 無い → `404`。

`data`: `{ "collectionId": "...", "savedUrlId": "..." }`、`201`。

---

## DELETE `/v1/collections/:id/items/:savedUrlId` — メンバー除外

`data`: `{ "collectionId": "...", "savedUrlId": "..." }`。保存 URL 自体は消えない。

---

## POST `/v1/collections/:id/summarize` — コレクション要約

コレクション内の記事をまとめて 1 つの概要にする。

### ボディ（任意）
```json
{ "locale": "ja" }   // "en" | "ja"。省略時はサーバー判定
```

### レスポンス `data`
```json
{ "summary": "…", "summaryUpdatedAt": "ISO" }
```
`collections.summary` / `summaryUpdatedAt` にも保存される（次回の `GET` で読める）。

- OpenRouter 未設定 → `503 service_not_configured`。
- 空コレクションや記事が少ないと短い / 失敗しうる。

---

## 典型フロー

1. `POST /v1/collections { name }` で作る。
2. 受信箱 / 検索で見つけた記事を `POST /v1/collections/:id/items { savedUrlId }`。
3. コレクション画面 → `GET /v1/collections/:id` で中身表示。
4. 「まとめて要約」 → `POST /v1/collections/:id/summarize { locale }`。
