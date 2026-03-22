"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { MoreHorizontal, BookOpen, Bus, Coffee, User, Sun, Moon, PenTool } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, doc } from "firebase/firestore";
import toast from "react-hot-toast";

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

type ScheduleBlock = {
  id: string; date: string; block_type: 'class'|'travel'|'study'|'meal'|'prep'|'free'|'wake';
  label: string; start_time: string; end_time: string; color: string; icon: string;
  subject_name?: string; class_id?: string; room?: string; faculty?: string; batch?: string;
  class_type?: string; is_bunked: boolean; is_cancelled: boolean;
};

const IconMap: any = { 
  class: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full p-0.5">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
      <path d="M8 7h6" /><path d="M8 11h8" /><path d="M8 15h6" />
    </svg>
  ),
  bus: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full p-0.5">
      <rect width="16" height="10" x="4" y="3" rx="2" />
      <path d="M9 21h6" /><path d="M4 13h16" /><path d="M7 3v10" /><path d="M17 3v10" />
      <circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" />
    </svg>
  ),
  study: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full p-0.5">
      <path d="M21 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2" />
      <path d="M21 7H3" /><path d="M21 17H3" /><path d="M18 7v10" /><path d="M6 7v10" />
    </svg>
  ),
  meal: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full p-0.5">
      <path d="M3 11c0 6.627 5.373 12 12 12s12-5.373 12-12H3Z" />
      <path d="M7 2h2v3" /><path d="M11 2h2v3" /><path d="M15 2h2v3" />
    </svg>
  ),
  prep: User,
  free: Sun,
  moon: Moon
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

// Timeline runs from 6:00 AM to 11:30 PM (1050 minutes range)
const TIMELINE_START = 6 * 60; // 360 = 6:00 AM
const TIMELINE_END = 23 * 60 + 30; // 1410 = 11:30 PM
const TIMELINE_RANGE = TIMELINE_END - TIMELINE_START;
const PX_PER_MIN = 1.6; // slightly taller for better readability
const TIMELINE_HEIGHT = TIMELINE_RANGE * PX_PER_MIN;

// Hour labels (6 AM to 11 PM)
const HOUR_LABELS = Array.from({length: 18}, (_, i) => i + 6).map(h => ({
  label: `${h > 12 ? h - 12 : (h === 0 ? 12 : h)} ${h >= 12 ? 'PM' : 'AM'}`,
  min: h * 60
}));

export default function SchedulePage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const dayParam = searchParams.get('day');
  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const defaultDay = DAYS.includes(todayName) ? todayName : 'Monday';

  const [activeDay, setActiveDay] = useState(dayParam && DAYS.includes(dayParam) ? dayParam : defaultDay);
  const [allBlocks, setAllBlocks] = useState<ScheduleBlock[]>([]);
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
      const snap = await getDocs(query(collection(db, 'schedule_blocks'), where('user_id', '==', user.uid)));
      setAllBlocks(snap.docs.map(d => ({ id: d.id, ...d.data() } as ScheduleBlock)));
    };
    load();
  }, [user]);

  const activeDayBlocks = allBlocks.filter(b => {
    const d = new Date(b.date);
    const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
    return dayName.toUpperCase() === activeDay.toUpperCase();
  }).sort((a, b) => timeToMin(a.start_time) - timeToMin(b.start_time));

  // Count classes per day for tabs
  const dayClassCounts = DAYS.map(day => {
    return allBlocks.filter(b => {
      const d = new Date(b.date);
      return d.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase() === day.toUpperCase() && b.block_type === 'class';
    }).length;
  });

  const handleBunk = async (cls: ScheduleBlock, status: string) => {
    if (!user) return;
    setOpenMenu(null);
    try {
      const { db } = await import('@/lib/firebase/clientApp');
      await addDoc(collection(db, 'attendance'), {
        user_id: user.uid, subject_name: cls.subject_name || cls.label, date: cls.date,
        status, logged_at: serverTimestamp()
      });
      // A full bunk cascade will occur on backend if we hit API, but for frontend consistency we update block
      await updateDoc(doc(db, 'schedule_blocks', cls.id), { is_bunked: true });
      const newBlocks = [...allBlocks];
      const i = newBlocks.findIndex(x => x.id === cls.id);
      if(i>-1) newBlocks[i].is_bunked = true;
      setAllBlocks(newBlocks);
      toast.success(status === 'bunked' ? `Bunked ${cls.label}` : `Marked ${cls.label} as cancelled`);
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
      {activeDayBlocks.length === 0 ? (
        <div className="py-20 flex flex-col items-center text-center">
          <span className="text-[48px] mb-4">🌴</span>
          <p className="text-[14px] font-semibold text-[#1A1A2E]">No schedule on {activeDay}</p>
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

            {/* Generated Blocks */}
            {activeDayBlocks.map((block) => {
              const startMin = timeToMin(block.start_time);
              const endMin = timeToMin(block.end_time);
              const top = (startMin - TIMELINE_START) * PX_PER_MIN;
              const height = Math.max((endMin - startMin) * PX_PER_MIN, Math.min(24, (endMin - startMin) * PX_PER_MIN));
              
              // Skip blocks outside timeline range to prevent huge renders
              if (endMin < TIMELINE_START || startMin > TIMELINE_END) return null;

              const isClass = block.block_type === 'class';
              const IconComp = IconMap[block.icon] || BookOpen;

              return (
                <div key={block.id} className="absolute left-0 right-0 group z-10"
                  style={{ top: `${top}px`, height: `${height}px`, paddingBottom: '2px' }}
                >
                  <div className={`h-full rounded-[0_12px_12px_0] border-l-4 flex flex-col justify-center px-4 py-1.5 relative overflow-hidden transition-shadow hover:shadow-md ${block.is_bunked ? 'opacity-50' : ''}`}
                    style={{ backgroundColor: `${block.color}15`, borderColor: block.color }}
                  >
                    <div className="flex items-center gap-2">
                       <IconComp className="w-3.5 h-3.5" style={{ color: block.color }} />
                       <p className="text-[13px] font-semibold leading-tight truncate" style={{ color: isClass ? '#1A1A2E' : block.color}}>
                         {block.label} {block.is_bunked ? '(BUNKED)' : ''}
                       </p>
                    </div>

                    {(block.room || block.faculty || isClass) && (
                      <div className="flex items-center gap-1.5 mt-1 opacity-80 overflow-x-auto no-scrollbar">
                        <span className="text-[9px] font-bold uppercase shrink-0" style={{ color: block.color }}>
                          {block.start_time} – {block.end_time}
                        </span>
                        {block.room && <span className="text-[9px] px-1.5 py-0.5 rounded-[4px] shrink-0" style={{ backgroundColor: `${block.color}20`, color: block.color }}>{block.room}</span>}
                        {block.faculty && <span className="text-[9px] px-1.5 py-0.5 rounded-[4px] shrink-0" style={{ backgroundColor: `${block.color}20`, color: block.color }}>{block.faculty}</span>}
                        {block.class_type && <span className="text-[9px] px-1.5 py-0.5 rounded-[4px] font-bold shrink-0" style={{ backgroundColor: block.color, color: '#fff' }}>{block.class_type}</span>}
                      </div>
                    )}

                    {/* ⋯ Menu */}
                    {isClass && !block.is_bunked && (
                      <div className="absolute top-2 right-2">
                        <button onClick={() => setOpenMenu(openMenu === block.id ? null : block.id)}
                          className="p-1 rounded-md bg-white hover:bg-[#F3F4F6] transition-colors"
                        >
                          <MoreHorizontal className="w-[14px] h-[14px] text-[#9CA3AF]" />
                        </button>
                        {openMenu === block.id && (
                          <div className="absolute right-0 top-7 bg-white rounded-[12px] shadow-xl border border-[#E5E7EB] z-50 w-[200px] py-1 animate-in fade-in zoom-in-95 duration-150">
                            <button onClick={() => handleBunk(block, 'bunked')} className="w-full text-left px-4 py-2.5 text-[12px] hover:bg-[#F3F4F6] font-medium">🚫 Bunk this class</button>
                            <button onClick={() => handleBunk(block, 'cancelled')} className="w-full text-left px-4 py-2.5 text-[12px] hover:bg-[#F3F4F6] font-medium">❌ Cancelled by professor</button>
                          </div>
                        )}
                      </div>
                    )}
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
