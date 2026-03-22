import { adminDb } from '@/lib/firebase/firebaseAdmin';

// Helper functions for time conversion
const toMins = (timeStr: string) => {
  if (!timeStr) return 0;
  const is12Hour = timeStr.includes('AM') || timeStr.includes('PM');
  
  if (is12Hour) {
    const [time, period] = timeStr.split(' ');
    let [h, m] = time.split(':').map(Number);
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  } else {
    let [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  }
};

const fromMins = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
  const displayM = m.toString().padStart(2, '0');
  return `${displayH}:${displayM} ${period}`;
};

const getDateStr = (plusDays: number) => {
  const d = new Date();
  d.setDate(d.getDate() + plusDays);
  return d.toISOString().split('T')[0];
};

const getDayName = (plusDays: number) => {
  const d = new Date();
  d.setDate(d.getDate() + plusDays);
  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  return days[d.getDay()];
};

export async function buildScheduleForUser(uid: string) {
  // Fetch user preferences
  const userDoc = await adminDb.collection('users').doc(uid).get();
  if (!userDoc.exists) {
    throw new Error('User not found');
  }
  const prefs = userDoc.data() || {};
  
  // Fetch classes
  const classesSnapshot = await adminDb.collection('classes').where('user_id', '==', uid).get();
  const classes = classesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

  // Extract Preferences
  const wakeTimeMins = toMins(prefs.wake_time || '07:00 AM');
  const sleepTimeMins = toMins(prefs.sleep_time || '11:30 PM');
  const morningCommute = parseInt(prefs.morning_commute_mins) || 30;
  const eveningCommute = parseInt(prefs.Evening_commute_mins || prefs.evening_commute_mins) || 30;
  const prepTime = parseInt(prefs.prep_mins) || 45;
  const rushHourBuffer = prefs.rush_hour_buffer || false;

  let allBlocks: any[] = [];

  // Generate for 7 days
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const dateStr = getDateStr(dayOffset);
    const dayName = getDayName(dayOffset);
    
    const todayClasses = classes
      .filter(c => c.days && c.days.map((d:string) => d.toUpperCase()).includes(dayName))
      .sort((a, b) => toMins(a.startTime) - toMins(b.startTime));

    const blocks: any[] = [];

    if (todayClasses.length === 0) {
      blocks.push({
        user_id: uid, date: dateStr, block_type: 'wake', label: 'Wake Up',
        start_time: fromMins(wakeTimeMins), end_time: fromMins(wakeTimeMins + 10),
        color: '#6B7280', icon: 'moon', is_bunked: false, is_cancelled: false
      });
      
      blocks.push({
        user_id: uid, date: dateStr, block_type: 'free', label: 'Free Day',
        start_time: fromMins(wakeTimeMins + 10), end_time: fromMins(sleepTimeMins),
        color: '#E5E7EB', icon: 'free', is_bunked: false, is_cancelled: false
      });
    } else {
      const firstClass = todayClasses[0];
      const lastClass = todayClasses[todayClasses.length - 1];
      const firstClassStart = toMins(firstClass.startTime);
      const lastClassEnd = toMins(lastClass.endTime);

      const leaveTime = firstClassStart - morningCommute;
      const getReadyStart = leaveTime - prepTime;
      
      const lastClassEndAfter5 = lastClassEnd >= 17 * 60;
      const effectiveEveningCommute = (rushHourBuffer && lastClassEndAfter5) ? eveningCommute + 15 : eveningCommute;

      blocks.push({
        user_id: uid, date: dateStr, block_type: 'wake', label: 'Wake Up',
        start_time: fromMins(wakeTimeMins), end_time: fromMins(wakeTimeMins + 10),
        color: '#6B7280', icon: 'moon', is_bunked: false, is_cancelled: false
      });

      if (getReadyStart > wakeTimeMins) {
        blocks.push({
          user_id: uid, date: dateStr, block_type: 'prep', label: 'Get Ready',
          start_time: fromMins(getReadyStart), end_time: fromMins(leaveTime),
          color: '#8B5CF6', icon: 'prep', is_bunked: false, is_cancelled: false
        });
      }

      blocks.push({
        user_id: uid, date: dateStr, block_type: 'travel', label: 'Travel to College',
        start_time: fromMins(Math.max(leaveTime, wakeTimeMins + 10)),
        end_time: fromMins(firstClassStart),
        color: '#86EFAC', icon: 'bus', is_bunked: false, is_cancelled: false
      });

      for (let i = 0; i < todayClasses.length; i++) {
        const cls = todayClasses[i];
        const clsStart = toMins(cls.startTime);
        const clsEnd = toMins(cls.endTime);

        blocks.push({
          user_id: uid, date: dateStr, block_type: 'class', label: cls.subject || 'Class',
          subject_name: cls.subject || 'Class', class_id: cls.id || '',
          start_time: cls.startTime, end_time: cls.endTime,
          color: '#6366F1', icon: 'class', room: cls.room || '', faculty: cls.faculty || '',
          batch: cls.batch || 'All', class_type: cls.type || 'Theory', is_bunked: false, is_cancelled: false
        });

        if (i < todayClasses.length - 1) {
          const nextClass = todayClasses[i + 1];
          const nextStart = toMins(nextClass.startTime);
          const gapMins = nextStart - clsEnd;

          if (gapMins > 20) {
            if (gapMins >= 45) {
              const mealLabel = clsEnd >= 12 * 60 && clsEnd < 15 * 60 ? 'Lunch Break' : clsEnd < 12 * 60 ? 'Breakfast Break' : 'Dinner Break';
              const mealDuration = Math.min(45, gapMins - 20);

              blocks.push({
                user_id: uid, date: dateStr, block_type: 'meal', label: mealLabel,
                start_time: fromMins(clsEnd), end_time: fromMins(clsEnd + mealDuration),
                color: '#FDA4AF', icon: 'meal', is_bunked: false, is_cancelled: false
              });

              const studyStart = clsEnd + mealDuration;
              const studyEnd = nextStart - 5;
              if (studyEnd - studyStart >= 20) {
                blocks.push({
                  user_id: uid, date: dateStr, block_type: 'study', label: `Study — ${cls.subject}`,
                  subject_name: cls.subject, start_time: fromMins(studyStart), end_time: fromMins(studyEnd),
                  color: '#FCD34D', icon: 'study', is_bunked: false, is_cancelled: false
                });
              }
            } else {
              blocks.push({
                user_id: uid, date: dateStr, block_type: 'study', label: `Study — ${cls.subject}`,
                subject_name: cls.subject, start_time: fromMins(clsEnd), end_time: fromMins(nextStart - 5),
                color: '#FCD34D', icon: 'study', is_bunked: false, is_cancelled: false
              });
            }
          }
        }

        if (i === todayClasses.length - 1) {
          const studyDuration = 30;
          const studyEnd = lastClassEnd + studyDuration;

          if (studyEnd < lastClassEnd + effectiveEveningCommute - 10) {
             blocks.push({
               user_id: uid, date: dateStr, block_type: 'study', label: `Revise — ${cls.subject}`,
               subject_name: cls.subject, start_time: fromMins(lastClassEnd), end_time: fromMins(lastClassEnd + studyDuration),
               color: '#FCD34D', icon: 'study', is_bunked: false, is_cancelled: false
             });
          }
        }
      }

      const actualLastClassEnd = toMins(blocks[blocks.length-1].end_time); 
      const travelHomeStart = Math.max(lastClassEnd, actualLastClassEnd);
      blocks.push({
        user_id: uid, date: dateStr, block_type: 'travel', label: 'Travel Home',
        start_time: fromMins(travelHomeStart), end_time: fromMins(travelHomeStart + effectiveEveningCommute),
        color: '#86EFAC', icon: 'bus', is_bunked: false, is_cancelled: false
      });

      const freeStart = travelHomeStart + effectiveEveningCommute;
      if (sleepTimeMins - freeStart > 30) {
        blocks.push({
          user_id: uid, date: dateStr, block_type: 'free', label: 'Free Time',
          start_time: fromMins(freeStart), end_time: fromMins(sleepTimeMins),
          color: '#E5E7EB', icon: 'free', is_bunked: false, is_cancelled: false
        });
      }
    }

    blocks.sort((a, b) => toMins(a.start_time) - toMins(b.start_time));

    for (let i = 0; i < blocks.length - 1; i++) {
      const current = blocks[i];
      const next = blocks[i + 1];
      const currentEnd = toMins(current.end_time);
      const nextStart = toMins(next.start_time);

      if (currentEnd > nextStart) {
        const priority: any = { class: 7, travel: 6, meal: 5, study: 4, prep: 3, wake: 2, free: 1 };
        const currentP = priority[current.block_type] || 0;
        const nextP = priority[next.block_type] || 0;

        if (currentP >= nextP) {
          next.start_time = current.end_time;
          if (toMins(next.start_time) >= toMins(next.end_time)) {
            blocks.splice(i + 1, 1);
            i--;
          }
        } else {
          current.end_time = next.start_time;
          if (toMins(current.start_time) >= toMins(current.end_time)) {
            blocks.splice(i, 1);
            i--;
          }
        }
      }
    }

    allBlocks.push(...blocks);
  }

  // Delete existing
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const dateStr = getDateStr(dayOffset);
    const existing = await adminDb.collection('schedule_blocks')
      .where('user_id', '==', uid)
      .where('date', '==', dateStr)
      .get();
      
    const batch = adminDb.batch();
    existing.docs.forEach(doc => {
       batch.delete(doc.ref);
    });
    await batch.commit();
  }

  // Write new
  const chunkArray = (arr: any[], size: number) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
  const chunks = chunkArray(allBlocks, 500);
  
  for (const chunk of chunks) {
    const batch = adminDb.batch();
    chunk.forEach(block => {
      const docRef = adminDb.collection('schedule_blocks').doc();
      batch.set(docRef, block);
    });
    await batch.commit();
  }

  return allBlocks;
}
