import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/firebase/auth';
import { adminDb } from '@/lib/firebase/firebaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const { uid, error } = await verifyAuthToken(req);
    if (!uid) return NextResponse.json({ error }, { status: 401 });

    // Fetch all classes for this user
    const snapshot = await adminDb.collection('classes').where('user_id', '==', uid).get();
    const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

    // Deduplicate by key
    const seen = new Set<string>();
    const toDelete: string[] = [];
    const kept: string[] = [];

    for (const cls of docs) {
      const key = [
        cls.subject || '',
        (cls.days || []).sort().join(','),
        cls.startTime || '',
        cls.batch || 'All'
      ].join('|');

      if (seen.has(key)) {
        toDelete.push(cls.id);
      } else {
        seen.add(key);
        kept.push(cls.id);
      }
    }

    // Delete duplicates
    const batch = adminDb.batch();
    for (const id of toDelete) {
      batch.delete(adminDb.collection('classes').doc(id));
    }
    await batch.commit();

    return NextResponse.json({
      deleted: toDelete.length,
      kept: kept.length,
      message: `Removed ${toDelete.length} duplicate entries, kept ${kept.length} unique classes.`
    });
  } catch (error: any) {
    console.error('Dedup error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
