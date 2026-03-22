// Open-Meteo — completely free, no API key, unlimited
// https://open-meteo.com/

export interface WeatherData {
  temp: number;          // °C
  feelsLike: number;     // °C
  rainChance: number;    // 0-100 %
  weatherCode: number;   // WMO code
  description: string;
  emoji: string;
  alert?: string;        // e.g. "Take an umbrella!"
}

// WMO Weather Codes → labels + emoji
function decodeWeather(code: number): { description: string; emoji: string } {
  if (code === 0)               return { description: 'Clear sky',         emoji: '☀️' };
  if (code <= 2)                return { description: 'Partly cloudy',     emoji: '⛅' };
  if (code === 3)               return { description: 'Overcast',          emoji: '☁️' };
  if (code <= 49)               return { description: 'Foggy',             emoji: '🌫️' };
  if (code <= 57)               return { description: 'Drizzle',           emoji: '🌦️' };
  if (code <= 67)               return { description: 'Rain',              emoji: '🌧️' };
  if (code <= 77)               return { description: 'Snow',              emoji: '❄️' };
  if (code <= 82)               return { description: 'Rain showers',      emoji: '🌦️' };
  if (code <= 86)               return { description: 'Snow showers',      emoji: '🌨️' };
  if (code <= 99)               return { description: 'Thunderstorm',      emoji: '⛈️' };
  return { description: 'Unknown', emoji: '🌡️' };
}

// Pune coordinates as default (can make configurable later)
const DEFAULT_LAT = 18.5204;
const DEFAULT_LON = 73.8567;

export async function fetchWeather(
  lat = DEFAULT_LAT,
  lon = DEFAULT_LON
): Promise<WeatherData | null> {
  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lon));
    url.searchParams.set('current', [
      'temperature_2m',
      'apparent_temperature',
      'weather_code',
      'precipitation_probability',
    ].join(','));
    url.searchParams.set('timezone', 'Asia/Kolkata');

    const res = await fetch(url.toString(), { next: { revalidate: 1800 } }); // cache 30 min
    if (!res.ok) return null;

    const json = await res.json();
    const c = json.current;

    const temp       = Math.round(c.temperature_2m);
    const feelsLike  = Math.round(c.apparent_temperature);
    const rainChance = c.precipitation_probability ?? 0;
    const code       = c.weather_code;

    const { description, emoji } = decodeWeather(code);

    let alert: string | undefined;
    if (rainChance >= 60) alert = '☔ Take an umbrella for your commute!';
    else if (temp >= 38)  alert = '🥵 Very hot today — stay hydrated!';
    else if (temp <= 15)  alert = '🧥 Carry a jacket today!';

    return { temp, feelsLike, rainChance, weatherCode: code, description, emoji, alert };
  } catch {
    return null;
  }
}
