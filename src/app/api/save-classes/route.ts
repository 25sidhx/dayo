import { NextRequest, NextResponse } from 'next/server';
import { validateToken } from '@/lib/auth/validateToken';
import { adminDb } from '@/lib/firebase/firebaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const { uid, error, status } = await validateToken(req);
    if (error || !uid) return NextResponse.json({ error }, { status: status || 401 });

    const { classes } = await req.json();
    if (!classes || !Array.isArray(classes) || classes.length === 0) {
      return NextResponse.json({ error: 'No classes provided' }, { status: 400 });
    }

    // Validate each class
    const validClasses = classes.filter((cls: any) => {
      if (!cls.subject?.trim()) return false;
      if (!cls.startTime) return false;
      if (!cls.endTime) return false;
      if (!cls.days?.length) return false;
      return true;
    });

    if (validClasses.length === 0) {
      return NextResponse.json({ error: 'No valid classes after validation' }, { status: 400 });
    }

    // Delete existing classes
    const existing = await adminDb.collection('classes').where('user_id', '==', uid).get();
    const batch = adminDb.batch();
    existing.docs.forEach(d => batch.delete(d.ref));

    // Write new classes
    validClasses.forEach((cls: any) => {
      const ref = adminDb.collection('classes').doc();
      batch.set(ref, {
        ...cls,
        user_id: uid,
        created_at: new Date().toISOString(),
        source: 'manual'
      });
    });

    await batch.commit();

    return NextResponse.json({ success: true, count: validClasses.length });
  } catch (error: any) {
    console.error('Save classes error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
