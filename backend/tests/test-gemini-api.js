// Test Google Gemini API configuration
import fs from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Read API key from .env.local
let apiKey = '';
try {
    const envContent = fs.readFileSync('.env.local', 'utf8');
    const lines = envContent.split('\n');
    for (const line of lines) {
        if (line.startsWith('VITE_GOOGLE_API_KEY=')) {
            apiKey = line.split('=')[1].trim();
            break;
        }
    }
} catch (e) {
    console.log('Could not read .env.local file');
}

console.log('🔍 Testing Google Gemini API...');
console.log('API Key present:', apiKey ? 'Yes' : 'No');
console.log('API Key length:', apiKey ? apiKey.length : 0);
console.log('API Key starts with:', apiKey ? apiKey.substring(0, 10) + '...' : 'N/A');

if (!apiKey || apiKey === 'your_google_api_key_here') {
    console.log('❌ No Google API key found!');
    console.log('💡 Please add your Google API key to .env.local:');
    console.log('   VITE_GOOGLE_API_KEY=your_actual_api_key_here');
    process.exit(1);
}

async function testGeminiAPI() {
    try {
        console.log('🚀 Testing Gemini API connection...');
        
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

        const result = await model.generateContent('Say "Hello from Gemini API!" and confirm you are working properly.');
        const response = await result.response;
        const text = response.text();

        console.log('✅ Gemini API Response:', text);
        console.log('🎉 Gemini API is working properly!');
        
    } catch (error) {
        console.log('❌ Gemini API test failed:');
        console.log('Error:', error.message);
        
        if (error.message.includes('API_KEY_INVALID')) {
            console.log('💡 Your API key appears to be invalid.');
        }
        
        if (error.message.includes('PERMISSION_DENIED')) {
            console.log('💡 API key does not have permission to access Gemini API.');
        }
        
        if (error.message.includes('quota') || error.message.includes('billing')) {
            console.log('💡 API quota exceeded or billing issue. Check your Google Cloud account.');
        }
    }
}

testGeminiAPI();