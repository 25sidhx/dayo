import * as dotenv from 'dotenv';
import { executeTextWithFallback } from '../src/lib/aiProvider';

dotenv.config({ path: '.env.local' });

async function test() {
  console.log("Testing AI Provider with OpenRouter Fallback...");
  try {
    // We want to force it to use Tier 3 (OpenRouter) for this test
    // or just see if it works normally.
    // Since Tier 4 (Pro) is tried first in executeTextWithFallback, 
    // it might succeed there.
    
    const result = await executeTextWithFallback("Say 'OpenRouter Integration Successful' if you can read this.");
    console.log("Result:", result.text);
    console.log("Used Model:", result.usedModel);
  } catch (e: any) {
    console.error("Test Failed:", e.message);
  }
}

test();
