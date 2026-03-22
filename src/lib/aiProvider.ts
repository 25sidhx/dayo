import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Gemini API client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Define the Tiers
export const AI_TIERS = {
  TIER_1: {
    id: 'gemini-2.5-flash-lite', // Extremely fast, low latency, huge context
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
    id: 'gemini-1.5-pro',        // Slowest, most expensive, best reasoning
    provider: 'gemini',
    type: 'vision',
    description: 'Premium intelligence fallback'
  }
};

/**
 * Executes a vision extraction prompt with automatic multi-tier fallback logic.
 * Tries Tier 1, if it throws a 429 quota error, immediately switches to Tier 2, etc.
 */
export async function executeVisionWithFallback(prompt: string, imageBase64: string) {
  const tiersToTry = [AI_TIERS.TIER_1, AI_TIERS.TIER_2, AI_TIERS.TIER_3];
  
  let lastError = null;

  for (const tier of tiersToTry) {
    try {
      console.log(`[AI Provider] Attempting generation with Tier: ${tier.id} (${tier.description})`);
      
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
      const text = result.response.text();
      
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
      if (e.message.includes('429') || e.message.includes('Quota') || e.message.includes('503')) {
        console.log(`[AI Provider] Falling back to next tier...`);
        continue;
      }
      
      // If the image is simply invalid, or it's a structural error, don't waste API calls on other tiers
      if (e.message.includes('image') || e.message.includes('Invalid')) {
        throw e;
      }
      
      // Keep trying for other generic errors just in case
    }
  }

  // If we exhaust all tiers
  throw new Error(`All AI fallback tiers failed. Last error: ${lastError?.message}`);
}

/**
 * Executes a text-only prompt with automatic multi-tier fallback logic.
 */
export async function executeTextWithFallback(prompt: string) {
  const tiersToTry = [AI_TIERS.TIER_3, AI_TIERS.TIER_1, AI_TIERS.TIER_2]; // Tier 3 (Pro) is best for logic corrections
  
  let lastError = null;

  for (const tier of tiersToTry) {
    try {
      console.log(`[AI Provider TEXT] Attempting generation with Tier: ${tier.id}`);
      
      const model = genAI.getGenerativeModel({
        model: tier.id,
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
        }
      });

      const result = await model.generateContent([prompt]);
      const text = result.response.text();
      
      console.log(`[AI Provider TEXT] Success on ${tier.id}. Generated ${text.length} chars.`);
      
      return {
        text,
        usedModel: tier.id,
      };

    } catch (e: any) {
      console.warn(`[AI Provider TEXT] Error with ${tier.id}:`, e.message);
      lastError = e;
      
      if (e.message.includes('429') || e.message.includes('Quota') || e.message.includes('503')) {
        console.log(`[AI Provider TEXT] Falling back to next tier...`);
        continue;
      }
    }
  }

  throw new Error(`All AI TEXT fallback tiers failed. Last error: ${lastError?.message}`);
}
