import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;

if (!apiKey) {
  console.warn('⚠️ Google API key not configured. Using fallback analysis.');
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
const model = genAI?.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

export const analyzeCropWaste = async (base64Image) => {
  if (!genAI || !apiKey) {
    console.log('No valid API key, using fallback analysis');
    const fallbackAnalyses = [
      {
        residueType: "Wheat Straw",
        suggestedUses: ["Biofuel", "Cattle Feed", "Paper Production"],
        transportFeasibility: "High",
        environmentalImpactScore: 8,
        estimatedPriceRange: "₹3,000 - ₹4,000",
        confidence: 0.7,
        moistureContent: "12%",
        purityScore: 85,
        co2Saved: 450
      },
      {
        residueType: "Rice Stubble",
        suggestedUses: ["Composting", "Mushroom Cultivation", "Biogas"],
        transportFeasibility: "Medium",
        environmentalImpactScore: 7,
        estimatedPriceRange: "₹2,500 - ₹3,200",
        confidence: 0.6,
        moistureContent: "18%",
        purityScore: 80,
        co2Saved: 320
      }
    ];
    return fallbackAnalyses[Math.floor(Math.random() * fallbackAnalyses.length)];
  }

  try {
    console.log('Analyzing image with Gemini 2.5 Flash...');

    const prompt = `You are an expert agricultural scientist. Analyze this agricultural waste image and respond in raw JSON only:

{
  "residueType": "Exact crop name based on visual analysis",
  "suggestedUses": ["practical use1", "practical use2", "practical use3"],
  "transportFeasibility": "High/Medium/Low",
  "environmentalImpactScore": score_1_to_10,
  "estimatedPriceRange": "₹X,XXX - ₹X,XXX per ton",
  "confidence": confidence_0_to_1,
  "moistureContent": "XX%",
  "purityScore": score_1_to_100,
  "co2Saved": estimated_kg_co2
}

Be accurate and specific. Only identify what you can clearly see in the image.`;

    const imagePart = {
      inlineData: {
        data: base64Image.replace(/^data:image\/[a-z]+;base64,/, ''),
        mimeType: 'image/jpeg'
      }
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    console.log('Gemini API Response:', text);

    // Clean and parse JSON
    let cleanContent = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const firstBrace = cleanContent.indexOf('{');
    const lastBrace = cleanContent.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error("No JSON object found in response");
    }

    cleanContent = cleanContent.substring(firstBrace, lastBrace + 1);
    const analysis = JSON.parse(cleanContent);
    
    return analysis;

  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    return {
      residueType: "Analysis Failed",
      suggestedUses: ["Check internet connection", "Try a clearer image", "Try again later"],
      transportFeasibility: "Unknown",
      environmentalImpactScore: 0,
      estimatedPriceRange: "N/A",
      confidence: 0,
      moistureContent: "N/A",
      purityScore: 0,
      co2Saved: 0,
      error: error.message
    };
  }
};

export const analyzeFarmInput = async (base64Image) => {
  if (!genAI || !apiKey) {
    return {
      type: 'UNKNOWN',
      name: 'Unknown Item',
      summary: 'API key not configured. Please add your Google API key.',
      tips: [],
      healthScore: 0
    };
  }

  try {
    const prompt = `Identify this farm input (Crop, Soil, or Fertilizer). Provide a summary and tips for an Indian farmer in JSON format: {"type": "CROP/SOIL/FERTILIZER", "name": "name", "summary": "description", "tips": ["tip1", "tip2"], "healthScore": 0-100}`;

    const imagePart = {
      inlineData: {
        data: base64Image.replace(/^data:image\/[a-z]+;base64,/, ''),
        mimeType: 'image/jpeg'
      }
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : {
      type: 'UNKNOWN',
      name: 'Unknown',
      summary: 'Could not analyze',
      tips: [],
      healthScore: 0
    };
  } catch (error) {
    return {
      type: 'UNKNOWN',
      name: 'Unknown Item',
      summary: 'Analysis failed. Please try again.',
      tips: [],
      healthScore: 0
    };
  }
};

export const generateFarmPlan = async (length, breadth, unit, crop, state) => {
  if (!genAI || !apiKey) {
    return {
      optimalCropCount: 0,
      spacing: "N/A",
      estimatedRevenue: "₹0",
      bestSoil: "Standard agricultural soil",
      tips: ["API key not configured. Please add your Google API key."]
    };
  }

  try {
    const prompt = `Farm dimensions: ${length} ${unit} x ${breadth} ${unit}. Crop: ${crop}. State: ${state}. Calculate optimal plants, spacing, revenue in INR, soil, and tips. Respond in JSON format: {"optimalCropCount": number, "spacing": "description", "estimatedRevenue": "₹amount", "bestSoil": "soil type", "tips": ["tip1", "tip2"]}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : {
      optimalCropCount: 0,
      spacing: "N/A",
      estimatedRevenue: "₹0",
      bestSoil: "Standard agricultural soil",
      tips: ["Could not generate plan"]
    };
  } catch (error) {
    return {
      optimalCropCount: 0,
      spacing: "N/A",
      estimatedRevenue: "₹0",
      bestSoil: "Standard agricultural soil",
      tips: ["Ensure proper irrigation.", "Test soil pH."]
    };
  }
};