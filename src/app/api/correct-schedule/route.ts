import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/firebase/auth';
import { executeTextWithFallback } from '@/lib/aiProvider';

export async function POST(req: NextRequest) {
  try {
    const { uid, error } = await verifyAuthToken(req);
    if (!uid) return NextResponse.json({ error }, { status: 401 });

    const { classes, correction } = await req.json();
    if (!classes || !correction) return NextResponse.json({ error: "Missing data" }, { status: 400 });

    const prompt = `You are a strict data correction system for an Indian engineering college scheduled application.

HERE IS THE CURRENT TIMETABLE JSON:
${JSON.stringify(classes, null, 2)}

THE STUDENT HAS REQUESTED THIS MANUAL CORRECTION IN PLAIN ENGLISH:
"${correction}"

YOUR INSTRUCTIONS:
1. Parse the student's request carefully to understand what needs to be changed, added, or deleted.
2. Apply those extremely precise changes to the JSON structure provided.
3. Keep the exact same JSON array format and keys (subject, type, startTime, endTime, days, room). 
4. DO NOT change anything else unprompted.

Return ONLY the updated valid JSON array. No markdown, no conversational text, no explanations.`;

    const result = await executeTextWithFallback(prompt);
    const text = result.text;
    const cleanedJson = text.replace(/```json|```/gi, '').trim();
    
    const correctedClasses = JSON.parse(cleanedJson);

    return NextResponse.json({ classes: correctedClasses });

  } catch (error: any) {
    console.error('Correction Error:', error);
    return NextResponse.json({ error: error.message || "Failed to correct timetable" }, { status: 500 });
  }
}
