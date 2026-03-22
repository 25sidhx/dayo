import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, streamText } from 'ai';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// ─── Key Rotation Strategy ──────────────────────────────────────────────────
function getApiKeys(): string[] {
  const keysStr = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
  return keysStr.split(',').map(k => k.trim()).filter(Boolean);
}

const SYSTEM_PROMPT = `You are the friendly, helpful AI scheduling assistant for 'Smart Life Scheduler'. 
Your goal is to complete the user's profiling by asking exactly three short, conversational questions.
Instead of asking for everything at once, ask ONE question per turn. 
Wait for the user's answer, then politely acknowledge it and ask the next question.

Questions to ask sequentially (if you don't already have the answer):
1. What time do you wake up and roughly how long does it take you to get ready?
2. What time do you usually go to sleep?
3. How long is your typical commute to campus (in minutes)?

DO NOT ask for an answer if the user already provided it in a previous message.
If you have all three pieces of information, say: "Perfect, I have all I need! Click 'Generate Schedule' below when you're ready."
Keep responses short, upbeat, and under two sentences.`;

interface UIMessage {
  role: 'user' | 'assistant' | 'system';
  content?: string;
  parts?: Array<{ text: string }>;
}

function parseCoreMessages(messages: UIMessage[]) {
  return messages.map((m) => ({
    role: m.role as 'user' | 'assistant' | 'system',
    content: m.content || (m.parts ? m.parts.map((p) => p.text).join('') : '')
  }));
}

function isRateLimited(msg: string) {
  const m = msg.toLowerCase();
  return m.includes('429') || m.includes('quota') || m.includes('rate limit');
}

export async function POST(req: Request) {
  const body = await req.json();
  const { messages } = body;
  const coreMessages = parseCoreMessages(messages);
  const keys = getApiKeys();

  // ── Step 1: Try Gemini with sequential key rotation ──────────────────────
  for (let i = 0; i < keys.length; i++) {
    try {
      const google = createGoogleGenerativeAI({ apiKey: keys[i] });
      
      // Ping check
      await generateText({
        model: google('gemini-2.5-flash'),
        messages: [{ role: 'user', content: 'hi' }],
      });


      const result = await streamText({
        model: google('gemini-2.5-flash'),
        messages: coreMessages,
        system: SYSTEM_PROMPT,
      });
      return result.toUIMessageStreamResponse();

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isRateLimited(msg)) {
        console.warn(`[Gemini Chat] Key ${i + 1} rate limited. Trying next...`);
        continue;
      }
      return new Response(JSON.stringify({ error: msg }), { status: 500 });
    }
  }

  // ── Step 2: NVIDIA Fallback ─────────────────────────────────────────────
  const nvKey = process.env.NVIDIA_API_KEY;
  if (nvKey) {
    try {
      console.warn('[AI Chat] Gemini failed. Trying NVIDIA...');
      const nvidia = createOpenAI({
        apiKey: nvKey,
        baseURL: 'https://integrate.api.nvidia.com/v1',
      });
      const result = await streamText({
        model: nvidia('meta/llama-3.1-405b-instruct'),
        messages: coreMessages,
        system: SYSTEM_PROMPT,
      });
      return result.toUIMessageStreamResponse();
    } catch (err: unknown) {
      console.error('[NVIDIA Chat] Error:', err);
    }
  }

  // ── Step 3: Minimax Fallback ────────────────────────────────────────────
  const mmKey = process.env.MINIMAX_API_KEY;
  if (mmKey) {
    try {
      console.warn('[AI Chat] NVIDIA failed. Trying Minimax...');
      const minimax = createOpenAI({
        apiKey: mmKey,
        baseURL: 'https://api.minimax.chat/v1',
      });
      const result = await streamText({
        model: minimax('abab6.5s-chat'),
        messages: coreMessages,
        system: SYSTEM_PROMPT,
      });
      return result.toUIMessageStreamResponse();
    } catch (err: unknown) {
      console.error('[Minimax Chat] Error:', err);
    }
  }

  return new Response(JSON.stringify({ error: 'All AI providers are currently rate limited.' }), { status: 429 });
}
