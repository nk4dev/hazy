# DTO リファレンス

一次ソース: `packages/api-client/src/types.ts`。すべて `{ "data": <T> }` の中身。
`null` 許容は Dart では nullable（`String?`）にする。日時は ISO 文字列 → `DateTime.parse`。

## SavedUrlDTO — 保存 URL

| フィールド | 型 | 備考 |
|---|---|---|
| `id` | `String` | UUID |
| `url` | `String` | 正規化前の元 URL |
| `domain` | `String?` | `www.` 除去済みホスト |
| `title` | `String?` | 取得できた `<title>` / og:title |
| `description` | `String?` | メタ description |
| `faviconUrl` | `String?` | |
| `ogImageUrl` | `String?` | プレビュー画像 |
| `summary` | `String?` | **AI 要約**。生成するまで `null`（[items.md](./items.md) の summarize） |
| `tags` | `List<String>` | 小文字・trim・重複除去済み、最大 30 |
| `contentLanguage` | `String?` | `en` / `ja` 等 |
| `estimatedReadMinutes` | `int?` | 読了目安。あとで読むのバケット分けに使われる |
| `fetchStatus` | `String` | `pending` \| `success` \| `error` |
| `fetchError` | `String?` | `fetchStatus == "error"` のとき理由 |
| `createdAt` / `updatedAt` | `DateTime` | ISO 文字列 |
| `readLaterStatus` | `String?` | `inbox` \| `snoozed` \| `read` \| `archived` \| `null` |

```dart
class SavedUrl {
  final String id;
  final String url;
  final String? domain, title, description, faviconUrl, ogImageUrl, summary;
  final List<String> tags;
  final String? contentLanguage;
  final int? estimatedReadMinutes;
  final String fetchStatus;
  final String? fetchError;
  final DateTime createdAt, updatedAt;
  final String? readLaterStatus;

  SavedUrl.fromJson(Map<String, dynamic> j)
      : id = j['id'],
        url = j['url'],
        domain = j['domain'],
        title = j['title'],
        description = j['description'],
        faviconUrl = j['faviconUrl'],
        ogImageUrl = j['ogImageUrl'],
        summary = j['summary'],
        tags = (j['tags'] as List).cast<String>(),
        contentLanguage = j['contentLanguage'],
        estimatedReadMinutes = j['estimatedReadMinutes'],
        fetchStatus = j['fetchStatus'],
        fetchError = j['fetchError'],
        createdAt = DateTime.parse(j['createdAt']),
        updatedAt = DateTime.parse(j['updatedAt']),
        readLaterStatus = j['readLaterStatus'];
}
```

## PaginatedResponse&lt;T&gt;

```json
{ "items": [ <T> ], "nextCursor": "uuid-or-null" }
```
`nextCursor` が `null` → 次ページなし。ある → 次リクエストの `?cursor=` に渡す。

## CollectionDTO / CollectionDetailDTO

| フィールド | 型 | 備考 |
|---|---|---|
| `id` | `String` | |
| `name` | `String` | 1–255 文字 |
| `description` | `String?` | 最大 1000 |
| `color` | `String?` | 任意の色文字列（最大 32） |
| `summary` | `String?` | コレクション全体の AI 概要。生成まで `null` |
| `summaryUpdatedAt` | `DateTime?` | |
| `itemCount` | `int` | メンバー数 |
| `previewImages` | `List<String>` | 直近の og:image を最大 4 件 |
| `createdAt` | `DateTime` | |

`CollectionDetailDTO` = 上記 + `items: List<SavedUrlDTO>`（`GET /v1/collections/:id`）。

## Ask 系

### AskThreadDTO
`id`, `title`, `createdAt`, `updatedAt`。

### AskMessageDTO
`id`, `role`（`user` \| `assistant`）, `content`, `modelId: String?`,
`usedFallback: bool`, `createdAt`, `citations?: List<AskCitationDTO>`。

### AskCitationDTO
`savedUrlId`, `title: String?`, `domain: String?`, `url`, `faviconUrl: String?`,
`snippet: String`（最大 240 字）, `rank: int`（1 始まり）。

### AskResponseDTO — `POST /v1/ask`, `POST /v1/ask/threads/:id/messages`
```json
{
  "thread":   { AskThreadDTO },
  "message":  { AskMessageDTO },   // role == "assistant"
  "citations": [ AskCitationDTO ],
  "meta": { "sourceCount": 3 }
}
```

### AskThreadDetailDTO — `GET /v1/ask/threads/:id`
```json
{ "thread": { AskThreadDTO }, "messages": [ AskMessageDTO ] }
```

## Read-later 系

### ReadLaterQueueDTO — `GET /v1/read-later`
```json
{
  "totalCount": 12,
  "totalMinutes": 84,
  "todaysThreeMinutes": 11,
  "todaysThree": [ SavedUrlDTO ],   // 最大 3
  "fiveMinutes":  [ SavedUrlDTO ],  // estimatedReadMinutes <= 5
  "sitDown":      [ SavedUrlDTO ]   // > 5
}
```

### ReadLaterStatsDTO — `GET /v1/read-later/stats`
```json
{
  "days": [ { "count": 2, "heightPct": 100 } ],  // 直近 7 日、古い→新しい
  "readThisWeek": 9,
  "savedThisWeek": 14
}
```

### ReadLaterStateDTO — `PATCH /v1/read-later/:itemId`
`status`（`inbox`\|`snoozed`\|`read`\|`archived`）, `snoozedUntil: String?`,
`markedReadAt: String?`。

## SearchResponseDTO — `GET /v1/search`
```json
{ "query": "生の q", "items": [ SavedUrlDTO ] }
```

## MeDTO / UserPreferencesDTO — `GET/PATCH /v1/me`
```json
{
  "id": "uuid", "email": "a@b.c", "displayName": "…", "avatarUrl": "…",
  "preferences": {
    "interfaceLocale": "en",              // "en" | "ja"
    "answerLanguageMode": "interface",    // "interface" | "source"
    "notifyReadLaterDigest": true,
    "notifyWeeklyStats": false
  }
}
```
`PATCH /v1/me` は `preferences` の中身だけを返す（`UserPreferencesDTO`）。

## その他の小さな封筒

| エンドポイント | `data` の形 |
|---|---|
| `DELETE /v1/items/:id` ほか削除系 | `{ "id": "..." }` |
| `POST /v1/collections/:id/items` | `{ "collectionId": "...", "savedUrlId": "..." }` |
| `POST /v1/collections/:id/summarize` | `{ "summary": "...", "summaryUpdatedAt": "ISO" }` |
