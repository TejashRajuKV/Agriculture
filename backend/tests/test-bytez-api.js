// Test Bytez API configuration
import fs from 'fs';

// Read API key from .env.local
let apiKey = '';
try {
    const envContent = fs.readFileSync('.env.local', 'utf8');
    const lines = envContent.split('\n');
    for (const line of lines) {
        if (line.startsWith('VITE_BYTEZ_API_KEY=')) {
            apiKey = line.split('=')[1].trim();
            break;
        }
    }
} catch (e) {
    console.log('Could not read .env.local file');
}

console.log('🔍 Testing Bytez API...');
console.log('API Key present:', apiKey ? 'Yes' : 'No');
console.log('API Key length:', apiKey ? apiKey.length : 0);
console.log('API Key starts with:', apiKey ? apiKey.substring(0, 10) + '...' : 'N/A');

if (!apiKey) {
    console.log('❌ No Bytez API key found!');
    process.exit(1);
}

const BYTEZ_API_URL = 'https://api.bytez.com/v1/chat/completions';

async function testBytezAPI() {
    try {
        console.log('🚀 Testing Bytez API connection...');
        
        const response = await fetch(BYTEZ_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful AI assistant.'
                    },
                    {
                        role: 'user',
                        content: 'Say "Hello from Bytez API!" and confirm you are working properly.'
                    }
                ],
                max_tokens: 100,
                temperature: 0.1
            })
        });

        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            const errorText = await response.text();
            console.log('❌ API Error Response:', errorText);
            throw new Error(`Bytez API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('✅ Bytez API Response:', JSON.stringify(data, null, 2));
        
        const content = data.choices?.[0]?.message?.content;
        if (content) {
            console.log('✅ AI Message:', content);
            console.log('🎉 Bytez API is working properly!');
        } else {
            console.log('⚠️ Unexpected response format');
        }
        
    } catch (error) {
        console.log('❌ Bytez API test failed:');
        console.log('Error:', error.message);
        
        if (error.message.includes('401')) {
            console.log('💡 Your API key appears to be invalid or expired.');
        }
        
        if (error.message.includes('429')) {
            console.log('💡 API rate limit exceeded. Wait a moment and try again.');
        }
        
        if (error.message.includes('quota') || error.message.includes('billing')) {
            console.log('💡 API quota exceeded or billing issue. Check your Bytez account.');
        }
    }
}

testBytezAPI();