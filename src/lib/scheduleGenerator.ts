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
  const prepTime = 30; // Phase C: Default prep_mins is 30
  const rushHourBuffer = prefs.rush_hour_buffer || false;

  let allBlocks: any[] = [];

  // Generate for 7 days
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const dateStr = getDateStr(dayOffset);
    const dayName = getDayName(dayOffset);
    
    // 1. Get user's classes for that day
    const todayClasses = classes
      .filter(c => c.days && c.days.map((d:string) => d.toUpperCase()).includes(dayName))
      // 2. Sort by start time
      .sort((a, b) => toMins(a.startTime) - toMins(b.startTime));

    const dayBlocks: any[] = [];

    // Skip generation if no classes and no wake/sleep? 
    // Phase C implies we always create the timeline blocks.
    
    // START CORE LOGIC
    // Wake block at wake_time
    dayBlocks.push({
      user_id: uid, date: dateStr, block_type: 'wake', label: 'Wake Up',
      start_time: fromMins(wakeTimeMins), end_time: fromMins(wakeTimeMins + 10),
      color: '#6B7280', icon: 'moon', is_bunked: false, is_cancelled: false
    });

    if (todayClasses.length > 0) {
      const firstClassStart = toMins(todayClasses[0].startTime);
      const lastClassEnd = toMins(todayClasses[todayClasses.length - 1].endTime);

      // Calculate: leaveTime = firstClass.startTime minus morning_commute_mins
      const leaveTime = firstClassStart - morningCommute;
      
      // Calculate: getReadyTime = leaveTime minus prep_mins (default 30)
      const getReadyTime = leaveTime - prepTime;

      // Get Ready block from getReadyTime to leaveTime
      dayBlocks.push({
        user_id: uid, date: dateStr, block_type: 'prep', label: 'Get Ready',
        start_time: fromMins(getReadyTime), end_time: fromMins(leaveTime),
        color: '#8B5CF6', icon: 'prep', is_bunked: false, is_cancelled: false
      });

      // Travel to College from leaveTime to firstClass.startTime
      dayBlocks.push({
        user_id: uid, date: dateStr, block_type: 'travel', label: 'Travel to College',
        start_time: fromMins(leaveTime), end_time: fromMins(firstClassStart),
        color: '#86EFAC', icon: 'bus', is_bunked: false, is_cancelled: false
      });

      // For each class: Add class block
      for (let i = 0; i < todayClasses.length; i++) {
        const cls = todayClasses[i];
        const clsStart = toMins(cls.startTime);
        const clsEnd = toMins(cls.endTime);

        dayBlocks.push({
          user_id: uid, date: dateStr, block_type: 'class', label: cls.subject || 'Class',
          subject_name: cls.subject || 'Class', class_id: cls.id || '',
          start_time: cls.startTime, end_time: cls.endTime,
          color: '#6366F1', icon: 'class', room: cls.room || '', faculty: cls.faculty || '',
          batch: cls.batch || 'All', class_type: cls.type || 'Theory', is_bunked: false, is_cancelled: false
        });

        // Check gap to next class
        if (i < todayClasses.length - 1) {
          const nextStart = toMins(todayClasses[i+1].startTime);
          const gap = nextStart - clsEnd;

          if (gap >= 45) {
            // Over 45 min: add meal (30min) then study block
            dayBlocks.push({
              user_id: uid, date: dateStr, block_type: 'meal', label: 'Meal Break',
              start_time: fromMins(clsEnd), end_time: fromMins(clsEnd + 30),
              color: '#FDA4AF', icon: 'meal', is_bunked: false, is_cancelled: false
            });
            dayBlocks.push({
              user_id: uid, date: dateStr, block_type: 'study', label: 'Study Session',
              start_time: fromMins(clsEnd + 30), end_time: fromMins(nextStart),
              color: '#FCD34D', icon: 'study', is_bunked: false, is_cancelled: false
            });
          } else if (gap >= 20) {
            // 20-44 min: add study block only
            dayBlocks.push({
              user_id: uid, date: dateStr, block_type: 'study', label: 'Short Study',
              start_time: fromMins(clsEnd), end_time: fromMins(nextStart),
              color: '#FCD34D', icon: 'study', is_bunked: false, is_cancelled: false
            });
          }
        }
      }

      // Travel Home from lastClass.endTime
      const effectiveEveningCommute = (rushHourBuffer && lastClassEnd >= 17*60) ? eveningCommute + 15 : eveningCommute;
      dayBlocks.push({
        user_id: uid, date: dateStr, block_type: 'travel', label: 'Travel Home',
        start_time: fromMins(lastClassEnd), end_time: fromMins(lastClassEnd + effectiveEveningCommute),
        color: '#86EFAC', icon: 'bus', is_bunked: false, is_cancelled: false
      });

      // Free Time from travel end to sleep_time
      const freeStart = lastClassEnd + effectiveEveningCommute;
      dayBlocks.push({
        user_id: uid, date: dateStr, block_type: 'free', label: 'Free Time',
        start_time: fromMins(freeStart), end_time: fromMins(sleepTimeMins),
        color: '#E5E7EB', icon: 'free', is_bunked: false, is_cancelled: false
      });
    } else {
      // No classes: Free Time from Wake to Sleep
      dayBlocks.push({
        user_id: uid, date: dateStr, block_type: 'free', label: 'Free Day',
        start_time: fromMins(wakeTimeMins + 10), end_time: fromMins(sleepTimeMins),
        color: '#E5E7EB', icon: 'free', is_bunked: false, is_cancelled: false
      });
    }

    // RESOLVE OVERLAPS BY PRIORITY
    // Priority order: class (7) beats travel (6) beats meal (5) beats study (4) beats prep (3) beats wake (2) beats free (1)
    const priority: any = { class: 7, travel: 6, meal: 5, study: 4, prep: 3, wake: 2, free: 1 };
    
    dayBlocks.sort((a, b) => toMins(a.start_time) - toMins(b.start_time));

    for (let i = 0; i < dayBlocks.length - 1; i++) {
      const current = dayBlocks[i];
      const next = dayBlocks[i + 1];
      const currentStart = toMins(current.start_time);
      const currentEnd = toMins(current.end_time);
      const nextStart = toMins(next.start_time);
      const nextEnd = toMins(next.end_time);

      if (currentEnd > nextStart) {
        const p1 = priority[current.block_type] || 0;
        const p2 = priority[next.block_type] || 0;

        if (p1 >= p2) {
          // Current wins: Trim or skip next
          next.start_time = current.end_time;
          if (toMins(next.start_time) >= toMins(next.end_time)) {
            dayBlocks.splice(i + 1, 1);
            i--;
          }
        } else {
          // Next wins: Trim current
          current.end_time = next.start_time;
          if (toMins(current.start_time) >= toMins(current.end_time)) {
            dayBlocks.splice(i, 1);
            i--;
          }
        }
      }
    }

    allBlocks.push(...dayBlocks);
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
