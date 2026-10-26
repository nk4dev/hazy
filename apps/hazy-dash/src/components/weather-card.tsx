"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  LocateFixed,
  MapPin,
  Moon,
  Sun,
  Wind,
} from "lucide-react";
import { useState } from "react";
import { useDash } from "@/components/dash-provider";
import {
  fetchForecast,
  type Place,
  searchPlace,
  type WeatherKind,
  weatherKind,
} from "@/lib/weather";

const PLACE_KEY = "hazy-dash:place";
const DEFAULT_PLACE: Place = { name: "Tokyo", latitude: 35.6895, longitude: 139.6917 };

const ICONS: Record<WeatherKind, typeof Sun> = {
  clear: Sun,
  partly: CloudSun,
  cloudy: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning,
};

function WeatherIcon({
  code,
  isDay = true,
  className,
}: {
  code: number;
  isDay?: boolean;
  className?: string;
}) {
  const kind = weatherKind(code);
  const Icon = kind === "clear" && !isDay ? Moon : ICONS[kind];
  return <Icon className={className} />;
}

function loadPlace(): Place {
  try {
    const raw = localStorage.getItem(PLACE_KEY);
    return raw ? (JSON.parse(raw) as Place) : DEFAULT_PLACE;
  } catch {
    return DEFAULT_PLACE;
  }
}

export function WeatherCard() {
  const { t, locale } = useDash();
  const [place, setPlace] = useState<Place>(loadPlace);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);

  const forecast = useQuery({
    queryKey: ["weather", place.latitude, place.longitude],
    queryFn: ({ signal }) => fetchForecast(place, signal),
    staleTime: 15 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
  });

  function choose(next: Place) {
    setPlace(next);
    setEditing(false);
    setResults([]);
    setQuery("");
    try {
      localStorage.setItem(PLACE_KEY, JSON.stringify(next));
    } catch {}
  }

  function locate() {
    navigator.geolocation?.getCurrentPosition(
      (pos) =>
        choose({
          name: locale === "ja" ? "現在地" : "Current location",
          latitude: Number(pos.coords.latitude.toFixed(3)),
          longitude: Number(pos.coords.longitude.toFixed(3)),
        }),
      () => setEditing(true),
      { timeout: 10000 }
    );
  }

  const time = (iso: string) => `${Number(iso.slice(11, 13))}${locale === "ja" ? "時" : ""}`;
  const day = (iso: string) =>
    new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(`${iso}T12:00`));

  return (
    <section className="hz-surface flex min-w-0 flex-col gap-4 p-5">
      <div className="flex items-center gap-2">
        <h2 className="hz-eyebrow flex-1">{t.weather}</h2>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <MapPin className="size-3.5" />
          {place.name}
        </button>
      </div>

      {editing && (
        <div className="flex flex-col gap-2">
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (query.trim()) setResults(await searchPlace(query.trim(), locale));
            }}
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.placeSearch}
              className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-[16px] outline-none focus-visible:border-ring sm:text-sm"
            />
            <button
              type="button"
              onClick={locate}
              aria-label={t.locate}
              className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-input text-muted-foreground hover:text-foreground"
            >
              <LocateFixed className="size-4" />
            </button>
          </form>
          {results.map((r) => (
            <button
              key={`${r.latitude},${r.longitude}`}
              type="button"
              onClick={() => choose(r)}
              className="hz-interactive rounded-lg px-3 py-2 text-left text-sm"
            >
              {r.name}
            </button>
          ))}
        </div>
      )}

      {forecast.isError && <p className="text-sm text-muted-foreground">{t.weatherError}</p>}
      {forecast.isLoading && <div className="h-40 animate-pulse rounded-lg bg-secondary/60" />}

      {forecast.data && (
        <>
          <div className="flex items-center gap-4">
            <WeatherIcon
              code={forecast.data.current.code}
              isDay={forecast.data.current.isDay}
              className="size-12 text-primary"
            />
            <div className="flex flex-col">
              <span className="text-4xl font-medium tracking-tight">
                {Math.round(forecast.data.current.temperature)}°
              </span>
              <span className="text-sm text-muted-foreground">
                {t.weatherKind[weatherKind(forecast.data.current.code)]}
              </span>
            </div>
            <div className="ml-auto flex flex-col items-end gap-1 text-xs text-muted-foreground">
              <span>
                {t.feelsLike} {Math.round(forecast.data.current.apparent)}°
              </span>
              <span className="flex items-center gap-1">
                <Wind className="size-3" />
                {Math.round(forecast.data.current.wind)} km/h
              </span>
            </div>
          </div>

          <div className="-mx-1 flex gap-1 overflow-x-auto pb-1">
            {forecast.data.hourly.map((h) => (
              <div
                key={h.time}
                className="flex min-w-12 flex-col items-center gap-1 rounded-lg px-1 py-2 text-xs"
              >
                <span className="text-muted-foreground">{time(h.time)}</span>
                <WeatherIcon code={h.code} className="size-4" />
                <span>{Math.round(h.temperature)}°</span>
                <span className="text-[10px] text-primary">{h.precipitation}%</span>
              </div>
            ))}
          </div>

          <ul className="flex flex-col divide-y divide-border/70">
            {forecast.data.daily.map((d, i) => (
              <li key={d.date} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-10 text-muted-foreground">
                  {i === 0 ? (locale === "ja" ? "今日" : "Today") : day(d.date)}
                </span>
                <WeatherIcon code={d.code} className="size-4" />
                <span className="w-10 text-xs text-primary">{d.precipitation}%</span>
                <span className="ml-auto tabular-nums">
                  <span className="text-muted-foreground">{Math.round(d.min)}°</span>
                  <span className="mx-1.5 text-muted-foreground/50">/</span>
                  {Math.round(d.max)}°
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
