import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/firebase/auth";
import { adminDb } from "@/lib/firebase/firebaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const { uid, error } = await verifyAuthToken(req);
    if (!uid) return NextResponse.json({ error }, { status: 401 });

    const { code } = await req.json();
    if (!code || code.length !== 6) {
      return NextResponse.json({ error: "Invalid 6-digit code" }, { status: 400 });
    }

    const groupQuery = await adminDb.collection('batch_groups').where('code', '==', code.toUpperCase()).limit(1).get();
    
    if (groupQuery.empty) {
       return NextResponse.json({ error: "Batch not found or expired." }, { status: 404 });
    }

    const groupDoc = groupQuery.docs[0];
    const groupData = groupDoc.data();

    // Replicate classes to joining user
    const batch = adminDb.batch();
    const templateClasses = groupData.template_classes || [];
    
    for (const cls of templateClasses) {
       const newClsRef = adminDb.collection('classes').doc();
       batch.set(newClsRef, {
         ...cls,
         user_id: uid,
         imported_from: groupDoc.id,
         created_at: new Date()
       });
    }

    // Increment member count
    batch.update(groupDoc.ref, {
      member_count: (groupData.member_count || 1) + 1
    });

    await batch.commit();

    return NextResponse.json({ 
       success: true,
       imported_count: templateClasses.length,
       group_name: groupData.name
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
