"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";
import toast from "react-hot-toast";

type BunkModalProps = {
  isOpen: boolean;
  onClose: () => void;
  subject: string;
  timeStr: string;
  userId: string;
  onBunked: () => void;
};

export default function BunkModal({ isOpen, onClose, subject, timeStr, userId, onBunked }: BunkModalProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [dangerTap, setDangerTap] = useState(false);
  const currentRef = useRef<HTMLSpanElement>(null);
  const projectedRef = useRef<HTMLSpanElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Fetch attendance math
  useEffect(() => {
    if (!isOpen || !subject) return;
    setLoading(true);
    setDangerTap(false);
    const fetchData = async () => {
      try {
        const { auth } = await import('@/lib/firebase/clientApp');
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch('/api/bunk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ subjectName: subject, date: new Date().toISOString().split('T')[0], action: 'preview' })
        });
        const d = await res.json();
        setData(d);
        setLoading(false);
      } catch (e) { setLoading(false); }
    };
    fetchData();
  }, [isOpen, subject]);

  // Animate count-up
  useEffect(() => {
    if (!data || loading) return;
    const animate = (el: HTMLSpanElement | null, target: number) => {
      if (!el) return;
      const start = performance.now();
      const dur = 400;
      const update = (t: number) => {
        const p = Math.min((t - start) / dur, 1);
        el.textContent = Math.round(p * target) + '%';
        if (p < 1) requestAnimationFrame(update);
      };
      requestAnimationFrame(update);
    };
    animate(currentRef.current, data.currentPct);
    animate(projectedRef.current, data.projectedPct);
  }, [data, loading]);

  const handleConfirmBunk = async () => {
    if (data?.status === 'danger' && !dangerTap) {
      setDangerTap(true);
      return;
    }
    setConfirming(true);
    try {
      const { auth } = await import('@/lib/firebase/clientApp');
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/bunk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ subjectName: subject, date: new Date().toISOString().split('T')[0], action: 'confirm_bunk' })
      });
      const d = await res.json();
      toast.success(d.message || `Bunked ✓ — ${subject} removed for today`);
      onBunked();
      onClose();
    } catch (e: any) { toast.error(e.message); }
    setConfirming(false);
  };

  const getColor = (pct: number) => pct >= 80 ? '#059669' : pct >= 75 ? '#D97706' : '#EF4444';

  if (!isOpen) return null;

  return (
    <div ref={backdropRef} onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
      className="fixed inset-0 bg-black/40 z-[100] flex items-end justify-center"
      style={{ animation: 'fadeIn 200ms ease-out' }}
    >
      <div className="bg-white w-full max-w-[480px] rounded-t-[24px] shadow-2xl"
        style={{ animation: 'slideUp 300ms ease-out' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-[36px] h-[3px] bg-[#E5E7EB] rounded-full" />
        </div>

        <div className="px-6 pb-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="font-heading text-[20px] text-[#1A1A2E]">{subject}</h3>
              <p className="text-[11px] text-[#9CA3AF]">{timeStr} • Today</p>
            </div>
            <button onClick={onClose} className="p-1 rounded-md hover:bg-[#F3F4F6]">
              <X className="w-4 h-4 text-[#9CA3AF]" />
            </button>
          </div>

          {loading ? (
            <div className="py-10 text-center text-[#9CA3AF] text-[12px]">Calculating attendance...</div>
          ) : data ? (
            <>
              {/* Percentage Display */}
              <div className="flex items-center justify-around my-6">
                <div className="text-center">
                  <span ref={currentRef} className="font-heading text-[40px] leading-none" style={{ color: getColor(data.currentPct) }}>
                    {data.currentPct}%
                  </span>
                  <p className="text-[11px] text-[#9CA3AF] mt-1">Now</p>
                </div>
                <span className="text-[24px] text-[#D1D5DB]">→</span>
                <div className="text-center">
                  <span ref={projectedRef} className="font-heading text-[40px] leading-none" style={{ color: getColor(data.projectedPct) }}>
                    {data.projectedPct}%
                  </span>
                  <p className="text-[11px] text-[#9CA3AF] mt-1">After bunk</p>
                </div>
              </div>

              {/* Warning chip */}
              {data.safeBunks <= 3 && (
                <div className="bg-[#FFFBEB] border border-[#FCD34D]/30 rounded-[10px] py-2.5 px-3 mb-5 text-center">
                  <span className="text-[12px] font-semibold text-[#B45309]">
                    ⚠️ {data.safeBunks} safe bunk{data.safeBunks !== 1 ? 's' : ''} left this semester
                  </span>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 mt-2">
                <button onClick={onClose}
                  className="flex-1 py-3 rounded-[12px] text-[13px] font-semibold bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB] transition-colors"
                >Cancel</button>
                <button onClick={handleConfirmBunk} disabled={confirming}
                  className={`flex-1 py-3 rounded-[12px] text-[13px] font-semibold text-white transition-colors disabled:opacity-50 ${
                    data.status === 'danger' ? (dangerTap ? 'bg-[#DC2626] animate-pulse' : 'bg-[#EF4444] hover:bg-[#DC2626]')
                    : 'bg-[#6366F1] hover:bg-[#4F46E5]'
                  }`}
                >
                  {confirming ? 'Bunking...' : dangerTap ? 'Are you sure? Tap again' : 'Bunk Anyway'}
                </button>
              </div>
            </>
          ) : (
            <p className="py-10 text-center text-[#EF4444] text-[12px]">Failed to load attendance data.</p>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html:`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
      `}} />
    </div>
  );
}
