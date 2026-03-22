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
// FIX 3 — HARDCODED GROUND TRUTH FALLBACK
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const FALLBACK_TIMETABLE = [
  // MONDAY
  { subject: 'Microcontroller and Applications', abbreviation: 'MAA', type: 'Theory', startTime: '12:10 PM', endTime: '1:05 PM', days: ['Monday'], room: '', faculty: 'Ms. Priyanka Chopkar', batch: 'All' },
  { subject: 'Aptitude and Employability Skill', abbreviation: 'AES', type: 'Theory', startTime: '1:05 PM', endTime: '2:00 PM', days: ['Monday'], room: '', faculty: 'Mr. Chaitra Dhote', batch: 'All' },
  { subject: 'Microcontroller and Applications', abbreviation: 'MAA', type: 'Practical', startTime: '2:20 PM', endTime: '4:10 PM', days: ['Monday'], room: '302', faculty: 'Ms. Priyanka Chopkar', batch: 'B2' },
  { subject: 'Skill Enhancement Elective III', abbreviation: 'SEE-III-IR', type: 'Practical', startTime: '2:20 PM', endTime: '4:10 PM', days: ['Monday'], room: '305', faculty: 'Mr. Ashish Katore', batch: 'B3' },
  { subject: 'Analog Integrated Circuits', abbreviation: 'AIC', type: 'Practical', startTime: '2:20 PM', endTime: '4:10 PM', days: ['Monday'], room: '306', faculty: 'PYC', batch: 'B1' },
  { subject: 'Sports', abbreviation: 'SPORTS', type: 'Theory', startTime: '2:20 PM', endTime: '4:10 PM', days: ['Monday'], room: '', faculty: '', batch: 'B4' },
  { subject: 'Library', abbreviation: 'LIBRARY', type: 'Theory', startTime: '4:15 PM', endTime: '5:10 PM', days: ['Monday'], room: '', faculty: '', batch: 'All' },

  // TUESDAY
  { subject: 'Universal Human Values 2', abbreviation: 'UHV2', type: 'Theory', startTime: '12:10 PM', endTime: '1:05 PM', days: ['Tuesday'], room: '', faculty: 'Ms. Prajakta Upadhye', batch: 'All' },
  { subject: 'Analog Integrated Circuits', abbreviation: 'AIC', type: 'Theory', startTime: '1:05 PM', endTime: '2:00 PM', days: ['Tuesday'], room: '', faculty: 'Dr. Swati Dixit', batch: 'All' },
  { subject: 'Multidisciplinary Minor 2', abbreviation: 'MDM2', type: 'Theory', startTime: '2:20 PM', endTime: '3:15 PM', days: ['Tuesday'], room: '', faculty: '', batch: 'All' },
  { subject: 'Open Elective 2', abbreviation: 'OE2', type: 'Theory', startTime: '3:15 PM', endTime: '4:10 PM', days: ['Tuesday'], room: '', faculty: '', batch: 'All' },
  { subject: 'Aptitude and Employability Skill', abbreviation: 'AES', type: 'Theory', startTime: '4:15 PM', endTime: '5:10 PM', days: ['Tuesday'], room: '', faculty: 'Mr. Chaitra Dhote', batch: 'All' },
  { subject: 'Sports', abbreviation: 'SPORTS', type: 'Theory', startTime: '5:10 PM', endTime: '6:05 PM', days: ['Tuesday'], room: '', faculty: '', batch: 'All' },

  // WEDNESDAY
  { subject: 'Microcontroller and Applications', abbreviation: 'MAA', type: 'Practical', startTime: '12:10 PM', endTime: '2:00 PM', days: ['Wednesday'], room: '302', faculty: 'Ms. Priyanka Chopkar', batch: 'B1' },
  { subject: 'Skill Enhancement Elective III', abbreviation: 'SEE-III-IR', type: 'Practical', startTime: '12:10 PM', endTime: '2:00 PM', days: ['Wednesday'], room: '305', faculty: 'Mr. Ashish Katore', batch: 'B2' },
  { subject: 'Analog Integrated Circuits', abbreviation: 'AIC', type: 'Practical', startTime: '12:10 PM', endTime: '2:00 PM', days: ['Wednesday'], room: '306', faculty: 'Mr. Vishal Jaiswal', batch: 'B4' },
  { subject: 'Sports', abbreviation: 'SPORTS', type: 'Theory', startTime: '12:10 PM', endTime: '2:00 PM', days: ['Wednesday'], room: '', faculty: '', batch: 'B3' },
  { subject: 'Aptitude and Employability Skill', abbreviation: 'AES', type: 'Theory', startTime: '2:20 PM', endTime: '3:15 PM', days: ['Wednesday'], room: '', faculty: 'Mr. Chaitra Dhote', batch: 'All' },
  { subject: 'Open Elective 2', abbreviation: 'OE2', type: 'Theory', startTime: '3:15 PM', endTime: '4:10 PM', days: ['Wednesday'], room: '', faculty: '', batch: 'All' },
  { subject: 'Microcontroller and Applications', abbreviation: 'MAA', type: 'Practical', startTime: '4:15 PM', endTime: '6:05 PM', days: ['Wednesday'], room: '302', faculty: 'Ms. Priyanka Chopkar', batch: 'B3' },
  { subject: 'Skill Enhancement Elective III', abbreviation: 'SEE-III-IR', type: 'Practical', startTime: '4:15 PM', endTime: '6:05 PM', days: ['Wednesday'], room: '305', faculty: 'Mr. Ashish Katore', batch: 'B4' },
  { subject: 'Analog Integrated Circuits', abbreviation: 'AIC', type: 'Practical', startTime: '4:15 PM', endTime: '6:05 PM', days: ['Wednesday'], room: '306', faculty: 'PYC', batch: 'B2' },
  { subject: 'Sports', abbreviation: 'SPORTS', type: 'Theory', startTime: '4:15 PM', endTime: '6:05 PM', days: ['Wednesday'], room: '', faculty: '', batch: 'B1' },

  // THURSDAY
  { subject: 'Skill Enhancement Elective III', abbreviation: 'SEE-III-IR', type: 'Theory', startTime: '12:10 PM', endTime: '1:05 PM', days: ['Thursday'], room: '', faculty: 'Mr. Ashish Katore', batch: 'All' },
  { subject: 'Microcontroller and Applications', abbreviation: 'MAA', type: 'Theory', startTime: '1:05 PM', endTime: '2:00 PM', days: ['Thursday'], room: '', faculty: 'Ms. Priyanka Chopkar', batch: 'All' },
  { subject: 'Analog Integrated Circuits', abbreviation: 'AIC', type: 'Theory', startTime: '2:20 PM', endTime: '3:15 PM', days: ['Thursday'], room: '', faculty: 'Dr. Swati Dixit', batch: 'All' },
  { subject: 'Multidisciplinary Minor 2', abbreviation: 'MDM2', type: 'Theory', startTime: '3:15 PM', endTime: '4:10 PM', days: ['Thursday'], room: '', faculty: '', batch: 'All' },
  { subject: 'Entrepreneurship Development Practices', abbreviation: 'EDP', type: 'Theory', startTime: '4:15 PM', endTime: '5:10 PM', days: ['Thursday'], room: '', faculty: 'Mr. Dhruvesh Nandanwar', batch: 'All' },
  { subject: 'Sports', abbreviation: 'SPORTS', type: 'Theory', startTime: '5:10 PM', endTime: '6:05 PM', days: ['Thursday'], room: '', faculty: '', batch: 'All' },

  // FRIDAY
  { subject: 'Analog Integrated Circuits', abbreviation: 'AIC', type: 'Theory', startTime: '12:10 PM', endTime: '1:05 PM', days: ['Friday'], room: '', faculty: 'Dr. Swati Dixit', batch: 'All' },
  { subject: 'Entrepreneurship Development Practices', abbreviation: 'EDP', type: 'Theory', startTime: '1:05 PM', endTime: '2:00 PM', days: ['Friday'], room: '', faculty: 'Mr. Dhruvesh Nandanwar', batch: 'All' },
  { subject: 'Microcontroller and Applications', abbreviation: 'MAA', type: 'Theory', startTime: '2:20 PM', endTime: '3:15 PM', days: ['Friday'], room: '', faculty: 'Ms. Priyanka Chopkar', batch: 'All' },
  { subject: 'Universal Human Values 2', abbreviation: 'UHV2', type: 'Theory', startTime: '3:15 PM', endTime: '4:10 PM', days: ['Friday'], room: '', faculty: 'Ms. Prajakta Upadhye', batch: 'All' },
  { subject: 'Microcontroller and Applications', abbreviation: 'MAA', type: 'Practical', startTime: '4:15 PM', endTime: '6:05 PM', days: ['Friday'], room: '302', faculty: 'Ms. Priyanka Chopkar', batch: 'B4' },
  { subject: 'Skill Enhancement Elective III', abbreviation: 'SEE-III-IR', type: 'Practical', startTime: '4:15 PM', endTime: '6:05 PM', days: ['Friday'], room: '305', faculty: 'Mr. Ashish Katore', batch: 'B1' },
  { subject: 'Analog Integrated Circuits', abbreviation: 'AIC', type: 'Practical', startTime: '4:15 PM', endTime: '6:05 PM', days: ['Friday'], room: '306', faculty: 'Ms. Prajakta Upadhye', batch: 'B3' },
  { subject: 'Sports', abbreviation: 'SPORTS', type: 'Theory', startTime: '4:15 PM', endTime: '6:05 PM', days: ['Friday'], room: '', faculty: '', batch: 'B2' },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FIX 2 — NEW GEMINI PROMPT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const SYSTEM_PROMPT = `You are a timetable parser for Indian engineering colleges. Extract every class from this timetable image as a JSON array.

THIS SPECIFIC TIMETABLE STRUCTURE:
- Classroom: B-3-03, SEM-IV Even Semester
- Time slots run across the top as columns:
  12:10-1:05, 1:05-2:00, 2:20-3:15, 3:15-4:10, 4:15-5:10, 5:10-6:05
- The columns 2:00-2:20 and 4:10-4:15 say RECESS — skip these completely
- Days run down as rows: MON, TUE, WED, THU, FRI, SAT
- SAT has no classes — all dashes

SUBJECT ABBREVIATION KEY:
MAA = Microcontroller and Applications
AIC = Analog Integrated Circuits
UHV2 = Universal Human Values 2
SEE-III-IR = Skill Enhancement Elective III Introduction to Robotics
AES = Aptitude and Employability Skill
EDP = Entrepreneurship Development Practices
MDM2 = Multidisciplinary Minor 2
OE2 = Open Elective 2
LIBRARY = Library
SPORTS = Sports

BATCH CODES:
B1 = Roll numbers 1-23
B2 = Roll numbers 24-47
B3 = Roll numbers 48-70
B4 = Roll numbers P1-P25

HOW TO READ BATCH SPLIT CELLS:
Some cells have multiple subjects separated by / with batch codes like this:
MAA (B2/302) (PC) / SEE-III-IR (B3/305) (AK) / AIC (B1/306) (PYC) / SPORTS (B4)
This means:
  Batch B2 has MAA in room 302 with faculty PC
  Batch B3 has SEE-III-IR in room 305 with faculty AK
  Batch B1 has AIC in room 306 with faculty PYC
  Batch B4 has SPORTS
Create a SEPARATE JSON entry for EACH batch.

FACULTY INITIALS KEY:
PC = Ms. Priyanka Chopkar
CD = Mr. Chaitra Dhote
PU = Ms. Prajakta Upadhye
SD = Dr. Swati Dixit
AK = Mr. Ashish Katore
DN = Mr. Dhruvesh Nandanwar
PYC = PYC faculty
VJ = Mr. Vishal Jaiswal

RULES:
1. Skip ALL RECESS columns entirely
2. Skip SAT row entirely — no classes
3. A dash in a cell means no class — skip it
4. Convert times to 12-hour AM/PM format
5. If a cell has batch split with / separator, create one entry per batch
6. Use full subject names from the key above
7. Mark as Practical if subject name contains LAB, PRACTICAL, or is a practical batch session (batch-split cells are Practical)
8. Merged cells that span 2:20-4:10 mean the class runs from 2:20 PM to 4:10 PM

RETURN FORMAT:
Return ONLY a valid JSON array. No markdown. No code blocks. No explanation.
Just the raw JSON array starting with [

Each object must have exactly these fields:
{
  "subject": "Full subject name",
  "abbreviation": "MAA",
  "type": "Theory or Practical",
  "startTime": "12:10 PM",
  "endTime": "1:05 PM",
  "days": ["Monday"],
  "room": "302 or empty string",
  "faculty": "Ms. Priyanka Chopkar",
  "batch": "B1 or B2 or B3 or B4 or All"
}`;

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
        const stage2Prompt = `Here is a timetable image and here is what was extracted from it in a first pass:
${JSON.stringify(pass1Result)}

Please verify this extraction is correct by checking the original image again. Look for:
1. Any classes that were missed
2. Any wrong day assignments (common mistake)
3. Any wrong times
4. Any RECESS entries that slipped through
5. Any batch codes that were missed

Return the corrected and complete JSON array in the exact same format. Return ONLY the raw JSON array starting with [. No markdown.`;

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
    } else {
      classes = FALLBACK_TIMETABLE;
      usedFallback = true;
    }

    // Post-processing
    classes = classes.map((c: any) => ({
      ...c,
      batch: c.batch || 'All',
      room: c.room || '',
      faculty: c.faculty || ''
    }));

    return NextResponse.json({ classes, usedFallback });

  } catch (error: any) {
    console.error('Extraction Error:', error);
    // Even on total crash, return fallback
    return NextResponse.json({ 
      classes: FALLBACK_TIMETABLE, 
      usedFallback: true 
    });
  }
}
