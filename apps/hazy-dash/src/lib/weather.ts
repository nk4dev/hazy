/** Open-Meteo (no API key): https://open-meteo.com/en/docs */

export type Place = { name: string; latitude: number; longitude: number };

export type Forecast = {
  current: { temperature: number; apparent: number; code: number; isDay: boolean; wind: number };
  hourly: { time: string; temperature: number; code: number; precipitation: number }[];
  daily: { date: string; max: number; min: number; code: number; precipitation: number }[];
};

export async function fetchForecast(place: Place, signal?: AbortSignal): Promise<Forecast> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(place.latitude));
  url.searchParams.set("longitude", String(place.longitude));
  url.searchParams.set(
    "current",
    "temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m"
  );
  url.searchParams.set("hourly", "temperature_2m,weather_code,precipitation_probability");
  url.searchParams.set(
    "daily",
    "temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max"
  );
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "7");

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const j = await res.json();

  // Next 12 hours from the current hour (hourly starts at local midnight).
  const nowHour = (j.current.time as string).slice(0, 13);
  const start = Math.max(
    0,
    (j.hourly.time as string[]).findIndex((t) => t.startsWith(nowHour))
  );

  return {
    current: {
      temperature: j.current.temperature_2m,
      apparent: j.current.apparent_temperature,
      code: j.current.weather_code,
      isDay: j.current.is_day === 1,
      wind: j.current.wind_speed_10m,
    },
    hourly: (j.hourly.time as string[]).slice(start, start + 12).map((time, i) => ({
      time,
      temperature: j.hourly.temperature_2m[start + i],
      code: j.hourly.weather_code[start + i],
      precipitation: j.hourly.precipitation_probability[start + i] ?? 0,
    })),
    daily: (j.daily.time as string[]).map((date, i) => ({
      date,
      max: j.daily.temperature_2m_max[i],
      min: j.daily.temperature_2m_min[i],
      code: j.daily.weather_code[i],
      precipitation: j.daily.precipitation_probability_max[i] ?? 0,
    })),
  };
}

export async function searchPlace(name: string, language: string): Promise<Place[]> {
  const places = await geocode(name, language);
  // The geocoder knows Japanese cities as "札幌市" and finds nothing for "札幌".
  if (places.length === 0 && /[\u3040-\u9fff]$/.test(name) && !/[市町村区都道府県]$/.test(name)) {
    return geocode(`${name}市`, language);
  }
  return places;
}

async function geocode(name: string, language: string): Promise<Place[]> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", name);
  url.searchParams.set("count", "5");
  url.searchParams.set("language", language);
  const res = await fetch(url);
  if (!res.ok) return [];
  const j = (await res.json()) as {
    results?: { name: string; admin1?: string; latitude: number; longitude: number }[];
  };
  return (j.results ?? []).map((r) => ({
    name: r.admin1 && r.admin1 !== r.name ? `${r.name}, ${r.admin1}` : r.name,
    latitude: r.latitude,
    longitude: r.longitude,
  }));
}

export type WeatherKind =
  | "clear"
  | "partly"
  | "cloudy"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "storm";

/** WMO weather interpretation codes, grouped for an icon + label. */
export function weatherKind(code: number): WeatherKind {
  if (code === 0 || code === 1) return "clear";
  if (code === 2) return "partly";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  return "cloudy";
}
