import Bytez from "bytez.js";

const key = "6567210fbb1e7a280d1e72c8677644dc";
const sdk = new Bytez(key);
const model = sdk.model("openai/gpt-5.2");

console.log('🔍 Testing Bytez SDK integration...');

async function testBytezSDK() {
    try {
        const { error, output } = await model.run([
            {
                "role": "user",
                "content": "Say 'Hello from Bytez SDK!' and confirm you are working properly."
            }
        ]);

        if (error) {
            console.log('❌ Bytez SDK Error:', error);
            return;
        }

        console.log('✅ Bytez SDK Response:', output);
        console.log('🎉 Bytez SDK is working properly!');
        
    } catch (error) {
        console.log('❌ Bytez SDK test failed:', error.message);
    }
}

testBytezSDK();