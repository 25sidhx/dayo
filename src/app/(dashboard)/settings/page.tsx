"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { doc, getDoc, setDoc, getDocs, collection, query, where, deleteDoc } from "firebase/firestore";
import toast from "react-hot-toast";

export default function SettingsPage() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: '', batch: '', wakeTime: '07:00', sleepTime: '23:00',
    morningCommute: 30, eveningCommute: 30, rushHour: false,
    semesterWeeks: 16, state: '', intensity: 'Balanced',
    semesterStart: new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [dataHealth, setDataHealth] = useState<{ classes: number; blocks: number; attendance: number } | null>(null);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { db } = await import('@/lib/firebase/clientApp');
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) {
        const d = snap.data();
        setForm({
          name: d.name || '', batch: d.batch || '',
          wakeTime: d.wake_time || '07:00', sleepTime: d.sleep_time || '23:00',
          morningCommute: d.morning_commute_mins || 30, eveningCommute: d.Evening_commute_mins || 30,
          rushHour: d.rush_hour_buffer || false, semesterWeeks: d.semester_weeks || 16,
          state: d.state || '', intensity: d.checkin_intensity || 'Balanced',
          semesterStart: d.semester_start_date || new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        });
      }
    };
    load();
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { db } = await import('@/lib/firebase/clientApp');
      await setDoc(doc(db, 'users', user.uid), {
        name: form.name, batch: form.batch,
        wake_time: form.wakeTime, sleep_time: form.sleepTime,
        morning_commute_mins: form.morningCommute, Evening_commute_mins: form.eveningCommute,
        rush_hour_buffer: form.rushHour, semester_weeks: form.semesterWeeks,
        state: form.state, checkin_intensity: form.intensity,
        semester_start_date: form.semesterStart
      }, { merge: true });
      toast.success('Settings saved!');
    } catch (e: any) { toast.error(e.message); }
    setSaving(false);
  };

  const handleRegenerate = async () => {
    if (!user) return;
    setRegenerating(true);
    const toastId = toast.loading("Building your schedule...");
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/generate-schedule', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      if (!res.ok) throw new Error("Failed to generate schedule");
      toast.success("Schedule updated!", { id: toastId });
    } catch (e: any) {
      toast.error(e.message, { id: toastId });
    }
    setRegenerating(false);
  };

  const inputCls = "w-full h-[48px] bg-white border-[1.5px] border-[#F3F4F6] rounded-[12px] px-4 text-[14px] text-[#1A1A2E] focus:border-[#6366F1] outline-none transition-colors";
  const labelCls = "text-[11px] text-[#9CA3AF] font-bold uppercase tracking-widest mb-1.5 block";

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[600px] w-full mx-auto flex-1">
      <header className="mb-8">
        <h2 className="font-heading text-[26px] text-[#1A1A2E] leading-[1.1] mb-1">Settings</h2>
        <p className="text-[12px] text-[#9CA3AF]">Update your preferences and account info.</p>
      </header>

      <div className="space-y-6">
        {/* Profile */}
        <div className="bg-white rounded-[16px] p-5 shadow-sm border border-[#F3F4F6]">
          <h3 className="text-[13px] font-bold text-[#1A1A2E] mb-4">Profile</h3>
          <div className="space-y-4">
            <div><label className={labelCls}>Name</label><input className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div>
              <label className={labelCls}>Batch</label>
              <div className="flex gap-2">
                {['B1', 'B2', 'B3', 'B4'].map(b => (
                  <button key={b} onClick={() => setForm(f => ({ ...f, batch: b }))}
                    className={`flex-1 py-2.5 rounded-[10px] text-[13px] font-bold transition-colors ${
                      form.batch === b ? 'bg-[#6366F1] text-white' : 'bg-[#F3F4F6] text-[#4B5563] hover:bg-[#E5E7EB]'
                    }`}
                  >{b}</button>
                ))}
              </div>
            </div>
            <div><label className={labelCls}>State (for holidays)</label><input className={inputCls} value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} placeholder="Maharashtra" /></div>
          </div>
        </div>

        {/* Schedule Prefs */}
        <div className="bg-white rounded-[16px] p-5 shadow-sm border border-[#F3F4F6]">
          <h3 className="text-[13px] font-bold text-[#1A1A2E] mb-4">Schedule Preferences</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls}>Wake Time</label><input type="time" className={inputCls} value={form.wakeTime} onChange={e => setForm(f => ({ ...f, wakeTime: e.target.value }))} /></div>
              <div><label className={labelCls}>Sleep Time</label><input type="time" className={inputCls} value={form.sleepTime} onChange={e => setForm(f => ({ ...f, sleepTime: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Morning Commute (min)</label>
                <input type="range" min={0} max={120} value={form.morningCommute} onChange={e => setForm(f => ({ ...f, morningCommute: Number(e.target.value) }))} className="w-full accent-[#6366F1]" />
                <span className="text-[12px] text-[#6366F1] font-semibold">{form.morningCommute} min</span>
              </div>
              <div>
                <label className={labelCls}>Evening Commute (min)</label>
                <input type="range" min={0} max={120} value={form.eveningCommute} onChange={e => setForm(f => ({ ...f, eveningCommute: Number(e.target.value) }))} className="w-full accent-[#6366F1]" />
                <span className="text-[12px] text-[#6366F1] font-semibold">{form.eveningCommute} min</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Semester Length (weeks)</label>
                <input type="number" className={inputCls} value={form.semesterWeeks} onChange={e => setForm(f => ({ ...f, semesterWeeks: Number(e.target.value) }))} />
              </div>
              <div>
                <label className={labelCls}>Semester Start Date</label>
                <input type="date" className={inputCls} value={form.semesterStart} onChange={e => setForm(f => ({ ...f, semesterStart: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-[#1A1A2E]">Rush Hour Buffer</p>
                <p className="text-[11px] text-[#9CA3AF]">Add extra commute time during peak hours</p>
              </div>
              <button onClick={() => setForm(f => ({ ...f, rushHour: !f.rushHour }))}
                className={`w-[44px] h-[24px] rounded-full transition-colors relative ${form.rushHour ? 'bg-[#6366F1]' : 'bg-[#E5E7EB]'}`}
              >
                <div className={`w-[20px] h-[20px] bg-white rounded-full absolute top-[2px] transition-transform ${form.rushHour ? 'translate-x-[22px]' : 'translate-x-[2px]'}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-[16px] p-5 shadow-sm border border-[#F3F4F6]">
          <h3 className="text-[13px] font-bold text-[#1A1A2E] mb-4">Notification Intensity</h3>
          <div className="flex gap-2">
            {['Gentle', 'Balanced', 'Detailed'].map(opt => (
              <button key={opt} onClick={() => setForm(f => ({ ...f, intensity: opt }))}
                className={`flex-1 py-2.5 rounded-[10px] text-[12px] font-bold transition-colors ${
                  form.intensity === opt ? 'bg-[#6366F1] text-white' : 'bg-[#F3F4F6] text-[#4B5563] hover:bg-[#E5E7EB]'
                }`}
              >{opt}</button>
            ))}
          </div>
        </div>

        {/* Regeneration */}
        <div className="bg-white rounded-[16px] p-5 shadow-sm border border-[#F3F4F6] flex items-center justify-between">
          <div>
            <h3 className="text-[14px] font-bold text-[#1A1A2E]">Regenerate Schedule</h3>
            <p className="text-[12px] text-[#9CA3AF] mt-1">Rebuild your week using current settings</p>
          </div>
          <button 
            onClick={handleRegenerate} 
            disabled={regenerating}
            className="px-4 py-2 bg-[#EEF2FF] hover:bg-[#E0E7FF] text-[#6366F1] font-bold text-[13px] rounded-[10px] transition-colors disabled:opacity-50"
          >
            {regenerating ? 'Working...' : 'Regenerate'}
          </button>
        </div>

        {/* Data Health */}
        <div className="bg-white rounded-[16px] p-5 shadow-sm border border-[#F3F4F6]">
          <h3 className="text-[13px] font-bold text-[#1A1A2E] mb-3">Data Health</h3>
          {dataHealth ? (
            <div className="space-y-2 text-[13px]">
              <p className={dataHealth.classes > 0 ? 'text-[#059669]' : 'text-[#EF4444]'}>{dataHealth.classes > 0 ? '✅' : '⚠️'} {dataHealth.classes} classes saved</p>
              <p className={dataHealth.blocks > 0 ? 'text-[#059669]' : 'text-[#F59E0B]'}>{dataHealth.blocks > 0 ? '✅' : '⚠️'} {dataHealth.blocks > 0 ? `Schedule generated (${dataHealth.blocks} blocks)` : 'No schedule generated yet'}</p>
              <p className={dataHealth.attendance > 0 ? 'text-[#059669]' : 'text-[#9CA3AF]'}>{dataHealth.attendance > 0 ? '✅' : 'ℹ️'} {dataHealth.attendance > 0 ? `${dataHealth.attendance} attendance records` : 'No attendance logged yet'}</p>
            </div>
          ) : (
            <button onClick={async () => {
              if (!user) return;
              const { db } = await import('@/lib/firebase/clientApp');
              const [classesSnap, blocksSnap, attSnap] = await Promise.all([
                getDocs(query(collection(db, 'classes'), where('user_id', '==', user.uid))),
                getDocs(query(collection(db, 'schedule_blocks'), where('user_id', '==', user.uid))),
                getDocs(query(collection(db, 'attendance'), where('user_id', '==', user.uid)))
              ]);
              setDataHealth({ classes: classesSnap.size, blocks: blocksSnap.size, attendance: attSnap.size });
            }} className="text-[#6366F1] text-[13px] font-semibold hover:underline">Check Data Health →</button>
          )}
          <button onClick={async () => {
            if (!user || !confirm('This will delete ALL your classes, schedule blocks, and attendance records. Are you sure?')) return;
            setClearing(true);
            try {
              const { db } = await import('@/lib/firebase/clientApp');
              const collections = ['classes', 'schedule_blocks', 'attendance'];
              for (const col of collections) {
                const snap = await getDocs(query(collection(db, col), where('user_id', '==', user.uid)));
                await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
              }
              setDataHealth({ classes: 0, blocks: 0, attendance: 0 });
              toast.success('All data cleared.');
            } catch (e: any) { toast.error(e.message); }
            setClearing(false);
          }} disabled={clearing} className="mt-3 text-[12px] text-red-400 hover:text-red-600 font-medium transition-colors disabled:opacity-50">
            {clearing ? 'Clearing...' : '🗑 Clear All Data'}
          </button>
        </div>

        {/* Account Info */}
        <div className="bg-[#F3F4F6] rounded-[16px] p-5">
          <h3 className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-2">Account</h3>
          <p className="text-[13px] text-[#4B5563]">{user?.email || 'No email'}</p>
          <p className="text-[11px] text-[#9CA3AF] mt-1">UID: {user?.uid?.substring(0, 12)}...</p>
        </div>

        {/* Save */}
        <button onClick={save} disabled={saving} className="w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white py-4 rounded-[14px] font-semibold text-[14px] shadow-lg transition-colors disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
      <div className="h-8" />
    </div>
  );
}
