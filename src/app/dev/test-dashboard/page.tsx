"use client";

import { useState, useEffect } from "react";
import { useRouter, redirect } from "next/navigation";
import { Play, RotateCcw, Download, CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";

type TestResult = 'PENDING' | 'RUNNING' | 'PASS' | 'FAIL' | 'WARNING' | 'SKIPPED';

if (process.env.NODE_ENV !== 'development') {
  redirect('/dashboard');
}

export interface TestCase {
  id: string;
  category: string;
  name: string;
  status: TestResult;
  timeMs: number;
  expected: string;
  actual: string;
  error?: string;
  fix?: string;
}

const ALL_TESTS: Omit<TestCase, 'status' | 'timeMs' | 'actual' | 'error' | 'fix'>[] = [
  // FIREBASE
  { id: 'fb_conn', category: 'Firebase', name: 'Firebase Connection', expected: 'connection successful under 2000ms' },
  { id: 'fb_auth_google', category: 'Firebase', name: 'Firebase Auth — Google OAuth', expected: 'provider initialized, no config errors' },
  { id: 'fb_auth_phone', category: 'Firebase', name: 'Firebase Auth — Phone OTP', expected: 'provider initialized' },
  { id: 'fb_rules', category: 'Firebase', name: 'Firestore Security Rules', expected: 'permission denied error' },
  { id: 'fb_write_users', category: 'Firebase', name: 'Firestore Write — Users', expected: 'write and read succeed, data matches' },
  { id: 'fb_write_blocks', category: 'Firebase', name: 'Firestore Write — Schedule Blocks', expected: 'success' },
  { id: 'fb_token_val', category: 'Firebase', name: 'Firebase Token Validation', expected: '401 unauthorized response' },

  // AI PIPELINE
  { id: 'ai_gemini_conn', category: 'AI Pipeline', name: 'Gemini API Connection', expected: 'valid JSON response under 5000ms' },
  { id: 'ai_gemini_ver', category: 'AI Pipeline', name: 'Gemini Model Version', expected: 'gemini-3-flash-preview' },
  { id: 'ai_extraction_test', category: 'AI Pipeline', name: 'Timetable Extract — Sample Image', expected: 'JSON array with exactly 3 class objects' },
  { id: 'ai_twopass', category: 'AI Pipeline', name: 'Timetable Two-Pass Verification', expected: 'two generateContent calls found' },
  { id: 'ai_claude_conn', category: 'AI Pipeline', name: 'Claude API Connection', expected: 'valid JSON under 5000ms' },
  { id: 'ai_claude_ver', category: 'AI Pipeline', name: 'Claude Model Versions', expected: 'correct models in correct routes' },
  { id: 'ai_sched_gen', category: 'AI Pipeline', name: 'Schedule Generation', expected: 'schedule quality score with details' },
  { id: 'ai_json_valid', category: 'AI Pipeline', name: 'JSON Response Validity', expected: 'all parse successfully' },

  // API ROUTES
  { id: 'api_extract_405', category: 'API Routes', name: '/api/extract-schedule exists (405 GET)', expected: '405 Method Not Allowed' },
  { id: 'api_extract_401', category: 'API Routes', name: '/api/extract-schedule — no auth', expected: '401 Unauthorized' },
  { id: 'api_extract_400', category: 'API Routes', name: '/api/extract-schedule — empty body', expected: '400 Bad Request' },
  { id: 'api_gen_exists', category: 'API Routes', name: '/api/generate-schedule exists', expected: '405 on GET' },
  { id: 'api_bunk_exists', category: 'API Routes', name: '/api/bunk exists and validates', expected: '400 or 401' },
  { id: 'api_batch_create', category: 'API Routes', name: '/api/batch/create exists', expected: '405 on GET' },
  { id: 'api_batch_join', category: 'API Routes', name: '/api/batch/join exists', expected: '405 on GET' },
  { id: 'api_notif_exists', category: 'API Routes', name: '/api/notifications/schedule exists', expected: '404 or 405' },
  { id: 'api_report_exists', category: 'API Routes', name: '/api/report/weekly exists', expected: '404 or 405' },
  { id: 'api_cal_exists', category: 'API Routes', name: '/api/calendar/sync exists', expected: '404 or 405' },
  { id: 'api_rate_limit', category: 'API Routes', name: 'Rate Limiting', expected: '6th request returns 429' },

  // ATTENDANCE MATH
  { id: 'math_safe', category: 'Attendance Math', name: 'Safe Zone Calculation', expected: 'current_pct=90%, status=safe' },
  { id: 'math_warning', category: 'Attendance Math', name: 'Warning Zone Calculation', expected: 'current_pct=75%, status=warning' },
  { id: 'math_danger', category: 'Attendance Math', name: 'Danger Zone Calculation', expected: 'current_pct=70%, status=danger' },
  { id: 'math_cascade', category: 'Attendance Math', name: 'Attendance Cascade on Bunk', expected: 'attendance record written, block deleted' },

  // ONBOARDING
  { id: 'ob_order', category: 'Onboarding Flow', name: 'Step Route Order', expected: 'all routes exist strictly ordered' },
  { id: 'ob_save', category: 'Onboarding Flow', name: 'Progress Save', expected: 'onboarding_step increments' },
  { id: 'ob_resume', category: 'Onboarding Flow', name: 'Onboarding Resume', expected: 'app redirects to step 5' },
  { id: 'ob_ios', category: 'Onboarding Flow', name: 'iOS Install Screen Logic', expected: 'standalone check present' },
  { id: 'ob_preproc', category: 'Onboarding Flow', name: 'Image Preprocessing', expected: 'Canvas scaling & PNG conversion found' },

  // UI/DESIGN
  { id: 'ui_fonts', category: 'UI & Design', name: 'Font Loading', expected: 'DM Serif & Inter loaded' },
  { id: 'ui_colors', category: 'UI & Design', name: 'Colour Tokens', expected: 'all specific hex codes present' },
  { id: 'ui_btns', category: 'UI & Design', name: 'Continue Button Colours', expected: 'background #6366F1' },
  { id: 'ui_icons', category: 'UI & Design', name: 'Timeline SVGs vs Lucide', expected: 'custom SVGs only' },
  { id: 'ui_layout', category: 'UI & Design', name: 'Three Column Layout', expected: 'all 3 present' },
  { id: 'ui_break', category: 'UI & Design', name: 'Responsive Breakpoints', expected: 'desktop/tablet/mobile defined' },
  { id: 'ui_skel', category: 'UI & Design', name: 'Skeleton Screens', expected: 'zero spinners' },
  { id: 'ui_storage', category: 'UI & Design', name: 'SessionStorage Usage', expected: 'zero occurrences' },

  // PWA & ENV
  { id: 'pwa_manifest', category: 'PWA Config', name: 'PWA Manifest', expected: 'all fields present' },
  { id: 'pwa_sw', category: 'PWA Config', name: 'Service Worker', expected: 'sw.js present' },
  { id: 'pwa_cache', category: 'PWA Config', name: 'Offline Schedule Cache', expected: 'caching configured' },
  { id: 'pwa_next', category: 'PWA Config', name: 'next-pwa Configuration', expected: 'config present' },
  { id: 'env_vars', category: 'Environment', name: 'Required Env Vars Present', expected: 'all variables defined' },
];

export default function TestDashboard() {
  const router = useRouter();
  const [tests, setTests] = useState<TestCase[]>(ALL_TESTS.map(t => ({ ...t, status: 'PENDING', timeMs: 0, actual: 'Not run' })));
  const [isRunningAll, setIsRunningAll] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') {
      router.replace('/');
    } else {
      runAllTests();
    }
  }, [router]);

  const runTest = async (testId: string) => {
    setTests(prev => prev.map(t => t.id === testId ? { ...t, status: 'RUNNING' } : t));
    
    let base64Mock = "";
    if (testId === 'ai_extraction_test') {
       const canvas = document.createElement('canvas');
       canvas.width = 1200; canvas.height = 600;
       const ctx = canvas.getContext('2d')!;
       ctx.fillStyle = '#fff'; ctx.fillRect(0,0,1200,600);
       ctx.fillStyle = '#000'; ctx.font = '24px Arial';
       ctx.fillText("MONDAY", 200, 50); ctx.fillText("TUESDAY", 400, 50); ctx.fillText("WEDNESDAY", 600, 50);
       ctx.fillText("09:00 AM", 50, 100); ctx.fillText("Physics", 200, 100);
       ctx.fillText("10:00 AM", 50, 200); ctx.fillText("Maths", 400, 200);
       ctx.fillText("11:00 AM", 50, 300); ctx.fillText("Chemistry", 600, 300);
       base64Mock = canvas.toDataURL('image/png').split(',')[1];
    }

    try {
      const start = performance.now();
      const res = await fetch('/api/dev/test-runner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId, payload: { base64Mock } })
      });
      const data = await res.json();
      const timeMs = Math.round(performance.now() - start);

      setTests(prev => prev.map(t => t.id === testId ? { 
        ...t, 
        status: data.status, 
        actual: data.actual || 'No actual data',
        error: data.error,
        fix: data.fix,
        timeMs 
      } : t));
    } catch (e: any) {
      setTests(prev => prev.map(t => t.id === testId ? { 
        ...t, 
        status: 'FAIL', 
        actual: 'Fetch Error',
        error: e.message,
        timeMs: 0 
      } : t));
    }
  };

  const runAllTests = async () => {
    setIsRunningAll(true);
    // Reset
    setTests(ALL_TESTS.map(t => ({ ...t, status: 'PENDING', timeMs: 0, actual: 'Not run' })));
    
    // Execute sequentially to prevent massive concurrent API spam
    for (const t of ALL_TESTS) {
      await runTest(t.id);
    }
    setIsRunningAll(false);
  };

  const completed = tests.filter(t => t.status !== 'PENDING' && t.status !== 'RUNNING').length;
  const passed = tests.filter(t => t.status === 'PASS').length;
  const failed = tests.filter(t => t.status === 'FAIL').length;
  const warnings = tests.filter(t => t.status === 'WARNING').length;

  const downloadReport = () => {
    let report = "DAYO AUTOMATED TEST REPORT\nDate: " + new Date().toISOString() + "\n";
    report += "SCORE: " + passed + "/" + ALL_TESTS.length + " (" + Math.round((passed/ALL_TESTS.length)*100) + "%)\n\n";
    
    report += "CRITICAL FAILURES:\n" + tests.filter(t=>t.status==='FAIL').map(t=>"[FAIL] " + t.name + "\n  Error: " + t.error + "\n  Fix: " + t.fix + "\n").join('\n') + "\n";
    report += "WARNINGS:\n" + tests.filter(t=>t.status==='WARNING').map(t=>"[WARN] " + t.name + "\n  Actual: " + t.actual + "\n").join('\n') + "\n";
    
    const blob = new Blob([report], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'dayo-test-report.txt';
    a.click();
  };

  return (
    <div className="min-h-screen bg-[#0F0F1A] text-[#FAFAF8] p-8 font-sans">
      <div className="max-w-[1200px] mx-auto">
        <header className="flex justify-between items-end mb-8 border-b border-white/10 pb-6">
          <div>
            <h1 className="font-heading text-4xl text-[#6366F1] mb-2">Diagnostic Shell</h1>
            <p className="text-[#9CA3AF]">Dayo Automated Test Suite</p>
          </div>
          <div className="flex gap-4">
             <button onClick={downloadReport} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition">
               <Download className="w-4 h-4" /> Export TXT
             </button>
             <button onClick={runAllTests} disabled={isRunningAll} className="flex items-center gap-2 px-4 py-2 bg-[#6366F1] text-white rounded-lg hover:bg-[#4F46E5] transition shadow-lg shadow-[#6366F1]/20 disabled:opacity-50">
               {isRunningAll ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
               {isRunningAll ? 'Running...' : 'Run All'}
             </button>
          </div>
        </header>

        {/* Progress Bar */}
        <div className="w-full bg-white/5 h-3 rounded-full mb-8 overflow-hidden">
           <div className="h-full bg-[#6366F1] transition-all duration-300" style={{ width: (completed / ALL_TESTS.length * 100) + '%' }} />
        </div>

        {/* Status Blocks */}
        <div className="grid grid-cols-4 gap-4 mb-12">
           <div className="bg-white/5 p-5 rounded-xl border border-white/10">
              <div className="text-[12px] text-[#9CA3AF] font-bold uppercase tracking-wider mb-1">Total Score</div>
              <div className="text-3xl font-heading">{passed}/{ALL_TESTS.length}</div>
           </div>
           <div className="bg-emerald-500/10 p-5 rounded-xl border border-emerald-500/20 text-emerald-400">
              <div className="text-[12px] font-bold uppercase tracking-wider mb-1">Passed</div>
              <div className="text-3xl font-heading flex items-center gap-3"><CheckCircle2 className="w-6 h-6"/> {passed}</div>
           </div>
           <div className="bg-rose-500/10 p-5 rounded-xl border border-rose-500/20 text-rose-400">
              <div className="text-[12px] font-bold uppercase tracking-wider mb-1">Failed</div>
              <div className="text-3xl font-heading flex items-center gap-3"><XCircle className="w-6 h-6"/> {failed}</div>
           </div>
           <div className="bg-amber-500/10 p-5 rounded-xl border border-amber-500/20 text-amber-400">
              <div className="text-[12px] font-bold uppercase tracking-wider mb-1">Warnings</div>
              <div className="text-3xl font-heading flex items-center gap-3"><AlertTriangle className="w-6 h-6"/> {warnings}</div>
           </div>
        </div>

        {/* Detailed Table */}
        <div className="space-y-4">
          {ALL_TESTS.map(t => tests.find(x => x.id === t.id)).map((test) => {
             if (!test) return null;
             
             let bgClasses = "bg-white/5 border-white/10";
             if (test.status === 'PASS') bgClasses = "bg-emerald-500/5 border-emerald-500/20";
             if (test.status === 'FAIL') bgClasses = "bg-rose-500/5 border-rose-500/20";
             if (test.status === 'WARNING') bgClasses = "bg-amber-500/5 border-amber-500/20";
             
             let statusBg = "bg-white/10 text-[#9CA3AF]";
             if (test.status === 'PASS') statusBg = "bg-emerald-500/20 text-emerald-400";
             if (test.status === 'FAIL') statusBg = "bg-rose-500/20 text-rose-400";
             if (test.status === 'WARNING') statusBg = "bg-amber-500/20 text-amber-400";
             if (test.status === 'RUNNING') statusBg = "bg-[#6366F1]/20 text-[#6366F1] animate-pulse";

             return (
               <div key={test.id} className={"p-4 rounded-xl border " + bgClasses}>
                  <div className="flex justify-between items-start">
                     <div>
                       <div className="flex items-center gap-3">
                         <span className={"text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider " + statusBg}>{test.status}</span>
                         <span className="text-[#9CA3AF] text-[12px]">{test.category}</span>
                         <h3 className="font-bold text-white text-[15px]">{test.name}</h3>
                         {test.timeMs > 0 && <span className="text-[11px] text-[#9CA3AF] font-mono">{test.timeMs}ms</span>}
                       </div>
                     </div>
                     <button onClick={() => runTest(test.id)} disabled={test.status === 'RUNNING'} className="text-[11px] bg-white/10 hover:bg-white/20 px-3 py-1 rounded font-bold uppercase tracking-wider transition">Run</button>
                  </div>

                  {(test.status === 'FAIL' || test.status === 'WARNING') && (
                    <div className="mt-4 pl-[80px] space-y-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div>
                         <p className="text-[11px] text-[#9CA3AF] uppercase tracking-wider mb-1">Expected</p>
                         <p className="text-[13px] bg-white/5 py-1 px-3 rounded font-mono text-white/80 border border-white/5">{test.expected}</p>
                       </div>
                       <div>
                         <p className="text-[11px] text-[#9CA3AF] uppercase tracking-wider mb-1">Actual</p>
                         <p className="text-[13px] bg-rose-500/10 py-1 px-3 rounded font-mono text-rose-300 border border-rose-500/20">{test.actual}</p>
                       </div>
                       
                       {test.error && (
                         <div className="col-span-full">
                           <p className="text-[11px] text-rose-400 uppercase tracking-wider mb-1">Error Trace</p>
                           <p className="text-[13px] text-rose-300 bg-rose-950/50 p-2 rounded">{test.error}</p>
                         </div>
                       )}

                       {test.fix && (
                         <div className="col-span-full mt-2 flex items-start gap-2 bg-[#6366F1]/10 p-3 rounded border border-[#6366F1]/30">
                           <Info className="w-5 h-5 text-[#6366F1] shrink-0" />
                           <div>
                             <p className="text-[12px] font-bold text-[#6366F1] mb-0.5">Automated Fix Suggestion</p>
                             <p className="text-[13px] text-indigo-200">{test.fix}</p>
                           </div>
                         </div>
                       )}
                    </div>
                  )}

               </div>
             );
          })}
        </div>
      </div>
    </div>
  );
}
