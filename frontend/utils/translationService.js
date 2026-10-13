export const SUPPORTED_LANGUAGES = {
  'en': 'English',
  'hi': 'Hindi',
  'pa': 'Punjabi',
  'ta': 'Tamil',
  'te': 'Telugu',
  'kn': 'Kannada',
  'ml': 'Malayalam',
  'mr': 'Marathi',
  'gu': 'Gujarati',
  'bn': 'Bengali'
};

export const getStateLanguage = (state) => {
  const stateLanguages = {
    'Punjab': 'pa',
    'Haryana': 'hi',
    'Uttar Pradesh': 'hi',
    'Madhya Pradesh': 'hi',
    'Maharashtra': 'mr',
    'Gujarat': 'gu',
    'Andhra Pradesh': 'te',
    'Karnataka': 'kn',
    'Tamil Nadu': 'ta',
    'West Bengal': 'bn',
    'Bihar': 'hi',
    'Rajasthan': 'hi',
    'Telangana': 'te',
    'Odisha': 'hi',
    'Kerala': 'ml',
    'Assam': 'hi',
    'Chhattisgarh': 'hi',
    'Jharkhand': 'hi',
    'Uttarakhand': 'hi'
  };
  return stateLanguages[state] || 'en';
};

export const translateText = async (text, targetLanguage) => {
  if (targetLanguage === 'en') {
    return text;
  }
  
  try {
    const response = await fetch('https://api.mymemory.translated.net/get', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const params = new URLSearchParams({
      q: text,
      langpair: `en|${targetLanguage}`
    });
    
    const translationResponse = await fetch(
      `https://api.mymemory.translated.net/get?${params}`
    );
    
    const data = await translationResponse.json();
    
    if (data.responseStatus === 200) {
      return data.responseData.translatedText;
    }
    
    return text;
  } catch (error) {
    console.error('Translation error:', error);
    return text;
  }
};