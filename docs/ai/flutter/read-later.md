# Read Later — あとで読む

保存 URL の消化キュー。読了目安（`estimatedReadMinutes`）でバケット分けする。
テーブル: `read_later_state`（`saved_urls` と 1:1、`status` を持つ）。
DTO は [`models.md` › Read-later 系](./models.md#read-later-系)。
ソース: `apps/api/src/routes/read-later.ts` / `lib/read-later/bucketing.ts`。

`status` は `inbox` \| `snoozed` \| `read` \| `archived`。保存直後は `inbox`。
キューに出るのは基本 `inbox`（スヌーズ期限切れも含む）。

---

## GET `/v1/read-later` — キュー（バケット済み）

### レスポンス `data`（`ReadLaterQueueDTO`）
```json
{
  "totalCount": 12,
  "totalMinutes": 84,
  "todaysThreeMinutes": 11,
  "todaysThree": [ SavedUrlDTO ],   // 「今日の3本」= 短い×古いを優先した最大3件
  "fiveMinutes":  [ SavedUrlDTO ],  // 5分以内（estimatedReadMinutes <= 5）
  "sitDown":      [ SavedUrlDTO ]   // じっくり（> 5分）
}
```

バケット分けは**ヒューリスティック**（AI ランキングではない）:
短い・保存から時間が経っているものほど「今日の3本」に上がる。
`estimatedReadMinutes` が無い記事は 15 分と仮定。

---

## GET `/v1/read-later/stats` — 週次統計

### レスポンス `data`（`ReadLaterStatsDTO`）
```json
{
  "days": [ { "count": 2, "heightPct": 100 }, … ],  // 7 要素、古い→新しい（末尾が今日）
  "readThisWeek": 9,
  "savedThisWeek": 14
}
```
`heightPct` はその週の最大日を 100 とした相対値（棒グラフ用）。

---

## PATCH `/v1/read-later/:itemId` — ステータス変更

`:itemId` は `saved_urls.id`（`read_later_state` の行 id ではない）。行が無ければ upsert。

### ボディ
| フィールド | 型 | 備考 |
|---|---|---|
| `status` | `inbox` \| `snoozed` \| `read` \| `archived` | 必須 |
| `snoozedUntil` | ISO 文字列 | `status: "snoozed"` のとき復帰日時。それ以外では無視 |

`status: "read"` にすると `markedReadAt` が now に入る（統計に反映）。
`read` / `archived` 以外に戻すと `markedReadAt` は `null` に戻る。

### レスポンス `data`（`ReadLaterStateDTO`）
```json
{ "status": "read", "snoozedUntil": null, "markedReadAt": "ISO" }
```

```dart
Future<void> markRead(String itemId) =>
    apiPatch('/read-later/$itemId', {'status': 'read'});

Future<void> snooze(String itemId, DateTime until) =>
    apiPatch('/read-later/$itemId',
        {'status': 'snoozed', 'snoozedUntil': until.toUtc().toIso8601String()});
```

---

## 典型フロー

1. ホーム = `GET /v1/read-later` → 「今日の3本」を大きく、`fiveMinutes` / `sitDown` を下に。
2. スワイプで既読 → `PATCH /:id { status: "read" }` → リストから除去。
3. 「あとで」 → `PATCH /:id { status: "snoozed", snoozedUntil }`。
4. 週の振り返り → `GET /v1/read-later/stats` の `days` を棒グラフに。
