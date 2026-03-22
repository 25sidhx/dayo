import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/firebase/auth';
import { adminDb } from '@/lib/firebase/firebaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const { uid, error } = await verifyAuthToken(req);
    if (!uid) return NextResponse.json({ error }, { status: 401 });

    const { subjectName, date, action } = await req.json();
    if (!subjectName || !date || !action) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    // Get user preferences
    const userDoc = await adminDb.collection('users').doc(uid).get();
    const userData = userDoc.data() || {};
    const semesterWeeks = userData.semester_weeks || 20;

    // Count weekly occurrences of this subject
    const classesSnap = await adminDb.collection('classes')
      .where('user_id', '==', uid)
      .where('subject', '==', subjectName)
      .get();

    const allDays = new Set<string>();
    classesSnap.docs.forEach(d => {
      const days = d.data().days || [];
      days.forEach((day: string) => allDays.add(day));
    });
    const weeklyCount = Math.max(allDays.size, 1);

    // Calculate weeks elapsed
    const semesterStart = userData.semester_start_date
      ? new Date(userData.semester_start_date)
      : new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000);
    const weeksElapsed = Math.max(1, Math.round(
      (Date.now() - semesterStart.getTime()) / (7 * 24 * 60 * 60 * 1000)
    ));
    const classesSoFar = weeksElapsed * weeklyCount;

    // Count attended + bunked
    const attSnap = await adminDb.collection('attendance')
      .where('user_id', '==', uid)
      .where('subject_name', '==', subjectName)
      .where('status', '==', 'attended')
      .get();
    const attended = attSnap.size;

    const bunkSnap = await adminDb.collection('attendance')
      .where('user_id', '==', uid)
      .where('subject_name', '==', subjectName)
      .where('status', '==', 'bunked')
      .get();
    const bunked = bunkSnap.size;

    const totalRecords = attended + bunked;
    const effectiveAttended = totalRecords > 0 ? attended : classesSoFar;
    const effectiveTotal = totalRecords > 0 ? totalRecords : classesSoFar;

    const currentPct = effectiveTotal > 0 ? Math.round((effectiveAttended / effectiveTotal) * 100) : 100;
    const projectedPct = Math.round((effectiveAttended / (effectiveTotal + 1)) * 100);
    const safeBunks = Math.max(0, Math.floor(effectiveAttended - (effectiveTotal * 0.75)));
    const status = currentPct >= 80 ? 'safe' : currentPct >= 75 ? 'warning' : 'danger';

    if (action === 'confirm_bunk' || action === 'confirm_cancel') {
      await adminDb.collection('attendance').add({
        user_id: uid,
        subject_name: subjectName,
        date: date,
        status: action === 'confirm_bunk' ? 'bunked' : 'cancelled',
        logged_at: new Date()
      });
      return NextResponse.json({
        success: true, currentPct, projectedPct, safeBunks, status,
        message: action === 'confirm_bunk'
          ? `Bunked ✓ — ${subjectName} removed for today`
          : `Marked as cancelled — no attendance penalty`
      });
    }

    return NextResponse.json({
      currentPct, projectedPct, safeBunks, status,
      attended: effectiveAttended, total: effectiveTotal, weeklyCount, weeksElapsed
    });
  } catch (error: any) {
    console.error('Bunk error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
