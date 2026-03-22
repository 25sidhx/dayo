// ============================================================
// iCal Generator — RFC5545 compliant .ics file builder
// Runs entirely in the browser. No API route needed.
//
// Bug fixes applied:
//  1. ONE morning commute + ONE evening commute per day (not per class)
//  2. UNTIL= semester end date instead of COUNT=31 (which means 31 weeks!)
//  3. TZID:Asia/Kolkata everywhere — IST is UTC+5:30, no DST
//  4. Client-side Blob download — no server involved
// ============================================================

import type { ExtractedClass, UserPreferences } from './scheduler';
import { parseTime } from './scheduler';

// ---- RFC5545 day abbreviations ----
const DAY_TO_BYDAY: Record<string, string> = {
  Sunday: 'SU', Monday: 'MO', Tuesday: 'TU',
  Wednesday: 'WE', Thursday: 'TH', Friday: 'FR', Saturday: 'SA',
};
const DAY_TO_JS: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2,
  Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
};
const DAY_ALIASES: Record<string, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday',
  thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
};

function normDay(d: string): string {
  return DAY_ALIASES[d.toLowerCase().trim().slice(0, 3)] ?? d;
}

// ---- Date/time formatting ----

// Format: YYYYMMDDTHHMMSS (local, with TZID so no Z suffix)
function toICalLocal(date: Date, hourMin: number): string {
  const h = Math.floor(hourMin / 60);
  const m = hourMin % 60;
  // Build date at the given time
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  const hh   = String(d.getHours()).padStart(2, '0');
  const mi   = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}${mm}${dd}T${hh}${mi}00`;
}

// UNTIL date: YYYYMMDD (all-day, end of semester)
function toICalDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm   = String(date.getMonth() + 1).padStart(2, '0');
  const dd   = String(date.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

// Find the first occurrence of a weekday ON OR AFTER a start date
function firstOccurrence(semesterStart: Date, targetDayOfWeek: number): Date {
  const d = new Date(semesterStart);
  d.setHours(0, 0, 0, 0);
  const diff = (targetDayOfWeek - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}

// Generate a stable UID for a recurring event
function makeUID(prefix: string, day: string, index: number): string {
  return `${prefix}-${day}-${index}@smart-life-scheduler.app`;
}

// Fold long lines per RFC5545 (max 75 chars, continue lines start with space)
function fold(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  chunks.push(line.slice(0, 75));
  let pos = 75;
  while (pos < line.length) {
    chunks.push(' ' + line.slice(pos, pos + 74));
    pos += 74;
  }
  return chunks.join('\r\n');
}

// ---- VTIMEZONE block for IST (Asia/Kolkata, UTC+5:30, no DST ever) ----
const VTIMEZONE_IST = `BEGIN:VTIMEZONE
TZID:Asia/Kolkata
BEGIN:STANDARD
DTSTART:19700101T000000
TZOFFSETFROM:+0530
TZOFFSETTO:+0530
TZNAME:IST
END:STANDARD
END:VTIMEZONE`;

// ---- Main export function ----

export interface ICalOptions {
  classes: ExtractedClass[];
  prefs: UserPreferences;
  semesterStart: Date;   // first day of semester
  semesterEnd: Date;     // last day of semester (UNTIL= date)
  calendarName?: string;
}

export function generateICalendar(opts: ICalOptions): string {
  const { classes, prefs, semesterStart, semesterEnd, calendarName = 'My Semester Schedule' } = opts;
  const untilStr = toICalDate(semesterEnd) + 'T235959Z'; // end of that day in UTC
  const lines: string[] = [];

  // ---- VCALENDAR header ----
  lines.push('BEGIN:VCALENDAR');
  lines.push('VERSION:2.0');
  lines.push('PRODID:-//Smart Life Scheduler//EN');
  lines.push('CALSCALE:GREGORIAN');
  lines.push('METHOD:PUBLISH');
  lines.push(fold(`X-WR-CALNAME:${calendarName}`));
  lines.push('X-WR-TIMEZONE:Asia/Kolkata');
  lines.push(VTIMEZONE_IST);

  // ---- Group classes by day ----
  // Build: dayName → classes sorted by start time
  const byDay: Record<string, Array<ExtractedClass & { startMin: number; endMin: number }>> = {};

  for (const cls of classes) {
    for (const rawDay of (cls.days ?? [])) {
      const day = normDay(rawDay);
      if (!DAY_TO_BYDAY[day]) continue;
      const startMin = parseTime(cls.startTime);
      const endMin   = parseTime(cls.endTime);
      if (startMin < 0 || endMin < 0 || endMin <= startMin) continue;
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push({ ...cls, startMin, endMin });
    }
  }

  // Sort each day's classes by start time
  for (const day of Object.keys(byDay)) {
    byDay[day].sort((a, b) => a.startMin - b.startMin);
  }

  let uidIndex = 0;

  // ---- Emit events per day ----
  for (const [day, dayClasses] of Object.entries(byDay)) {
    const byDay2 = DAY_TO_BYDAY[day];
    const firstDate = firstOccurrence(semesterStart, DAY_TO_JS[day]);
    const rrule = `RRULE:FREQ=WEEKLY;BYDAY=${byDay2};UNTIL=${untilStr}`;

    const firstClassStart = dayClasses[0].startMin;          // earliest class
    const lastClassEnd    = dayClasses[dayClasses.length - 1].endMin; // latest class end

    // FIX #1: ONE morning commute (before first class), ONE evening commute (after last class)
    if (prefs.commuteMinutes > 0) {
      const morningCommuteStart = firstClassStart - prefs.commuteMinutes;
      const eveningCommuteEnd   = lastClassEnd    + prefs.commuteMinutes;

      // Morning commute event
      lines.push('BEGIN:VEVENT');
      lines.push(fold(`UID:${makeUID('commute-am', day, uidIndex++)}`));
      lines.push(fold(`DTSTART;TZID=Asia/Kolkata:${toICalLocal(firstDate, morningCommuteStart)}`));
      lines.push(fold(`DTEND;TZID=Asia/Kolkata:${toICalLocal(firstDate, firstClassStart)}`));
      lines.push(fold(`SUMMARY:🚌 Commute to Campus`));
      lines.push(fold(`DESCRIPTION:Travel time before first class (${dayClasses[0].subject})`));
      lines.push(rrule);
      lines.push('END:VEVENT');

      // Evening commute event
      lines.push('BEGIN:VEVENT');
      lines.push(fold(`UID:${makeUID('commute-pm', day, uidIndex++)}`));
      lines.push(fold(`DTSTART;TZID=Asia/Kolkata:${toICalLocal(firstDate, lastClassEnd)}`));
      lines.push(fold(`DTEND;TZID=Asia/Kolkata:${toICalLocal(firstDate, eveningCommuteEnd)}`));
      lines.push(fold(`SUMMARY:🚌 Commute Home`));
      lines.push(fold(`DESCRIPTION:Travel home after last class (${dayClasses[dayClasses.length - 1].subject})`));
      lines.push(rrule);
      lines.push('END:VEVENT');
    }

    // Morning routine (on any day with classes)
    lines.push('BEGIN:VEVENT');
    lines.push(fold(`UID:${makeUID('morning', day, uidIndex++)}`));
    lines.push(fold(`DTSTART;TZID=Asia/Kolkata:${toICalLocal(firstDate, prefs.wakeTimeMinute)}`));
    lines.push(fold(`DTEND;TZID=Asia/Kolkata:${toICalLocal(firstDate, prefs.wakeTimeMinute + 30)}`));
    lines.push('SUMMARY:🌅 Morning Routine');
    lines.push(rrule);
    lines.push('END:VEVENT');

    // Each individual class
    for (const cls of dayClasses) {
      lines.push('BEGIN:VEVENT');
      lines.push(fold(`UID:${makeUID('class', day + cls.subject.replace(/\s/g, ''), uidIndex++)}`));
      lines.push(fold(`DTSTART;TZID=Asia/Kolkata:${toICalLocal(firstDate, cls.startMin)}`));
      lines.push(fold(`DTEND;TZID=Asia/Kolkata:${toICalLocal(firstDate, cls.endMin)}`));
      lines.push(fold(`SUMMARY:📚 ${cls.subject}`));

      if (cls.room)       lines.push(fold(`LOCATION:${cls.room}`));
      if (cls.instructor) lines.push(fold(`DESCRIPTION:Instructor: ${cls.instructor}`));

      // FIX #2: UNTIL= instead of COUNT= (COUNT=31 would mean 31 *weeks* / ~7 months!)
      lines.push(rrule);
      lines.push('END:VEVENT');
    }
  }

  lines.push('END:VCALENDAR');

  // Join with CRLF as required by RFC5545
  return lines.join('\r\n');
}

// ---- FIX #4: Client-side download — no server/API needed ----
export function downloadICalFile(icsContent: string, filename = 'semester-schedule.ics') {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
