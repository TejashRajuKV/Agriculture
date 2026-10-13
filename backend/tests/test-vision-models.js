import Bytez from "bytez.js";

const key = "6567210fbb1e7a280d1e72c8677644dc";
const sdk = new Bytez(key);

async function testVisionModels() {
    console.log('🔍 Testing vision models...');
    
    // Test different models that might support vision
    const modelsToTest = [
        "openai/gpt-4-vision-preview",
        "openai/gpt-4o",
        "openai/gpt-4o-mini",
        "openai/gpt-5.2"
    ];
    
    const testImage = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=";
    
    for (const modelName of modelsToTest) {
        try {
            console.log(`\n🧪 Testing ${modelName}...`);
            const model = sdk.model(modelName);
            
            const { error, output } = await model.run([
                {
                    "role": "user",
                    "content": `Analyze this image and tell me what you see. Image: ${testImage}`
                }
            ]);
            
            if (error) {
                console.log(`❌ ${modelName}: ${error}`);
            } else {
                console.log(`✅ ${modelName}: Working`);
                console.log(`Response: ${output.content.substring(0, 100)}...`);
            }
            
        } catch (e) {
            console.log(`❌ ${modelName}: ${e.message}`);
        }
    }
}

testVisionModels();