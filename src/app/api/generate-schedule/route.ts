import { NextRequest, NextResponse } from 'next/server';
import { validateToken } from '@/lib/auth/validateToken';
import { buildScheduleForUser } from '@/lib/scheduleGenerator';

export async function POST(req: NextRequest) {
  try {
    const { uid, error, status } = await validateToken(req);
    if (error || !uid) return NextResponse.json({ error }, { status: status || 401 });

    const allBlocks = await buildScheduleForUser(uid);

    return NextResponse.json({
      success: true,
      message: 'Schedule generated for 7 days',
      totalBlocks: allBlocks.length
    });

  } catch (error: any) {
    console.error("Generation Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
