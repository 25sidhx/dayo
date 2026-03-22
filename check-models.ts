import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

// Load env from .env.local
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
const apiKey = envConfig.GEMINI_API_KEY?.replace(/"/g, '');

if (!apiKey) {
    console.error("No API key found");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function run() {
    try {
        console.log("Checking available models...");
        // Hack to get models list since standard SDK doesn't expose listModels nicely in older versions
        // We'll just fetch directly with node-fetch
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();
        
        console.log("Available Models:");
        data.models?.forEach((m: any) => {
           console.log(`- ${m.name} (Vision: ${m.supportedGenerationMethods.includes('generateContent')})`);
        });

    } catch (e: any) {
        console.error("Error listing models:", e.message);
    }
}

run();
