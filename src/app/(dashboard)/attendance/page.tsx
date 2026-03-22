"use client";

import { useState, useEffect, useCallback } from "react";
import { PlusCircle, Trash2, ChevronDown, ChevronUp, CalendarDays, AlertTriangle, TrendingUp, BookOpen } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import toast from "react-hot-toast";

// ── Helpers ──
const dedup = (classes: any[]) => {
  const seen = new Set();
  return classes.filter(cls => {
    const key = `${cls.subject}-${(cls.days || []).join(',')}-${cls.startTime}-${cls.batch}`;
    if (seen.has(key)) return false; seen.add(key); return true;
  });
};

const calculateClassesSoFar = (days: string[], semesterStart: string): number => {
  const start = new Date(semesterStart);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  let count = 0;
  const current = new Date(start);
  while (current <= today) {
    const dayName = current.toLocaleDateString('en-US', { weekday: 'long' });
    if (days.some(d => d.toUpperCase() === dayName.toUpperCase())) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
};

const getStatusBadge = (pct: number | null) => {
  if (pct === null) return { label: 'No data', color: '#9CA3AF', bg: '#F3F4F6' };
  if (pct >= 80) return { label: 'Safe', color: '#059669', bg: '#F0FFF4' };
  if (pct >= 75) return { label: 'Warning', color: '#D97706', bg: '#FFFBEB' };
  return { label: 'Danger', color: '#E11D48', bg: '#FFF0F3' };
};

const getSafeBunks = (attended: number, total: number): number => {
  if (total === 0) return 0;
  // attended - 0.75 * total (current) means how many above the line
  // But we need: (attended) / (total + x) >= 0.75 → x = (attended / 0.75) - total
  const safe = Math.floor((attended / 0.75) - total);
  return Math.max(0, safe);
};

// Last N days for quick date pills
const getLastNDays = (n: number) => {
  const days = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      dateStr: d.toISOString().split('T')[0],
      label: i === 0 ? 'Today' : i === 1 ? 'Yesterday' : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }),
      dayName: d.toLocaleDateString('en-US', { weekday: 'long' })
    });
  }
  return days;
};

type SubjectData = {
  subject: string;
  days: string[];
  attended: number;
  bunked: number;
  total: number;
  pct: number | null;
  safeBunks: number;
  history: any[];
};

// ── Log Attendance Modal ──
function LogModal({ subject, onClose, onLogged, userId }: { subject: string; onClose: () => void; onLogged: () => void; userId: string }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [logging, setLogging] = useState(false);
  const quickDays = getLastNDays(7);

  const logAttendance = async (status: 'attended' | 'bunked') => {
    setLogging(true);
    try {
      const { db } = await import('@/lib/firebase/clientApp');
      // Check for duplicate
      const existing = await getDocs(query(
        collection(db, 'attendance'),
        where('user_id', '==', userId),
        where('subject_name', '==', subject),
        where('date', '==', selectedDate)
      ));
      if (!existing.empty) {
        toast.error("Already logged for this date. Delete the entry first to change it.");
        setLogging(false);
        return;
      }
      await addDoc(collection(db, 'attendance'), {
        user_id: userId, subject_name: subject, date: selectedDate,
        status, logged_at: serverTimestamp()
      });
      const dateLabel = new Date(selectedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      toast.success(`${subject} — ${status} on ${dateLabel}`);
      onLogged();
      onClose();
    } catch (e: any) { toast.error(e.message); }
    setLogging(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-[100] flex items-end sm:items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ animation: 'fadeIn 200ms ease-out' }}>
      <div className="bg-white w-full max-w-[420px] rounded-t-[24px] sm:rounded-[20px] shadow-2xl" style={{ animation: 'slideUp 300ms ease-out' }}>
        <div className="flex justify-center pt-3 pb-1 sm:hidden"><div className="w-[36px] h-[3px] bg-[#E5E7EB] rounded-full" /></div>
        <div className="p-5">
          <h3 className="font-heading text-[18px] text-[#1A1A2E] mb-1">Log attendance</h3>
          <p className="text-[12px] text-[#9CA3AF] mb-4">{subject}</p>

          {/* Quick date pills */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {quickDays.map(d => (
              <button key={d.dateStr} onClick={() => setSelectedDate(d.dateStr)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors ${selectedDate === d.dateStr ? 'bg-[#6366F1] text-white' : 'bg-[#F3F4F6] text-[#4B5563] hover:bg-[#E5E7EB]'}`}>
                {d.label}
              </button>
            ))}
          </div>

          {/* Custom date */}
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            className="w-full h-[42px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-[10px] px-3 text-[13px] text-[#1A1A2E] mb-4 outline-none focus:border-[#6366F1] transition-colors" />

          {/* Action buttons */}
          <div className="flex gap-3">
            <button onClick={() => logAttendance('attended')} disabled={logging}
              className="flex-1 py-3 rounded-[12px] text-[13px] font-bold bg-[#059669] text-white hover:bg-[#047857] transition-colors disabled:opacity-50">
              ✓ Attended
            </button>
            <button onClick={() => logAttendance('bunked')} disabled={logging}
              className="flex-1 py-3 rounded-[12px] text-[13px] font-bold bg-[#EF4444] text-white hover:bg-[#DC2626] transition-colors disabled:opacity-50">
              ✗ Bunked
            </button>
          </div>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}` }} />
    </div>
  );
}

// ── Main Page ──
export default function AttendancePage() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<SubjectData[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [semesterStart, setSemesterStart] = useState('');
  const [semesterEnd, setSemesterEnd] = useState('');
  const [semesterConfigured, setSemesterConfigured] = useState(false);
  const [savingSemester, setSavingSemester] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [logTarget, setLogTarget] = useState<string | null>(null);
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);
  const [classesThisWeek, setClassesThisWeek] = useState(0);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const { db } = await import('@/lib/firebase/clientApp');

      // Get user settings
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      const userData = userSnap.exists() ? userSnap.data() : {};
      const semStart = userData.semester_start_date || userData.semester_start || '';
      const semEnd = userData.semester_end_date || userData.semester_end || '';
      setSemesterStart(semStart);
      setSemesterEnd(semEnd);
      setSemesterConfigured(!!semStart);

      // Get classes
      const classesSnap = await getDocs(query(collection(db, 'classes'), where('user_id', '==', user.uid)));
      const allClasses = dedup(classesSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // Calculate classes this week
      const todayDow = new Date().getDay();
      const monday = new Date(); monday.setDate(monday.getDate() - (todayDow === 0 ? 6 : todayDow - 1));
      const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      let weekCount = 0;
      for (const cls of allClasses) {
        for (const day of (cls.days || [])) {
          if (WEEK_DAYS.some(wd => wd.toUpperCase() === String(day).toUpperCase())) weekCount++;
        }
      }
      setClassesThisWeek(weekCount);

      // Get unique subjects with their days
      const subjectMap: Record<string, string[]> = {};
      for (const cls of allClasses) {
        if (!cls.subject) continue;
        if (!subjectMap[cls.subject]) subjectMap[cls.subject] = [];
        for (const d of (cls.days || [])) {
          if (!subjectMap[cls.subject].includes(d)) subjectMap[cls.subject].push(d);
        }
      }

      // Get attendance records
      const attSnap = await getDocs(query(collection(db, 'attendance'), where('user_id', '==', user.uid)));
      const allRecords = attSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Build subject data
      const subjectData: SubjectData[] = Object.entries(subjectMap).map(([subject, days]) => {
        const records = allRecords.filter((r: any) => r.subject_name === subject);
        const attended = records.filter((r: any) => r.status === 'attended').length;
        const bunked = records.filter((r: any) => r.status === 'bunked').length;
        const total = semStart ? calculateClassesSoFar(days, semStart) : (attended + bunked);
        const pct = total > 0 ? Math.round((attended / total) * 100) : null;
        const safeBunks = total > 0 ? getSafeBunks(attended, total) : 0;
        const history = records.sort((a: any, b: any) => (b.date || '').localeCompare(a.date || '')).slice(0, 5);
        return { subject, days, attended, bunked, total, pct, safeBunks, history };
      }).sort((a, b) => (a.pct ?? 100) - (b.pct ?? 100));

      setSubjects(subjectData);
      setLoaded(true);
    } catch (e) { console.error(e); setLoaded(true); }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const saveSemester = async () => {
    if (!user || !semesterStart) { toast.error('Please set the semester start date.'); return; }
    setSavingSemester(true);
    try {
      const { db } = await import('@/lib/firebase/clientApp');
      await setDoc(doc(db, 'users', user.uid), {
        semester_start_date: semesterStart, semester_end_date: semesterEnd
      }, { merge: true });
      setSemesterConfigured(true);
      toast.success('Semester dates saved!');
      loadData();
    } catch (e: any) { toast.error(e.message); }
    setSavingSemester(false);
  };

  const resetAttendance = async () => {
    if (!user) return;
    setResetting(true);
    try {
      const { db } = await import('@/lib/firebase/clientApp');
      const attSnap = await getDocs(query(collection(db, 'attendance'), where('user_id', '==', user.uid)));
      const batch: Promise<void>[] = [];
      attSnap.docs.forEach(d => batch.push(deleteDoc(doc(db, 'attendance', d.id))));
      await Promise.all(batch);
      toast.success(`Attendance reset — deleted ${attSnap.size} records.`);
      setConfirmReset(false);
      loadData();
    } catch (e: any) { toast.error(e.message); }
    setResetting(false);
  };

  // Summary stats
  const overallPct = subjects.length > 0 && subjects.some(s => s.total > 0)
    ? Math.round(subjects.filter(s => s.total > 0).reduce((sum, s) => sum + (s.pct ?? 0), 0) / subjects.filter(s => s.total > 0).length)
    : null;
  const atRisk = subjects.filter(s => s.pct !== null && s.pct < 75).length;

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[960px] w-full mx-auto flex-1">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h2 className="font-heading text-[22px] md:text-[26px] text-[#1A1A2E] leading-[1.1] mb-1">Attendance Tracker</h2>
          <p className="text-[12px] text-[#9CA3AF]">Track your attendance across all subjects.</p>
        </div>
        <div className="flex gap-2">
          {confirmReset ? (
            <div className="flex items-center gap-2 bg-[#FFF0F3] rounded-[10px] px-3 py-2">
              <span className="text-[11px] text-[#E11D48] font-semibold">Delete all records?</span>
              <button onClick={resetAttendance} disabled={resetting} className="text-[11px] font-bold text-white bg-[#EF4444] px-3 py-1 rounded-[6px] hover:bg-[#DC2626] disabled:opacity-50">{resetting ? '...' : 'Yes, reset'}</button>
              <button onClick={() => setConfirmReset(false)} className="text-[11px] font-bold text-[#9CA3AF] px-2 py-1">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmReset(true)} className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium text-[#EF4444] border border-[#FECACA] hover:bg-[#FFF0F3] rounded-[10px] transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Reset Data
            </button>
          )}
        </div>
      </header>

      {/* ── Semester Setup ── */}
      {!semesterConfigured && loaded && (
        <div className="bg-white rounded-[16px] p-5 shadow-sm border border-[#E5E7EB] mb-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 bg-[#EEF2FF] rounded-[10px] flex items-center justify-center shrink-0"><CalendarDays className="w-5 h-5 text-[#6366F1]" /></div>
            <div>
              <h3 className="text-[14px] font-bold text-[#1A1A2E]">Set up your semester</h3>
              <p className="text-[11px] text-[#9CA3AF]">We&apos;ll calculate how many classes should have happened so far.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest mb-1 block">Start Date</label>
              <input type="date" value={semesterStart} onChange={e => setSemesterStart(e.target.value)}
                className="w-full h-[44px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-[10px] px-3 text-[13px] text-[#1A1A2E] outline-none focus:border-[#6366F1]" />
            </div>
            <div>
              <label className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest mb-1 block">End Date</label>
              <input type="date" value={semesterEnd} onChange={e => setSemesterEnd(e.target.value)}
                className="w-full h-[44px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-[10px] px-3 text-[13px] text-[#1A1A2E] outline-none focus:border-[#6366F1]" />
            </div>
          </div>
          <button onClick={saveSemester} disabled={savingSemester}
            className="w-full py-3 bg-[#6366F1] text-white rounded-[12px] text-[13px] font-bold hover:bg-[#4F46E5] transition-colors disabled:opacity-50">
            {savingSemester ? 'Saving...' : 'Save Semester Dates'}
          </button>
        </div>
      )}

      {/* ── Summary Cards ── */}
      {loaded && subjects.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className={`rounded-[14px] p-3 md:p-4 ${overallPct !== null && overallPct >= 75 ? 'bg-[#A8D4B0]' : overallPct !== null ? 'bg-[#F5A8C8]' : 'bg-[#F3F4F6]'}`}>
            <p className="text-[9px] md:text-[10px] uppercase tracking-widest text-black/50 font-bold mb-1">Overall</p>
            <p className="font-heading text-[24px] md:text-[28px] text-[#1A1A2E] leading-none">{overallPct !== null ? `${overallPct}%` : '—'}</p>
            <p className="text-[9px] md:text-[10px] text-black/45 mt-0.5">Average attendance</p>
          </div>
          <div className={`rounded-[14px] p-3 md:p-4 ${atRisk > 0 ? 'bg-[#F5A8C8]' : 'bg-[#A8D4B0]'}`}>
            <p className="text-[9px] md:text-[10px] uppercase tracking-widest text-black/50 font-bold mb-1">At Risk</p>
            <p className="font-heading text-[24px] md:text-[28px] text-[#1A1A2E] leading-none">{atRisk}</p>
            <p className="text-[9px] md:text-[10px] text-black/45 mt-0.5">{atRisk === 0 ? 'All clear!' : 'Below 75%'}</p>
          </div>
          <div className="rounded-[14px] p-3 md:p-4 bg-[#F5E642]">
            <p className="text-[9px] md:text-[10px] uppercase tracking-widest text-black/50 font-bold mb-1">This Week</p>
            <p className="font-heading text-[24px] md:text-[28px] text-[#1A1A2E] leading-none">{classesThisWeek}</p>
            <p className="text-[9px] md:text-[10px] text-black/45 mt-0.5">Total classes</p>
          </div>
        </div>
      )}

      {/* ── Attendance Table ── */}
      {!loaded ? (
        <div className="space-y-3 py-10">{[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-[#F3F4F6] rounded-[12px] animate-pulse" />)}</div>
      ) : subjects.length === 0 ? (
        <div className="py-16 flex flex-col items-center text-center">
          <span className="text-[48px] mb-4">📊</span>
          <p className="text-[14px] font-semibold text-[#1A1A2E] mb-1">No subjects found</p>
          <p className="text-[12px] text-[#9CA3AF]">Upload your timetable first to see subjects here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-[16px] shadow-[0_2px_12px_rgba(0,0,0,0.05)] overflow-hidden">
          {/* Desktop Header */}
          <div className="hidden md:grid grid-cols-[1fr_60px_60px_70px_90px_80px_70px] gap-0 text-[9px] uppercase tracking-widest text-[#9CA3AF] font-bold p-4 border-b border-[#F3F4F6]">
            <span>Subject</span><span className="text-center">Done</span><span className="text-center">Total</span><span className="text-center">%</span><span className="text-center">Safe Bunks</span><span className="text-center">Status</span><span className="text-center">Log</span>
          </div>

          {subjects.map((sub) => {
            const badge = getStatusBadge(sub.pct);
            const isExpanded = expandedSubject === sub.subject;
            return (
              <div key={sub.subject} className="border-b border-[#F3F4F6] last:border-0">
                {/* ── Desktop Row ── */}
                <div className="hidden md:grid grid-cols-[1fr_60px_60px_70px_90px_80px_70px] gap-0 p-4 items-center hover:bg-[#F9FAFB] transition-colors cursor-pointer"
                  onClick={() => setExpandedSubject(isExpanded ? null : sub.subject)}>
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-[#9CA3AF]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#9CA3AF]" />}
                    <span className="text-[13px] font-semibold text-[#1A1A2E] truncate">{sub.subject}</span>
                  </div>
                  <span className="text-center text-[13px] text-[#4B5563] font-medium">{sub.attended}</span>
                  <span className="text-center text-[13px] text-[#4B5563]">{sub.total}</span>
                  <div className="flex flex-col items-center gap-1">
                    <span className="font-heading text-[16px]" style={{ color: badge.color }}>{sub.pct ?? '—'}{sub.pct !== null && '%'}</span>
                    <div className="w-full h-[3px] bg-[#F3F4F6] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${sub.pct ?? 0}%`, backgroundColor: badge.color }} />
                    </div>
                  </div>
                  <div className="text-center">
                    <span className={`text-[11px] font-bold ${sub.safeBunks > 3 ? 'text-[#059669]' : sub.safeBunks > 0 ? 'text-[#D97706]' : 'text-[#EF4444]'}`}>
                      {sub.total === 0 ? '—' : sub.safeBunks > 0 ? `${sub.safeBunks} more` : sub.pct !== null && sub.pct < 75 ? 'Below 75%!' : 'At limit'}
                    </span>
                  </div>
                  <div className="flex justify-center">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold" style={{ backgroundColor: badge.bg, color: badge.color }}>{badge.label}</span>
                  </div>
                  <div className="flex justify-center" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setLogTarget(sub.subject)} className="flex items-center gap-1 text-[10px] font-semibold text-[#6366F1] hover:bg-[#EEF2FF] px-2 py-1 rounded-[6px] transition-colors">
                      <PlusCircle className="w-3 h-3" /> Log
                    </button>
                  </div>
                </div>

                {/* ── Mobile Card ── */}
                <div className="md:hidden p-3" onClick={() => setExpandedSubject(isExpanded ? null : sub.subject)}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0" />}
                      <span className="text-[13px] font-semibold text-[#1A1A2E] truncate">{sub.subject}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold" style={{ backgroundColor: badge.bg, color: badge.color }}>{badge.label}</span>
                      <button onClick={e => { e.stopPropagation(); setLogTarget(sub.subject); }}
                        className="flex items-center gap-1 text-[10px] font-semibold text-[#6366F1] bg-[#EEF2FF] px-2.5 py-1 rounded-[6px]">
                        <PlusCircle className="w-3 h-3" /> Log
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[11px] text-[#9CA3AF]">{sub.attended}/{sub.total}</span>
                    <span className="font-heading text-[18px]" style={{ color: badge.color }}>{sub.pct ?? '—'}{sub.pct !== null && '%'}</span>
                    <span className={`text-[10px] font-bold ${sub.safeBunks > 0 ? 'text-[#059669]' : 'text-[#EF4444]'}`}>
                      {sub.total === 0 ? '' : sub.safeBunks > 0 ? `${sub.safeBunks} bunks left` : 'No bunks left'}
                    </span>
                  </div>
                  <div className="w-full h-[3px] bg-[#F3F4F6] rounded-full overflow-hidden mt-2">
                    <div className="h-full rounded-full transition-all" style={{ width: `${sub.pct ?? 0}%`, backgroundColor: badge.color }} />
                  </div>
                </div>

                {/* ── Expanded History ── */}
                {isExpanded && (
                  <div className="bg-[#F9FAFB] px-4 md:px-8 py-3 border-t border-[#F3F4F6]">
                    <p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest mb-2">Recent History</p>
                    {sub.history.length === 0 ? (
                      <p className="text-[11px] text-[#9CA3AF] py-2">No entries yet. Click &quot;+ Log&quot; to start tracking.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {sub.history.map((entry: any, i: number) => (
                          <div key={i} className="flex items-center justify-between py-1.5">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${entry.status === 'attended' ? 'bg-[#059669]' : 'bg-[#EF4444]'}`} />
                              <span className="text-[12px] text-[#1A1A2E]">{new Date(entry.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                            </div>
                            <span className={`text-[10px] font-bold uppercase ${entry.status === 'attended' ? 'text-[#059669]' : 'text-[#EF4444]'}`}>{entry.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-[10px] text-[#9CA3AF] mt-2">Scheduled on: {sub.days.join(', ')}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Log Modal ── */}
      {logTarget && user && (
        <LogModal subject={logTarget} userId={user.uid} onClose={() => setLogTarget(null)} onLogged={loadData} />
      )}

      <div className="h-20" />
    </div>
  );
}
