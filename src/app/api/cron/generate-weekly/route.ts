import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/firebaseAdmin';
import { buildScheduleForUser } from '@/lib/scheduleGenerator';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      // return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      // Uncomment in prod once CRON_SECRET is set
    }

    const usersSnapshot = await adminDb.collection('users').get();
    let successCount = 0;
    let failCount = 0;

    const uids = usersSnapshot.docs.map(d => d.id);

    // Run sequentially to avoid rate limits/OOM if dataset is small
    for (const uid of uids) {
      try {
        await buildScheduleForUser(uid);
        successCount++;
      } catch (e) {
         console.warn(`Failed to generate weekly schedule for ${uid}:`, e);
         failCount++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Weekly schedule generation dispatched',
      successCount,
      failCount
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
