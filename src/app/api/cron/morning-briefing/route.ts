import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/firebaseAdmin';

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const usersSnap = await adminDb.collection('users').get();
    const today = new Date();
    const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
    let sent = 0;

    for (const userDoc of usersSnap.docs) {
      const userData = userDoc.data();
      if (!userData.onesignal_player_id) continue;

      // Get today's blocks
      const dateStr = today.toISOString().split('T')[0];
      const blocksSnap = await adminDb.collection('schedule_blocks')
        .where('user_id', '==', userDoc.id)
        .where('date', '==', dateStr)
        .get();

      const blocks = blocksSnap.docs.map(d => d.data());
      const classBlocks = blocks.filter(b => b.block_type === 'class').sort((a, b) => {
        const tv = (t: string) => { const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i); if (!m) return 0; let h = parseInt(m[1]); if (m[3]?.toUpperCase() === 'PM' && h !== 12) h += 12; if (m[3]?.toUpperCase() === 'AM' && h === 12) h = 0; return h * 60 + parseInt(m[2]); };
        return tv(a.start_time || '') - tv(b.start_time || '');
      });

      let message: string;
      const name = (userData.name || 'there').split(' ')[0];

      if (classBlocks.length === 0) {
        message = `Good morning ${name}! No classes today — enjoy your day off! 🌿`;
      } else {
        const first = classBlocks[0];
        const firstTravel = blocks.find(b => b.block_type === 'travel' && b.label === 'Travel to College');
        const leaveStr = firstTravel ? firstTravel.start_time : first.start_time;
        message = `Good morning ${name}! ${classBlocks.length} classes today — leave by ${leaveStr}. First up: ${first.label}.`;
      }

      // Send via OneSignal
      if (process.env.ONESIGNAL_REST_API_KEY && process.env.ONESIGNAL_APP_ID) {
        try {
          await fetch('https://onesignal.com/api/v1/notifications', {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${process.env.ONESIGNAL_REST_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              app_id: process.env.ONESIGNAL_APP_ID,
              include_player_ids: [userData.onesignal_player_id],
              headings: { en: 'Dayo 📅' },
              contents: { en: message },
              url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard`
            })
          });
          sent++;
        } catch (e) { console.error('OneSignal send error:', e); }
      }
    }

    return NextResponse.json({ sent, message: `Morning briefings sent to ${sent} users.` });
  } catch (error: any) {
    console.error('Cron error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
