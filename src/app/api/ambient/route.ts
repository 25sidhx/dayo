import { NextResponse } from 'next/server';
import { fetchWeather } from '@/lib/weather';
import { fetchDailyQuote } from '@/lib/quotes';
import { getTodayHoliday } from '@/lib/holidays';

// Fetch all 3 ambient data sources in one call to minimize client requests
export async function GET() {
  const [weather, quote, holiday] = await Promise.allSettled([
    fetchWeather(),
    fetchDailyQuote(),
    getTodayHoliday(),
  ]);

  return NextResponse.json({
    weather: weather.status === 'fulfilled' ? weather.value : null,
    quote:   quote.status   === 'fulfilled' ? quote.value   : null,
    holiday: holiday.status === 'fulfilled' ? holiday.value : null,
  }, {
    headers: { 'Cache-Control': 's-maxage=1800, stale-while-revalidate=3600' }
  });
}
