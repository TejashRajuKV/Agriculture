import { GoogleGenAI } from "@google/genai";
import fs from 'fs';

// Read environment variables from .env.local
let apiKey = '';
try {
    const envContent = fs.readFileSync('.env.local', 'utf8');
    const lines = envContent.split('\n');
    for (const line of lines) {
        if (line.startsWith('VITE_API_KEY=')) {
            apiKey = line.split('=')[1];
            break;
        }
        if (line.startsWith('GEMINI_API_KEY=')) {
            apiKey = line.split('=')[1];
            break;
        }
    }
} catch (e) {
    console.log('Could not read .env.local file');
}

console.log('🔍 Testing Google AI API...');
console.log('API Key present:', apiKey ? 'Yes' : 'No');
console.log('API Key length:', apiKey ? apiKey.length : 0);
console.log('API Key starts with:', apiKey ? apiKey.substring(0, 10) + '...' : 'N/A');

if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
    console.log('❌ No valid API key found!');
    console.log('Please set your Google AI API key in .env.local file:');
    console.log('VITE_API_KEY=your_actual_api_key_here');
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

async function testGoogleAI() {
    try {
        console.log('🚀 Testing basic text generation...');
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: 'Say "Hello from Google AI!" and confirm you are working properly.',
            config: {
                systemInstruction: 'You are a helpful AI assistant. Respond briefly and confirm you are working.'
            }
        });

        const text = response.text;
        console.log('✅ Google AI Response:', text);
        
        // Test JSON response
        console.log('🧪 Testing JSON response...');
        const jsonResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: 'Return a JSON object with fields: status, message, timestamp',
            config: {
                responseMimeType: "application/json",
                systemInstruction: 'Return valid JSON only.'
            }
        });

        const jsonText = jsonResponse.text;
        console.log('✅ JSON Response:', jsonText);
        
        try {
            const parsed = JSON.parse(jsonText);
            console.log('✅ JSON parsing successful:', parsed);
        } catch (e) {
            console.log('⚠️ JSON parsing failed:', e.message);
        }

        console.log('🎉 Google AI API is working properly!');
        
    } catch (error) {
        console.log('❌ Google AI API test failed:');
        console.log('Error:', error.message);
        
        if (error.message.includes('API_KEY_INVALID')) {
            console.log('💡 Your API key appears to be invalid. Please check:');
            console.log('1. Get a valid API key from https://makersuite.google.com/app/apikey');
            console.log('2. Update .env.local with: VITE_API_KEY=your_actual_key');
        }
        
        if (error.message.includes('quota')) {
            console.log('💡 API quota exceeded. Check your usage limits.');
        }
    }
}

testGoogleAI();