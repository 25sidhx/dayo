"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { MoreHorizontal, BookOpen } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import BunkModal from "@/components/BunkModal";

type ScheduleBlock = { id: string; type: 'class'; label: string; timeStr: string; endTime?: string; location?: string; typeLabel: string; subject?: string; batch?: string };

const dedup = (classes: any[]) => {
  const seen = new Set();
  return classes.filter(cls => {
    const key = `${cls.subject}-${(cls.days||[]).join(',')}-${cls.startTime}-${cls.batch}`;
    if (seen.has(key)) return false; seen.add(key); return true;
  });
};

const getGreeting = () => {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 21) return 'Good evening';
  return 'Good night';
};

// Skeleton component
const Skeleton = ({ w = 'w-full', h = 'h-4', className = '' }: { w?: string; h?: string; className?: string }) => (
  <div className={`${w} ${h} bg-[#F3F4F6] rounded-[8px] animate-pulse ${className}`} />
);

export default function DashboardPage() {
  const { user } = useAuth();
  const [userName, setUserName] = useState('');
  const [todayBlocks, setTodayBlocks] = useState<ScheduleBlock[]>([]);
  const [subjectsAtRisk, setSubjectsAtRisk] = useState(0);
  const [classCount, setClassCount] = useState(0);
  const [theoryCount, setTheoryCount] = useState(0);
  const [practicalCount, setPracticalCount] = useState(0);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [bunkTarget, setBunkTarget] = useState<{ subject: string; time: string } | null>(null);
  const [bunkedIds, setBunkedIds] = useState<Set<string>>(new Set());
  const menuRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
  const dateDisplay = today.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' });

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenu(null); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const { db } = await import('@/lib/firebase/clientApp');
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists() && userDoc.data().name) setUserName(userDoc.data().name.split(' ')[0]);

        const classesSnap = await getDocs(query(collection(db, 'classes'), where('user_id', '==', user.uid)));
        const allClasses = dedup(classesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        const todaysClasses = allClasses.filter((cls: any) =>
          cls.days?.some((d: string) => String(d).toUpperCase() === dayName.toUpperCase()));

        const blocks: ScheduleBlock[] = todaysClasses.map((cls: any) => ({
          id: cls.id, type: 'class' as const, label: cls.subject || 'Untitled',
          timeStr: cls.startTime || '', endTime: cls.endTime || '',
          location: [cls.room, cls.faculty].filter(Boolean).join(' • '),
          typeLabel: cls.type || 'Theory', subject: cls.subject, batch: cls.batch
        })).sort((a: any, b: any) => {
          const tv = (t: string) => { const [h, p] = t.split(' '); let [hr, mn] = h.split(':').map(Number); if (p?.toUpperCase() === 'PM' && hr !== 12) hr += 12; if (p?.toUpperCase() === 'AM' && hr === 12) hr = 0; return hr * 60 + (mn || 0); };
          return tv(a.timeStr) - tv(b.timeStr);
        });

        setTodayBlocks(blocks);
        setClassCount(blocks.length);
        setTheoryCount(blocks.filter(b => b.typeLabel === 'Theory').length);
        setPracticalCount(blocks.filter(b => b.typeLabel === 'Practical').length);

        const subjects = [...new Set(allClasses.map((c: any) => c.subject))].filter(Boolean);
        let riskCount = 0;
        for (const subject of subjects) {
          try {
            const attSnap = await getDocs(query(collection(db, 'attendance'), where('user_id', '==', user.uid), where('subject_name', '==', subject)));
            if (attSnap.size > 0) {
              const attended = attSnap.docs.filter(d => d.data().status === 'attended').length;
              if (Math.round((attended / attSnap.size) * 100) < 75) riskCount++;
            }
          } catch {}
        }
        setSubjectsAtRisk(riskCount);
        setLoaded(true);
      } catch (e) { console.error(e); setLoaded(true); }
    };
    load();
  }, [user, dayName]);

  const [showNotifyPrompt, setShowNotifyPrompt] = useState(false);

  useEffect(() => {
    const checkSub = async () => {
      if (typeof window !== 'undefined' && (window as any).OneSignal) {
        const isOptedIn = await (window as any).OneSignal.Notifications.permission;
        if (isOptedIn !== 'granted') setShowNotifyPrompt(true);
      }
    };
    const timer = setTimeout(checkSub, 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleNotifyEnable = async () => {
    if ((window as any).OneSignal) {
      await (window as any).OneSignal.Notifications.requestPermission();
      setShowNotifyPrompt(false);
    }
  };

  const subtitle = !loaded ? '...' : classCount === 0
    ? "No classes today — enjoy your day off!"
    : `You have ${classCount} class${classCount > 1 ? 'es' : ''} today.`;

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[900px] w-full mx-auto flex-1">
      {/* OneSignal Prompt */}
      {showNotifyPrompt && (
        <div className="bg-[#6366F1] rounded-[16px] p-5 mb-6 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg shadow-indigo-200 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center gap-4 text-center sm:text-left">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center shrink-0">
              <span className="text-2xl">🔔</span>
            </div>
            <div>
              <h3 className="font-heading text-lg leading-tight">Enable smart alerts?</h3>
              <p className="text-white/80 text-xs">Get &quot;Leave Now&quot; reminders and morning briefings.</p>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button onClick={() => setShowNotifyPrompt(false)} className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold hover:bg-white/10 transition-colors">Later</button>
            <button onClick={handleNotifyEnable} className="flex-1 sm:flex-none px-6 py-2 bg-white text-[#6366F1] rounded-xl text-xs font-bold shadow-sm hover:bg-indigo-50 transition-colors">Turn on</button>
          </div>
        </div>
      )}

      {/* Mobile briefing */}
      <div className="md:hidden bg-[#F5E642] rounded-[12px] p-3 mb-4">
        <p className="text-[10px] text-black/45 uppercase font-bold mb-1">Morning Briefing</p>
        <p className="font-heading text-[#1A1A2E] text-[13px] leading-tight">{loaded ? (classCount > 0 ? `${classCount} classes today. First up: ${todayBlocks[0]?.label || 'class'}.` : 'No classes today — rest up! 🌿') : '...'}</p>
      </div>

      <header className="mb-6 md:mb-8">
        <h2 className="font-heading text-[22px] md:text-[26px] text-[#1A1A2E] leading-[1.1] mb-1">{getGreeting()}, {userName || 'there'}.</h2>
        <p className="font-sans text-[12px] text-[#9CA3AF]">{subtitle}</p>
      </header>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-[10px] md:gap-[12px] mb-6 md:mb-8">
        <Link href="/schedule" className="bg-[#F5E642] rounded-[14px] md:rounded-[16px] p-3 md:p-4 relative overflow-hidden flex flex-col justify-between min-h-[120px] md:min-h-[140px] cursor-pointer hover:opacity-90 transition-opacity col-span-2 md:col-span-1">
          <div>
            <h3 className="text-[10px] md:text-[11px] uppercase tracking-[0.06em] text-black/50 font-bold mb-1">Classes Today</h3>
            {loaded ? (<>
              <div className="font-heading text-[28px] md:text-[32px] text-[#1A1A2E] leading-none mb-1">{classCount}</div>
              <p className="text-[10px] text-black/45 tracking-wide font-medium">{classCount === 0 ? 'Day off!' : `${practicalCount} Practical • ${theoryCount} Theory`}</p>
            </>) : <Skeleton w="w-16" h="h-8" />}
          </div>
        </Link>
        <Link href="/attendance" className="bg-[#F5A8C8] rounded-[14px] md:rounded-[16px] p-3 md:p-4 relative overflow-hidden flex flex-col justify-between min-h-[120px] md:min-h-[140px] cursor-pointer hover:opacity-90 transition-opacity">
          <div>
            <h3 className="text-[10px] md:text-[11px] uppercase tracking-[0.06em] text-black/50 font-bold mb-1">Attendance Risk</h3>
            {loaded ? (<>
              <div className="font-heading text-[28px] md:text-[32px] text-[#1A1A2E] leading-none mb-1">{subjectsAtRisk}</div>
              <p className="text-[10px] text-black/45 tracking-wide font-medium">{subjectsAtRisk === 0 ? 'All clear!' : 'Subjects below 75%'}</p>
            </>) : <Skeleton w="w-12" h="h-8" />}
          </div>
        </Link>
        <Link href="/schedule" className="bg-[#A8D4B0] rounded-[14px] md:rounded-[16px] p-3 md:p-4 relative overflow-hidden flex flex-col justify-between min-h-[120px] md:min-h-[140px] cursor-pointer hover:opacity-90 transition-opacity">
          <div>
            <h3 className="text-[10px] md:text-[11px] uppercase tracking-[0.06em] text-black/50 font-bold mb-1">Free Slots</h3>
            {loaded ? (<>
              <div className="font-heading text-[28px] md:text-[32px] text-[#1A1A2E] leading-none mb-1">{classCount === 0 ? 'All day' : '—'}</div>
              <p className="text-[10px] text-black/45 tracking-wide font-medium">{classCount === 0 ? 'No scheduled blocks' : 'View in schedule'}</p>
            </>) : <Skeleton w="w-16" h="h-8" />}
          </div>
        </Link>
      </div>

      {/* Mobile evening check-in */}
      <div className="lg:hidden bg-white rounded-[12px] p-3 shadow-sm border border-[#F3F4F6] mb-4">
        <p className="text-[10px] text-[#9CA3AF] uppercase font-bold mb-2">How did the day go?</p>
        <div className="flex gap-2">
          {['Solid','Mixed','Rough'].map(r => (
            <button key={r} className={`flex-1 py-1.5 rounded-[6px] text-[10px] font-bold ${r==='Solid'?'bg-[#F0FFF4] text-[#059669]':r==='Mixed'?'bg-[#FFFBEB] text-[#D97706]':'bg-[#FFF0F3] text-[#E11D48]'}`}>{r}</button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-[14px] md:rounded-[16px] shadow-[0_2px_12px_rgba(0,0,0,0.05)] overflow-hidden" ref={menuRef}>
        <div className="flex items-center justify-between p-[12px_16px] md:p-[16px_20px] border-b-[0.5px] border-[#F3F4F6]">
          <h3 className="text-[13px] font-semibold text-[#1A1A2E]">Today&apos;s timeline</h3>
          <div className="bg-[#EEF2FF] text-[#6366F1] px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide">{dateDisplay}</div>
        </div>
        <div className="flex flex-col">
          {!loaded ? (
            <div className="p-4 space-y-3">{[1,2,3].map(i => <div key={i} className="flex gap-3 items-center"><Skeleton w="w-12" h="h-3" /><Skeleton h="h-12" /></div>)}</div>
          ) : todayBlocks.length === 0 ? (
            <div className="py-12 md:py-16 flex flex-col items-center justify-center text-center px-4">
              <span className="text-[42px] md:text-[48px] mb-4">🎉</span>
              <p className="text-[14px] font-semibold text-[#1A1A2E] mb-1">No classes today</p>
              <p className="text-[12px] text-[#9CA3AF]">Enjoy your {dayName}!</p>
            </div>
          ) : todayBlocks.map((event) => {
            const isBunked = bunkedIds.has(event.id);
            return (
            <div key={event.id} className="flex relative items-stretch border-b-[0.5px] border-[#F3F4F6] group hover:bg-[#F9FAFB] transition-colors">
              <div className="w-[50px] md:w-[56px] shrink-0 flex items-center justify-center p-2 md:p-3 text-[10px] tabular-nums text-[#9CA3AF] font-medium border-r-[0.5px] border-[#F3F4F6]">{event.timeStr}</div>
              <div className="flex-1 flex items-center p-2 md:p-3 pl-0 pr-3 md:pr-4 relative">
                <div className="w-[4px] self-stretch mr-3 md:mr-4 my-[-8px] md:my-[-12px] rounded-full bg-[#6366F1]" />
                <div className="w-[24px] md:w-[28px] h-[24px] md:h-[28px] shrink-0 rounded-[8px] flex items-center justify-center mr-2 md:mr-3 bg-[#EEF2FF]">
                  <BookOpen className="w-[12px] md:w-[14px] h-[12px] md:h-[14px] text-[#6366F1]" />
                </div>
                <div className="flex-1 min-w-0 pr-2">
                  <p className={`text-[12px] font-semibold text-[#1A1A2E] truncate ${isBunked ? 'line-through opacity-50' : ''}`}>{event.label}</p>
                  <p className="text-[10px] text-[#9CA3AF] truncate">{event.location}</p>
                </div>
                <div className="flex items-center gap-1.5 md:gap-2 relative">
                  {isBunked ? (
                    <span className="text-[9px] font-bold text-[#EF4444] bg-[#FFF0F3] px-2 py-0.5 rounded-full">BUNKED</span>
                  ) : (<>
                    <button onClick={() => setOpenMenu(openMenu === event.id ? null : event.id)}
                      className="text-[#9CA3AF] md:opacity-0 md:group-hover:opacity-100 transition-opacity p-1 bg-white border border-[#E5E7EB] rounded-md hover:bg-gray-50 shadow-sm">
                      <MoreHorizontal className="w-[14px] h-[14px]" />
                    </button>
                    {openMenu === event.id && (
                      <div className="absolute right-0 top-8 bg-white rounded-[12px] shadow-xl border border-[#E5E7EB] z-50 w-[200px] py-1">
                        <button onClick={() => { setOpenMenu(null); setBunkTarget({ subject: event.subject || event.label, time: `${event.timeStr} – ${event.endTime}` }); }} className="w-full text-left px-4 py-2.5 text-[12px] hover:bg-[#F3F4F6] font-medium">🚫 Bunk this class</button>
                        <button onClick={() => { setOpenMenu(null); setBunkTarget({ subject: event.subject || event.label, time: `${event.timeStr} – ${event.endTime}` }); }} className="w-full text-left px-4 py-2.5 text-[12px] hover:bg-[#F3F4F6] font-medium">❌ Cancelled by professor</button>
                        <button onClick={() => { setOpenMenu(null); }} className="w-full text-left px-4 py-2.5 text-[12px] text-[#9CA3AF] hover:bg-[#F3F4F6] font-medium">🔄 Reschedule</button>
                      </div>
                    )}
                  </>)}
                  <div className="px-[6px] md:px-[8px] py-[3px] rounded-full text-[9px] md:text-[10px] font-semibold tracking-wide bg-[#EEF2FF] text-[#6366F1]">{event.typeLabel}</div>
                </div>
              </div>
            </div>
          );
          })}
        </div>
      </div>

      {/* Bunk Modal */}
      {bunkTarget && user && (
        <BunkModal
          isOpen={!!bunkTarget}
          onClose={() => setBunkTarget(null)}
          subject={bunkTarget.subject}
          timeStr={bunkTarget.time}
          userId={user.uid}
          onBunked={() => {
            const block = todayBlocks.find(b => b.subject === bunkTarget.subject);
            if (block) setBunkedIds(prev => new Set([...prev, block.id]));
          }}
        />
      )}
      <div className="h-6 md:h-8" />
    </div>
  );
}
