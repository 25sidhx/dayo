"use client";

import { useState, useEffect } from "react";
import { Copy, Check, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import toast from "react-hot-toast";

export default function BatchSharePage() {
  const { user } = useAuth();
  const [batchCode, setBatchCode] = useState('');
  const [memberCount, setMemberCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const { db } = await import('@/lib/firebase/clientApp');
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists() && userDoc.data().batch_code) {
          setBatchCode(userDoc.data().batch_code);
          setMemberCount(userDoc.data().batch_members || 1);
        } else {
          // Create batch code via API
          const token = await user.getIdToken();
          const res = await fetch('/api/batch/create', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
          });
          if (res.ok) {
            const data = await res.json();
            setBatchCode(data.code || '------');
          }
        }
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    load();
  }, [user]);

  const shareLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/join/${batchCode}`;

  const copyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    toast.success('Link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 md:p-8 max-w-[600px] w-full mx-auto flex-1 flex flex-col items-center">
      <header className="mb-10 text-center">
        <h2 className="font-heading text-[26px] text-[#1A1A2E] leading-[1.1] mb-1">Batch Share</h2>
        <p className="text-[12px] text-[#9CA3AF]">Share your timetable with classmates</p>
      </header>

      {loading ? (
        <p className="text-[#9CA3AF] py-20">Loading...</p>
      ) : (
        <div className="w-full flex flex-col items-center gap-8">
          {/* Large Code Display */}
          <div className="bg-white rounded-[24px] p-8 shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-[#F3F4F6] w-full text-center">
            <p className="text-[10px] text-[#9CA3AF] uppercase tracking-widest font-bold mb-4">Your Batch Code</p>
            <p className="font-heading text-[56px] text-[#6366F1] tracking-[0.15em] leading-none mb-6">{batchCode || '------'}</p>
            <p className="text-[12px] text-[#9CA3AF] mb-6">{shareLink}</p>
            <button onClick={copyLink} className="inline-flex items-center gap-2 px-6 py-3 bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-[12px] text-[13px] font-semibold transition-colors">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>

          {/* Member Count */}
          <div className="bg-[#EEF2FF] rounded-[16px] p-5 w-full flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#6366F1] flex items-center justify-center text-white">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-[#1A1A2E]">{memberCount} student{memberCount !== 1 ? 's' : ''}</p>
              <p className="text-[11px] text-[#9CA3AF]">joined with this code</p>
            </div>
          </div>

          {/* QR Placeholder */}
          <div className="bg-white rounded-[16px] p-6 shadow-sm border border-[#F3F4F6] w-full text-center">
            <p className="text-[10px] text-[#9CA3AF] uppercase tracking-widest font-bold mb-3">Scan to Join</p>
            <div className="w-[160px] h-[160px] bg-[#F3F4F6] rounded-[12px] mx-auto flex items-center justify-center">
              <p className="text-[10px] text-[#9CA3AF]">QR Code<br/>Coming soon</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
