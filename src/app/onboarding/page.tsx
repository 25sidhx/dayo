"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  X, ChevronRight, BookOpen, Wand2
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import { doc, setDoc, collection, addDoc, serverTimestamp, getDoc, getDocs, query, where, deleteDoc } from "firebase/firestore";

// Types
type ExtractedClass = {
  subject: string;
  abbreviation?: string;
  type?: 'Theory' | 'Practical' | string;
  startTime: string;
  endTime: string;
  days: string[];
  room: string;
  faculty?: string;
  batch?: string;
  uncertain?: boolean;
};

type WizardStep = 'profile' | 'upload' | 'batch_select' | 'verify' | 'commute' | 'wake_sleep' | 'semester' | 'intensity' | 'generating';
type UploadState = 'idle' | 'selected' | 'processing' | 'complete' | 'error';

const DAYS_OF_WEEK = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

export default function OnboardingWizard() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  const [step, setStep] = useState<WizardStep>('profile');

  // -- Data State --
  const [rawClasses, setRawClasses] = useState<ExtractedClass[]>([]);
  const [classes, setClasses] = useState<ExtractedClass[]>([]);
  const [availableBatches, setAvailableBatches] = useState<string[]>([]);
  
  // -- Upload State Machine --
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);

  const [name, setName] = useState("");
  const [batch, setBatch] = useState("");
  const [morningCommute, setMorningCommute] = useState(30);
  const [eveningCommute, setEveningCommute] = useState(30);
  const [rushHourBuffer, setRushHourBuffer] = useState(false);
  const [wakeTime, setWakeTime] = useState("07:00");
  const [sleepTime, setSleepTime] = useState("23:30");
  const [semesterWeeks, setSemesterWeeks] = useState(20);
  const [intensity, setIntensity] = useState<'gentle' | 'balanced' | 'detailed'>('balanced');
  
  // Verification State
  const [activeDay, setActiveDay] = useState('MONDAY');
  const [correctionText, setCorrectionText] = useState("");
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [manualForm, setManualForm] = useState({ subject: '', type: 'Theory', startTime: '09:00', endTime: '10:00', days: ['MONDAY'] as string[], room: '', faculty: '' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Install Prompt State
  const [showIOSInstall, setShowIOSInstall] = useState(false);

  // Resume Progress Logic
  useEffect(() => {
    let mounted = true;
    if (!authLoading && !user) {
      router.replace('/login');
    } else if (user) {
      import("@/lib/firebase/clientApp").then(({ db }) => {
        getDoc(doc(db, "users", user.uid)).then(d => {
           if (!mounted) return;
           if (d.exists()) {
             const data = d.data();
             if (data.onboarding_complete) {
               router.push('/dashboard');
               return;
             }
             
             // Restore draft data
             if (data.name) setName(data.name);
             if (data.batch) setBatch(data.batch);
             if (data.wake_time) setWakeTime(data.wake_time);
             if (data.sleep_time) setSleepTime(data.sleep_time);
             if (data.morning_commute_mins) setMorningCommute(data.morning_commute_mins);
             if (data.Evening_commute_mins) setEveningCommute(data.Evening_commute_mins);
             if (data.rush_hour_buffer) setRushHourBuffer(data.rush_hour_buffer);
             if (data.semester_weeks) setSemesterWeeks(data.semester_weeks);
             if (data.checkin_intensity) setIntensity(data.checkin_intensity);

             if (data.onboarding_step) {
               const stepNum = data.onboarding_step;
               if (stepNum >= 9) router.push('/dashboard');
               else {
                 const mapping: WizardStep[] = ['profile', 'upload', 'batch_select', 'verify', 'commute', 'wake_sleep', 'semester', 'intensity', 'generating'];
                 let resumeStep = mapping[stepNum - 1] || 'profile';
                 // If resuming to a step that requires class data (verify, batch_select),
                 // stay on upload since class data isn't persisted in this draft system yet
                 if (resumeStep === 'verify' || resumeStep === 'batch_select') resumeStep = 'upload';
                 setStep(resumeStep);
               }
             }
           }
        });
      });
    }
    return () => { mounted = false; };
  }, [user, authLoading, router]);

  // -- Image Preprocessing Logic --
  const processImageFile = async (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        let targetWidth = img.width;
        let targetHeight = img.height;
        if (targetWidth < 1200) {
          const ratio = 1200 / targetWidth;
          targetWidth = 1200;
          targetHeight = img.height * ratio;
        }
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        const base64 = canvas.toDataURL('image/png', 1.0).split(',')[1];
        resolve(base64);
        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(file);
    });
  };

  const processPdfFile = async (file: File): Promise<string> => {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    
    let tempViewport = page.getViewport({ scale: 1.0 });
    let scale = 2.0;
    if (tempViewport.width * scale < 1200) scale = 1200 / tempViewport.width;
    
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: ctx, viewport } as any).promise;
    
    return canvas.toDataURL('image/png', 1.0).split(',')[1];
  };

  // -- API Fetch Logic --
  const attemptExtraction = async (base64: string, attempt = 1): Promise<any> => {
    const idToken = await user?.getIdToken();
    try {
      const res = await fetch('/api/extract-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ base64str: base64 })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      return data;
    } catch (e: any) {
      if (attempt === 1) {
        console.warn("Retrying extraction attempt 2...");
        return attemptExtraction(base64, 2);
      }
      throw new Error("Could not read timetable. Try a clearer image.");
    }
  };

  const executeExtraction = async () => {
    if (!selectedFile) return;
    setUploadState('processing');
    const toastId = toast.loading("Reading your timetable...\nThis takes about 15 seconds.");
    let pass1Timer: NodeJS.Timeout | null = null;

    try {
      let base64 = "";
      if (selectedFile.type === 'application/pdf') {
        base64 = await processPdfFile(selectedFile);
      } else {
        base64 = await processImageFile(selectedFile);
      }
      
      // --- Storage Upload (Background) ---
      (async () => {
        try {
          const { ref, uploadString, getDownloadURL } = await import('firebase/storage');
          const { storage } = await import('@/lib/firebase/clientApp');
          if (storage && user) {
            const storageRef = ref(storage, `timetables/${user.uid}_${Date.now()}.png`);
            await uploadString(storageRef, base64, 'base64', { contentType: 'image/png' });
            const url = await getDownloadURL(storageRef);
            const { db } = await import('@/lib/firebase/clientApp');
            await addDoc(collection(db, "timetables"), { user_id: user.uid, image_url: url, created_at: serverTimestamp() });
          }
        } catch(e) {
          console.warn("Storage background upload failed/skipped:", e);
        }
      })();

      // --- AI Extraction (Priority) ---

      // Simulate 2-pass feedback natively
      pass1Timer = setTimeout(() => {
         toast.success("Pass 1 done.\nVerifying...", { id: toastId });
      }, 8000);

      const fetchPromise = attemptExtraction(base64);
      const data = await Promise.race([
         fetchPromise,
         new Promise((_, reject) => setTimeout(() => reject(new Error("This is taking longer than expected. Please try again with a clearer image.")), 30000))
      ]) as any;

      if (pass1Timer) clearTimeout(pass1Timer);
      setRawClasses(data.classes);
      if (data.usedFallback) setUsedFallback(true);
      toast.dismiss(toastId);
      setUploadState('complete');

      // Detect Batches
      const batches = Array.from(new Set(data.classes.map((c: any) => c.batch))).filter(b => b && b !== 'All' && String(b).trim() !== '') as string[];
      
      if (batches.length > 0) {
        setAvailableBatches(batches.sort());
        advanceStep('batch_select');
      } else {
        setClasses(data.classes);
        advanceStep('verify');
      }
      
    } catch (err: any) {
      if (pass1Timer) clearTimeout(pass1Timer);
      toast.error(err.message, { id: toastId, duration: 8000 });
      setUploadState('error');
    }
  };

  const handleBatchSelection = (selectedBatch: string) => {
    setBatch(selectedBatch);
    // Filter classes to only include selected batch or 'All'
    const filteredClasses = rawClasses.filter(c => !c.batch || c.batch === 'All' || c.batch.toUpperCase() === selectedBatch.toUpperCase());
    setClasses(filteredClasses);
    advanceStep('verify');
  };

  const applyCorrection = async () => {
    if (!correctionText.trim()) return;
    setIsCorrecting(true);
    const tid = toast.loading("Applying natural English correction via Claude...");
    try {
      const idToken = await user?.getIdToken();
      const res = await fetch('/api/correct-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ classes, correction: correctionText })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to apply correction.");
      
      setClasses(data.classes);
      setCorrectionText("");
      toast.success("Applied changes!", { id: tid });
    } catch (e: any) {
      toast.error(e.message, { id: tid });
    } finally {
      setIsCorrecting(false);
    }
  };

  const advanceStep = async (nextStep: WizardStep) => {
    setStep(nextStep);
    
    // Check iOS Install
    if (nextStep === 'intensity') {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isStandalone = (window.navigator as any).standalone;
      if (isIOS && !isStandalone) {
        setShowIOSInstall(true);
        return; 
      }
    }

    try {
       const stepsList: WizardStep[] = ['profile', 'upload', 'batch_select', 'verify', 'commute', 'wake_sleep', 'semester', 'intensity', 'generating'];
       const num = stepsList.indexOf(nextStep) + 1;
       const { db } = await import('@/lib/firebase/clientApp');
       // Save draft data along with step
       await setDoc(doc(db, "users", user!.uid), { 
         onboarding_step: num,
         name,
         batch,
         wake_time: wakeTime,
         sleep_time: sleepTime,
         morning_commute_mins: morningCommute,
         Evening_commute_mins: eveningCommute,
         rush_hour_buffer: rushHourBuffer,
         semester_weeks: semesterWeeks,
         checkin_intensity: intensity,
         updated_at: serverTimestamp()
       }, { merge: true });
    } catch(e) {}
  };

  const finishOnboarding = async () => {
    advanceStep('generating');
    try {
      const idToken = await user?.getIdToken();
      if (!idToken) throw new Error("Authentication token missing. Please refresh and log in again.");

      const { db } = await import('@/lib/firebase/clientApp');

      const saveUserPromise = setDoc(doc(db, "users", user!.uid), {
        name,
        batch,
        wake_time: wakeTime,
        sleep_time: sleepTime,
        morning_commute_mins: morningCommute,
        Evening_commute_mins: eveningCommute,
        rush_hour_buffer: rushHourBuffer,
        semester_weeks: semesterWeeks,
        checkin_intensity: intensity,
        onboarding_step: 9,
        created_at: serverTimestamp()
      }, { merge: true });

      await Promise.race([
        saveUserPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("Database save timed out. Did you create a Firestore Database in your Firebase Console?")), 10000))
      ]);

      // Delete ALL existing classes for this user first
      const existingClasses = await getDocs(query(
        collection(db, 'classes'),
        where('user_id', '==', user!.uid)
      ));
      const deletePromises = existingClasses.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);

      // Deduplicate before saving
      const seenKeys = new Set<string>();
      const uniqueClasses = classes.filter((cls: any) => {
        const key = [
          cls.subject || '',
          (cls.days || []).sort().join(','),
          cls.startTime || '',
          cls.batch || 'All'
        ].join('|');
        if (seenKeys.has(key)) return false;
        seenKeys.add(key);
        return true;
      });

      const classesRef = collection(db, "classes");
      const saveClassesPromises = uniqueClasses.map((cls: any) => 
        addDoc(classesRef, {
          ...cls,
          user_id: user!.uid,
          created_at: serverTimestamp()
        })
      );

      await Promise.race([
        Promise.all(saveClassesPromises),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Class saving timed out. Check Firestore rules.")), 10000))
      ]);

      const apiPromise = fetch('/api/generate-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ classes, preferences: { morningCommute, eveningCommute, wakeTime, sleepTime, intensity, semesterWeeks, rushHourBuffer } })
      });

      const res = await Promise.race([
        apiPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("AI Generator API hanging or timed out.")), 15000))
      ]) as Response;

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server returned ${res.status}`);
      }

      router.push('/dashboard');
    } catch (err: any) {
      console.error("ONBOARDING CRASH:", err);
      toast.error(err.message, { duration: 6000 });
      setStep('intensity');
    }
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
       const file = e.target.files[0];
       setSelectedFile(file);
       setPreviewUrl(URL.createObjectURL(file));
       setUploadState('selected');
    }
  };

  const skipToManualEntry = () => {
    setClasses([]);
    advanceStep('verify');
  };

  if (authLoading || !user) return <div className="min-h-screen bg-[#FAFAF8]" />;

  if (showIOSInstall) {
    return (
      <div className="fixed inset-0 z-50 bg-[#6366F1] flex justify-center items-center text-white px-6">
         <div className="max-w-md w-full flex flex-col items-center animate-in zoom-in slide-in-from-bottom-8 duration-500">
           <svg className="w-24 h-24 mb-8 text-white rounded-[24px]" viewBox="0 0 100 100" fill="currentColor"><rect width="100" height="100" rx="30" fill="white" fillOpacity="0.1"/><path d="M50 30 L50 70 M50 30 L30 50 M50 30 L70 50" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/></svg>
           <h2 className="font-heading text-4xl mb-4 text-center">Install Dayo</h2>
           <p className="text-center text-white/80 mb-12">To get the best experience and receive important notifications, add Dayo to your Home Screen.</p>
           
           <div className="bg-white/10 p-6 rounded-2xl border border-white/20 w-full flex flex-col items-center gap-4 mb-12">
             <div className="flex items-center gap-4 text-white text-lg font-medium w-full"><span className="w-8 h-8 rounded-full bg-white text-[#6366F1] flex items-center justify-center font-bold">1</span> Tap the Share button at the bottom</div>
             <div className="flex items-center gap-4 text-white text-lg font-medium w-full"><span className="w-8 h-8 rounded-full bg-white text-[#6366F1] flex items-center justify-center font-bold">2</span> Scroll and select "Add to Home Screen"</div>
           </div>

           <div className="flex w-full gap-4">
              <button onClick={() => { setShowIOSInstall(false); advanceStep('intensity'); }} className="flex-1 bg-white/20 hover:bg-white/30 text-white py-4 rounded-full font-bold transition">Skip for now</button>
           </div>
         </div>
      </div>
    );
  }

  const stepsList: WizardStep[] = ['profile','upload','batch_select','verify','commute','wake_sleep','semester','intensity','generating'];
  const currentIdx = stepsList.indexOf(step);

  return (
    <div className="min-h-[100dvh] bg-[#E5E0D5] flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans">
      <div className="w-full max-w-[1000px] h-[90vh] min-h-[600px] bg-[#FAFAF8] rounded-[20px] border-[1.5px] border-[#E5E0D5] overflow-hidden flex flex-col shadow-sm relative">
        
         <div className="pt-8 px-8 flex justify-between items-center z-10 shrink-0">
           <div className="flex gap-2">
             {stepsList.map((s, i) => (
               <div key={i} className={`h-2 rounded-full transition-all duration-300 ${
                 currentIdx >= i ? 'w-8 bg-[#6366F1]' : 'w-2 bg-[#D1D5DB]'
               }`} />
             ))}
           </div>
           <button 
             onClick={() => {
                if (uploadState === 'processing') {
                   setUploadState('selected');
                   toast.dismiss();
                } else {
                   router.push('/');
                }
             }} 
             className="text-[#9CA3AF] hover:text-[#1A1A2E] transition-colors"
           >
             <X className="w-6 h-6" />
           </button>
        </div>

        <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-10 flex flex-col items-center">
          
          {step === 'profile' && (
            <div className="w-full max-w-sm flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="font-heading text-[40px] text-[#1A1A2E] leading-[1.1] mb-2 text-center text-balance">Hey! What should we call you?</h2>
              <p className="text-[14px] text-[#9CA3AF] mb-12 text-center">Let&apos;s personalize your daily briefing.</p>
              <div className="w-full space-y-6">
                 <input type="text" placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} className="w-full h-[56px] bg-white border-[1.5px] border-[#F3F4F6] rounded-[16px] px-6 text-[15px] font-medium text-[#1A1A2E] focus:border-[#6366F1] outline-none transition-all" />
              </div>
              <button onClick={() => advanceStep('upload')} disabled={!name} className="w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white py-4 rounded-full font-bold mt-16 shadow-lg disabled:opacity-30 transition-colors">Continue</button>
            </div>
          )}

          {step === 'upload' && (
            <div className="w-full max-w-md flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="font-heading text-[40px] text-[#1A1A2E] leading-tight mb-2 text-center">Let&apos;s read your timetable</h2>
              <p className="text-[14px] text-[#9CA3AF] mb-10 text-center">We use AI to map your week in seconds (Auto-2-Pass Check Enabled).</p>

              {uploadState === 'idle' || uploadState === 'error' ? (
                <div className="w-full grid gap-4">
                  <button className="flex items-center gap-4 p-5 bg-white rounded-[16px] border-[1.5px] border-[#F3F4F6] hover:border-[#6366F1] transition-all group">
                     <div className="w-12 h-12 rounded-full bg-[#EEF2FF] flex items-center justify-center text-[#6366F1]">
                       <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M4 4h3l2-2h6l2 2h3a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm8 3a5 5 0 100 10 5 5 0 000-10z"/></svg>
                     </div>
                     <div className="text-left">
                       <p className="font-bold text-[15px] text-[#1A1A2E]">Take Photo</p>
                       <p className="text-[12px] text-[#9CA3AF]">Use your camera</p>
                     </div>
                  </button>

                  <label className="flex items-center gap-4 p-5 bg-white rounded-[16px] border-[1.5px] border-[#F3F4F6] hover:border-[#6366F1] transition-all group cursor-pointer">
                     <input type="file" className="hidden" accept="image/*,application/pdf" onChange={onFileSelected} />
                     <div className="w-12 h-12 rounded-full bg-[#EEF2FF] flex items-center justify-center text-[#6366F1]">
                       <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zm-3 14H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V8h2v2zm4 8h-2v-2h2v2zm0-4h-2v-2h2v2z"/></svg>
                     </div>
                     <div className="text-left">
                       <p className="font-bold text-[15px] text-[#1A1A2E]">Upload File</p>
                       <p className="text-[12px] text-[#9CA3AF]">PDF, JPG or PNG (Auto-Upscales)</p>
                     </div>
                  </label>

                  <button className="flex items-center gap-4 p-5 bg-white rounded-[16px] border-[1.5px] border-[#F3F4F6] hover:border-[#6366F1] transition-all group">
                     <div className="w-12 h-12 rounded-full bg-[#F3F4F6] flex items-center justify-center text-[#9CA3AF]">
                       <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M11 20H8l1-6H5l1-2h4l1-6h3l-1 6h4l-1 6h3l-1 6h4l-1 2h-4l-1 6h3l-1 2h-4l-1 6h-3l1-6h-4l-1 6H8l1-6zm4-8h-4l-1 6h4l1-6z"/></svg>
                     </div>
                     <div className="text-left">
                       <p className="font-bold text-[15px] text-[#1A1A2E]">Enter Class Code</p>
                       <p className="text-[12px] text-[#9CA3AF]">Joining via a friend?</p>
                     </div>
                  </button>

                  <button onClick={skipToManualEntry} className="text-[#9CA3AF] text-[13px] font-medium hover:text-[#1A1A2E] transition-colors mt-6 p-2">
                    Enter classes manually →
                  </button>
                </div>
              ) : (
                <div className="w-full flex flex-col items-center animate-in zoom-in-95 duration-300">
                  <div className="w-full aspect-video bg-[#E5E7EB] rounded-[16px] overflow-hidden mb-6 relative border-[1.5px] border-[#F3F4F6] shadow-sm flex items-center justify-center">
                    {previewUrl ? (
                      <img src={previewUrl} className="w-full h-full object-cover opacity-60" alt="Timetable Preview" />
                    ) : (
                      <BookOpen className="w-10 h-10 text-[#9CA3AF]" />
                    )}
                    {uploadState === 'processing' && (
                       <div className="absolute inset-0 bg-[#0F0F1A]/40 flex flex-col items-center justify-center text-white p-4">
                          <div className="w-12 h-12 border-[3px] border-white/20 border-t-white rounded-full animate-spin mb-4" />
                          <p className="font-bold">Analysing Timetable...</p>
                       </div>
                    )}
                  </div>
                  
                  <div className="w-full bg-white p-4 rounded-[16px] border-[1.5px] border-[#F3F4F6] mb-8">
                     <p className="font-bold text-[#1A1A2E] text-[14px] truncate">{selectedFile?.name || "Uploaded File"}</p>
                     <p className="text-[#9CA3AF] text-[12px] mt-1">{(selectedFile?.size ? (selectedFile.size / 1024 / 1024).toFixed(2) : '0')} MB</p>
                  </div>

                  {uploadState === 'processing' ? (
                     <button disabled className="w-full bg-[#D1D5DB] text-white py-4 rounded-[16px] font-bold shadow-sm transition-colors cursor-not-allowed">
                       Processing Matrix...
                     </button>
                  ) : (
                     <button onClick={executeExtraction} className="w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white py-4 rounded-full font-bold shadow-lg transition-colors">
                       Analyse Timetable →
                     </button>
                  )}
                  
                  {uploadState !== 'processing' && (
                    <button onClick={() => { setUploadState('idle'); setSelectedFile(null); }} className="text-[#9CA3AF] text-[13px] font-medium hover:text-[#EF4444] transition-colors mt-4 p-2">
                      Cancel
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 'batch_select' && (
             <div className="w-full max-w-2xl flex flex-col items-center animate-in fade-in zoom-in-95 duration-500">
               <h2 className="font-heading text-[40px] text-[#1A1A2E] leading-tight mb-2 text-center text-balance">Which batch are you in?</h2>
               <p className="text-[14px] text-[#9CA3AF] mb-12 text-center">We noticed multiple groups inside your timetable. Your practical labs differ by batch.</p>
               
               <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                  {availableBatches.map(batchCode => (
                     <button 
                       key={batchCode}
                       onClick={() => handleBatchSelection(batchCode)}
                       className="aspect-square bg-white border-2 border-[#E5E7EB] hover:border-[#6366F1] hover:bg-[#EEF2FF] rounded-[24px] flex flex-col items-center justify-center transition-all group shadow-sm hover:shadow-md p-4"
                     >
                       <span className="text-[48px] font-heading text-[#1A1A2E] group-hover:text-[#6366F1] transition-colors line-clamp-1 break-all w-full text-center px-2">{batchCode}</span>
                       <span className="text-[11px] text-[#9CA3AF] font-medium mt-2 group-hover:text-[#6366F1]/70 transition-colors uppercase tracking-widest bg-[#F9FAFB] px-3 py-1 rounded-full">Select Group</span>
                     </button>
                  ))}
               </div>
             </div>
          )}

          {step === 'verify' && (
            <div className="w-full max-w-4xl flex flex-col items-center animate-in fade-in duration-700 relative">
              {classes.length === 0 ? (
                <>
                  <h2 className="font-heading text-[32px] text-[#1A1A2E] leading-tight mb-2 text-center">Let&apos;s add your classes manually</h2>
                  <p className="text-[14px] text-[#9CA3AF] mb-8 text-center">Our AI couldn&apos;t read your timetable. Add your classes one by one.</p>
                </>
              ) : (
                <>
                  <h2 className="font-heading text-[32px] text-[#1A1A2E] leading-tight mb-2 text-center">{name.split(' ')[0] || 'Hey'}, we found {classes.length} classes!</h2>
                  <p className="text-[14px] text-[#9CA3AF] mb-4 text-center">Does this look right? You can edit properties or add missing entries manually.</p>
                </>
              )}

               {classes.length > 0 && !classes.some(c => c.uncertain) && uploadState === 'complete' && (
                 <div className="w-full max-w-2xl mb-6 p-4 bg-[#ECFDF5] border border-[#10B981]/30 rounded-[16px] flex items-start gap-3">
                   <span className="text-xl">✅</span>
                   <p className="text-[13px] text-[#065F46] font-medium">AI successfully read your timetable! Please verify below.</p>
                 </div>
               )}

               {classes.length > 0 && classes.some(c => c.uncertain) && uploadState === 'complete' && (
                 <div className="w-full max-w-2xl mb-6 p-4 bg-[#FEF3C7] border border-[#F59E0B]/30 rounded-[16px] flex items-start gap-3">
                   <span className="text-xl">⚠️</span>
                   <p className="text-[13px] text-[#92400E] font-medium">Some entries were unclear — highlighted in orange. Please check them.</p>
                 </div>
               )}

              {/* ── FORM SECTION ── */}
              <div className="w-full max-w-2xl bg-white p-6 rounded-[20px] shadow-sm border border-[#E5E7EB] mb-6">
                <h3 className="font-bold text-[#1A1A2E] mb-4">Add Class</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="col-span-1 md:col-span-2">
                    <input id="subject-input" type="text" placeholder="Subject Name e.g. Physics" value={manualForm.subject} onChange={e => { setManualForm({...manualForm, subject: e.target.value}); setFormErrors(prev => ({...prev, subject: ''})); }} className={`w-full h-12 bg-[#F9FAFB] border rounded-xl px-4 outline-none focus:border-[#6366F1] ${formErrors.subject ? 'border-red-400 bg-red-50' : 'border-[#E5E7EB]'}`} />
                    {formErrors.subject && <p className="text-red-500 text-xs mt-1">{formErrors.subject}</p>}
                  </div>
                  
                  <div className="flex bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-1">
                    <button onClick={() => setManualForm({...manualForm, type: 'Theory'})} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${manualForm.type === 'Theory' ? 'bg-white shadow-sm text-[#1A1A2E]' : 'text-[#9CA3AF]'}`}>Theory</button>
                    <button onClick={() => setManualForm({...manualForm, type: 'Practical'})} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${manualForm.type === 'Practical' ? 'bg-white shadow-sm text-[#1A1A2E]' : 'text-[#9CA3AF]'}`}>Practical</button>
                  </div>

                  <div className="flex gap-2">
                    <div className="flex-1">
                      <input type="time" value={manualForm.startTime} onChange={e => { setManualForm({...manualForm, startTime: e.target.value}); setFormErrors(prev => ({...prev, startTime: ''})); }} className={`w-full h-12 bg-[#F9FAFB] border rounded-xl px-4 outline-none focus:border-[#6366F1] ${formErrors.startTime ? 'border-red-400 bg-red-50' : 'border-[#E5E7EB]'}`} />
                      {formErrors.startTime && <p className="text-red-500 text-xs mt-1">{formErrors.startTime}</p>}
                    </div>
                    <div className="flex-1">
                      <input type="time" value={manualForm.endTime} onChange={e => { setManualForm({...manualForm, endTime: e.target.value}); setFormErrors(prev => ({...prev, endTime: ''})); }} className={`w-full h-12 bg-[#F9FAFB] border rounded-xl px-4 outline-none focus:border-[#6366F1] ${formErrors.endTime ? 'border-red-400 bg-red-50' : 'border-[#E5E7EB]'}`} />
                      {formErrors.endTime && <p className="text-red-500 text-xs mt-1">{formErrors.endTime}</p>}
                    </div>
                  </div>

                  <div className="col-span-1 md:col-span-2">
                    <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                      {DAYS_OF_WEEK.map(day => (
                        <button key={day} onClick={() => {
                          const days = manualForm.days.includes(day) ? manualForm.days.filter(d => d !== day) : [...manualForm.days, day];
                          setManualForm({...manualForm, days});
                          setFormErrors(prev => ({...prev, days: ''}));
                        }} className={`px-4 py-2 shrink-0 rounded-full border text-xs font-bold transition-all ${manualForm.days.includes(day) ? 'bg-[#6366F1] border-[#6366F1] text-white' : 'bg-[#F9FAFB] border-[#E5E7EB] text-[#6B7280]'}`}>
                          {day.substring(0,3)}
                        </button>
                      ))}
                    </div>
                    {formErrors.days && <p className="text-red-500 text-xs mt-1">{formErrors.days}</p>}
                  </div>

                  <input type="text" placeholder="Room (Optional)" value={manualForm.room} onChange={e => setManualForm({...manualForm, room: e.target.value})} className="w-full h-12 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-4 outline-none focus:border-[#6366F1]" />
                  <input type="text" placeholder="Faculty (Optional)" value={manualForm.faculty} onChange={e => setManualForm({...manualForm, faculty: e.target.value})} className="w-full h-12 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-4 outline-none focus:border-[#6366F1]" />
                </div>

                {/* + Add Class — INSIDE the form */}
                <button onClick={() => {
                  const newErrors: Record<string, string> = {};
                  if (!manualForm.subject.trim()) newErrors.subject = 'Subject name is required';
                  if (manualForm.days.length === 0) newErrors.days = 'Select at least one day';
                  if (!manualForm.startTime) newErrors.startTime = 'Start time is required';
                  if (!manualForm.endTime) newErrors.endTime = 'End time is required';
                  const toMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
                  if (manualForm.startTime && manualForm.endTime && toMins(manualForm.endTime) <= toMins(manualForm.startTime)) {
                    newErrors.endTime = 'End time must be after start time';
                  }
                  if (Object.keys(newErrors).length > 0) { setFormErrors(newErrors); return; }

                  const formatTime = (time24: string) => {
                    const [h, m] = time24.split(':').map(Number);
                    const ampm = h >= 12 ? 'PM' : 'AM';
                    const h12 = h % 12 || 12;
                    return `${h12}:${m.toString().padStart(2,'0')} ${ampm}`;
                  };

                  setClasses(prev => [{ ...manualForm, startTime: formatTime(manualForm.startTime), endTime: formatTime(manualForm.endTime), batch: 'All', uncertain: false }, ...prev]);
                  toast.success(`${manualForm.subject} added!`);
                  setManualForm(prev => ({ ...prev, subject: '', room: '', faculty: '' }));
                  setFormErrors({});
                  setTimeout(() => document.getElementById('subject-input')?.focus(), 100);
                }} className="w-full mt-4 bg-[#6366F1] hover:bg-[#4F46E5] text-white py-3 rounded-xl font-bold shadow-md transition-all">
                  + Add Class
                </button>
              </div>

              {/* ── ADDED CLASSES LIST ── */}
              {classes.length > 0 && (
                <div className="w-full max-w-2xl mb-6">
                  <p className="text-[11px] text-[#9CA3AF] uppercase tracking-widest font-bold mb-3">{classes.length} classes added</p>
                  {classes.map((cls, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-[#F8F7FF] rounded-xl mb-2" style={{ animation: `fadeSlideUp 300ms ease-out ${i * 60}ms both` }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#1A1A2E] truncate">{cls.subject}</p>
                        <p className="text-xs text-gray-400">{cls.days.map(d => d.slice(0,3)).join(', ')} · {cls.startTime} – {cls.endTime}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${cls.type === 'Practical' ? 'bg-[#FFF0F3] text-[#E11D48]' : 'bg-[#EEF2FF] text-[#6366F1]'}`}>{cls.type || 'Theory'}</span>
                      <button onClick={() => setClasses(classes.filter((_, idx) => idx !== i))} className="text-gray-300 hover:text-red-400 text-lg shrink-0">×</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Natural Language AI Corrector */}
              <div className="w-full max-w-2xl bg-white p-2 pl-4 rounded-[16px] flex flex-col md:flex-row gap-2 items-center mb-12 shadow-[0_4px_24px_rgba(0,0,0,0.06)] border-[1.5px] border-[#6366F1]/30">
                <Wand2 className="w-5 h-5 text-[#6366F1] shrink-0 hidden md:block" />
                <input 
                  type="text" 
                  value={correctionText}
                  onChange={(e) => setCorrectionText(e.target.value)}
                  placeholder="Something wrong? Describe it in plain English"
                  className="w-full text-[14px] bg-transparent outline-none placeholder:text-[#9CA3AF] text-[#1A1A2E] py-2 md:py-0"
                  disabled={isCorrecting}
                />
                <button 
                  onClick={applyCorrection} 
                  disabled={!correctionText.trim() || isCorrecting}
                  className="w-full md:w-auto px-6 py-2.5 bg-[#6366F1] hover:bg-[#4F46E5] text-white font-bold text-[13px] rounded-[12px] shadow-sm transition-all disabled:opacity-50"
                >
                  {isCorrecting ? 'Fixing...' : 'Fix'}
                </button>
              </div>

              {/* Empty bottom padding so content doesn't hide behind fixed Done button */}
              <div className="h-24" />

              {/* ── DONE BUTTON — FIXED TO BOTTOM, only when classes exist ── */}
              {classes.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-sm border-t border-gray-100 z-50">
                  <div className="max-w-md mx-auto">
                    <button disabled={classes.length === 0} onClick={() => advanceStep('commute')} className="w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white py-4 rounded-[14px] font-semibold text-[14px] shadow-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
                      <span>Done — Build My Schedule ({classes.length} classes)</span>
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'commute' && (
            <div className="w-full max-w-sm flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="font-heading text-[40px] text-[#1A1A2E] leading-[1.1] mb-2 text-center">How long is your commute?</h2>
              <div className="w-full space-y-10 mt-12">
                <div className="space-y-4">
                  <div className="flex justify-between items-end px-2">
                     <span className="text-[12px] font-bold text-[#9CA3AF] uppercase tracking-widest">Morning</span>
                     <span className="font-heading text-[32px] text-[#6366F1]">{morningCommute}min</span>
                  </div>
                  <input type="range" min="5" max="120" step="5" value={morningCommute} onChange={(e) => setMorningCommute(parseInt(e.target.value))} className="w-full accent-[#6366F1]" />
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-end px-2">
                     <span className="text-[12px] font-bold text-[#9CA3AF] uppercase tracking-widest">Evening</span>
                     <span className="font-heading text-[32px] text-[#6366F1]">{eveningCommute}min</span>
                  </div>
                  <input type="range" min="5" max="120" step="5" value={eveningCommute} onChange={(e) => setEveningCommute(parseInt(e.target.value))} className="w-full accent-[#6366F1]" />
                </div>
                <div className="flex items-center gap-4 p-5 bg-white rounded-[20px] border-[1.5px] border-[#F3F4F6]">
                   <div className="flex-1 text-sm font-bold text-[#1A1A2E]">Evening rush hour delay?</div>
                   <button onClick={() => setRushHourBuffer(!rushHourBuffer)} className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 ${rushHourBuffer ? 'bg-[#6366F1]' : 'bg-[#D1D5DB]'}`}><div className={`w-4 h-4 rounded-full bg-white transition-transform ${rushHourBuffer ? 'translate-x-6' : 'translate-x-0'}`} /></button>
                </div>
              </div>
              <button onClick={() => advanceStep('wake_sleep')} className="w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white py-4 rounded-full font-bold shadow-lg mt-12 transition-colors">Continue</button>
            </div>
          )}

          {step === 'wake_sleep' && (
            <div className="w-full max-w-sm flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="font-heading text-[40px] text-[#1A1A2E] mb-12">Daily Anchors</h2>
              <div className="w-full space-y-12">
                 <div className="text-center"><label className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest block mb-4">Wake Time</label><input type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} className="w-full text-center font-heading text-[64px] text-[#1A1A2E] bg-transparent outline-none border-b-2 border-[#E5E7EB] pb-2 cursor-pointer" /></div>
                 <div className="text-center"><label className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest block mb-4">Sleep Time</label><input type="time" value={sleepTime} onChange={(e) => setSleepTime(e.target.value)} className="w-full text-center font-heading text-[64px] text-[#1A1A2E] bg-transparent outline-none border-b-2 border-[#E5E7EB] pb-2 cursor-pointer" /></div>
              </div>
              <button onClick={() => advanceStep('semester')} className="w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white py-4 rounded-full font-bold shadow-lg mt-16 transition-colors">Continue</button>
            </div>
          )}

          {step === 'semester' && (
            <div className="w-full max-w-sm flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="font-heading text-[40px] text-[#1A1A2E] text-center text-balance mb-2">How many weeks is your semester?</h2>
              <div className="w-full flex justify-center my-16"><input type="number" value={semesterWeeks} onChange={(e) => setSemesterWeeks(parseInt(e.target.value) || 0)} className="w-48 text-center font-heading text-[96px] text-[#6366F1] bg-transparent outline-none" /></div>
              <button onClick={() => advanceStep('intensity')} className="w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white py-4 rounded-full font-bold shadow-lg transition-colors">Continue</button>
            </div>
          )}

          {step === 'intensity' && (
            <div className="w-full max-w-md flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="font-heading text-[40px] text-[#1A1A2E] text-center text-balance mb-12">Notification Intensity</h2>
              <div className="w-full space-y-4 mb-12">
                {[{id:'gentle', label:'🧘 Gentle', desc:'Briefing + Sunday report'}, {id:'balanced', label:'⚖️ Balanced', desc:'Morning + End-of-day'}, {id:'detailed', label:'📊 Detailed', desc:'All active'}].map((t) => (
                  <button key={t.id} onClick={() => setIntensity(t.id as any)} className={`w-full p-5 rounded-[20px] text-left border-[2px] transition-all ${intensity === t.id ? 'bg-[#EEF2FF] border-[#6366F1]' : 'bg-white border-[#F3F4F6] hover:border-[#E5E7EB]'}`}>
                    <p className={`font-bold text-[16px] mb-1 ${intensity === t.id ? 'text-[#6366F1]' : 'text-[#1A1A2E]'}`}>{t.label}</p>
                    <p className={`text-[12px] ${intensity === t.id ? 'text-[#6366F1]/80' : 'text-[#9CA3AF]'}`}>{t.desc}</p>
                  </button>
                ))}
              </div>
              <button onClick={finishOnboarding} className="w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white py-4 rounded-full font-bold shadow-lg transition-colors">Finalize My Day</button>
            </div>
          )}

          {step === 'generating' && (
             <div className="flex-1 flex flex-col items-center justify-center animate-pulse">
                <div className="w-20 h-20 bg-[#6366F1] rounded-[24px] rotate-45 flex items-center justify-center mb-10 shadow-xl"><div className="w-10 h-10 border-4 border-white border-t-transparent animate-spin rounded-full -rotate-45" /></div>
                <h2 className="font-heading text-[40px] text-[#1A1A2E] mb-2 text-center">Your day is ready...</h2>
                <p className="text-[14px] text-[#9CA3AF] text-center">AI is injecting your lifestyle blocks.</p>
             </div>
          )}

        </main>
      </div>
    </div>
  );
}
