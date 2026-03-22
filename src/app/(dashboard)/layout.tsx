"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Home, CalendarDays, Clock, CheckCircle2, Share2, Settings, LogOut, Menu, X
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { doc, getDoc, collection, query, where, getDocs, setDoc, serverTimestamp } from "firebase/firestore";
import { signOut } from "firebase/auth";
import toast from "react-hot-toast";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import MobileNav from "@/components/MobileNav";

const getWeekDays = () => {
  const today = new Date();
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      dateObj: d, date: d.getDate(),
      day: d.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0),
      fullDay: d.toLocaleDateString('en-US', { weekday: 'long' }),
      isToday: d.toDateString() === today.toDateString()
    };
  });
};

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: Home },
  { label: 'Schedule', href: '/schedule', icon: CalendarDays },
  { label: 'Timetable', href: '/timetable', icon: Clock },
  { label: 'Attendance', href: '/attendance', icon: CheckCircle2 },
  { label: 'Batch Share', href: '/batch-share', icon: Share2 },
  { label: 'Settings', href: '/settings', icon: Settings },
];
const BOTTOM_NAV = NAV_ITEMS.filter(n => ['Dashboard','Schedule','Timetable','Attendance','Settings'].includes(n.label));

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const [userName, setUserName] = useState('');
  const [briefing, setBriefing] = useState('');
  const [attendanceWatch, setAttendanceWatch] = useState<any[]>([]);
  const [checkinLogged, setCheckinLogged] = useState<string | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const weekDays = getWeekDays();
  const isOnline = useOnlineStatus();

  useEffect(() => { if (!authLoading && !user) router.replace('/login'); }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const { db } = await import('@/lib/firebase/clientApp');
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists() && userDoc.data().name) setUserName(userDoc.data().name.split(' ')[0]);

        const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        const h = new Date().getHours();
        const classesSnap = await getDocs(query(collection(db, 'classes'), where('user_id', '==', user.uid)));
        const todaysClasses = classesSnap.docs.map(d => d.data()).filter(cls =>
          cls.days?.some((d: string) => String(d).toUpperCase() === dayName.toUpperCase()));

        // Dynamic briefing: after 6pm show tomorrow
        if (h >= 18) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const tmrName = tomorrow.toLocaleDateString('en-US', { weekday: 'long' });
          const tmrClasses = classesSnap.docs.map(d => d.data()).filter(cls =>
            cls.days?.some((d: string) => String(d).toUpperCase() === tmrName.toUpperCase()));
          setBriefing(tmrClasses.length > 0
            ? `Tomorrow: ${tmrClasses.length} classes. First up: ${tmrClasses[0]?.subject || 'class'}.`
            : 'No classes tomorrow — rest up! 🌿');
        } else {
          setBriefing(todaysClasses.length > 0
            ? `${todaysClasses.length} classes today. First up: ${todaysClasses[0]?.subject || 'class'}.`
            : 'No classes today — rest up! 🌿');
        }

        // Attendance
        const allClasses = classesSnap.docs.map(d => d.data());
        const subjects = [...new Set(allClasses.map(c => c.subject))].filter(Boolean);
        try {
          const attData = await Promise.all(subjects.map(async (subject) => {
            const attSnap = await getDocs(query(collection(db, 'attendance'), where('user_id', '==', user.uid), where('subject_name', '==', subject)));
            const records = attSnap.docs.map(d => d.data());
            const total = records.length, attended = records.filter(r => r.status === 'attended').length;
            return { subject, pct: total > 0 ? Math.round((attended / total) * 100) : null, total };
          }));
          setAttendanceWatch(attData.filter(s => s.total > 0).sort((a, b) => (a.pct ?? 100) - (b.pct ?? 100)));
        } catch { setAttendanceWatch([]); }

        // Today checkin
        const todayStr = new Date().toISOString().split('T')[0];
        const checkinSnap = await getDocs(query(collection(db, 'checkins'), where('user_id', '==', user.uid), where('date', '==', todayStr)));
        if (!checkinSnap.empty) setCheckinLogged(checkinSnap.docs[0].data().day_rating);
        setDataLoaded(true);
      } catch (e) { console.error(e); setDataLoaded(true); }
    };
    load();
  }, [user]);

  // OneSignal Push Notifications
  useEffect(() => {
    if (!user || typeof window === 'undefined') return;
    (window as any).OneSignalDeferred = (window as any).OneSignalDeferred || [];
    (window as any).OneSignalDeferred.push(async function(OneSignal: any) {
      await OneSignal.init({
        appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
        safari_web_id: "web.onesignal.auto.10425fa5-385c-4217-bc5b-4395e921876a",
        notifyButton: { enable: true },
      });
      
      const saveId = async (id: string) => {
        const { db } = await import('@/lib/firebase/clientApp');
        await setDoc(doc(db, 'users', user.uid), { onesignal_player_id: id }, { merge: true });
      };

      if (OneSignal.User.PushSubscription.id) {
        saveId(OneSignal.User.PushSubscription.id);
      }
      
      OneSignal.User.PushSubscription.addEventListener("change", (event: any) => {
        if (event.current.id) saveId(event.current.id);
      });
    });
  }, [user]);

  const handleCheckin = async (rating: string) => {
    if (!user) return;
    try {
      const { db } = await import('@/lib/firebase/clientApp');
      const todayStr = new Date().toISOString().split('T')[0];
      await setDoc(doc(db, 'checkins', `${user.uid}_${todayStr}`), {
        user_id: user.uid, date: todayStr, day_rating: rating, logged_at: serverTimestamp()
      }, { merge: true });
      setCheckinLogged(rating);
      toast.success('Day logged! See your weekly report on Sunday. 📊');
    } catch (e: any) { toast.error(e.message); }
  };

  const handleLogout = async () => {
    try { const { auth } = await import('@/lib/firebase/clientApp'); await signOut(auth); router.replace('/'); }
    catch { toast.error('Logout failed'); }
  };

  if (authLoading || !user) return <div className="min-h-screen bg-[#FAFAF8]" />;

  return (
    <div className="min-h-[100dvh] bg-[#E5E0D5] lg:p-6 flex items-center justify-center font-sans">
      <div className="w-full max-w-[1400px] h-[100dvh] lg:h-[90vh] lg:min-h-[700px] bg-[#FAFAF8] lg:rounded-[20px] lg:border-[1.5px] lg:border-[#E5E0D5] overflow-hidden grid grid-cols-1 md:grid-cols-[240px_1fr] lg:grid-cols-[240px_1fr_300px] lg:shadow-[0_8px_32px_rgba(0,0,0,0.05)]">

        {/* ── SIDEBAR (hidden on mobile) ── */}
        <aside className="hidden md:flex bg-[#0F0F1A] flex-col p-[20px_14px] overflow-y-auto">
          <div className="mb-8 px-2">
            <Link href="/dashboard"><h1 className="font-heading text-[20px] text-white leading-none tracking-tight">Day<span className="text-[#6366F1]">o</span></h1></Link>
          </div>
          <div className="flex flex-col gap-1 mb-6">
            <p className="text-[9px] text-white/30 uppercase tracking-widest px-2 mb-2 font-semibold">General</p>
            {NAV_ITEMS.slice(0, 4).map(item => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (<Link key={item.href} href={item.href} className={`w-full flex items-center gap-3 px-[10px] py-[8px] rounded-[10px] text-[12px] font-sans transition-colors ${isActive ? 'bg-[rgba(99,102,241,0.2)] text-white font-medium' : 'text-white/50 hover:text-white/80 hover:bg-white/5'}`}>
                <Icon className="w-[14px] h-[14px] shrink-0" strokeWidth={2.5} /><span>{item.label}</span>
              </Link>);
            })}
          </div>
          <div className="flex flex-col gap-1 mb-auto">
            <p className="text-[9px] text-white/30 uppercase tracking-widest px-2 mb-2 mt-2 font-semibold">More</p>
            {NAV_ITEMS.slice(4).map(item => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (<Link key={item.href} href={item.href} className={`w-full flex items-center gap-3 px-[10px] py-[8px] rounded-[10px] text-[12px] font-sans transition-colors ${isActive ? 'bg-[rgba(99,102,241,0.2)] text-white font-medium' : 'text-white/50 hover:text-white/80 hover:bg-white/5'}`}>
                <Icon className="w-[14px] h-[14px] shrink-0" strokeWidth={2.5} /><span>{item.label}</span>
              </Link>);
            })}
          </div>
          <div className="flex flex-col gap-1 mt-6 border-t border-white/10 pt-4">
            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-[10px] py-[8px] rounded-[10px] text-[12px] font-sans transition-colors text-white/50 hover:text-white/80 hover:bg-white/5">
              <LogOut className="w-[14px] h-[14px] shrink-0" strokeWidth={2.5} /><span>Log out</span>
            </button>
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main className="flex flex-col overflow-y-auto bg-[#FAFAF8] h-full pb-[80px] md:pb-0">
          {/* Offline banner */}
          {!isOnline && (
            <div className="bg-amber-400 text-amber-900 text-center text-sm py-2 z-50 font-medium">📡 Offline — showing cached data</div>
          )}
          {/* Mobile header */}
          <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-[#F3F4F6] bg-white sticky top-0 z-30">
            <Link href="/dashboard"><h1 className="font-heading text-[18px] text-[#1A1A2E]">Day<span className="text-[#6366F1]">o</span></h1></Link>
            <div className="flex items-center gap-1">
              {weekDays.map((d, i) => (
                <Link key={i} href={`/schedule?day=${d.fullDay}`} className={`w-[24px] h-[24px] rounded-full flex items-center justify-center text-[10px] font-semibold ${d.isToday ? 'bg-[#6366F1] text-white' : 'text-[#9CA3AF]'}`}>{d.date}</Link>
              ))}
            </div>
          </div>
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>

        <MobileNav />

        {/* ── RIGHT PANEL (hidden on mobile + tablet) ── */}
        <aside className="hidden lg:flex flex-col gap-[16px] p-[20px_16px] border-l-[0.5px] border-[#F3F4F6] overflow-y-auto bg-[#FAFAF8] custom-scrollbar">
          {/* Week Strip */}
          <div className="flex justify-between items-start pt-2">
            {weekDays.map((d, i) => (
              <Link key={i} href={`/schedule?day=${d.fullDay}`} className="flex flex-col items-center gap-[6px] group">
                <span className="text-[9px] uppercase text-[#9CA3AF] font-bold">{d.day}</span>
                <div className={`w-[26px] h-[26px] rounded-full flex items-center justify-center text-[12px] font-semibold transition-colors ${d.isToday ? 'bg-[#6366F1] text-white' : 'text-[#4B5563] group-hover:bg-[#F3F4F6]'}`}>{d.date}</div>
                <div className={`w-[4px] h-[4px] rounded-full ${d.isToday ? 'bg-[#6366F1]' : 'bg-[#E5E7EB]'}`} />
              </Link>
            ))}
          </div>
          <div className="h-[1px] bg-[#F3F4F6] w-full my-1" />

          {/* Morning Briefing */}
          <div className="bg-[#F5E642] rounded-[16px] p-[14px] relative overflow-hidden">
            <p className="text-[10px] text-black/45 uppercase tracking-[0.06em] font-bold mb-2">Morning Briefing</p>
            <p className="font-heading text-[#1A1A2E] text-[14px] leading-[1.25] max-w-[90%]">{briefing || 'Loading...'}</p>
          </div>

          {/* Attendance Watch */}
          <div className="bg-[#0F0F1A] rounded-[16px] p-[14px] flex flex-col gap-3">
            <p className="text-[10px] text-white/40 uppercase tracking-[0.06em] font-bold mb-1">Attendance Watch</p>
            {attendanceWatch.length === 0 ? (
              <p className="text-[11px] text-white/30 font-medium py-4 text-center">{dataLoaded ? 'Attend some classes to see stats here.' : 'Loading...'}</p>
            ) : attendanceWatch.slice(0, 4).map((sub, i) => {
              const pct = sub.pct ?? 0;
              const color = pct < 70 ? '#EF4444' : pct < 75 ? '#F59E0B' : '#22C55E';
              return (<div key={i} className="flex flex-col gap-1">
                <div className="flex justify-between items-end">
                  <span className="text-[12px] font-semibold text-white truncate max-w-[140px]">{sub.subject}</span>
                  <div className="flex items-baseline gap-[1px]"><span className="font-heading text-[22px] leading-none" style={{ color }}>{pct}</span><span className="text-[10px] text-white/50">%</span></div>
                </div>
                <div className="h-[4px] w-full bg-white/10 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} /></div>
              </div>);
            })}
          </div>

          {/* Evening Check-in */}
          <div className="bg-white rounded-[16px] p-[14px] shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-[#F3F4F6] mt-auto">
            <p className="text-[10px] text-[#9CA3AF] uppercase tracking-[0.06em] font-bold mb-2">Evening Check-in</p>
            {checkinLogged ? (
              <div className="flex items-center justify-between">
                <p className={`text-[12px] font-semibold ${checkinLogged === 'solid' ? 'text-[#059669]' : checkinLogged === 'mixed' ? 'text-[#D97706]' : 'text-[#E11D48]'}`}>✓ Logged — {checkinLogged} day</p>
                <button onClick={() => setCheckinLogged(null)} className="text-[10px] text-[#6366F1] font-medium hover:underline">Change</button>
              </div>
            ) : (<>
              <p className="text-[12px] font-semibold text-[#1A1A2E] leading-snug mb-3">How did the day go?</p>
              <div className="flex gap-[6px]">
                <button onClick={() => handleCheckin('solid')} className="flex-1 py-1.5 rounded-[6px] text-[10px] font-bold tracking-wide bg-[#F0FFF4] text-[#059669] hover:bg-[#D1FAE5] transition-colors">Solid</button>
                <button onClick={() => handleCheckin('mixed')} className="flex-1 py-1.5 rounded-[6px] text-[10px] font-bold tracking-wide bg-[#FFFBEB] text-[#D97706] hover:bg-[#FEF3C7] transition-colors">Mixed</button>
                <button onClick={() => handleCheckin('rough')} className="flex-1 py-1.5 rounded-[6px] text-[10px] font-bold tracking-wide bg-[#FFF0F3] text-[#E11D48] hover:bg-[#FFE4E6] transition-colors">Rough</button>
              </div>
            </>)}
          </div>
        </aside>
      </div>

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#F3F4F6] z-50 flex items-center justify-around" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
        {BOTTOM_NAV.map(item => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="flex flex-col items-center gap-0.5 py-2 px-3">
              <Icon className={`w-[20px] h-[20px] ${isActive ? 'text-[#6366F1]' : 'text-[#9CA3AF]'}`} strokeWidth={2} />
              <span className={`text-[10px] font-medium ${isActive ? 'text-[#6366F1]' : 'text-[#9CA3AF]'}`}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <style dangerouslySetInnerHTML={{__html:`
        .custom-scrollbar::-webkit-scrollbar{width:4px}.custom-scrollbar::-webkit-scrollbar-track{background:transparent}.custom-scrollbar::-webkit-scrollbar-thumb{background:#E5E7EB;border-radius:4px}
      `}} />
    </div>
  );
}
