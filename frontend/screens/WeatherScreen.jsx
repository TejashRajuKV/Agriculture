import React, { useEffect, useState } from 'react';
import { Button } from '../components/Common/Button.jsx';
import { getWeatherAnalysis, getSowingHarvestingAdvice, getCropWeatherSummary, getAvailableCrops } from '../utils/aiWasteAnalyzer.js';
import { translateText, SUPPORTED_LANGUAGES, getStateLanguage } from '../utils/translationService.js';
import { CloudRain, AlertTriangle, Calendar, Droplets, MapPin, Thermometer, Wind, Sun, Cloud, CheckCircle2, MessageCircle } from 'lucide-react';
import './WeatherScreen.css';

export const WeatherScreen = ({ user }) => {
  const [location, setLocation] = useState('');
  const [state, setState] = useState('Punjab');
  const [crop, setCrop] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [weatherData, setWeatherData] = useState(null);
  const [sowingAdvice, setSowingAdvice] = useState(null);
  const [showSowingAdvice, setShowSowingAdvice] = useState(false);
  const [cropSummary, setCropSummary] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('en');

  const indianStates = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
    'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
    'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
    'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
    'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi',
    'Jammu and Kashmir', 'Ladakh', 'Puducherry', 'Chandigarh',
    'Dadra and Nagar Haveli and Daman and Diu', 'Lakshadweep', 'Andaman and Nicobar Islands'
  ];

  const getCitiesForState = (stateName) => {
    const cities = {
      'Andhra Pradesh': ['Anakapalli', 'Anantapur', 'Annamayya', 'Alluri Sitharama Raju', 'Bapatla', 'Chittoor', 'Dr. B.R. Ambedkar Konaseema', 'East Godavari', 'Eluru', 'Guntur', 'Kakinada', 'Krishna', 'Kurnool', 'Nandyal', 'Nellore', 'Palnadu', 'Parvathipuram Manyam', 'Prakasam', 'Srikakulam', 'Tirupati', 'Visakhapatnam', 'Vizianagaram', 'West Godavari', 'YSR Kadapa'],
      'Arunachal Pradesh': ['Anjaw', 'Changlang', 'Dibang Valley', 'East Kameng', 'East Siang', 'Kamle', 'Kra Daadi', 'Kurung Kumey', 'Lepa Rada', 'Lohit', 'Longding', 'Lower Dibang Valley', 'Lower Siang', 'Lower Subansiri', 'Namsai', 'Pakke Kessang', 'Papum Pare', 'Shi Yomi', 'Siang', 'Tawang', 'Tirap', 'Upper Dibang Valley', 'Upper Siang', 'Upper Subansiri', 'West Kameng', 'West Siang'],
      'Assam': ['Baksa', 'Bajali', 'Barpeta', 'Biswanath', 'Bongaigaon', 'Cachar', 'Charaideo', 'Chirang', 'Darrang', 'Dhemaji', 'Dhubri', 'Dibrugarh', 'Dima Hasao', 'Goalpara', 'Golaghat', 'Hailakandi', 'Hojai', 'Jorhat', 'Kamrup', 'Kamrup Metropolitan', 'Karbi Anglong', 'Karimganj', 'Kokrajhar', 'Lakhimpur', 'Majuli', 'Morigaon', 'Nagaon', 'Nalbari', 'Sivasagar', 'Sonitpur', 'South Salmara-Mankachar', 'Tinsukia', 'Udalguri', 'West Karbi Anglong'],
      'Bihar': ['Araria', 'Arwal', 'Aurangabad', 'Banka', 'Begusarai', 'Bhagalpur', 'Bhojpur', 'Buxar', 'Darbhanga', 'East Champaran', 'Gaya', 'Gopalganj', 'Jamui', 'Jehanabad', 'Kaimur', 'Katihar', 'Khagaria', 'Kishanganj', 'Lakhisarai', 'Madhepura', 'Madhubani', 'Munger', 'Muzaffarpur', 'Nalanda', 'Nawada', 'Patna', 'Purnia', 'Rohtas', 'Saharsa', 'Samastipur', 'Saran', 'Sheikhpura', 'Sheohar', 'Sitamarhi', 'Siwan', 'Supaul', 'Vaishali', 'West Champaran'],
      'Chhattisgarh': ['Balod', 'Baloda Bazar', 'Balrampur', 'Bastar', 'Bemetara', 'Bijapur', 'Bilaspur', 'Dantewada', 'Dhamtari', 'Durg', 'Gariaband', 'Gaurela-Pendra-Marwahi', 'Janjgir-Champa', 'Jashpur', 'Kabirdham', 'Kanker', 'Kondagaon', 'Korba', 'Koriya', 'Mahasamund', 'Manendragarh-Chirmiri-Bharatpur', 'Mohla-Manpur-Ambagarh Chowki', 'Mungeli', 'Narayanpur', 'Raigarh', 'Raipur', 'Rajnandgaon', 'Sakti', 'Sarangarh-Bilaigarh', 'Sukma', 'Surajpur', 'Surguja'],
      'Goa': ['North Goa', 'South Goa'],
      'Gujarat': ['Ahmedabad', 'Amreli', 'Anand', 'Aravalli', 'Banaskantha', 'Bharuch', 'Bhavnagar', 'Botad', 'Chhota Udaipur', 'Dahod', 'Dang', 'Devbhoomi Dwarka', 'Gandhinagar', 'Gir Somnath', 'Jamnagar', 'Junagadh', 'Kheda', 'Kutch', 'Mahisagar', 'Mehsana', 'Morbi', 'Narmada', 'Navsari', 'Panchmahal', 'Patan', 'Porbandar', 'Rajkot', 'Sabarkantha', 'Surat', 'Surendranagar', 'Tapi', 'Vadodara', 'Valsad'],
      'Haryana': ['Ambala', 'Bhiwani', 'Charkhi Dadri', 'Faridabad', 'Fatehabad', 'Gurugram', 'Hisar', 'Jhajjar', 'Jind', 'Kaithal', 'Karnal', 'Kurukshetra', 'Mahendragarh', 'Nuh', 'Palwal', 'Panchkula', 'Panipat', 'Rewari', 'Rohtak', 'Sirsa', 'Sonipat', 'Yamunanagar'],
      'Himachal Pradesh': ['Bilaspur', 'Chamba', 'Hamirpur', 'Kangra', 'Kinnaur', 'Kullu', 'Lahaul & Spiti', 'Mandi', 'Shimla', 'Sirmaur', 'Solan', 'Una'],
      'Jharkhand': ['Bokaro', 'Chatra', 'Deoghar', 'Dhanbad', 'Dumka', 'East Singhbhum', 'Garhwa', 'Giridih', 'Godda', 'Gumla', 'Hazaribagh', 'Jamtara', 'Khunti', 'Koderma', 'Latehar', 'Lohardaga', 'Pakur', 'Palamu', 'Ramgarh', 'Ranchi', 'Sahebganj', 'Seraikela-Kharsawan', 'Simdega', 'West Singhbhum'],
      'Karnataka': ['Bagalkot', 'Ballari', 'Belagavi', 'Bengaluru Rural', 'Bengaluru Urban', 'Bidar', 'Chamarajanagar', 'Chikkaballapur', 'Chikkamagaluru', 'Chitradurga', 'Dakshina Kannada', 'Davanagere', 'Dharwad', 'Gadag', 'Hassan', 'Haveri', 'Kalaburagi', 'Kodagu', 'Kolar', 'Koppal', 'Mandya', 'Mysuru', 'Raichur', 'Ramanagara', 'Shivamogga', 'Tumakuru', 'Udupi', 'Uttara Kannada', 'Vijayapura', 'Yadgir'],
      'Kerala': ['Alappuzha', 'Ernakulam', 'Idukki', 'Kannur', 'Kasaragod', 'Kollam', 'Kottayam', 'Kozhikode', 'Malappuram', 'Palakkad', 'Pathanamthitta', 'Thiruvananthapuram', 'Thrissur', 'Wayanad'],
      'Madhya Pradesh': ['Agar Malwa', 'Alirajpur', 'Anuppur', 'Ashoknagar', 'Balaghat', 'Barwani', 'Betul', 'Bhind', 'Bhopal', 'Burhanpur', 'Chhatarpur', 'Chhindwara', 'Damoh', 'Datia', 'Dewas', 'Dhar', 'Dindori', 'Guna', 'Gwalior', 'Harda', 'Hoshangabad (Narmadapuram)', 'Indore', 'Jabalpur', 'Jhabua', 'Katni', 'Khandwa', 'Khargone', 'Maihar', 'Mandla', 'Mandsaur', 'Morena', 'Narsinghpur', 'Neemuch', 'Niwari', 'Panna', 'Raisen', 'Rajgarh', 'Ratlam', 'Rewa', 'Sagar', 'Satna', 'Sehore', 'Seoni', 'Shahdol', 'Shajapur', 'Sheopur', 'Shivpuri', 'Sidhi', 'Singrauli', 'Tikamgarh', 'Ujjain', 'Umaria', 'Vidisha'],
      'Maharashtra': ['Ahmednagar', 'Akola', 'Amravati', 'Beed', 'Bhandara', 'Buldhana', 'Chandrapur', 'Dhule', 'Gadchiroli', 'Gondia', 'Hingoli', 'Jalgaon', 'Jalna', 'Kolhapur', 'Latur', 'Mumbai City', 'Mumbai Suburban', 'Nagpur', 'Nanded', 'Nandurbar', 'Nashik', 'Osmanabad (Dharashiv)', 'Palghar', 'Parbhani', 'Pune', 'Raigad', 'Ratnagiri', 'Sangli', 'Satara', 'Sindhudurg', 'Solapur', 'Thane', 'Wardha', 'Washim', 'Yavatmal'],
      'Manipur': ['Bishnupur', 'Chandel', 'Churachandpur', 'Imphal East', 'Imphal West', 'Jiribam', 'Kakching', 'Kangpokpi', 'Noney', 'Pherzawl', 'Senapati', 'Tamenglong', 'Tengnoupal', 'Thoubal', 'Ukhrul'],
      'Meghalaya': ['East Garo Hills', 'East Khasi Hills', 'East Jaintia Hills', 'North Garo Hills', 'Ri Bhoi', 'South Garo Hills', 'South West Garo Hills', 'South West Khasi Hills', 'West Garo Hills', 'West Khasi Hills', 'West Jaintia Hills'],
      'Mizoram': ['Aizawl', 'Champhai', 'Hnahthial', 'Khawzawl', 'Kolasib', 'Lawngtlai', 'Lunglei', 'Mamit', 'Saiha', 'Saitual', 'Serchhip'],
      'Nagaland': ['Chümoukedima', 'Dimapur', 'Kiphire', 'Kohima', 'Longleng', 'Mokokchung', 'Mon', 'Niuland', 'Noklak', 'Peren', 'Phek', 'Tsemyong', 'Tuensang', 'Wokha', 'Zünheboto'],
      'Odisha': ['Angul', 'Balangir', 'Balasore', 'Bargarh', 'Bhadrak', 'Boudh', 'Cuttack', 'Deogarh', 'Dhenkanal', 'Gajapati', 'Ganjam', 'Jagatsinghpur', 'Jajpur', 'Jharsuguda', 'Kalahandi', 'Kandhamal', 'Kendrapara', 'Kendujhar', 'Khordha', 'Koraput', 'Malkangiri', 'Mayurbhanj', 'Nabarangpur', 'Nayagarh', 'Nuapada', 'Puri', 'Rayagada', 'Sambalpur', 'Subarnapur', 'Sundargarh'],
      'Punjab': ['Amritsar', 'Barnala', 'Bathinda', 'Faridkot', 'Fatehgarh Sahib', 'Fazilka', 'Ferozepur', 'Gurdaspur', 'Hoshiarpur', 'Jalandhar', 'Kapurthala', 'Ludhiana', 'Malerkotla', 'Mansa', 'Moga', 'Pathankot', 'Patiala', 'Rupnagar', 'SAS Nagar', 'SBS Nagar', 'Sangrur', 'Sri Muktsar Sahib', 'Tarn Taran'],
      'Rajasthan': ['Ajmer', 'Alwar', 'Anupgarh', 'Balotra', 'Banswara', 'Baran', 'Barmer', 'Beawar', 'Bharatpur', 'Bhilwara', 'Bikaner', 'Bundi', 'Chittorgarh', 'Churu', 'Dausa', 'Deeg', 'Didwana-Kuchaman', 'Dholpur', 'Dungarpur', 'Gangapur City', 'Hanumangarh', 'Jaipur North', 'Jaipur South', 'Jaisalmer', 'Jalore', 'Jhalawar', 'Jhunjhunu', 'Jodhpur East', 'Jodhpur West', 'Karauli', 'Kekri', 'Khairthal-Tijara', 'Kota', 'Kotputli-Behror', 'Nagaur', 'Neem Ka Thana', 'Pali', 'Phalodi', 'Pratapgarh', 'Rajsamand', 'Salumbar', 'Sawai Madhopur', 'Sikar', 'Sirohi', 'Sri Ganganagar', 'Tonk', 'Udaipur'],
      'Sikkim': ['East Sikkim', 'North Sikkim', 'South Sikkim', 'West Sikkim'],
      'Tamil Nadu': ['Ariyalur', 'Chengalpattu', 'Chennai', 'Coimbatore', 'Cuddalore', 'Dharmapuri', 'Dindigul', 'Erode', 'Kallakurichi', 'Kanchipuram', 'Kanniyakumari', 'Karur', 'Krishnagiri', 'Madurai', 'Mayiladuthurai', 'Nagapattinam', 'Namakkal', 'Nilgiris', 'Perambalur', 'Pudukkottai', 'Ramanathapuram', 'Ranipet', 'Salem', 'Sivaganga', 'Tenkasi', 'Thanjavur', 'Theni', 'Thiruvallur', 'Thiruvarur', 'Thoothukudi', 'Tiruchirappalli', 'Tirunelveli', 'Tirupathur', 'Tiruppur', 'Tiruvannamalai', 'Vellore', 'Viluppuram', 'Virudhunagar'],
      'Telangana': ['Adilabad', 'Bhadradri Kothagudem', 'Hanamkonda', 'Hyderabad', 'Jagtial', 'Jangaon', 'Jayashankar Bhupalpally', 'Jogulamba Gadwal', 'Kamareddy', 'Karimnagar', 'Khammam', 'Komaram Bheem Asifabad', 'Mahabubabad', 'Mahabubnagar', 'Mancherial', 'Medak', 'Medchal-Malkajgiri', 'Mulugu', 'Nagarkurnool', 'Nalgonda', 'Narayanpet', 'Nirmal', 'Nizamabad', 'Peddapalli', 'Rajanna Sircilla', 'Rangareddy', 'Sangareddy', 'Siddipet', 'Suryapet', 'Vikarabad', 'Wanaparthy', 'Warangal', 'Yadadri Bhuvanagiri'],
      'Tripura': ['Dhalai', 'Gomati', 'Khowai', 'North Tripura', 'Sepahijala', 'South Tripura', 'Unakoti', 'West Tripura'],
      'Uttar Pradesh': ['Agra', 'Aligarh', 'Ambedkar Nagar', 'Amethi', 'Amroha', 'Auraiya', 'Ayodhya', 'Azamgarh', 'Baghpat', 'Bahraich', 'Ballia', 'Balrampur', 'Banda', 'Barabanki', 'Bareilly', 'Basti', 'Bhadohi', 'Bijnor', 'Budaun', 'Bulandshahr', 'Chandauli', 'Chitrakoot', 'Deoria', 'Etah', 'Etawah', 'Farrukhabad', 'Fatehpur', 'Firozabad', 'Gautam Buddha Nagar', 'Ghaziabad', 'Ghazipur', 'Gonda', 'Gorakhpur', 'Hamirpur', 'Hapur', 'Hardoi', 'Hathras', 'Jalaun', 'Jaunpur', 'Jhansi', 'Kannauj', 'Kanpur Dehat', 'Kanpur Nagar', 'Kasganj', 'Kaushambi', 'Kheri', 'Kushinagar', 'Lalitpur', 'Lucknow', 'Maharajganj', 'Mahoba', 'Mainpuri', 'Mathura', 'Mau', 'Meerut', 'Mirzapur', 'Moradabad', 'Muzaffarnagar', 'Pilibhit', 'Pratapgarh', 'Prayagraj', 'Raebareli', 'Rampur', 'Saharanpur', 'Sambhal', 'Sant Kabir Nagar', 'Shahjahanpur', 'Shamli', 'Shravasti', 'Siddharthnagar', 'Sitapur', 'Sonbhadra', 'Sultanpur', 'Unnao', 'Varanasi'],
      'Uttarakhand': ['Almora', 'Bageshwar', 'Chamoli', 'Champawat', 'Dehradun', 'Haridwar', 'Nainital', 'Pauri Garhwal', 'Pithoragarh', 'Rudraprayag', 'Tehri Garhwal', 'Udham Singh Nagar', 'Uttarkashi'],
      'West Bengal': ['Alipurduar', 'Bankura', 'Birbhum', 'Cooch Behar', 'Dakshin Dinajpur', 'Darjeeling', 'Hooghly', 'Howrah', 'Jalpaiguri', 'Jhargram', 'Kalimpong', 'Kolkata', 'Malda', 'Murshidabad', 'Nadia', 'North 24 Parganas', 'Paschim Bardhaman', 'Paschim Medinipur', 'Purba Bardhaman', 'Purba Medinipur', 'Purulia', 'South 24 Parganas', 'Uttar Dinajpur'],
      'Delhi': ['Central Delhi', 'East Delhi', 'New Delhi', 'North Delhi', 'North East Delhi', 'North West Delhi', 'Shahdara', 'South Delhi', 'South East Delhi', 'South West Delhi', 'West Delhi'],
      'Jammu and Kashmir': ['Anantnag', 'Bandipora', 'Baramulla', 'Budgam', 'Doda', 'Ganderbal', 'Jammu', 'Kathua', 'Kishtwar', 'Kulgam', 'Kupwara', 'Poonch', 'Pulwama', 'Rajouri', 'Ramban', 'Reasi', 'Samba', 'Shopian', 'Srinagar', 'Udhampur'],
      'Ladakh': ['Kargil', 'Leh'],
      'Puducherry': ['Karaikal', 'Mahe', 'Puducherry', 'Yanam'],
      'Chandigarh': ['Chandigarh'],
      'Dadra and Nagar Haveli and Daman and Diu': ['Dadra and Nagar Haveli', 'Daman', 'Diu'],
      'Lakshadweep': ['Lakshadweep'],
      'Andaman and Nicobar Islands': ['Nicobar', 'North and Middle Andaman', 'South Andaman']
    };
    return cities[stateName] || [];
  };

  const crops = getAvailableCrops();

  // Start from the place saved on the profile ("Mandya, Karnataka") when it matches a listed state and district
  useEffect(() => {
    const parts = String(user?.location || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
    if (parts.length < 2) return;
    const st = indianStates.find((x) => x.toLowerCase() === parts.at(-1));
    if (!st) return;
    setState(st);
    setSelectedLanguage(getStateLanguage(st));
    const city = getCitiesForState(st).find((c) => c.toLowerCase() === parts[0]);
    if (city) setLocation(city);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.location]);

  // Translation helper functions
  const translateWeatherData = async (data, targetLang) => {
    try {
      const translatedData = { ...data };
      
      // Translate current weather
      if (data.currentWeather) {
        translatedData.currentWeather = await translateText(data.currentWeather, targetLang);
      }
      
      // Translate alerts
      if (data.alerts && data.alerts.length > 0) {
        translatedData.alerts = await Promise.all(
          data.alerts.map(async (alert) => ({
            ...alert,
            message: await translateText(alert.message, targetLang),
            impact: await translateText(alert.impact, targetLang),
            recommendations: await Promise.all(
              alert.recommendations.map(rec => translateText(rec, targetLang))
            )
          }))
        );
      }
      
      // Translate rainfall advisory
      if (data.rainfallAdvisory) {
        translatedData.rainfallAdvisory = {
          ...data.rainfallAdvisory,
          soilMoistureStatus: await translateText(data.rainfallAdvisory.soilMoistureStatus, targetLang),
          irrigationAdvice: await translateText(data.rainfallAdvisory.irrigationAdvice, targetLang),
          cropProtectionTips: await Promise.all(
            data.rainfallAdvisory.cropProtectionTips.map(tip => translateText(tip, targetLang))
          )
        };
      }
      
      // Translate general recommendations
      if (data.generalRecommendations) {
        translatedData.generalRecommendations = await Promise.all(
          data.generalRecommendations.map(rec => translateText(rec, targetLang))
        );
      }
      
      return translatedData;
    } catch (error) {
      console.error('Translation failed:', error);
      return data;
    }
  };
  
  const translateSowingAdvice = async (advice, targetLang) => {
    try {
      return {
        ...advice,
        reason: await translateText(advice.reason, targetLang),
        weatherConsiderations: await Promise.all(
          advice.weatherConsiderations.map(tip => translateText(tip, targetLang))
        )
      };
    } catch (error) {
      console.error('Translation failed:', error);
      return advice;
    }
  };

  const handleStateChange = (selectedState) => {
    setState(selectedState);
    setLocation(''); // Reset location when state changes
    // Auto-select language based on state
    const suggestedLanguage = getStateLanguage(selectedState);
    setSelectedLanguage(suggestedLanguage);
  };

  const handleGetWeather = async () => {
    if (!location || !state) return;
    setIsLoading(true);
    
    try {
      // Get simple crop summary if crop is selected
      if (crop) {
        const summary = await getCropWeatherSummary(location, state, crop);
        // Translate summary if language is not English
        if (selectedLanguage !== 'en') {
          const translatedSummary = await translateText(summary, selectedLanguage);
          setCropSummary(translatedSummary);
        } else {
          setCropSummary(summary);
        }
      }
      
      // Get detailed weather analysis
      const data = await getWeatherAnalysis(location, state, crop || undefined);
      // Translate weather data if language is not English
      if (selectedLanguage !== 'en') {
        const translatedData = await translateWeatherData(data, selectedLanguage);
        setWeatherData(translatedData);
      } else {
        setWeatherData(data);
      }
      setShowSowingAdvice(false);
    } catch (e) {
      console.error('Weather analysis error:', e);
      alert(`Weather analysis failed: ${e.message}. Check your internet connection and try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetSowingAdvice = async () => {
    if (!crop || !location || !state) {
      alert("Please select a crop and location first");
      return;
    }
    setIsLoading(true);
    try {
      const advice = await getSowingHarvestingAdvice(crop, location, state);
      // Translate advice if language is not English
      if (selectedLanguage !== 'en') {
        const translatedAdvice = await translateSowingAdvice(advice, selectedLanguage);
        setSowingAdvice(translatedAdvice);
      } else {
        setSowingAdvice(advice);
      }
      setShowSowingAdvice(true);
    } catch (e) {
      alert("Failed to get sowing advice. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const getAlertIcon = (type) => {
    switch (type) {
      case 'RAIN': return <CloudRain className="alert-icon-blue" size={20} />;
      case 'DROUGHT': return <Sun className="alert-icon-orange" size={20} />;
      case 'HEAT_WAVE': return <Thermometer className="alert-icon-red" size={20} />;
      case 'STORM': return <Wind className="alert-icon-purple" size={20} />;
      case 'FROST': return <Cloud className="alert-icon-cyan" size={20} />;
      default: return <CheckCircle2 className="alert-icon-green" size={20} />;
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'CRITICAL': return 'severity-critical';
      case 'HIGH': return 'severity-high';
      case 'MEDIUM': return 'severity-medium';
      default: return 'severity-low';
    }
  };

  const sendWhatsAppAlert = async () => {
    if (!phoneNumber || !cropSummary) {
      alert('Please enter phone number and get weather analysis first');
      return;
    }
    
    try {
      console.log('Original message:', cropSummary);
      console.log('Selected language:', selectedLanguage);
      
      // Always translate the message to the selected language
      let messageToSend = cropSummary;
      if (selectedLanguage !== 'en') {
        console.log('Attempting translation to:', selectedLanguage);
        messageToSend = await translateText(cropSummary, selectedLanguage);
        console.log('Translated message:', messageToSend);
      }
      
      // Clean phone number (remove spaces, dashes, etc.)
      const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
      
      // Add country code if not present
      const formattedPhone = cleanPhone.startsWith('91') ? cleanPhone : '91' + cleanPhone;
      
      // Encode the translated message for URL
      const encodedMessage = encodeURIComponent(messageToSend);
      
      // Generate WhatsApp URL
      const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
      
      // Open WhatsApp
      window.open(whatsappUrl, '_blank');
    } catch (error) {
      console.error('WhatsApp alert error:', error);
      alert('Failed to prepare WhatsApp message. Please try again.');
    }
  };

  return (
    <div className="weather-screen">
      {/* Header */}
      <div className="weather-header">
        <h1 className="weather-title">
          <CloudRain size={32} /> Weather & Climate Intelligence
        </h1>
        <p className="weather-subtitle">
          Get AI-powered weather alerts, sowing/harvesting suggestions, and rainfall-based advisories for your farm.
        </p>
      </div>

      {/* Input Form */}
      <div className="weather-form">
        <h3 className="form-title">Location & Crop Details</h3>
        
        <div className="form-group">
          <label className="form-label">State</label>
          <select 
            value={state}
            onChange={(e) => handleStateChange(e.target.value)}
            className="form-select"
          >
            {indianStates.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">
            <MapPin size={16} /> Location (City/District)
          </label>
          <select 
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="form-select"
          >
            <option value="">Select a city/district</option>
            {getCitiesForState(state).map(city => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Crop (Optional - for sowing advice)</label>
          <select 
            value={crop}
            onChange={(e) => setCrop(e.target.value)}
            className="form-select"
          >
            <option value="">Select a crop (optional)</option>
            {crops.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">
            <MessageCircle size={16} /> Phone Number (for WhatsApp alerts)
          </label>
          <input 
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="Enter 10-digit mobile number"
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Language for WhatsApp Message</label>
          <select 
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="form-select"
          >
            {Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
        </div>

        <div className="form-buttons">
          <Button onClick={handleGetWeather} isLoading={isLoading} className="btn-primary">
            Get Weather Analysis
          </Button>
          {crop && (
            <Button onClick={handleGetSowingAdvice} isLoading={isLoading} className="btn-secondary">
              <Calendar size={18} className="btn-icon" /> Sowing Advice
            </Button>
          )}
        </div>
      </div>

      {/* Crop Summary */}
      {cropSummary && (
        <div className="crop-summary">
          <div className="crop-summary-header">
            <h3 className="crop-summary-title">
              <CheckCircle2 size={20} /> Crop Weather Summary
            </h3>
            {phoneNumber && (
              <Button 
                onClick={sendWhatsAppAlert} 
                className="btn-whatsapp"
                style={{ backgroundColor: '#25D366', color: 'white' }}
              >
                <MessageCircle size={18} className="btn-icon" /> Send WhatsApp Alert
              </Button>
            )}
          </div>
          <div className="crop-summary-content">
            <pre className="crop-summary-text">{cropSummary}</pre>
          </div>
        </div>
      )}

      {/* Weather Alerts */}
      {weatherData && (
        <div className="weather-results">
          {/* Current Weather */}
          <div className="current-weather">
            <h3 className="current-weather-title">
              <CloudRain size={20} /> Current Weather - {weatherData.place || `${weatherData.location}, ${weatherData.state}`}
            </h3>
            <p className="current-weather-text">{weatherData.currentWeather}</p>
            {weatherData.source === 'open-meteo' && (
              <p className="current-weather-source">Live forecast · Open-Meteo</p>
            )}
          </div>

          {/* 7-day forecast */}
          {weatherData.forecast?.length > 0 && (
            <div className="forecast-strip">
              {weatherData.forecast.map((day) => (
                <div key={day.date} className={`forecast-day ${day.rain >= 5 ? 'forecast-day-wet' : ''}`}>
                  <p className="forecast-label">{day.label}</p>
                  <p className="forecast-condition">{day.condition}</p>
                  <p className="forecast-temp">
                    {Math.round(day.tMax)}° <span>{Math.round(day.tMin)}°</span>
                  </p>
                  <p className="forecast-rain">
                    <Droplets size={12} /> {day.rain.toFixed(0)} mm · {day.rainProb}%
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Weather Alerts */}
          {weatherData.alerts && weatherData.alerts.length > 0 && (
            <div className="alerts-section">
              <div className="alerts-header">
                <h3 className="alerts-title">
                  <AlertTriangle size={20} /> Weather Alerts
                </h3>
              </div>
              <div className="alerts-content">
                {weatherData.alerts.map((alert, idx) => (
                  <div key={idx} className={`alert-card ${getSeverityColor(alert.severity)}`}>
                    <div className="alert-content">
                      {getAlertIcon(alert.type)}
                      <div className="alert-details">
                        <div className="alert-header">
                          <span className="alert-type">{alert.type.replace('_', ' ')}</span>
                          <span className="alert-severity">{alert.severity}</span>
                        </div>
                        <p className="alert-message">{alert.message}</p>
                        <p className="alert-impact">{alert.impact}</p>
                        <div className="alert-recommendations">
                          {alert.recommendations.map((rec, i) => (
                            <div key={i} className="recommendation">
                              <CheckCircle2 size={14} />
                              <span>{rec}</span>
                            </div>
                          ))}
                        </div>
                        <p className="alert-date">Date: {alert.date}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rainfall Advisory */}
          {weatherData.rainfallAdvisory && (
            <div className="rainfall-section">
              <div className="rainfall-header">
                <h3 className="rainfall-title">
                  <Droplets size={20} /> Rainfall Advisory
                </h3>
              </div>
              <div className="rainfall-content">
                <div className="rainfall-grid">
                  <div className="rainfall-item">
                    <p className="rainfall-label">Current Rainfall</p>
                    <p className="rainfall-value">{weatherData.rainfallAdvisory.currentRainfall}</p>
                  </div>
                  <div className="rainfall-item">
                    <p className="rainfall-label">Forecast Rainfall</p>
                    <p className="rainfall-value">{weatherData.rainfallAdvisory.forecastRainfall}</p>
                  </div>
                </div>
                <div className="rainfall-item">
                  <p className="rainfall-label">Soil Moisture Status</p>
                  <p className="rainfall-value">{weatherData.rainfallAdvisory.soilMoistureStatus}</p>
                </div>
                <div className="irrigation-advice">
                  <p className="irrigation-label">Irrigation Advice</p>
                  <p className="irrigation-text">{weatherData.rainfallAdvisory.irrigationAdvice}</p>
                </div>
                <div className="crop-protection">
                  <p className="protection-label">Crop Protection Tips</p>
                  <ul className="protection-list">
                    {weatherData.rainfallAdvisory.cropProtectionTips.map((tip, i) => (
                      <li key={i} className="protection-item">
                        <CheckCircle2 size={14} />
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={`risk-level risk-${weatherData.rainfallAdvisory.riskLevel.toLowerCase()}`}>
                  Risk Level: {weatherData.rainfallAdvisory.riskLevel}
                </div>
              </div>
            </div>
          )}

          {/* General Recommendations */}
          {weatherData.generalRecommendations && weatherData.generalRecommendations.length > 0 && (
            <div className="recommendations-section">
              <h3 className="recommendations-title">
                <CheckCircle2 size={20} /> General Recommendations
              </h3>
              <ul className="recommendations-list">
                {weatherData.generalRecommendations.map((rec, i) => (
                  <li key={i} className="recommendation-item">
                    <CheckCircle2 size={16} />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Sowing/Harvesting Advice */}
      {showSowingAdvice && sowingAdvice && (
        <div className="sowing-section">
          <div className="sowing-header">
            <h3 className="sowing-title">
              <Calendar size={20} /> Sowing & Harvesting Advice for {sowingAdvice.crop}
            </h3>
          </div>
          <div className="sowing-content">
            {!sowingAdvice.noCalendar && <div className="sowing-dates">
              <div className="sowing-date-item sowing-optimal">
                <p className="sowing-date-label">Optimal Sowing Date</p>
                <p className="sowing-date-value">{sowingAdvice.optimalSowingDate}</p>
              </div>
              <div className="sowing-date-item harvest-date">
                <p className="sowing-date-label">Expected Harvest Date</p>
                <p className="sowing-date-value">{sowingAdvice.expectedHarvestDate}</p>
              </div>
            </div>}
            <div className="sowing-reason">
              <p className="reason-label">Reasoning</p>
              <p className="reason-text">{sowingAdvice.reason}</p>
            </div>
            {sowingAdvice.alternativeSowingDates && sowingAdvice.alternativeSowingDates.length > 0 && (
              <div className="alternative-dates">
                <p className="alternative-label">Alternative Sowing Dates</p>
                <div className="alternative-tags">
                  {sowingAdvice.alternativeSowingDates.map((date, i) => (
                    <span key={i} className="alternative-tag">{date}</span>
                  ))}
                </div>
              </div>
            )}
            {sowingAdvice.weatherConsiderations && sowingAdvice.weatherConsiderations.length > 0 && (
              <div className="weather-considerations">
                <p className="considerations-label">Weather Considerations</p>
                <ul className="considerations-list">
                  {sowingAdvice.weatherConsiderations.map((consideration, i) => (
                    <li key={i} className="consideration-item">
                      <CheckCircle2 size={14} />
                      <span>{consideration}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};