# Search — キーワード検索

保存 URL の全文検索（title / description / summary / 本文抜粋 / tags に対する
Postgres の tsvector マッチ）。`domain:` / `tag:` フィルタトークンを `q` に混ぜられる。
ソース: `apps/api/src/routes/search.ts` / `lib/search/keyword-search.ts`。

> これはサーバー側の**キーワード検索**。hazy-note の `/search`（クライアント側 +
> `@ternlight/base` セマンティック + チャット）とは別実装。Flutter アプリが使うのは
> この `GET /v1/search`。

---

## GET `/v1/search`

### クエリ
| パラメータ | 型 | 既定 | 備考 |
|---|---|---|---|
| `q` | `String` | 必須、1 文字以上 | フリーテキスト + フィルタトークン |
| `limit` | int 1–50 | `20` | |

### フィルタトークン（`q` の中に書く）

| 書き方 | 効果 |
|---|---|
| `domain:example.com` | そのドメインに限定（`www.` は自動除去） |
| `tag:rust` | そのタグを持つものに限定 |
| `tag:"two words"` | スペース入りタグ |

複数 `tag:` は AND（全部持つもの）。トークンを除いた残りがフリーテキスト。
例: `q=分散システム tag:database domain:gihyo.jp`

### レスポンス `data`（`SearchResponseDTO`）
```json
{ "query": "送った生の q", "items": [ SavedUrlDTO ] }   // 関連度順
```
ページングなし（`limit` 件で打ち切り）。

```dart
Future<List<SavedUrl>> search(String q, {int limit = 20}) async {
  final res = await apiGet('/search?q=${Uri.encodeQueryComponent(q)}&limit=$limit');
  final data = unwrap(res, (d) => d as Map<String, dynamic>);
  return (data['items'] as List)
      .map((e) => SavedUrl.fromJson(e as Map<String, dynamic>))
      .toList();
}
```

---

## 実装メモ

- 入力が空 / 空白のみ → `400 validation_error`。UI 側でも 1 文字以上でのみ発火。
- デバウンス推奨（250–350ms）。`limit` を小さめ（10–15）にして体感を上げる。
- 結果カードは [items.md](./items.md) の詳細（`GET /v1/items/:id`）へ遷移。
