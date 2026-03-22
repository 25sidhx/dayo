// ============================================================
// Parse user preferences from onboarding chat messages
// ============================================================

import type { UserPreferences } from './scheduler';
import { parseTime, DEFAULT_PREFS } from './scheduler';

// Simple regex-based extraction — fast and zero API cost for basic phrases
// Falls back to DEFAULT_PREFS for anything not found

type ChatMessage = { role: string; content: string };

export function parsePreferencesFromChat(messages: ChatMessage[]): UserPreferences {
  // Combine all user messages into one block of text for regex scanning
  const userText = messages
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .join(' ')
    .toLowerCase();

  return {
    wakeTimeMinute: extractWakeTime(userText),
    sleepTimeMinute: extractSleepTime(userText),
    commuteMinutes: extractCommute(userText),
    breakfastMinute: extractMeal(userText, 'breakfast') ?? DEFAULT_PREFS.breakfastMinute,
    lunchMinute: DEFAULT_PREFS.lunchMinute,
    dinnerMinute: DEFAULT_PREFS.dinnerMinute,
    morningRoutineMins: DEFAULT_PREFS.morningRoutineMins,
    collegePrepMins: DEFAULT_PREFS.collegePrepMins,
  };
}

// ------- Extractors -------

function extractWakeTime(text: string): number {
  // "wake up at 7", "get up at 6:30 am", "I wake at 7am", "woken by 8"
  const match = text.match(
    /(?:wake\s*up|get\s*up|woken|i\s*wake|alarm)[\s\w]*?(?:at|by|around)?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i
  );
  if (match) {
    const parsed = safeParseTime(match[1]);
    if (parsed >= 0) return parsed;
  }

  // Fallback: look for plain time near "wake" in 5-word window
  const words = text.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    if (words[i].includes('wake') || words[i].includes('get up') || words[i].includes('alarm')) {
      for (let j = i + 1; j < Math.min(i + 6, words.length); j++) {
        const t = safeParseTime(words[j]);
        if (t >= 0 && t < 720) return t; // morning time (before noon)
      }
    }
  }

  return DEFAULT_PREFS.wakeTimeMinute;
}

function extractSleepTime(text: string): number {
  const match = text.match(
    /(?:sleep|bed|bedtime|lights\s*out|go\s*to\s*sleep)[\s\w]*?(?:at|by|around)?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i
  );
  if (match) {
    const parsed = safeParseTime(match[1]);
    if (parsed >= 0) {
      // If parsed < 360 (before 6am), assume late night (e.g. 1am = 60min)
      // Add to 1440 to represent next-day-midnight representation
      return parsed < 360 ? parsed + 1440 : parsed;
    }
  }
  return DEFAULT_PREFS.sleepTimeMinute;
}

function extractCommute(text: string): number {
  // "commute takes 30 minutes", "30 min commute", "45 minutes to get there"
  const match = text.match(/(\d+)\s*(?:min(?:ute)?s?)?\s*(?:commute|travel|to\s*(?:get|reach|campus|college|school))/i)
    || text.match(/commute\s*(?:is|takes|of)\s*(\d+)\s*(?:min(?:ute)?s?)/i);
  if (match) {
    const mins = parseInt(match[1]);
    if (mins >= 0 && mins <= 180) return mins;
  }
  return DEFAULT_PREFS.commuteMinutes;
}

function extractMeal(text: string, meal: string): number | null {
  const match = text.match(
    new RegExp(`${meal}[\\s\\w]*?(?:at|around)\\s*(\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)?)`, 'i')
  );
  if (match) {
    const t = safeParseTime(match[1]);
    if (t >= 0) return t;
  }
  return null;
}

function safeParseTime(raw: string): number {
  if (!raw) return -1;
  // normalize: "7am" → "7 AM", "6:30" → "6:30 AM" if no suffix
  let s = raw.trim();
  if (!/am|pm/i.test(s)) {
    const h = parseInt(s.split(':')[0]);
    s += h < 12 ? ' AM' : ' PM';
  }
  return parseTime(s);
}
