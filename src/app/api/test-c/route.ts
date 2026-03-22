import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/firebaseAdmin';
import { getAuth } from 'firebase-admin/auth';
import { buildScheduleForUser } from '@/lib/scheduleGenerator';

export async function GET() {
  try {
    const auth = getAuth();
    let uid = null;
    try {
      const userRecord = await auth.getUserByEmail('testuser_phaseb@gmail.com');
      uid = userRecord.uid;
    } catch(e) {
      const snapshot = await adminDb.collection('users').limit(1).get();
      if (!snapshot.empty) {
        uid = snapshot.docs[0].id;
      }
    }

    if (!uid) {
      return NextResponse.json({ error: 'No user found' }, { status: 404 });
    }

    // Set some dummy preferences and classes for this user for Phase C test
    await adminDb.collection('users').doc(uid).set({
      wake_time: '06:00 AM',
      sleep_time: '11:00 PM',
      morning_commute_mins: 30,
      evening_commute_mins: 30,
      rush_hour_buffer: false,
      semester_weeks: 16
    }, { merge: true });

    // Clear existing classes
    const existingClasses = await adminDb.collection('classes').where('user_id', '==', uid).get();
    const batch = adminDb.batch();
    existingClasses.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    // Add mock classes
    const classesRef = adminDb.collection('classes');
    await classesRef.add({
      user_id: uid,
      subject: 'Physics',
      type: 'Theory',
      days: ['Monday'],
      startTime: '09:00 AM',
      endTime: '10:30 AM',
    });
    await classesRef.add({
      user_id: uid,
      subject: 'Maths Lab',
      type: 'Practical',
      days: ['Monday'],
      startTime: '11:15 AM',
      endTime: '01:15 PM',
    });

    const result = await buildScheduleForUser(uid);
    const formatted = result.map((b: any) => {
      return `[${b.date} | ${b.start_time} - ${b.end_time}] ${b.label} (${b.block_type})`;
    });

    return NextResponse.json({ success: true, user: uid, formatted: formatted, raw: result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}
