import { NextRequest, NextResponse } from "next/server";
import { validateToken } from "@/lib/auth/validateToken";
import { adminDb } from "@/lib/firebase/firebaseAdmin";

function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function POST(req: NextRequest) {
  try {
    const { uid, error, status } = await validateToken(req);
    if (error || !uid) return NextResponse.json({ error }, { status: status || 401 });

    const { name } = await req.json().catch(() => ({ name: 'My Batch' }));

    // Generate guaranteed unique 6-digit code
    let code = '';
    let isUnique = false;
    while (!isUnique) {
      code = generateCode();
      const snap = await adminDb.collection('batch_groups').where('code', '==', code).limit(1).get();
      if (snap.empty) isUnique = true;
    }

    // Get current user's timetable classes
    const classesSnap = await adminDb.collection('classes').where('user_id', '==', uid).get();
    const classData = classesSnap.docs.map(d => d.data());

    // Create the batch group
    const groupRef = adminDb.collection('batch_groups').doc();
    await groupRef.set({
      code,
      name,
      created_by: uid,
      created_at: new Date(),
      member_count: 1,
      template_classes: classData
    });

    const hostHeader = req.headers.get('host') || 'localhost:3000';
    const protocol = hostHeader.includes('localhost') ? 'http' : 'https';

    return NextResponse.json({ 
      code, 
      link: `${protocol}://${hostHeader}/join/${code}`,
      qr_data: `dayo://batch/${code}`
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
