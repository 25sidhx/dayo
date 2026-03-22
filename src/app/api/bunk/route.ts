import { NextRequest, NextResponse } from 'next/server';
import { validateToken } from '@/lib/auth/validateToken';
import { adminDb } from '@/lib/firebase/firebaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const { uid, error, status: authStatus } = await validateToken(req);
    if (error || !uid) return NextResponse.json({ error }, { status: authStatus || 401 });

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

    // Count attended, bunked, cancelled
    const attSnap = await adminDb.collection('attendance')
      .where('user_id', '==', uid)
      .where('subject_name', '==', subjectName)
      .get();
      
    let bunked = 0;
    let cancelled = 0;
    
    attSnap.docs.forEach(doc => {
      const s = doc.data().status;
      if (s === 'bunked') bunked++;
      if (s === 'cancelled') cancelled++;
    });

    const effectiveTotal = Math.max(1, classesSoFar - cancelled);
    const effectiveAttended = Math.max(0, effectiveTotal - bunked);

    const currentPct = Math.round((effectiveAttended / effectiveTotal) * 100);
    const projectedPct = Math.round((effectiveAttended / (effectiveTotal + 1)) * 100);
    const safeBunks = Math.max(0, Math.floor(effectiveAttended - (effectiveTotal * 0.75)));
    const status = currentPct >= 80 ? 'safe' : currentPct >= 75 ? 'warning' : 'danger';

    if (action === 'confirm_bunk' || action === 'confirm_cancel') {
      const isBunked = action === 'confirm_bunk';
      const batch = adminDb.batch();

      // 1. Add attendance record
      const attRef = adminDb.collection('attendance').doc();
      batch.set(attRef, {
        user_id: uid,
        subject_name: subjectName,
        date: date,
        status: isBunked ? 'bunked' : 'cancelled',
        logged_at: new Date()
      });

      // 2. Cascade schedule
      const blocksSnap = await adminDb.collection('schedule_blocks')
        .where('user_id', '==', uid)
        .where('date', '==', date)
        .where('subject_name', '==', subjectName)
        .where('block_type', '==', 'class')
        .get();

      blocksSnap.docs.forEach(blockDoc => {
        batch.update(blockDoc.ref, { 
          is_bunked: isBunked,
          is_cancelled: !isBunked 
        });

        const data = blockDoc.data();
        const newFreeRef = adminDb.collection('schedule_blocks').doc();
        batch.set(newFreeRef, {
          user_id: uid,
          date: date,
          block_type: 'free',
          label: 'Free Time',
          start_time: data.start_time,
          end_time: data.end_time,
          color: '#E5E7EB',
          icon: 'free',
          is_bunked: false,
          is_cancelled: false
        });
      });

      // Phase E: "delete travel block" if this was the only/last class today
      if (isBunked) {
        const allClassBlocksSnap = await adminDb.collection('schedule_blocks')
          .where('user_id', '==', uid)
          .where('date', '==', date)
          .where('block_type', '==', 'class')
          .get();
          
        const areAllClassesNowBunked = allClassBlocksSnap.docs.every(d => {
          if (d.data().subject_name === subjectName) return true; // Just bunked
          if (d.data().is_bunked) return true; // Already bunked
          return false;
        });

        if (areAllClassesNowBunked) {
           const commuteBlocksSnap = await adminDb.collection('schedule_blocks')
             .where('user_id', '==', uid)
             .where('date', '==', date)
             .where('block_type', 'in', ['travel', 'prep'])
             .get();
             
           commuteBlocksSnap.docs.forEach(doc => {
             batch.update(doc.ref, { 
               block_type: 'free', 
               label: 'Free Time', 
               icon: 'free', 
               color: '#E5E7EB' 
             });
           });
        }
      }

      await batch.commit();

      return NextResponse.json({
        success: true, currentPct, projectedPct, safeBunks, status,
        message: isBunked
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
