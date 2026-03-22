import { NextResponse } from 'next/server';
import { searchFood } from '@/lib/food-search';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') ?? '';
  if (!q.trim()) return NextResponse.json({ results: [] });
  const results = await searchFood(q, 5);
  return NextResponse.json({ results });
}
