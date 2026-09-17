import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function listAndTest() {
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey });

  try {
    console.log('Listing available models...');
    const list = await ai.models.list();
    console.log('Available models:');
    for await (const m of list) {
      console.log(`- ${m.name}`);
    }
  } catch (err: any) {
    console.error('List models error:', err.message || err);
  }

  const tryModels = ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-2.0-flash-001', 'gemini-1.5-flash-001', 'gemini-1.5-flash-latest'];
  for (const model of tryModels) {
    try {
      console.log(`Testing: ${model}...`);
      const res = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: 'Hello!' }] }],
      });
      console.log(`SUCCESS with ${model}:`, res.text);
      return;
    } catch (e: any) {
      console.log(`Failed ${model}:`, e.message || e);
    }
  }
}

listAndTest();
