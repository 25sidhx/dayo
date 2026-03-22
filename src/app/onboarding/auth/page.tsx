"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase/clientApp';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';

export default function AuthPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    // If user is already logged in, skip the auth page
    if (!loading && user) {
      router.replace('/onboarding');
    }
  }, [user, loading, router]);

  const handleGoogleSignIn = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    const loadingToast = toast.loading('Connecting secure port...');
    
    try {
      const result = await signInWithPopup(auth, googleProvider);
      toast.success(`Welcome, ${result.user.displayName}`, { id: loadingToast });
      router.push('/onboarding');
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user') {
        toast.error(error.message || 'Verification failed. Try again.', { id: loadingToast });
      } else {
        toast.dismiss(loadingToast);
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handlePhoneOTP = () => {
    toast('Phone login is configured as fallback and pending in V2.', {
      icon: '📱',
      style: { background: '#1A1A2E', color: '#FAFAF8' },
    });
  };

  // Prevent flash of login screen if already authenticated
  if (loading || user) return <div className="min-h-screen bg-[#0F0F1A]" />;

  return (
    <div className="flex flex-col items-center justify-between min-h-[100dvh] pb-12 pt-24 px-8 overflow-hidden bg-[#0F0F1A] relative">
      
      {/* Decorative center element (SVG character placeholder) */}
      <div className="flex-1 flex flex-col justify-center items-center w-full z-10 relative">
        <svg className="w-48 h-48 mb-6" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Abstract chunky student backpack shape using theme colors #6366F1, #FDA4AF */}
          <circle cx="100" cy="100" r="80" fill="#1A1A2E" />
          <path d="M60 140C60 117.909 77.9086 100 100 100C122.091 100 140 117.909 140 140H60Z" fill="#6366F1" />
          <rect x="75" y="75" width="50" height="40" rx="12" fill="#FDA4AF" />
          <path d="M85 85H115V105H85V85Z" fill="#0F0F1A" opacity="0.5"/>
        </svg>

        <h1 className="font-heading text-white text-[56px] leading-[0.9] tracking-[-0.03em] mb-2 text-center">
          Day<span className="text-[#6366F1]">o</span>
        </h1>
        
        <p className="font-sans text-[14px] text-white/50 text-center">
          Your day, sorted.
        </p>
      </div>

      {/* Buttons container */}
      <div className="w-full max-w-sm flex flex-col gap-4 mt-auto z-10 relative px-4">
        {/* Primary Auth Method */}
        <button 
          onClick={handleGoogleSignIn}
          disabled={isSigningIn}
          className="w-full h-[56px] bg-white hover:bg-white/90 text-[#1A1A2E] rounded-full flex items-center justify-center gap-3 font-sans font-semibold text-[15px] transition-all shadow-[0_4px_14px_rgba(255,255,255,0.1)] active:scale-[0.98] disabled:opacity-50"
        >
          {/* Google G SVG */}
          <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            <path d="M1 1h22v22H1z" fill="none"/>
          </svg>
          {isSigningIn ? 'Connecting...' : 'Continue with Google'}
        </button>

        {/* Fallback Auth Method */}
        <button 
          onClick={handlePhoneOTP}
          className="w-full h-[48px] bg-transparent hover:bg-white/5 border border-white/10 text-white/70 rounded-full flex items-center justify-center gap-2 font-sans font-medium text-[14px] transition-all active:scale-[0.98]"
        >
          Continue with Phone OTP
        </button>
      </div>

    </div>
  );
}
