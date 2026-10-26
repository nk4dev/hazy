import type { WeatherKind } from "./weather";

const en = {
  connectTitle: "Your Hazy, at a glance",
  connectBody:
    "Hazy Dash shows today's reading, recent saves and the weather on one screen. Connect it to your Hazy account to start.",
  connect: "Connect with Hazy",
  connecting: "Connecting…",
  denied: "Connection was cancelled.",
  stateError: "That connection link has expired. Try again.",
  exchangeError: "Couldn't finish connecting. Try again.",
  disconnect: "Disconnect",
  disconnectHint: "To revoke access completely, open Settings → Connected apps in Hazy.",
  greetingMorning: "Good morning",
  greetingDay: "Good afternoon",
  greetingEvening: "Good evening",
  weather: "Weather",
  feelsLike: "Feels like",
  wind: "Wind",
  locate: "Use my location",
  placeSearch: "Search a city",
  weatherError: "Couldn't load the weather.",
  quickSave: "Save a link",
  paste: "Paste",
  save: "Save",
  saved: "Saved",
  saveError: "Couldn't save that link.",
  clipboardEmpty: "No link on the clipboard.",
  todaysThree: "Today's three",
  minutes: (n: number) => `${n} min`,
  markRead: "Mark as read",
  nothingQueued: "Nothing waiting. Enjoy the quiet.",
  recent: "Recently saved",
  week: "This week",
  readSaved: (read: number, saved: number) => `${read} read · ${saved} saved`,
  ask: "Ask your library",
  askPlaceholder: "What did I save about…",
  askSubmit: "Ask",
  sources: "Sources",
  openInHazy: "Open Hazy",
  loadError: "Couldn't load this.",
  weatherKind: {
    clear: "Clear",
    partly: "Partly cloudy",
    cloudy: "Cloudy",
    fog: "Fog",
    drizzle: "Drizzle",
    rain: "Rain",
    snow: "Snow",
    storm: "Thunderstorm",
  } satisfies Record<WeatherKind, string>,
};

const ja: typeof en = {
  connectTitle: "Hazyを、ひと目で",
  connectBody:
    "Hazy Dash は今日読むもの、最近の保存、天気を1画面にまとめます。はじめにHazyのアカウントと連携してください。",
  connect: "Hazyと連携",
  connecting: "連携しています…",
  denied: "連携がキャンセルされました。",
  stateError: "連携リンクの有効期限が切れました。もう一度お試しください。",
  exchangeError: "連携を完了できませんでした。もう一度お試しください。",
  disconnect: "連携を外す",
  disconnectHint: "アクセスを完全に取り消すには、Hazyの 設定 → 連携アプリ から解除してください。",
  greetingMorning: "おはようございます",
  greetingDay: "こんにちは",
  greetingEvening: "こんばんは",
  weather: "天気",
  feelsLike: "体感",
  wind: "風速",
  locate: "現在地を使う",
  placeSearch: "都市を検索",
  weatherError: "天気を読み込めませんでした。",
  quickSave: "リンクを保存",
  paste: "貼り付け",
  save: "保存",
  saved: "保存しました",
  saveError: "リンクを保存できませんでした。",
  clipboardEmpty: "クリップボードにリンクがありません。",
  todaysThree: "今日の3本",
  minutes: (n: number) => `${n}分`,
  markRead: "読んだ",
  nothingQueued: "読むものはありません。ひと休みしましょう。",
  recent: "最近の保存",
  week: "この一週間",
  readSaved: (read: number, saved: number) => `${read}件既読・${saved}件保存`,
  ask: "ライブラリに質問",
  askPlaceholder: "保存したものについて聞いてみましょう…",
  askSubmit: "質問",
  sources: "出典",
  openInHazy: "Hazyを開く",
  loadError: "読み込めませんでした。",
  weatherKind: {
    clear: "晴れ",
    partly: "晴れ時々くもり",
    cloudy: "くもり",
    fog: "霧",
    drizzle: "霧雨",
    rain: "雨",
    snow: "雪",
    storm: "雷雨",
  },
};

export type Strings = typeof en;
export type Locale = "en" | "ja";

export function strings(locale: Locale): Strings {
  return locale === "ja" ? ja : en;
}

export function detectLocale(): Locale {
  return typeof navigator !== "undefined" && navigator.language.startsWith("ja") ? "ja" : "en";
}
