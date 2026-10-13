// Test Open-Meteo Weather API
async function testWeatherAPI() {
  try {
    // Test with Ludhiana coordinates
    const lat = 30.9010;
    const lon = 75.8573;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=Asia/Kolkata`;
    
    console.log('Testing URL:', url);
    
    const response = await fetch(url);
    console.log('Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Weather data received:', {
        temperature: data.current?.temperature_2m + '°C',
        humidity: data.current?.relative_humidity_2m + '%',
        windSpeed: data.current?.wind_speed_10m + ' km/h',
        maxTemp: data.daily?.temperature_2m_max?.[0] + '°C',
        minTemp: data.daily?.temperature_2m_min?.[0] + '°C',
        precipitation: data.daily?.precipitation_sum?.[0] + 'mm'
      });
      return true;
    } else {
      console.error('API request failed:', response.statusText);
      return false;
    }
  } catch (error) {
    console.error('Weather API test failed:', error);
    return false;
  }
}

// Run the test
testWeatherAPI().then(success => {
  console.log('Weather API working:', success);
});