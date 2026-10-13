import Bytez from "bytez.js";

const key = "6567210fbb1e7a280d1e72c8677644dc";
const sdk = new Bytez(key);
const model = sdk.model("openai/gpt-5.2");

async function testAIResponse() {
    console.log('🧪 Testing AI response quality...');
    
    try {
        // Test crop analysis
        const { error, output } = await model.run([
            {
                "role": "system",
                "content": "You are an expert Indian agricultural scientist. Analyze crop waste and provide accurate JSON response."
            },
            {
                "role": "user", 
                "content": `Analyze wheat straw crop waste. Provide analysis in this exact JSON format:
                {
                  "residueType": "Wheat Straw",
                  "suggestedUses": ["use1", "use2", "use3"],
                  "transportFeasibility": "High",
                  "environmentalImpactScore": 8,
                  "estimatedPriceRange": "₹3,000 - ₹4,000",
                  "confidence": 0.8,
                  "moistureContent": "12%",
                  "purityScore": 85,
                  "co2Saved": 450
                }`
            }
        ]);

        if (error) {
            console.log('❌ Error:', error);
            return;
        }

        console.log('✅ Raw AI Response:');
        console.log(output);
        
        // Try to extract JSON
        const jsonMatch = output.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0]);
                console.log('✅ Parsed JSON:', parsed);
            } catch (e) {
                console.log('❌ JSON Parse Error:', e.message);
                console.log('Raw JSON string:', jsonMatch[0]);
            }
        } else {
            console.log('❌ No JSON found in response');
        }
        
    } catch (error) {
        console.log('❌ Test failed:', error.message);
    }
}

testAIResponse();