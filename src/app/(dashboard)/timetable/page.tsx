"use client";

import { useState, useEffect } from "react";
import { Upload, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { collection, query, where, getDocs } from "firebase/firestore";
import toast from "react-hot-toast";

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const TIME_SLOTS = [
  { start: '12:10 PM', end: '1:05 PM', label: '12:10–1:05', isRecess: false },
  { start: '1:05 PM', end: '2:00 PM', label: '1:05–2:00', isRecess: false },
  { start: '2:00 PM', end: '2:20 PM', label: 'RECESS', isRecess: true },
  { start: '2:20 PM', end: '3:15 PM', label: '2:20–3:15', isRecess: false },
  { start: '3:15 PM', end: '4:10 PM', label: '3:15–4:10', isRecess: false },
  { start: '4:10 PM', end: '4:15 PM', label: 'RECESS', isRecess: true },
  { start: '4:15 PM', end: '5:10 PM', label: '4:15–5:10', isRecess: false },
  { start: '5:10 PM', end: '6:05 PM', label: '5:10–6:05', isRecess: false },
];

const BATCH_COLORS: Record<string, string> = { B1: '#6366F1', B2: '#FDA4AF', B3: '#86EFAC', B4: '#FCD34D' };

const dedup = (classes: any[]) => {
  const seen = new Set();
  return classes.filter(cls => {
    const key = `${cls.subject}-${(cls.days||[]).join(',')}-${cls.startTime}-${cls.batch}`;
    if (seen.has(key)) return false; seen.add(key); return true;
  });
};

export default function TimetablePage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [cleaning, setCleaning] = useState(false);
  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { db } = await import('@/lib/firebase/clientApp');
      const snap = await getDocs(query(collection(db, 'classes'), where('user_id', '==', user.uid)));
      setClasses(dedup(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    };
    load();
  }, [user]);

  const handleCleanup = async () => {
    if (!user) return;
    setCleaning(true);
    try {
      const { auth } = await import('@/lib/firebase/clientApp');
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/admin/deduplicate', {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      toast.success(`Removed ${data.deleted} duplicates, kept ${data.kept} unique classes.`);
      // Reload
      const { db } = await import('@/lib/firebase/clientApp');
      const snap = await getDocs(query(collection(db, 'classes'), where('user_id', '==', user.uid)));
      setClasses(dedup(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    } catch (e: any) { toast.error(e.message); }
    setCleaning(false);
  };

  const getCell = (day: string, slot: typeof TIME_SLOTS[0]) => {
    return classes.filter(cls => {
      if (!cls.days?.some((d: string) => d.toUpperCase() === day.toUpperCase())) return false;
      if (!cls.startTime) return false;
      const normalize = (t: string) => t.replace(/\s+/g, ' ').trim().toUpperCase();
      return normalize(cls.startTime) === normalize(slot.start);
    });
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 w-full mx-auto flex-1">
      <header className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="font-heading text-[22px] md:text-[26px] text-[#1A1A2E] leading-[1.1] mb-1">Timetable Grid</h2>
          <p className="text-[12px] text-[#9CA3AF]">{classes.length} unique classes loaded.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleCleanup} disabled={cleaning}
            className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium text-[#9CA3AF] hover:text-[#6B7280] hover:bg-[#F3F4F6] rounded-[10px] transition-colors disabled:opacity-50">
            <Trash2 className="w-3.5 h-3.5" /> {cleaning ? 'Cleaning...' : 'Clean up duplicates'}
          </button>
          {/* Mobile view toggle */}
          <div className="md:hidden flex bg-[#F3F4F6] rounded-[8px] p-0.5">
            <button onClick={() => setViewMode('grid')} className={`px-3 py-1 rounded-[6px] text-[10px] font-bold ${viewMode === 'grid' ? 'bg-white text-[#1A1A2E] shadow-sm' : 'text-[#9CA3AF]'}`}>Grid</button>
            <button onClick={() => setViewMode('list')} className={`px-3 py-1 rounded-[6px] text-[10px] font-bold ${viewMode === 'list' ? 'bg-white text-[#1A1A2E] shadow-sm' : 'text-[#9CA3AF]'}`}>List</button>
          </div>
          <button onClick={() => window.location.href = '/onboarding'} className="flex items-center gap-2 px-4 py-2 bg-[#6366F1] text-white rounded-[14px] text-[12px] md:text-[13px] font-semibold hover:bg-[#4F46E5] transition-colors shadow-sm">
            <Upload className="w-4 h-4" /> Re-upload
          </button>
        </div>
      </header>

      {/* Mobile scroll hint */}
      {viewMode === 'grid' && <p className="md:hidden text-[10px] text-[#9CA3AF] mb-2 text-right">Scroll left to see full week →</p>}

      {/* Grid View */}
      {viewMode === 'grid' ? (
        <div className="w-full overflow-x-auto">
          <div className="min-w-[900px]">
            <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: '4px' }}>
              <thead>
                <tr>
                  <th className="w-[100px] bg-[#FAFAF8] p-3 text-right text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider rounded-[10px] sticky left-0 z-10">Time</th>
                  {DAY_SHORT.map((day, i) => (
                    <th key={day} className={`p-3 text-center text-[12px] font-bold uppercase tracking-wider rounded-[10px] transition-colors ${DAYS[i] === todayName ? 'bg-[#EEF2FF] text-[#6366F1]' : 'bg-[#FAFAF8] text-[#1A1A2E]'}`} style={{ minWidth: '140px' }}>{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map((slot, idx) => {
                  if (slot.isRecess) {
                    return (<tr key={idx}><td colSpan={7} className="bg-[#F3F4F6] rounded-[8px] text-center py-1.5"><span className="text-[10px] uppercase tracking-[0.15em] text-[#9CA3AF] font-bold">Recess</span></td></tr>);
                  }
                  return (
                    <tr key={idx}>
                      <td className="bg-[#FAFAF8] p-2 text-right align-top rounded-[10px] sticky left-0 z-10"><span className="text-[11px] text-[#9CA3AF] font-medium whitespace-nowrap">{slot.label}</span></td>
                      {DAYS.map((day, di) => {
                        const cellClasses = getCell(day, slot);
                        const isToday = day === todayName;
                        if (cellClasses.length === 0) return <td key={di} className={`rounded-[10px] ${isToday ? 'bg-[#FAFBFF]' : 'bg-[#F9F9F9]'}`}><div className="h-[70px]" /></td>;
                        return (
                          <td key={di} className={`align-top rounded-[10px] ${isToday ? 'bg-[#FAFBFF]' : ''}`}>
                            <div className="flex flex-col gap-[1px]">
                              {cellClasses.map((cls, ci) => (
                                <div key={ci} className="bg-white rounded-[10px] border border-[#E5E7EB] p-2.5 relative overflow-hidden">
                                  {cls.batch && cls.batch !== 'All' && <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-[10px]" style={{ backgroundColor: BATCH_COLORS[cls.batch] || '#6366F1' }} />}
                                  <div className={cls.batch && cls.batch !== 'All' ? 'pl-2' : ''}>
                                    <p className="text-[12px] font-semibold text-[#1A1A2E] leading-tight truncate">{cls.subject}</p>
                                    {cls.faculty && <p className="text-[10px] text-[#9CA3AF] mt-0.5 truncate">{cls.faculty}</p>}
                                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-[4px] ${(cls.type||'').toLowerCase() === 'practical' ? 'bg-[#FFF0F3] text-[#E11D48]' : 'bg-[#EEF2FF] text-[#6366F1]'}`}>{cls.type || 'Theory'}</span>
                                      {cls.room && <span className="text-[9px] text-[#9CA3AF] bg-[#F3F4F6] px-1.5 py-0.5 rounded-[4px]">{cls.room}</span>}
                                      {cls.batch && cls.batch !== 'All' && <span className="text-[9px] font-bold text-[#6366F1] bg-[#EEF2FF] px-1.5 py-0.5 rounded-[4px]">{cls.batch}</span>}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* List View (mobile) */
        <div className="space-y-6">
          {DAYS.map(day => {
            const dayClasses = classes.filter(cls => cls.days?.some((d: string) => d.toUpperCase() === day.toUpperCase()))
              .sort((a, b) => { const tv = (t: string) => { const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i); if (!m) return 0; let h = parseInt(m[1]); if (m[3]?.toUpperCase() === 'PM' && h !== 12) h += 12; return h * 60 + parseInt(m[2]); }; return tv(a.startTime||'')-tv(b.startTime||''); });
            if (dayClasses.length === 0) return null;
            return (
              <div key={day}>
                <h3 className="text-[12px] font-bold text-[#6366F1] uppercase tracking-widest mb-2">{day}</h3>
                {dayClasses.map(cls => (
                  <div key={cls.id} className="bg-white rounded-[10px] border border-[#F3F4F6] p-3 mb-2 flex gap-3 items-center">
                    <div className={`w-[3px] self-stretch rounded-full`} style={{ backgroundColor: BATCH_COLORS[cls.batch] || '#6366F1' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-[#1A1A2E] truncate">{cls.subject}</p>
                      <p className="text-[10px] text-[#9CA3AF]">{cls.startTime} – {cls.endTime} {cls.faculty && `• ${cls.faculty}`}</p>
                    </div>
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-[4px] ${(cls.type||'').toLowerCase() === 'practical' ? 'bg-[#FFF0F3] text-[#E11D48]' : 'bg-[#EEF2FF] text-[#6366F1]'}`}>{cls.type || 'Theory'}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
