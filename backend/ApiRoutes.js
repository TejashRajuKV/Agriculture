/*
  Google Gemini 2.5 Flash Integration
  npm install @google/generative-ai
*/

import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = import.meta.env.VITE_GOOGLE_API_KEY || 'your_google_api_key_here';
const genAI = new GoogleGenerativeAI(apiKey);

// Use Gemini 2.5 Flash model
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

// Example usage
const testGemini = async () => {
  try {
    const result = await model.generateContent('Hello, how are you?');
    const response = await result.response;
    const text = response.text();
    console.log({ success: true, output: text });
  } catch (error) {
    console.log({ error: error.message });
  }
};

// Uncomment to test
// testGemini();