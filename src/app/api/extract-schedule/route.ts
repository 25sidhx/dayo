import { NextRequest, NextResponse } from 'next/server';
import { validateToken } from '@/lib/auth/validateToken';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { checkRateLimit } from '@/lib/rateLimit';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FIX 4 — SAFE JSON PARSER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function safeParseGeminiJSON(raw: string): any[] | null {
  try {
    // Remove markdown code blocks if present
    let cleaned = raw
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    // Find the first [ and last ] to extract just the array
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');

    if (start === -1 || end === -1) {
      console.error('No JSON array found in response');
      return null;
    }

    const jsonString = cleaned.slice(start, end + 1);
    const parsed = JSON.parse(jsonString);

    if (!Array.isArray(parsed)) {
      console.error('Parsed result is not an array');
      return null;
    }

    if (parsed.length === 0) {
      console.error('Parsed array is empty');
      return null;
    }

    return parsed;
  } catch (err: any) {
    console.error('JSON parse failed:', err.message);
    console.error('Raw response was:', raw?.substring(0, 500));
    return null;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UNIVERSAL TIMETABLE PARSER PROMPT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FIX 2 — NEW GEMINI PROMPT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const SYSTEM_PROMPT = `You are an expert at reading college timetable images from any Indian university, college, or institution. You can read timetables from engineering, medical, arts, commerce, law, pharmacy, nursing, architecture, or any other field.

YOUR ONLY JOB: Extract what you actually see in this image. Do not assume, do not guess, do not use any prior knowledge about subjects. Read ONLY what is written in the cells of this timetable.

UNIVERSAL RULES FOR READING ANY TIMETABLE:

STRUCTURE — Most Indian college timetables follow one of these layouts:
  Layout A: Days as ROWS, Times as COLUMNS (rows say MON/TUE/WED or Monday etc)
  Layout B: Times as ROWS, Days as COLUMNS (top row has day names)
  Layout C: Day-wise tables, one per day

Detect which layout this timetable uses before extracting anything.

READING EACH CELL:
  Take EXACTLY what is written in the cell as the subject name.
  Do not expand abbreviations unless a legend/key is visible in the same image.
  If a legend is visible, use it to expand.
  If no legend is visible, use the abbreviation exactly as written.

  Example: if cell says 'DBMS' — subject is 'DBMS' not 'Database Management Systems' (unless legend shows expansion)
  Example: if cell says 'Anatomy' — subject is 'Anatomy'
  Example: if cell says 'Contract Law' — subject is 'Contract Law'

SKIP THESE COMPLETELY:
  Any cell that says RECESS or BREAK
  Any cell that says LUNCH
  Any cell that says FREE or LIBRARY unless clearly a scheduled class
  Any cell with only a dash - or empty
  Header row with day names
  Header column with time labels

BATCH SPLITS:
  If a cell contains multiple subjects separated by / or | with group codes, create a separate entry for each group.
  Group codes can be: A/B, Batch1/Batch2, Div A/Div B, Gr1/Gr2, or any other format.

TYPE DETECTION:
  Mark as Practical if subject name contains: Lab, Practical, Prac, PR, Workshop, Tutorial, Clinic, Dissection, or similar
  Otherwise mark as Theory.

TIME FORMAT:
  Convert all times to 12-hour format with AM/PM.
  If time shows 08:00 -> 8:00 AM
  If time shows 14:00 -> 2:00 PM
  If time shows 9-10 -> 9:00 AM to 10:00 AM

RETURN FORMAT — JSON array only:
[
  {
    "subject": "exactly as written in cell",
    "type": "Theory or Practical",
    "startTime": "9:00 AM",
    "endTime": "10:00 AM",
    "days": ["Monday"],
    "room": "room if visible or empty string",
    "faculty": "faculty if visible or empty",
    "batch": "batch code or All",
    "uncertain": false
  }
]

CRITICAL RULES:
1. Only extract what you SEE in the image
2. Never add subjects from memory or prior knowledge
3. Never add Siddhant's subjects or any specific student's subjects
4. If you cannot read a cell clearly, set uncertain: true for that entry
5. Return empty array [] if the image is not a timetable at all
6. Return ONLY the JSON array. No markdown, no explanation, no text. Just the raw JSON starting with [`;

export async function POST(req: NextRequest) {
  try {
    // 1. Verify User Session
    const { uid, error, status } = await validateToken(req);
    if (error || !uid) return NextResponse.json({ error }, { status: status || 401 });

    const limiter = checkRateLimit(uid, 5, 3600);
    if (!limiter.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please wait before trying again.' }, { status: 429 });
    }

    // 2. Parse Request
    const { base64str } = await req.json();
    if (!base64str) return NextResponse.json({ error: "Missing image data" }, { status: 400 });

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // --- PASS 1 ---
    let pass1Result: any[] | null = null;
    try {
      const result1 = await model.generateContent([
        SYSTEM_PROMPT,
        { inlineData: { data: base64str, mimeType: "image/png" } }
      ]);
      const raw1 = result1.response.text();
      pass1Result = safeParseGeminiJSON(raw1);
    } catch (e: any) {
      console.error('Pass 1 Gemini call failed:', e.message);
    }

    // --- PASS 2 (Verification) ---
    let pass2Result: any[] | null = null;
    if (pass1Result && pass1Result.length > 0) {
      try {
        const stage2Prompt = `Here is a timetable image and what was extracted from it in a first pass:
${JSON.stringify(pass1Result)}

Look at the image again carefully and check:
1. Are there any classes that were missed?
2. Are any days wrong?
3. Are any times wrong?
4. Were any RECESS/BREAK cells included that should be removed?
5. Are there subjects from a specific student's timetable that were invented and are not actually in this image? Remove any that are not in the image.

Return the corrected complete JSON array. Only return JSON. No text.`;

        const result2 = await model.generateContent([
          stage2Prompt,
          { inlineData: { data: base64str, mimeType: "image/png" } }
        ]);
        const raw2 = result2.response.text();
        pass2Result = safeParseGeminiJSON(raw2);
      } catch (e: any) {
        console.error('Pass 2 Gemini call failed:', e.message);
      }
    }

    // --- Determine final result ---
    let classes: any[] = [];
    let usedFallback = false;

    if (pass2Result && pass2Result.length > 0) {
      classes = pass2Result;
    } else if (pass1Result && pass1Result.length > 0) {
      classes = pass1Result;
    }

    // Post-processing
    classes = classes.map((c: any) => ({
      ...c,
      batch: c.batch || 'All',
      room: c.room || '',
      faculty: c.faculty || '',
      uncertain: c.uncertain !== undefined ? c.uncertain : false
    }));

    return NextResponse.json({ classes, usedFallback });

  } catch (error: any) {
    console.error('Extraction Error:', error);
    // Explicitly return an empty array if completely failed 
    // so the frontend triggers the Manual Entry form.
    return NextResponse.json({ 
      classes: [], 
      usedFallback: false 
    });
  }
}
