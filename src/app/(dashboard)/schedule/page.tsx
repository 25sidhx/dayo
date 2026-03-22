"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import toast from "react-hot-toast";

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Dedup helper
const dedup = (classes: any[]) => {
  const seen = new Set();
  return classes.filter(cls => {
    const key = `${cls.subject}-${(cls.days||[]).join(',')}-${cls.startTime}-${cls.batch}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// Parse "12:10 PM" → minutes from midnight
const timeToMin = (t: string) => {
  if (!t) return 0;
  const clean = t.replace(/\s+/g, ' ').trim();
  const match = clean.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return 0;
  let h = parseInt(match[1]), m = parseInt(match[2]);
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h * 60 + m;
};

// Timeline runs from 12:00 PM to 6:30 PM (390 minutes range)
const TIMELINE_START = 12 * 60; // 720 = noon
const TIMELINE_END = 18 * 60 + 30; // 1110 = 6:30 PM
const TIMELINE_RANGE = TIMELINE_END - TIMELINE_START;
const PX_PER_MIN = 1.4; // pixels per minute
const TIMELINE_HEIGHT = TIMELINE_RANGE * PX_PER_MIN;

// Recess blocks
const RECESSES = [
  { start: timeToMin('2:00 PM'), end: timeToMin('2:20 PM'), label: 'Recess' },
  { start: timeToMin('4:10 PM'), end: timeToMin('4:15 PM'), label: 'Recess' },
];

// Hour labels
const HOUR_LABELS = [12, 1, 2, 3, 4, 5, 6].map(h => ({
  label: `${h} ${h === 12 ? 'PM' : 'PM'}`,
  min: (h === 12 ? 12 : h + 12) * 60
}));

export default function SchedulePage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const dayParam = searchParams.get('day');
  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const defaultDay = DAYS.includes(todayName) ? todayName : 'Monday';

  const [activeDay, setActiveDay] = useState(dayParam && DAYS.includes(dayParam) ? dayParam : defaultDay);
  const [allClasses, setAllClasses] = useState<any[]>([]);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [currentMin, setCurrentMin] = useState(new Date().getHours() * 60 + new Date().getMinutes());

  useEffect(() => { if (dayParam && DAYS.includes(dayParam)) setActiveDay(dayParam); }, [dayParam]);

  // Real-time clock
  useEffect(() => {
    const id = setInterval(() => { const n = new Date(); setCurrentMin(n.getHours() * 60 + n.getMinutes()); }, 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { db } = await import('@/lib/firebase/clientApp');
      const snap = await getDocs(query(collection(db, 'classes'), where('user_id', '==', user.uid)));
      setAllClasses(dedup(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    };
    load();
  }, [user]);

  const dayClasses = allClasses.filter(cls =>
    cls.days?.some((d: string) => d.toUpperCase() === activeDay.toUpperCase())
  ).sort((a, b) => timeToMin(a.startTime) - timeToMin(b.startTime));

  // Count classes per day for tabs
  const dayClassCounts = DAYS.map(day =>
    allClasses.filter(cls => cls.days?.some((d: string) => d.toUpperCase() === day.toUpperCase())).length
  );

  const handleBunk = async (cls: any, status: string) => {
    if (!user) return;
    setOpenMenu(null);
    try {
      const { db } = await import('@/lib/firebase/clientApp');
      await addDoc(collection(db, 'attendance'), {
        user_id: user.uid, subject_name: cls.subject, date: new Date().toISOString().split('T')[0],
        status, logged_at: serverTimestamp()
      });
      toast.success(status === 'bunked' ? `Bunked ${cls.subject}` : `Marked ${cls.subject} as cancelled`);
    } catch (e: any) { toast.error(e.message); }
  };

  const isToday = activeDay === todayName;
  const showTimeline = currentMin >= TIMELINE_START && currentMin <= TIMELINE_END;

  return (
    <div className="p-6 md:p-8 max-w-[900px] w-full mx-auto flex-1">
      <header className="mb-6">
        <h2 className="font-heading text-[26px] text-[#1A1A2E] leading-[1.1] mb-1">Schedule</h2>
        <p className="text-[12px] text-[#9CA3AF]">Your daily planner — visual timeline view.</p>
      </header>

      {/* Day Tabs */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {DAYS.map((day, i) => (
          <button key={day} onClick={() => setActiveDay(day)}
            className={`flex flex-col items-center px-5 py-2.5 rounded-[20px] text-[13px] font-semibold transition-all whitespace-nowrap ${
              activeDay === day
                ? 'bg-[#1A1A2E] text-white shadow-md'
                : 'bg-transparent text-[#6B7280] hover:bg-[#F3F4F6]'
            }`}
          >
            <span>{day.substring(0, 3).toUpperCase()}</span>
            <span className={`text-[10px] mt-0.5 ${activeDay === day ? 'text-white/60' : 'text-[#9CA3AF]'}`}>
              {dayClassCounts[i]} class{dayClassCounts[i] !== 1 ? 'es' : ''}
            </span>
          </button>
        ))}
      </div>

      {/* Timeline */}
      {dayClasses.length === 0 ? (
        <div className="py-20 flex flex-col items-center text-center">
          <span className="text-[48px] mb-4">🌴</span>
          <p className="text-[14px] font-semibold text-[#1A1A2E]">No classes on {activeDay}</p>
          <p className="text-[12px] text-[#9CA3AF]">Enjoy your free day!</p>
        </div>
      ) : (
        <div className="relative flex" style={{ height: `${TIMELINE_HEIGHT}px` }}>

          {/* Hour Labels Column */}
          <div className="w-[60px] shrink-0 relative">
            {HOUR_LABELS.map(h => {
              const top = (h.min - TIMELINE_START) * PX_PER_MIN;
              return (
                <div key={h.min} className="absolute right-3 -translate-y-1/2 text-[11px] text-[#9CA3AF] font-medium tabular-nums" style={{ top: `${top}px` }}>
                  {h.label}
                </div>
              );
            })}
          </div>

          {/* Vertical Track Line */}
          <div className="w-[2px] bg-[#F3F4F6] shrink-0 relative rounded-full">
            {/* Current time dot */}
            {isToday && showTimeline && (
              <div className="absolute w-[10px] h-[10px] bg-[#EF4444] rounded-full -left-[4px] z-20 shadow-sm" style={{ top: `${(currentMin - TIMELINE_START) * PX_PER_MIN}px` }} />
            )}
          </div>

          {/* Events Column */}
          <div className="flex-1 relative ml-3">

            {/* Hour grid lines */}
            {HOUR_LABELS.map(h => {
              const top = (h.min - TIMELINE_START) * PX_PER_MIN;
              return <div key={h.min} className="absolute left-0 right-0 h-[1px] bg-[#F3F4F6]" style={{ top: `${top}px` }} />;
            })}

            {/* Current time line */}
            {isToday && showTimeline && (
              <div className="absolute left-0 right-0 h-[2px] bg-[#EF4444] z-20" style={{ top: `${(currentMin - TIMELINE_START) * PX_PER_MIN}px` }} />
            )}

            {/* Recess blocks */}
            {RECESSES.map((r, i) => {
              const top = (r.start - TIMELINE_START) * PX_PER_MIN;
              const height = (r.end - r.start) * PX_PER_MIN;
              return (
                <div key={i} className="absolute left-0 right-0 bg-[#F9FAFB] rounded-[6px] flex items-center justify-center z-5" style={{ top: `${top}px`, height: `${height}px` }}>
                  <span className="text-[10px] uppercase tracking-[0.15em] text-[#D1D5DB] font-bold">Recess</span>
                </div>
              );
            })}

            {/* Class blocks */}
            {dayClasses.map((cls) => {
              const startMin = timeToMin(cls.startTime);
              const endMin = timeToMin(cls.endTime);
              const top = (startMin - TIMELINE_START) * PX_PER_MIN;
              const height = Math.max((endMin - startMin) * PX_PER_MIN, 40);
              const isPractical = (cls.type || '').toLowerCase() === 'practical';

              return (
                <div key={cls.id} className="absolute left-0 right-0 group z-10"
                  style={{ top: `${top}px`, height: `${height}px`, paddingBottom: '2px' }}
                >
                  <div className={`h-full rounded-[0_12px_12px_0] border-l-4 flex flex-col justify-center px-4 py-2 relative overflow-hidden transition-shadow hover:shadow-md ${
                    isPractical ? 'bg-[#FFF0F3] border-[#E11D48]' : 'bg-[#EEF2FF] border-[#6366F1]'
                  }`}>
                    {/* Subject */}
                    <p className={`text-[13px] font-semibold leading-tight ${isPractical ? 'text-[#E11D48]' : 'text-[#6366F1]'}`}>
                      {cls.subject}
                    </p>
                    {cls.faculty && <p className="text-[11px] text-[#9CA3AF] mt-0.5">{cls.faculty}</p>}

                    {/* Bottom tags */}
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[9px] font-bold uppercase text-[#9CA3AF] bg-white/60 px-1.5 py-0.5 rounded-[4px]">
                        {cls.startTime} – {cls.endTime}
                      </span>
                      {cls.room && <span className="text-[9px] text-[#9CA3AF] bg-white/60 px-1.5 py-0.5 rounded-[4px]">{cls.room}</span>}
                      {cls.batch && cls.batch !== 'All' && (
                        <span className="text-[9px] font-bold text-[#6366F1] bg-white/60 px-1.5 py-0.5 rounded-[4px]">{cls.batch}</span>
                      )}
                    </div>

                    {/* ⋯ Menu */}
                    <div className="absolute top-2 right-2">
                      <button onClick={() => setOpenMenu(openMenu === cls.id ? null : cls.id)}
                        className="p-1 rounded-md bg-white/60 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal className="w-[14px] h-[14px] text-[#9CA3AF]" />
                      </button>
                      {openMenu === cls.id && (
                        <div className="absolute right-0 top-7 bg-white rounded-[12px] shadow-xl border border-[#E5E7EB] z-50 w-[200px] py-1 animate-in fade-in zoom-in-95 duration-150">
                          <button onClick={() => handleBunk(cls, 'bunked')} className="w-full text-left px-4 py-2.5 text-[12px] hover:bg-[#F3F4F6] font-medium">🚫 Bunk this class</button>
                          <button onClick={() => handleBunk(cls, 'cancelled')} className="w-full text-left px-4 py-2.5 text-[12px] hover:bg-[#F3F4F6] font-medium">❌ Cancelled by professor</button>
                          <button onClick={() => { setOpenMenu(null); toast('Coming soon!'); }} className="w-full text-left px-4 py-2.5 text-[12px] text-[#9CA3AF] hover:bg-[#F3F4F6] font-medium">🔄 Reschedule</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

          </div>
        </div>
      )}
    </div>
  );
}
