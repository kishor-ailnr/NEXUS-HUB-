import { GoogleGenAI, Type } from '@google/genai';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testToolCalling() {
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey });

  const tools = [
    {
      name: 'get_dashboard_stats',
      description: 'Get live operational stats for active vehicles, alerts, speed, and trips.',
      parameters: { type: Type.OBJECT, properties: {} },
    },
  ];

  console.log('--- Test 1: General question (Should NOT call tool) ---');
  const res1 = await ai.models.generateContent({
    model: 'gemini-3.6-flash',
    contents: [{ role: 'user', parts: [{ text: 'What are the operational workflows you can manage?' }] }],
    config: {
      systemInstruction: 'You are the NEXUS WAYS Multimodal Logistics Operations Assistant. Only use tools when the user requests live fleet data.',
      tools: [{ functionDeclarations: tools }],
    },
  });

  const candidate1 = res1.candidates?.[0];
  const functionCall1 = candidate1?.content?.parts?.find((p: any) => p.functionCall);
  console.log('Test 1 Function Call:', functionCall1?.functionCall?.name || 'None (Correct!)');
  console.log('Test 1 Text Response preview:', res1.text?.substring(0, 150), '...\n');

  console.log('--- Test 2: Fleet status question (SHOULD call get_dashboard_stats) ---');
  const res2 = await ai.models.generateContent({
    model: 'gemini-3.6-flash',
    contents: [{ role: 'user', parts: [{ text: 'What is the current fleet status?' }] }],
    config: {
      systemInstruction: 'You are the NEXUS WAYS Multimodal Logistics Operations Assistant. Only use tools when the user requests live fleet data.',
      tools: [{ functionDeclarations: tools }],
    },
  });

  const candidate2 = res2.candidates?.[0];
  const functionCall2 = candidate2?.content?.parts?.find((p: any) => p.functionCall);
  console.log('Test 2 Function Call:', functionCall2?.functionCall?.name || 'None');
}

testToolCalling().catch(console.error);
