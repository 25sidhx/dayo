"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, ArrowUpRight, Zap, Smartphone, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

// Firebase
import { auth } from "@/lib/firebase/clientApp";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithPopup,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  sendPasswordResetEmail
} from "firebase/auth";

declare global {
  interface Window {
    recaptchaVerifier: any;
  }
}

declare const grecaptcha: any;

export default function Login() {
  const router = useRouter();

  // Auth Modes
  const [mode, setMode] = useState<"login" | "signup" | "forgot" | "phone">("login");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Email/Pass State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetSent, setResetSent] = useState(false);

  // Phone Auth State
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  // Initialize Recaptcha
  useEffect(() => {
    if (typeof window !== "undefined" && !window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible'
        });
      } catch(e) { console.error(e) }
    }
  }, []);

  const handleEmailAuth = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      toast.success("Welcome to Dayo!");
      router.push("/onboarding");
    } catch (err: any) {
      setError(err.message || "Authentication failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast.success("Welcome to Dayo!");
      router.push("/onboarding");
    } catch (err: any) {
      setError(err.message || "Google SignIn failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOTP = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const appVerifier = window.recaptchaVerifier;
      const fmtPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
      const confirmation = await signInWithPhoneNumber(auth, fmtPhone, appVerifier);
      setConfirmationResult(confirmation);
      toast.success("OTP Sent!");
    } catch (err: any) {
      setError(err.message || "Failed to send OTP.");
      if (window.recaptchaVerifier) window.recaptchaVerifier.render().then((wId: any) => grecaptcha.reset(wId));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!confirmationResult) return;
    setIsLoading(true);
    setError(null);
    try {
      await confirmationResult.confirm(otp);
      toast.success("Phone verified!");
      router.push("/onboarding");
    } catch (err: any) {
      setError("Invalid OTP code.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Please enter your email address.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (err: any) {
      setError(err.message || "Failed to send reset email.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-[#0F0F1A] text-[#FAFAF8] font-sans relative">
      <div id="recaptcha-container" className="absolute top-0 left-0"></div>
      
      {/* LEFT — Brand panel */}
      <div className="hidden md:flex flex-col justify-between p-12 border-r border-[#1A1A2E] relative overflow-hidden bg-[#0F0F1A]">

        <Link href="/" className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 bg-[#6366F1] flex items-center justify-center rounded-xl shadow-lg">
            <Zap size={20} className="text-white fill-white" />
          </div>
          <span className="font-heading text-2xl tracking-widest text-white">DAYO</span>
        </Link>

        <div className="relative z-10">
          <div className="w-10 h-1 bg-[#6366F1] mb-6 rounded-full" />
          <p className="font-heading text-4xl text-white leading-tight max-w-[320px]">
            Your schedule,<br />
            <span className="text-[#6366F1]">finally</span> under control.
          </p>
          <p className="mt-4 text-[15px] text-[#9CA3AF] leading-relaxed max-w-[300px]">
            Upload your timetable, commit to your schedule, and let AI do the planning.
          </p>
        </div>
      </div>

      {/* RIGHT — Auth form */}
      <div className="flex flex-col justify-center px-8 md:px-16 max-w-[520px] mx-auto w-full">
        <Link href="/" className="flex items-center gap-2 mb-12 text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors">
          <ArrowLeft size={14} /> Back to Home
        </Link>

        {/* Toggle */}
        <div className="flex mb-10 border-b border-[#1A1A2E]">
          {(['login', 'signup', 'phone'] as const).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(null); setConfirmationResult(null); }}
              className={`flex-1 py-3.5 font-bold text-[13px] tracking-wider uppercase transition-all ${
                mode === m 
                  ? 'border-b-2 border-[#6366F1] text-white' 
                  : 'border-b-2 border-transparent text-[#9CA3AF] hover:text-white/80'
              }`}
            >
              {m === 'login' ? 'Sign In' : m === 'signup' ? 'Create' : 'Phone'}
            </button>
          ))}
        </div>

        {/* Heading */}
        <div className="mb-8">
          <h1 className="font-heading text-4xl text-white mb-2">
            {mode === 'login' ? 'Welcome back.' : mode === 'phone' ? 'Phone Access.' : 'Join Dayo.'}
          </h1>
          <p className="text-[#9CA3AF] text-[15px]">
            {mode === 'login' ? 'Sign in to access your schedule.' : mode === 'phone' ? 'Fast, passwordless entry.' : 'Create a free account to get started.'}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[13px] rounded-xl mb-6">
            {error}
          </div>
        )}

        {/* Form Body */}
        {mode === 'phone' ? (
          <div className="flex flex-col gap-4 mb-6">
            {!confirmationResult ? (
              <>
                <div>
                  <label className="text-[12px] font-bold text-[#9CA3AF] uppercase tracking-widest block mb-2">Phone Number</label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={e => setPhoneNumber(e.target.value)}
                    placeholder="+91 9876543210"
                    className="w-full h-14 bg-white/5 border border-white/10 rounded-xl px-5 text-white placeholder:text-white/20 focus:border-[#6366F1] outline-none transition-all"
                  />
                </div>
                <button
                  onClick={handleSendOTP}
                  disabled={isLoading || !phoneNumber}
                  className="w-full h-14 bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  {isLoading ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <>Send OTP <Smartphone size={18} /></>}
                </button>
              </>
            ) : (
              <>
                <div>
                  <label className="text-[12px] font-bold text-[#9CA3AF] uppercase tracking-widest block mb-2">6-Digit Code</label>
                  <input
                    type="text"
                    value={otp}
                    onChange={e => setOtp(e.target.value)}
                    placeholder="123456"
                    className="w-full h-14 bg-white/5 border border-white/10 rounded-xl px-5 text-white placeholder:text-white/20 focus:border-[#6366F1] outline-none transition-all text-center font-heading text-2xl tracking-[0.5em]"
                    maxLength={6}
                  />
                </div>
                <button
                  onClick={handleVerifyOTP}
                  disabled={isLoading || otp.length < 6}
                  className="w-full h-14 bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  {isLoading ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <>Verify & Login <ArrowUpRight size={18} /></>}
                </button>
              </>
            )}
          </div>
        ) : mode === 'forgot' ? (
          <div className="flex flex-col gap-4 mb-6">
            {resetSent ? (
               <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[13px] rounded-xl">
                 Password reset email sent! Check your inbox.
               </div>
            ) : (
              <>
                <div>
                  <label className="text-[12px] font-bold text-[#9CA3AF] uppercase tracking-widest block mb-2">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@college.edu"
                    className="w-full h-14 bg-white/5 border border-white/10 rounded-xl px-5 text-white placeholder:text-white/20 focus:border-[#6366F1] outline-none transition-all"
                  />
                </div>
                <button
                  onClick={handleForgotPassword}
                  disabled={isLoading || !email}
                  className="w-full h-14 bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  {isLoading ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <>Send Reset Link <Mail size={18} /></>}
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4 mb-6">
            <div>
              <label className="text-[12px] font-bold text-[#9CA3AF] uppercase tracking-widest block mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@college.edu"
                className="w-full h-14 bg-white/5 border border-white/10 rounded-xl px-5 text-white placeholder:text-white/20 focus:border-[#6366F1] outline-none transition-all"
                onKeyDown={e => e.key === 'Enter' && handleEmailAuth()}
              />
            </div>
            <div>
              <label className="text-[12px] font-bold text-[#9CA3AF] uppercase tracking-widest block mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-14 bg-white/5 border border-white/10 rounded-xl px-5 text-white placeholder:text-white/20 focus:border-[#6366F1] outline-none transition-all"
                onKeyDown={e => e.key === 'Enter' && handleEmailAuth()}
              />
            </div>
            
            <button
              onClick={handleEmailAuth}
              disabled={isLoading || !email || !password}
              className="w-full h-14 bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-xl font-bold flex items-center justify-center gap-2 mt-2 transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>{mode === 'login' ? 'Sign In' : 'Create Account'} <ArrowUpRight size={18} /></>
              )}
            </button>
            
            <div className="relative flex py-5 items-center">
                <div className="flex-grow border-t border-white/10"></div>
                <span className="flex-shrink-0 mx-4 text-white/30 text-xs font-bold uppercase tracking-widest">Or</span>
                <div className="flex-grow border-t border-white/10"></div>
            </div>

            <button
              onClick={handleGoogleAuth}
              disabled={isLoading}
              className="w-full h-14 bg-white hover:bg-white/90 text-[#1A1A2E] rounded-xl font-bold flex items-center justify-center gap-3 transition-colors disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                 <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                 <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                 <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                 <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Sign in with Google
            </button>

          </div>
        )}

        {/* Footer Links */}
        <div className="text-center mt-6 flex flex-col gap-3">
          {mode === 'login' && (
            <button
              onClick={() => { setMode('forgot'); setError(null); setResetSent(false); }}
              className="text-[#9CA3AF] text-[13px] hover:text-white transition-colors underline"
            >
              Forgot password?
            </button>
          )}
          <Link href="/privacy" className="text-white/40 text-[11px] hover:text-white transition-colors underline">
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  );
}
