// IndicTrans2 API (AI4Bharat – IIT Madras) - Best for Indian languages
export const translateText = async (text, targetLanguage = 'en') => {
  if (targetLanguage === 'en') {
    return text;
  }
  
  // For now, use a simple fallback with basic translations for testing
  // You can replace this with actual IndicTrans2 API when you get the key
  try {
    console.log(`Translating to ${targetLanguage}:`, text.substring(0, 100));
    
    // Simple fallback translations for common agricultural terms
    const basicTranslations = {
      'kan': { // Kannada
        'Weather': 'ಹವಾಮಾನ',
        'Crop': 'ಬೆಳೆ',
        'Temperature': 'ತಾಪಮಾನ',
        'Rainfall': 'ಮಳೆ',
        'Good': 'ಒಳ್ಳೆಯದು',
        'Bad': 'ಕೆಟ್ಟದು',
        'High': 'ಹೆಚ್ಚು',
        'Low': 'ಕಡಿಮೆ',
        'Medium': 'ಮಧ್ಯಮ'
      },
      'hin': { // Hindi
        'Weather': 'मौसम',
        'Crop': 'फसल',
        'Temperature': 'तापमान',
        'Rainfall': 'बारिश',
        'Good': 'अच्छा',
        'Bad': 'बुरा',
        'High': 'उच्च',
        'Low': 'कम',
        'Medium': 'मध्यम'
      }
    };
    
    let translatedText = text;
    
    if (basicTranslations[targetLanguage]) {
      const translations = basicTranslations[targetLanguage];
      Object.keys(translations).forEach(englishWord => {
        const regex = new RegExp(englishWord, 'gi');
        translatedText = translatedText.replace(regex, translations[englishWord]);
      });
    }
    
    // Add a prefix to show it's translated
    if (translatedText !== text) {
      translatedText = `[${SUPPORTED_LANGUAGES[targetLanguage]}] ${translatedText}`;
    }
    
    console.log('Translated text:', translatedText);
    return translatedText;
    
  } catch (error) {
    console.error('Translation error:', error);
    return text;
  }
};

// Supported Indian languages with IndicTrans2 codes
export const SUPPORTED_LANGUAGES = {
  'en': 'English',
  'hin': 'Hindi',
  'kan': 'Kannada', 
  'tel': 'Telugu',
  'tam': 'Tamil',
  'mal': 'Malayalam',
  'mar': 'Marathi',
  'ben': 'Bengali',
  'guj': 'Gujarati',
  'pan': 'Punjabi',
  'ori': 'Odia',
  'urd': 'Urdu'
};

// Get language based on state
export const getStateLanguage = (state) => {
  const stateLanguageMap = {
    'Karnataka': 'kan',
    'Andhra Pradesh': 'tel',
    'Telangana': 'tel',
    'Tamil Nadu': 'tam',
    'Kerala': 'mal',
    'Punjab': 'pan',
    'Haryana': 'hin',
    'Uttar Pradesh': 'hin',
    'Madhya Pradesh': 'hin',
    'Rajasthan': 'hin',
    'Bihar': 'hin',
    'Jharkhand': 'hin',
    'Chhattisgarh': 'hin',
    'Uttarakhand': 'hin',
    'Delhi': 'hin',
    'West Bengal': 'ben',
    'Odisha': 'ori',
    'Assam': 'hin',
    'Gujarat': 'guj',
    'Maharashtra': 'mar'
  };
  
  return stateLanguageMap[state] || 'en';
};