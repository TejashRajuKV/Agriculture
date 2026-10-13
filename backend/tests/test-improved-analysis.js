import Bytez from "bytez.js";

const key = "6567210fbb1e7a280d1e72c8677644dc";
const sdk = new Bytez(key);
const model = sdk.model("openai/gpt-5.2");

async function testImageAnalysis() {
    console.log('🧪 Testing improved image analysis...');
    
    try {
        // Test with a description of coconut husk characteristics
        const { error, output } = await model.run([
            {
                "role": "system",
                "content": "You are an expert agricultural scientist specializing in crop waste identification. You must be extremely accurate in identifying different types of agricultural waste. Pay close attention to texture, color, shape, and size to distinguish between different crop residues like coconut husks, rice straw, wheat straw, corn stalks, etc."
            },
            {
                "role": "user",
                "content": `You are an expert in identifying agricultural waste and crop residues. Look at this description very carefully and identify the EXACT type of crop waste:

                Description: Brown, fibrous, curved shell pieces with coarse fiber texture, thick and sturdy appearance, coconut-like shell fragments.

                IMPORTANT: Be very specific about what this describes. Look for these key characteristics:
                - Coconut husks: Brown, fibrous, curved shell pieces with coarse fiber texture
                - Rice straw: Golden/yellow thin stalks, hollow stems, grain remnants
                - Wheat straw: Thick hollow stems, golden color, node joints visible
                - Corn stalks: Thick, sturdy stems with visible nodes and leaves
                - Sugarcane bagasse: Fibrous pulp, whitish-brown, compressed appearance

                Analyze and provide your analysis in this exact JSON format:
                {
                  "residueType": "EXACT crop name based on analysis",
                  "suggestedUses": ["specific use1", "specific use2", "specific use3"],
                  "transportFeasibility": "High/Medium/Low",
                  "environmentalImpactScore": 8,
                  "estimatedPriceRange": "₹X,XXX - ₹X,XXX per ton",
                  "confidence": 0.9,
                  "moistureContent": "XX%",
                  "purityScore": 85,
                  "co2Saved": 450
                }

                DO NOT guess or assume. Only identify based on the characteristics described.`
            }
        ]);

        if (error) {
            console.log('❌ Error:', error);
            return;
        }

        console.log('✅ AI Response:');
        console.log(output.content);
        
        // Try to extract JSON
        const jsonMatch = output.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0]);
                console.log('\n✅ Identified as:', parsed.residueType);
                console.log('✅ Confidence:', parsed.confidence);
            } catch (e) {
                console.log('❌ JSON Parse Error:', e.message);
            }
        }
        
    } catch (error) {
        console.log('❌ Test failed:', error.message);
    }
}

testImageAnalysis();