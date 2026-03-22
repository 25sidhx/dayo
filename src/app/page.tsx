"use client";

import { useRouter } from "next/navigation";
import { MoveRight } from "lucide-react";

export default function Home() {
  const router = useRouter();

  return (
    <div className="relative flex flex-col items-center justify-between min-h-[100dvh] pb-12 pt-24 px-8 overflow-hidden bg-[#0F0F1A]">
      
      {/* Background Glows (Subtle) */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[80vw] h-[80vw] rounded-full bg-[#6366F1] mix-blend-screen opacity-5 blur-[120px]" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col justify-center items-center w-full max-w-md mx-auto text-center">
        {/* SVG Illustrated Student Placeholder */}
        <div className="w-56 h-56 mb-8 animate-[fade-in-up_0.8s_ease-out_both] flex items-center justify-center">
           <svg className="w-full h-full" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="100" cy="110" r="70" fill="#1A1A2E" />
              <path d="M50 160C50 132.386 72.3858 110 100 110C127.614 110 150 132.386 150 160H50Z" fill="#6366F1" />
              <rect x="70" y="70" width="60" height="50" rx="15" fill="#FDA4AF" />
              <circle cx="100" cy="55" r="25" fill="#6366F1" />
           </svg>
        </div>

        <h1 className="font-heading text-white text-[72px] sm:text-[84px] leading-[0.85] tracking-[-0.04em] mb-4 animate-[fade-in-up_1s_ease-out_0.2s_both]">
          Day<span className="text-[#6366F1]">o</span>
        </h1>
        
        <p className="font-sans font-medium text-[16px] text-white/50 tracking-tight animate-[fade-in-up_1s_ease-out_0.4s_both]">
          Your day, sorted.
        </p>
      </div>

      <div className="relative z-10 w-full max-w-sm mt-auto px-4 flex justify-center animate-[fade-in-up_1s_ease-out_0.6s_both]">
        <button 
          id="get-started-button"
          onClick={() => router.push('/onboarding/auth')}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-white/95 text-[#0F0F1A] py-4 px-8 rounded-full font-sans font-bold text-[16px] transition-all shadow-[0_8px_20px_rgba(255,255,255,0.08)] active:scale-[0.97] group"
        >
          <span>Get Started</span>
          <MoveRight className="w-5 h-5 transition-transform group-hover:translate-x-1" strokeWidth={2.5} />
        </button>
      </div>

    </div>
  );
}
