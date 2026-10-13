import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

console.log('🔧 Testing API Configuration...\n');

// Test environment variables
console.log('📋 Environment Variables:');
console.log(`MONGODB_URI: ${process.env.MONGODB_URI ? '✅ Set' : '❌ Missing'}`);
console.log(`GOOGLE_API_KEY: ${process.env.GOOGLE_API_KEY ? '✅ Set' : '❌ Missing'}`);
console.log(`PORT: ${process.env.PORT || '5000'}\n`);

// Test Google AI API
if (process.env.GOOGLE_API_KEY) {
  console.log('🤖 Testing Google AI API...');
  try {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    
    const result = await model.generateContent('Say "API test successful" in JSON format');
    const response = await result.response;
    console.log('✅ Google AI API: Working');
    console.log('📝 Test Response:', response.text().substring(0, 100) + '...\n');
  } catch (error) {
    console.log('❌ Google AI API: Failed');
    console.log('Error:', error.message, '\n');
  }
} else {
  console.log('⚠️ Skipping Google AI test - API key missing\n');
}

console.log('✅ Configuration test complete!');