// ============================================================
// Smart Life Scheduler — Core Scheduling Engine
// Priority: Class > Travel > Meal > Study > Free
// ============================================================

export type BlockType = 'class' | 'travel' | 'meal' | 'study' | 'free' | 'sleep' | 'morning';

export interface ScheduleBlock {
  id: string;
  type: BlockType;
  classType?: 'Theory' | 'Practical'; // New field for class categorization
  batch?: string; // New field for batch mapping
  label: string;
  startMinute: number;   // minutes since midnight (0–1439)
  endMinute: number;
  durationMins: number;
  location?: string;
  instructor?: string;
  notes?: string;
  priority: number;       // lower = higher priority
}

export interface ExtractedClass {
  subject: string;
  type: 'Theory' | 'Practical';  // Added type
  batch: string;                 // Added batch string
  startTime: string;   // e.g. '09:00 AM'
  endTime: string;
  days: string[];
  room?: string;
  instructor?: string;
}

export interface UserPreferences {
  wakeTimeMinute: number;       // minutes since midnight (e.g. 480 = 8:00 AM)
  sleepTimeMinute: number;      // e.g. 1380 = 11:00 PM
  commuteMinutes: number;       // one-way commute in minutes
  breakfastMinute: number;      // not directly used — computed from wake time
  lunchMinute: number;          // default: 780 (1:00 PM)
  dinnerMinute: number;         // default: 1140 (7:00 PM)
  morningRoutineMins: number;   // light prep after waking (brush, freshen up) — 45 mins
  collegePrepMins: number;      // bath + iron + pack bag before leaving — 60 mins
}

export const DEFAULT_PREFS: UserPreferences = {
  wakeTimeMinute: 480,      // 8:00 AM
  sleepTimeMinute: 1380,    // 11:00 PM
  commuteMinutes: 45,
  breakfastMinute: 525,     // 8:45 AM (after morning routine)
  lunchMinute: 780,         // 1:00 PM
  dinnerMinute: 1140,       // 7:00 PM
  morningRoutineMins: 45,   // 45 min morning routine
  collegePrepMins: 60,      // 60 min bath+prep
};

// ------- Helpers -------

export function parseTime(timeStr: string): number {
  if (!timeStr) return -1;

  // Handle HH:MM:SS or HH:MM 24h
  const hhmm24 = timeStr.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (hhmm24) {
    return parseInt(hhmm24[1]) * 60 + parseInt(hhmm24[2]);
  }

  // Handle 12-hour format: 09:00 AM / 9:00AM / 9AM
  const ampm = timeStr.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (ampm) {
    let h = parseInt(ampm[1]);
    const m = parseInt(ampm[2] || '0');
    const meridiem = ampm[3].toUpperCase();
    if (meridiem === 'AM' && h === 12) h = 0;
    if (meridiem === 'PM' && h !== 12) h += 12;
    return h * 60 + m;
  }

  return -1;
}

export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m.toString().padStart(2, '0')} ${suffix}`;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_ALIASES: Record<string, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday',
  thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
};

function normDay(d: string): string {
  const clean = d.toLowerCase().trim().slice(0, 3);
  return DAY_ALIASES[clean] || d;
}

let _idCounter = 0;
function uid(prefix: string) {
  return `${prefix}-${++_idCounter}-${Math.random().toString(36).slice(2, 6)}`;
}

// ------- Main Generator (Realistic Backward-Anchoring) -------

export function generateDailySchedule(
  dayName: string,
  classes: ExtractedClass[],
  userPrefs: Partial<UserPreferences> = DEFAULT_PREFS
): ScheduleBlock[] {
  _idCounter = 0;
  const blocks: ScheduleBlock[] = [];

  // Merge provided prefs with defaults to prevent NaN from missing fields (morningRoutineMins, etc.)
  const prefs: UserPreferences = { ...DEFAULT_PREFS, ...userPrefs };

  // Filter to today's classes
  const todaysClasses = classes
    .filter(c => (c.days ?? []).some(d => normDay(d) === dayName || d === dayName))
    .map(c => ({ ...c, _start: parseTime(c.startTime), _end: parseTime(c.endTime) }))
    .filter(c => c._start >= 0 && c._end > c._start)
    .sort((a, b) => a._start - b._start);

  const hasClasses = todaysClasses.length > 0;
  const firstClassStart = hasClasses ? todaysClasses[0]._start : -1;
  const lastClassEnd    = hasClasses ? todaysClasses[todaysClasses.length - 1]._end : -1;

  // ── STEP 1: Anchor forward from wake time ──────────────────────────────────
  // Morning prep (washing face, light stretching, brushing) — 45 mins
  const morningRoutineEnd = prefs.wakeTimeMinute + prefs.morningRoutineMins;
  blocks.push({
    id: uid('morning'), type: 'morning',
    label: 'Morning Routine',
    startMinute: prefs.wakeTimeMinute,
    endMinute: morningRoutineEnd,
    durationMins: prefs.morningRoutineMins,
    notes: 'Wake up, freshen up, brush teeth',
    priority: 0,
  });

  // Breakfast & Coffee — 15–30 mins immediately after morning routine
  const bfStart = morningRoutineEnd;
  const bfEnd   = bfStart + 30;
  blocks.push({
    id: uid('meal'), type: 'meal',
    label: 'Breakfast & Coffee',
    startMinute: bfStart,
    endMinute: bfEnd,
    durationMins: 30,
    notes: 'Fuel up before study / college',
    priority: 3,
  });

  // ── STEP 2: Backward-anchor from first class ───────────────────────────────
  if (hasClasses && prefs.commuteMinutes > 0) {
    // Commute ends exactly when class starts
    const commuteEnd   = firstClassStart;
    const commuteStart = commuteEnd - prefs.commuteMinutes;

    // College Prep (Bath, iron shirt, pack bag) — anchored just before commute
    const prepEnd   = commuteStart;
    const prepStart = prepEnd - prefs.collegePrepMins;

    if (prepStart >= bfEnd) {
      // Enough time: add Study gap (if long enough) + College Prep + Commute
      const studyGapMins = prepStart - bfEnd;
      if (studyGapMins >= 20) {
        blocks.push({
          id: uid('study'), type: 'study',
          label: 'Pre-Class Study',
          startMinute: bfEnd,
          endMinute: prepStart,
          durationMins: studyGapMins,
          notes: 'Focus block before heading out',
          priority: 4,
        });
      }
      blocks.push({
        id: uid('morning'), type: 'morning',
        label: 'College Prep',
        startMinute: prepStart,
        endMinute: prepEnd,
        durationMins: prefs.collegePrepMins,
        notes: 'Bath, iron shirt, pack bag',
        priority: 1,
      });
      blocks.push({
        id: uid('travel'), type: 'travel',
        label: 'Commute → College',
        startMinute: commuteStart,
        endMinute: commuteEnd,
        durationMins: prefs.commuteMinutes,
        notes: 'Metro / transit to campus',
        priority: 1,
      });
    } else if (commuteStart >= bfEnd) {
      // Not enough time for College Prep, but Commute fits after breakfast
      // Show a short gap as free time, then Commute
      blocks.push({
        id: uid('travel'), type: 'travel',
        label: 'Commute → College',
        startMinute: commuteStart,
        endMinute: commuteEnd,
        durationMins: prefs.commuteMinutes,
        notes: 'Metro / transit to campus (quick start today)',
        priority: 1,
      });
    }
    // If even commute doesn't fit (class is very early), skip silently
  }

  // ── STEP 3: Add all classes ────────────────────────────────────────────────
  for (const cls of todaysClasses) {
    blocks.push({
      id: uid('class'), type: 'class',
      classType: cls.type,
      batch: cls.batch,
      label: cls.subject,
      startMinute: cls._start,
      endMinute: cls._end,
      durationMins: cls._end - cls._start,
      location: cls.room,
      instructor: cls.instructor,
      priority: 0,
    });
  }

  // ── STEP 4: Evening Commute back home (anchored to last class end) ─────────
  if (hasClasses && prefs.commuteMinutes > 0) {
    const returnStart = lastClassEnd;
    const returnEnd   = returnStart + prefs.commuteMinutes;
    blocks.push({
      id: uid('travel'), type: 'travel',
      label: 'Commute ← Home',
      startMinute: returnStart,
      endMinute: returnEnd,
      durationMins: prefs.commuteMinutes,
      notes: 'Metro / transit back home',
      priority: 1,
    });
  }

  // ── STEP 5: Dinner ────────────────────────────────────────────────────────
  const dinnerStart = hasClasses
    ? Math.max(prefs.dinnerMinute, lastClassEnd + prefs.commuteMinutes + 30)
    : prefs.dinnerMinute;
  blocks.push({
    id: uid('meal'), type: 'meal',
    label: 'Dinner',
    startMinute: dinnerStart,
    endMinute: dinnerStart + 45,
    durationMins: 45,
    priority: 3,
  });

  // Lunch (only if during college hours)
  if (hasClasses) {
    const lunchCandidate = prefs.lunchMinute;
    // Only add lunch if there is a reasonable gap in classes
    const lunchOverlaps = todaysClasses.some(c => c._start < lunchCandidate + 45 && c._end > lunchCandidate);
    if (!lunchOverlaps && lunchCandidate > firstClassStart && lunchCandidate < lastClassEnd) {
      blocks.push({
        id: uid('meal'), type: 'meal',
        label: 'Lunch',
        startMinute: lunchCandidate,
        endMinute: lunchCandidate + 45,
        durationMins: 45,
        priority: 3,
      });
    }
  }

  // ── STEP 6: Resolve conflicts and fill evening study gaps ──────────────────
  const fixed     = deduplicateAndResolve(blocks);
  const withStudy = fillGapsWithStudy(fixed, prefs);

  // ── STEP 7: Sleep ─────────────────────────────────────────────────────────
  withStudy.push({
    id: uid('sleep'), type: 'sleep',
    label: 'Sleep',
    startMinute: prefs.sleepTimeMinute,
    endMinute: prefs.sleepTimeMinute + 480,
    durationMins: 480,
    priority: 0,
  });

  return withStudy.sort((a, b) => a.startMinute - b.startMinute);
}


// ------- Conflict Resolution -------

function deduplicateAndResolve(blocks: ScheduleBlock[]): ScheduleBlock[] {
  // Sort by start time, then priority
  const sorted = [...blocks].sort((a, b) => a.startMinute - b.startMinute || a.priority - b.priority);
  const result: ScheduleBlock[] = [];

  for (const block of sorted) {
    const prev = result[result.length - 1];
    if (!prev || block.startMinute >= prev.endMinute) {
      result.push(block);
    } else {
      // Overlap: keep lower priority number (higher priority)
      if (block.priority < prev.priority) {
        result.pop();
        result.push(block);
      }
      // else skip the current conflicting lower-priority block
    }
  }

  return result;
}

// ------- Gap Filler -------

const STUDY_BLOCK_MAX = 120; // 2-hour max study session
const STUDY_BLOCK_MIN = 25;  // ignore tiny gaps under 25 min

function fillGapsWithStudy(blocks: ScheduleBlock[], prefs: UserPreferences): ScheduleBlock[] {
  const result = [...blocks];
  const gaps: { start: number; end: number }[] = [];

  // Find all gaps in the sorted block list within wakeTime..sleepTime
  const sorted = [...blocks].sort((a, b) => a.startMinute - b.startMinute);

  let cursor = prefs.wakeTimeMinute + 30; // after morning routine
  for (const b of sorted) {
    if (b.startMinute > cursor + STUDY_BLOCK_MIN) {
      gaps.push({ start: cursor, end: b.startMinute });
    }
    cursor = Math.max(cursor, b.endMinute);
  }
  // Gap between last block and sleep
  if (prefs.sleepTimeMinute > cursor + STUDY_BLOCK_MIN) {
    gaps.push({ start: cursor, end: prefs.sleepTimeMinute });
  }

  // Fill each gap with up to STUDY_BLOCK_MAX minute study blocks
  for (const gap of gaps) {
    let s = gap.start;
    while (s + STUDY_BLOCK_MIN <= gap.end) {
      const duration = Math.min(STUDY_BLOCK_MAX, gap.end - s);
      result.push({
        id: uid('study'),
        type: 'study',
        label: 'Study / Review',
        startMinute: s,
        endMinute: s + duration,
        durationMins: duration,
        notes: 'Self-directed study time',
        priority: 4,
      });
      s += duration;
      if (duration < STUDY_BLOCK_MAX) break; // filled to end of gap
    }
  }

  return result;
}

// ------- Week Generator -------

export function generateWeekSchedule(
  classes: ExtractedClass[],
  prefs: UserPreferences = DEFAULT_PREFS
): Record<string, ScheduleBlock[]> {
  const result: Record<string, ScheduleBlock[]> = {};
  for (const day of DAY_NAMES) {
    result[day] = generateDailySchedule(day, classes, prefs);
  }
  return result;
}
