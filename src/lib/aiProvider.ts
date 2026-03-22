import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Gemini API client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Define the Tiers
export const AI_TIERS = {
  TIER_1: {
    id: 'gemini-2.5-flash-lite-preview-06-17', // Extremely fast, low latency, huge context
    provider: 'gemini',
    type: 'vision',
    description: 'Ultra-fast primary engine'
  },
  TIER_2: {
    id: 'gemini-1.5-flash',      // Proven stable workhorse with high quotas
    provider: 'gemini',
    type: 'vision', 
    description: 'High free-quota stable fallback'
  },
  TIER_3: {
    id: 'google/gemma-3-12b-it:free',
    provider: 'openrouter',
    type: 'vision',
    description: 'OpenRouter Free Fallback (Gemma 3 12B)'
  },
  TIER_3B: {
    id: 'nvidia/nemotron-3-nano-30b-a3b:free',
    provider: 'openrouter',
    type: 'text',
    description: 'OpenRouter Free Fallback (Nemotron 30B)'
  },
  TIER_3C: {
    id: 'stepfun/step-3.5-flash:free',
    provider: 'openrouter',
    type: 'text',
    description: 'OpenRouter Free Fallback (Step 3.5 Flash)'
  },
  TIER_4: {
    id: 'gemini-1.5-pro',        // Slowest, most expensive, best reasoning
    provider: 'gemini',
    type: 'vision',
    description: 'Premium intelligence fallback'
  }
};

/**
 * Helper to call OpenRouter API (OpenAI compatible)
 */
async function executeOpenRouterRequest(modelId: string, prompt: string, imageBase64?: string) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not found");

  const messages: any[] = [
    {
      role: 'user',
      content: [
        { type: 'text', text: prompt }
      ]
    }
  ];

  if (imageBase64) {
    messages[0].content.push({
      type: 'image_url',
      image_url: {
        url: `data:image/jpeg;base64,${imageBase64}`
      }
    });
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "Dayo Scheduler",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: modelId,
      messages: messages,
      temperature: 0.1
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenRouter Error: ${error.error?.message || response.statusText}`);
  }

  const result = await response.json();
  return result.choices[0].message.content;
}

/**
 * Executes a vision extraction prompt with automatic multi-tier fallback logic.
 * Tries Tier 1, if it throws a 429 quota error, immediately switches to Tier 2, etc.
 */
export async function executeVisionWithFallback(prompt: string, imageBase64: string) {
  const tiersToTry = [AI_TIERS.TIER_1, AI_TIERS.TIER_2, AI_TIERS.TIER_3, AI_TIERS.TIER_3B, AI_TIERS.TIER_3C, AI_TIERS.TIER_4];
  
  let lastError = null;

  for (const tier of tiersToTry) {
    try {
      console.log(`[AI Provider] Attempting generation with Tier: ${tier.id} (${tier.description})`);
      
      let text = '';
      if (tier.provider === 'gemini') {
        const model = genAI.getGenerativeModel({
          model: tier.id,
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8192,
          }
        });

        const imagePart = {
          inlineData: {
            mimeType: 'image/jpeg' as const,
            data: imageBase64
          }
        };

        const result = await model.generateContent([prompt, imagePart]);
        text = result.response.text();
      } else if (tier.provider === 'openrouter') {
        text = await executeOpenRouterRequest(tier.id, prompt, imageBase64);
      }
      
      console.log(`[AI Provider] Success on ${tier.id}. Generated ${text.length} chars.`);
      
      return {
        text,
        usedModel: tier.id,
        tierLevel: tiersToTry.indexOf(tier) + 1
      };

    } catch (e: any) {
      console.warn(`[AI Provider] Error with ${tier.id}:`, e.message);
      lastError = e;
      
      // If it's a quota/rate limit error (429) or service unavailable (503), continue to next tier
      if (e.message.includes('429') || e.message.includes('Quota') || e.message.includes('503') || e.message.includes('402')) {
        console.log(`[AI Provider] Falling back to next tier...`);
        continue;
      }
      
      if (e.message.includes('image') || e.message.includes('Invalid')) {
        throw e;
      }
    }
  }

  throw new Error(`All AI fallback tiers failed. Last error: ${lastError?.message}`);
}

/**
 * Executes a text-only prompt with automatic multi-tier fallback logic.
 */
export async function executeTextWithFallback(prompt: string) {
  const tiersToTry = [AI_TIERS.TIER_4, AI_TIERS.TIER_1, AI_TIERS.TIER_2, AI_TIERS.TIER_3, AI_TIERS.TIER_3B, AI_TIERS.TIER_3C]; // TIER_4 (Pro) is best for logic corrections
  
  let lastError = null;

  for (const tier of tiersToTry) {
    try {
      console.log(`[AI Provider TEXT] Attempting generation with Tier: ${tier.id}`);
      
      let text = '';
      if (tier.provider === 'gemini') {
        const model = genAI.getGenerativeModel({
          model: tier.id,
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8192,
          }
        });

        const result = await model.generateContent([prompt]);
        text = result.response.text();
      } else if (tier.provider === 'openrouter') {
        text = await executeOpenRouterRequest(tier.id, prompt);
      }
      
      console.log(`[AI Provider TEXT] Success on ${tier.id}. Generated ${text.length} chars.`);
      
      return {
        text,
        usedModel: tier.id,
      };

    } catch (e: any) {
      console.warn(`[AI Provider TEXT] Error with ${tier.id}:`, e.message);
      lastError = e;
      
      if (e.message.includes('429') || e.message.includes('Quota') || e.message.includes('503') || e.message.includes('402')) {
        console.log(`[AI Provider TEXT] Falling back to next tier...`);
        continue;
      }
    }
  }

  throw new Error(`All AI TEXT fallback tiers failed. Last error: ${lastError?.message}`);
}
