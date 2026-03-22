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

      // Get today's classes
      const classesSnap = await adminDb.collection('classes')
        .where('user_id', '==', userDoc.id)
        .get();

      const todaysClasses = classesSnap.docs
        .map(d => d.data())
        .filter(cls => cls.days?.some((d: string) => d.toUpperCase() === dayName.toUpperCase()))
        .sort((a, b) => {
          const tv = (t: string) => { const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i); if (!m) return 0; let h = parseInt(m[1]); if (m[3]?.toUpperCase() === 'PM' && h !== 12) h += 12; if (m[3]?.toUpperCase() === 'AM' && h === 12) h = 0; return h * 60 + parseInt(m[2]); };
          return tv(a.startTime || '') - tv(b.startTime || '');
        });

      let message: string;
      const name = (userData.name || 'there').split(' ')[0];

      if (todaysClasses.length === 0) {
        message = `Good morning ${name}! No classes today — rest up! 🌿`;
      } else {
        const first = todaysClasses[0];
        const commute = userData.morning_commute_mins || 30;
        // Calculate leave time
        const m = (first.startTime || '').match(/(\d+):(\d+)\s*(AM|PM)/i);
        let leaveStr = '';
        if (m) {
          let h = parseInt(m[1]), mn = parseInt(m[2]);
          if (m[3]?.toUpperCase() === 'PM' && h !== 12) h += 12;
          if (m[3]?.toUpperCase() === 'AM' && h === 12) h = 0;
          const totalMin = h * 60 + mn - commute;
          const lh = Math.floor(totalMin / 60), lm = totalMin % 60;
          leaveStr = `${lh > 12 ? lh - 12 : lh}:${String(lm).padStart(2, '0')} ${lh >= 12 ? 'PM' : 'AM'}`;
        }
        message = `Good morning ${name}! ${todaysClasses.length} classes today — leave by ${leaveStr}. First up: ${first.subject}.`;
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
