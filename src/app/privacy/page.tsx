"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#1A1A2E] font-sans">
      <div className="max-w-[700px] mx-auto px-6 py-12 md:py-20">
        <Link href="/" className="inline-flex items-center gap-2 text-[#6366F1] font-semibold text-[14px] hover:underline mb-8">
          <ArrowLeft size={16} /> Back to Home
        </Link>
        
        <h1 className="font-heading text-4xl mb-6">Privacy Policy</h1>
        <p className="text-[#9CA3AF] mb-10">Last updated: March 2026</p>
        
        <div className="space-y-8 text-[15px] leading-relaxed">
          <section>
            <h2 className="font-heading text-2xl mb-4 text-[#0F0F1A]">1. What Data We Collect</h2>
            <p>Dayo is designed securely to only collect the information absolutely necessary for scheduling: your display name, your uploaded timetable text blocks, attendance check-ins, and daily notes. We do not require or ask for any highly sensitive biometric information or passwords natively (we use secure Firebase Authentication matching).</p>
          </section>

          <section>
            <h2 className="font-heading text-2xl mb-4 text-[#0F0F1A]">2. How We Use It</h2>
            <p>Your timetable images are securely converted to text strings and then processed dynamically by AI models (like Google Gemini). We only use this to organize your day, display your schedule, and provide contextual attendance warnings. None of your data is sold to any third party entities or ad domains.</p>
          </section>

          <section>
            <h2 className="font-heading text-2xl mb-4 text-[#0F0F1A]">3. Managing Your Data & Deletion</h2>
            <p>You have full autonomy over your data. All records inside your schedule and attendance boards can be entirely purged by utilizing the "Reset Data" application feature in the settings. If you require full account deletion, you may request it by contacting us.</p>
          </section>

          <section>
            <h2 className="font-heading text-2xl mb-4 text-[#0F0F1A]">4. Contact</h2>
            <p>If you have any questions or require an immediate data deletion override, please contact us at: <strong>privacy@dayo.app</strong>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
