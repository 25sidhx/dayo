import * as dotenv from 'dotenv';
import { executeVisionWithFallback } from '../src/lib/aiProvider';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

async function test() {
  console.log("Testing AI Provider VISION Extractor...");
  try {
    // Generate a simple 1x1 base64 JPEG
    const dummyBase64 = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

    const result = await executeVisionWithFallback("What is this image?", dummyBase64);
    console.log("Result:", result.text);
    console.log("Used Model:", result.usedModel);
  } catch (e: any) {
    console.error("Test Failed:", e.message);
  }
}

test();
