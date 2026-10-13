import React, { useState } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import { Globe, Sprout, Layers, CloudSun, BarChart3, ArrowLeft } from 'lucide-react';
import { AnimatedContent } from '../components/Common/AnimatedContent.jsx';
import { Tooltip } from 'react-tooltip';
import './GeoMapScreen.css';

// Using a stable public TopoJSON for India
const INDIA_TOPO_JSON = "https://raw.githubusercontent.com/deldersveld/topojson/master/countries/india/india-states.json";

// State name mapping to handle different naming conventions
const STATE_NAME_MAPPING = {
  "Andhra Pradesh": "Andhra Pradesh",
  "Arunachal Pradesh": "Arunachal Pradesh", 
  "Assam": "Assam",
  "Bihar": "Bihar",
  "Chhattisgarh": "Chhattisgarh",
  "Goa": "Goa",
  "Gujarat": "Gujarat",
  "Haryana": "Haryana",
  "Himachal Pradesh": "Himachal Pradesh",
  "Jharkhand": "Jharkhand",
  "Karnataka": "Karnataka",
  "Kerala": "Kerala",
  "Madhya Pradesh": "Madhya Pradesh",
  "Maharashtra": "Maharashtra",
  "Manipur": "Manipur",
  "Meghalaya": "Meghalaya",
  "Mizoram": "Mizoram",
  "Nagaland": "Nagaland",
  "Odisha": "Odisha",
  "Orissa": "Odisha",
  "Punjab": "Punjab",
  "Rajasthan": "Rajasthan",
  "Sikkim": "Sikkim",
  "Tamil Nadu": "Tamil Nadu",
  "Telangana": "Telangana",
  "Tripura": "Tripura",
  "Uttar Pradesh": "Uttar Pradesh",
  "Uttarakhand": "Uttarakhand",
  "West Bengal": "West Bengal",
  "Delhi": "Delhi",
  "NCT of Delhi": "Delhi",
  "National Capital Territory of Delhi": "Delhi",
  "Jammu and Kashmir": "Jammu and Kashmir",
  "Jammu & Kashmir": "Jammu and Kashmir",
  "Ladakh": "Ladakh",
  "Puducherry": "Puducherry",
  "Pondicherry": "Puducherry",
  "Chandigarh": "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu": "Dadra and Nagar Haveli and Daman and Diu",
  "Lakshadweep": "Lakshadweep",
  "Andaman and Nicobar Islands": "Andaman and Nicobar Islands"
};

const STATE_DATA = {
  "Andhra Pradesh": {
    id: "AP",
    topCrops: ["Rice", "Maize", "Cotton"],
    soil: ["Red Soil", "Black Soil"],
    residue: "High",
    cycles: ["Kharif", "Rabi"],
    districts: [
      { name: "Anakapalli", residue: "Medium", crop: "Rice" },
      { name: "Anantapur", residue: "Medium", crop: "Maize" },
      { name: "Annamayya", residue: "Medium", crop: "Cotton" },
      { name: "Alluri Sitharama Raju", residue: "Medium", crop: "Rice" },
      { name: "Bapatla", residue: "Medium", crop: "Rice" },
      { name: "Chittoor", residue: "Medium", crop: "Mango" },
      { name: "Dr. B.R. Ambedkar Konaseema", residue: "Medium", crop: "Rice" },
      { name: "East Godavari", residue: "Medium", crop: "Rice" },
      { name: "Eluru", residue: "Medium", crop: "Rice" },
      { name: "Guntur", residue: "Medium", crop: "Cotton" },
      { name: "Kakinada", residue: "Medium", crop: "Rice" },
      { name: "Krishna", residue: "Medium", crop: "Rice" },
      { name: "Kurnool", residue: "Medium", crop: "Groundnut" },
      { name: "Nandyal", residue: "Medium", crop: "Rice" },
      { name: "Nellore", residue: "Medium", crop: "Rice" },
      { name: "Palnadu", residue: "Medium", crop: "Cotton" },
      { name: "Parvathipuram Manyam", residue: "Medium", crop: "Rice" },
      { name: "Prakasam", residue: "Medium", crop: "Cotton" },
      { name: "Srikakulam", residue: "Medium", crop: "Rice" },
      { name: "Tirupati", residue: "Medium", crop: "Mango" },
      { name: "Visakhapatnam", residue: "Medium", crop: "Rice" },
      { name: "Vizianagaram", residue: "Medium", crop: "Rice" },
      { name: "West Godavari", residue: "Medium", crop: "Rice" },
      { name: "YSR Kadapa", residue: "Medium", crop: "Groundnut" }
    ]
  },
  "Arunachal Pradesh": {
    id: "AR",
    topCrops: ["Rice", "Maize", "Millet"],
    soil: ["Mountain Soil"],
    residue: "Low",
    cycles: ["Kharif"],
    districts: [
      { name: "Anjaw", residue: "Low", crop: "Rice" },
      { name: "Changlang", residue: "Low", crop: "Rice" },
      { name: "Dibang Valley", residue: "Low", crop: "Rice" },
      { name: "East Kameng", residue: "Low", crop: "Rice" },
      { name: "East Siang", residue: "Low", crop: "Rice" },
      { name: "Kamle", residue: "Low", crop: "Rice" },
      { name: "Kra Daadi", residue: "Low", crop: "Rice" },
      { name: "Kurung Kumey", residue: "Low", crop: "Rice" },
      { name: "Lepa Rada", residue: "Low", crop: "Rice" },
      { name: "Lohit", residue: "Low", crop: "Rice" },
      { name: "Longding", residue: "Low", crop: "Rice" },
      { name: "Lower Dibang Valley", residue: "Low", crop: "Rice" },
      { name: "Lower Siang", residue: "Low", crop: "Rice" },
      { name: "Lower Subansiri", residue: "Low", crop: "Rice" },
      { name: "Namsai", residue: "Low", crop: "Rice" },
      { name: "Pakke Kessang", residue: "Low", crop: "Rice" },
      { name: "Papum Pare", residue: "Low", crop: "Rice" },
      { name: "Shi Yomi", residue: "Low", crop: "Rice" },
      { name: "Siang", residue: "Low", crop: "Rice" },
      { name: "Tawang", residue: "Low", crop: "Rice" },
      { name: "Tirap", residue: "Low", crop: "Rice" },
      { name: "Upper Dibang Valley", residue: "Low", crop: "Rice" },
      { name: "Upper Siang", residue: "Low", crop: "Rice" },
      { name: "Upper Subansiri", residue: "Low", crop: "Rice" },
      { name: "West Kameng", residue: "Low", crop: "Rice" },
      { name: "West Siang", residue: "Low", crop: "Rice" }
    ]
  },
  "Assam": {
    id: "AS",
    topCrops: ["Rice", "Tea", "Jute"],
    soil: ["Alluvial Soil"],
    residue: "High",
    cycles: ["Kharif", "Rabi"],
    districts: [
      { name: "Baksa", residue: "Medium", crop: "Rice" },
      { name: "Bajali", residue: "Medium", crop: "Rice" },
      { name: "Barpeta", residue: "Medium", crop: "Rice" },
      { name: "Biswanath", residue: "Medium", crop: "Rice" },
      { name: "Bongaigaon", residue: "Medium", crop: "Rice" },
      { name: "Cachar", residue: "Medium", crop: "Rice" },
      { name: "Charaideo", residue: "Medium", crop: "Rice" },
      { name: "Chirang", residue: "Medium", crop: "Rice" },
      { name: "Darrang", residue: "Medium", crop: "Rice" },
      { name: "Dhemaji", residue: "Medium", crop: "Rice" },
      { name: "Dhubri", residue: "Medium", crop: "Rice" },
      { name: "Dibrugarh", residue: "Medium", crop: "Rice" },
      { name: "Dima Hasao", residue: "Medium", crop: "Rice" },
      { name: "Goalpara", residue: "Medium", crop: "Rice" },
      { name: "Golaghat", residue: "Medium", crop: "Rice" },
      { name: "Hailakandi", residue: "Medium", crop: "Rice" },
      { name: "Hojai", residue: "Medium", crop: "Rice" },
      { name: "Jorhat", residue: "Medium", crop: "Rice" },
      { name: "Kamrup", residue: "Medium", crop: "Rice" },
      { name: "Kamrup Metropolitan", residue: "Medium", crop: "Rice" },
      { name: "Karbi Anglong", residue: "Medium", crop: "Rice" },
      { name: "Karimganj", residue: "Medium", crop: "Rice" },
      { name: "Kokrajhar", residue: "Medium", crop: "Rice" },
      { name: "Lakhimpur", residue: "Medium", crop: "Rice" },
      { name: "Majuli", residue: "Medium", crop: "Rice" },
      { name: "Morigaon", residue: "Medium", crop: "Rice" },
      { name: "Nagaon", residue: "Medium", crop: "Rice" },
      { name: "Nalbari", residue: "Medium", crop: "Rice" },
      { name: "Sivasagar", residue: "Medium", crop: "Rice" },
      { name: "Sonitpur", residue: "Medium", crop: "Rice" },
      { name: "South Salmara-Mankachar", residue: "Medium", crop: "Rice" },
      { name: "Tinsukia", residue: "Medium", crop: "Rice" },
      { name: "Udalguri", residue: "Medium", crop: "Rice" },
      { name: "West Karbi Anglong", residue: "Medium", crop: "Rice" }
    ]
  },
  "Bihar": {
    id: "BR",
    topCrops: ["Rice", "Wheat", "Maize"],
    soil: ["Alluvial Soil"],
    residue: "High",
    cycles: ["Kharif", "Rabi"],
    districts: [
      { name: "Araria", residue: "Medium", crop: "Rice" },
      { name: "Arwal", residue: "Medium", crop: "Rice" },
      { name: "Aurangabad", residue: "Medium", crop: "Rice" },
      { name: "Banka", residue: "Medium", crop: "Rice" },
      { name: "Begusarai", residue: "Medium", crop: "Rice" },
      { name: "Bhagalpur", residue: "Medium", crop: "Rice" },
      { name: "Bhojpur", residue: "Medium", crop: "Rice" },
      { name: "Buxar", residue: "Medium", crop: "Rice" },
      { name: "Darbhanga", residue: "Medium", crop: "Rice" },
      { name: "East Champaran", residue: "Medium", crop: "Rice" },
      { name: "Gaya", residue: "Medium", crop: "Rice" },
      { name: "Gopalganj", residue: "Medium", crop: "Rice" },
      { name: "Jamui", residue: "Medium", crop: "Rice" },
      { name: "Jehanabad", residue: "Medium", crop: "Rice" },
      { name: "Kaimur", residue: "Medium", crop: "Rice" },
      { name: "Katihar", residue: "Medium", crop: "Rice" },
      { name: "Khagaria", residue: "Medium", crop: "Rice" },
      { name: "Kishanganj", residue: "Medium", crop: "Rice" },
      { name: "Lakhisarai", residue: "Medium", crop: "Rice" },
      { name: "Madhepura", residue: "Medium", crop: "Rice" },
      { name: "Madhubani", residue: "Medium", crop: "Rice" },
      { name: "Munger", residue: "Medium", crop: "Rice" },
      { name: "Muzaffarpur", residue: "Medium", crop: "Rice" },
      { name: "Nalanda", residue: "Medium", crop: "Rice" },
      { name: "Nawada", residue: "Medium", crop: "Rice" },
      { name: "Patna", residue: "Medium", crop: "Rice" },
      { name: "Purnia", residue: "Medium", crop: "Rice" },
      { name: "Rohtas", residue: "Medium", crop: "Rice" },
      { name: "Saharsa", residue: "Medium", crop: "Rice" },
      { name: "Samastipur", residue: "Medium", crop: "Rice" },
      { name: "Saran", residue: "Medium", crop: "Rice" },
      { name: "Sheikhpura", residue: "Medium", crop: "Rice" },
      { name: "Sheohar", residue: "Medium", crop: "Rice" },
      { name: "Sitamarhi", residue: "Medium", crop: "Rice" },
      { name: "Siwan", residue: "Medium", crop: "Rice" },
      { name: "Supaul", residue: "Medium", crop: "Rice" },
      { name: "Vaishali", residue: "Medium", crop: "Rice" },
      { name: "West Champaran", residue: "Medium", crop: "Rice" }
    ]
  },
  "Chhattisgarh": {
    id: "CT",
    topCrops: ["Rice", "Maize", "Pulses"],
    soil: ["Red Soil", "Black Soil"],
    residue: "Medium",
    cycles: ["Kharif", "Rabi"],
    districts: [
      { name: "Balod", residue: "Medium", crop: "Rice" },
      { name: "Baloda Bazar", residue: "Medium", crop: "Rice" },
      { name: "Balrampur", residue: "Medium", crop: "Rice" },
      { name: "Bastar", residue: "Medium", crop: "Rice" },
      { name: "Bemetara", residue: "Medium", crop: "Rice" },
      { name: "Bijapur", residue: "Medium", crop: "Rice" },
      { name: "Bilaspur", residue: "Medium", crop: "Rice" },
      { name: "Dantewada", residue: "Medium", crop: "Rice" },
      { name: "Dhamtari", residue: "Medium", crop: "Rice" },
      { name: "Durg", residue: "Medium", crop: "Rice" },
      { name: "Gariaband", residue: "Medium", crop: "Rice" },
      { name: "Gaurela-Pendra-Marwahi", residue: "Medium", crop: "Rice" },
      { name: "Janjgir-Champa", residue: "Medium", crop: "Rice" },
      { name: "Jashpur", residue: "Medium", crop: "Rice" },
      { name: "Kabirdham", residue: "Medium", crop: "Rice" },
      { name: "Kanker", residue: "Medium", crop: "Rice" },
      { name: "Kondagaon", residue: "Medium", crop: "Rice" },
      { name: "Korba", residue: "Medium", crop: "Rice" },
      { name: "Koriya", residue: "Medium", crop: "Rice" },
      { name: "Mahasamund", residue: "Medium", crop: "Rice" },
      { name: "Manendragarh-Chirmiri-Bharatpur", residue: "Medium", crop: "Rice" },
      { name: "Mohla-Manpur-Ambagarh Chowki", residue: "Medium", crop: "Rice" },
      { name: "Mungeli", residue: "Medium", crop: "Rice" },
      { name: "Narayanpur", residue: "Medium", crop: "Rice" },
      { name: "Raigarh", residue: "Medium", crop: "Rice" },
      { name: "Raipur", residue: "Medium", crop: "Rice" },
      { name: "Rajnandgaon", residue: "Medium", crop: "Rice" },
      { name: "Sakti", residue: "Medium", crop: "Rice" },
      { name: "Sarangarh-Bilaigarh", residue: "Medium", crop: "Rice" },
      { name: "Sukma", residue: "Medium", crop: "Rice" },
      { name: "Surajpur", residue: "Medium", crop: "Rice" },
      { name: "Surguja", residue: "Medium", crop: "Rice" }
    ]
  },
  "Goa": {
    id: "GA",
    topCrops: ["Rice", "Coconut", "Cashew"],
    soil: ["Laterite Soil"],
    residue: "Low",
    cycles: ["Kharif"],
    districts: [
      { name: "North Goa", residue: "Low", crop: "Rice" },
      { name: "South Goa", residue: "Low", crop: "Rice" }
    ]
  },
  "Gujarat": {
    id: "GJ",
    topCrops: ["Cotton", "Groundnut", "Wheat"],
    soil: ["Black Soil", "Desert Soil"],
    residue: "Medium",
    cycles: ["Kharif", "Rabi"],
    districts: [
      { name: "Ahmedabad", residue: "Medium", crop: "Cotton" },
      { name: "Amreli", residue: "Medium", crop: "Cotton" },
      { name: "Anand", residue: "Medium", crop: "Cotton" },
      { name: "Aravalli", residue: "Medium", crop: "Cotton" },
      { name: "Banaskantha", residue: "Medium", crop: "Cotton" },
      { name: "Bharuch", residue: "Medium", crop: "Cotton" },
      { name: "Bhavnagar", residue: "Medium", crop: "Cotton" },
      { name: "Botad", residue: "Medium", crop: "Cotton" },
      { name: "Chhota Udaipur", residue: "Medium", crop: "Cotton" },
      { name: "Dahod", residue: "Medium", crop: "Cotton" },
      { name: "Dang", residue: "Medium", crop: "Cotton" },
      { name: "Devbhoomi Dwarka", residue: "Medium", crop: "Cotton" },
      { name: "Gandhinagar", residue: "Medium", crop: "Cotton" },
      { name: "Gir Somnath", residue: "Medium", crop: "Cotton" },
      { name: "Jamnagar", residue: "Medium", crop: "Cotton" },
      { name: "Junagadh", residue: "Medium", crop: "Cotton" },
      { name: "Kheda", residue: "Medium", crop: "Cotton" },
      { name: "Kutch", residue: "Medium", crop: "Cotton" },
      { name: "Mahisagar", residue: "Medium", crop: "Cotton" },
      { name: "Mehsana", residue: "Medium", crop: "Cotton" },
      { name: "Morbi", residue: "Medium", crop: "Cotton" },
      { name: "Narmada", residue: "Medium", crop: "Cotton" },
      { name: "Navsari", residue: "Medium", crop: "Cotton" },
      { name: "Panchmahal", residue: "Medium", crop: "Cotton" },
      { name: "Patan", residue: "Medium", crop: "Cotton" },
      { name: "Porbandar", residue: "Medium", crop: "Cotton" },
      { name: "Rajkot", residue: "Medium", crop: "Cotton" },
      { name: "Sabarkantha", residue: "Medium", crop: "Cotton" },
      { name: "Surat", residue: "Medium", crop: "Cotton" },
      { name: "Surendranagar", residue: "Medium", crop: "Cotton" },
      { name: "Tapi", residue: "Medium", crop: "Cotton" },
      { name: "Vadodara", residue: "Medium", crop: "Cotton" },
      { name: "Valsad", residue: "Medium", crop: "Cotton" }
    ]
  },
  "Haryana": {
    id: "HR",
    topCrops: ["Wheat", "Rice", "Cotton"],
    soil: ["Alluvial", "Sandy Loam"],
    residue: "High (15M Tons)",
    cycles: ["Kharif: Rice", "Rabi: Wheat"],
    districts: [
      { name: "Ambala", residue: "High", crop: "Rice" },
      { name: "Bhiwani", residue: "Medium", crop: "Cotton" },
      { name: "Charkhi Dadri", residue: "Medium", crop: "Wheat" },
      { name: "Faridabad", residue: "Medium", crop: "Rice" },
      { name: "Fatehabad", residue: "Medium", crop: "Cotton" },
      { name: "Gurugram", residue: "Medium", crop: "Rice" },
      { name: "Hisar", residue: "Medium", crop: "Wheat" },
      { name: "Jhajjar", residue: "Medium", crop: "Rice" },
      { name: "Jind", residue: "Medium", crop: "Rice" },
      { name: "Kaithal", residue: "Medium", crop: "Rice" },
      { name: "Karnal", residue: "High", crop: "Rice" },
      { name: "Kurukshetra", residue: "Medium", crop: "Rice" },
      { name: "Mahendragarh", residue: "Medium", crop: "Wheat" },
      { name: "Nuh", residue: "Medium", crop: "Rice" },
      { name: "Palwal", residue: "Medium", crop: "Rice" },
      { name: "Panchkula", residue: "Medium", crop: "Rice" },
      { name: "Panipat", residue: "Medium", crop: "Rice" },
      { name: "Rewari", residue: "Medium", crop: "Wheat" },
      { name: "Rohtak", residue: "Medium", crop: "Rice" },
      { name: "Sirsa", residue: "Medium", crop: "Cotton" },
      { name: "Sonipat", residue: "Medium", crop: "Rice" },
      { name: "Yamunanagar", residue: "Medium", crop: "Rice" }
    ]
  },
  "Himachal Pradesh": {
    id: "HP",
    topCrops: ["Wheat", "Maize", "Rice"],
    soil: ["Mountain Soil"],
    residue: "Low",
    cycles: ["Kharif", "Rabi"],
    districts: [
      { name: "Bilaspur", residue: "Low", crop: "Wheat" },
      { name: "Chamba", residue: "Low", crop: "Wheat" },
      { name: "Hamirpur", residue: "Low", crop: "Wheat" },
      { name: "Kangra", residue: "Low", crop: "Wheat" },
      { name: "Kinnaur", residue: "Low", crop: "Wheat" },
      { name: "Kullu", residue: "Low", crop: "Wheat" },
      { name: "Lahaul & Spiti", residue: "Low", crop: "Wheat" },
      { name: "Mandi", residue: "Low", crop: "Wheat" },
      { name: "Shimla", residue: "Low", crop: "Wheat" },
      { name: "Sirmaur", residue: "Low", crop: "Wheat" },
      { name: "Solan", residue: "Low", crop: "Wheat" },
      { name: "Una", residue: "Low", crop: "Wheat" }
    ]
  },
  "Jharkhand": {
    id: "JH",
    topCrops: ["Rice", "Wheat", "Maize"],
    soil: ["Red Soil", "Laterite Soil"],
    residue: "Medium",
    cycles: ["Kharif", "Rabi"],
    districts: [
      { name: "Bokaro", residue: "Medium", crop: "Rice" },
      { name: "Chatra", residue: "Medium", crop: "Rice" },
      { name: "Deoghar", residue: "Medium", crop: "Rice" },
      { name: "Dhanbad", residue: "Medium", crop: "Rice" },
      { name: "Dumka", residue: "Medium", crop: "Rice" },
      { name: "East Singhbhum", residue: "Medium", crop: "Rice" },
      { name: "Garhwa", residue: "Medium", crop: "Rice" },
      { name: "Giridih", residue: "Medium", crop: "Rice" },
      { name: "Godda", residue: "Medium", crop: "Rice" },
      { name: "Gumla", residue: "Medium", crop: "Rice" },
      { name: "Hazaribagh", residue: "Medium", crop: "Rice" },
      { name: "Jamtara", residue: "Medium", crop: "Rice" },
      { name: "Khunti", residue: "Medium", crop: "Rice" },
      { name: "Koderma", residue: "Medium", crop: "Rice" },
      { name: "Latehar", residue: "Medium", crop: "Rice" },
      { name: "Lohardaga", residue: "Medium", crop: "Rice" },
      { name: "Pakur", residue: "Medium", crop: "Rice" },
      { name: "Palamu", residue: "Medium", crop: "Rice" },
      { name: "Ramgarh", residue: "Medium", crop: "Rice" },
      { name: "Ranchi", residue: "Medium", crop: "Rice" },
      { name: "Sahebganj", residue: "Medium", crop: "Rice" },
      { name: "Seraikela-Kharsawan", residue: "Medium", crop: "Rice" },
      { name: "Simdega", residue: "Medium", crop: "Rice" },
      { name: "West Singhbhum", residue: "Medium", crop: "Rice" }
    ]
  },
  "Karnataka": {
    id: "KA",
    topCrops: ["Rice", "Ragi", "Jowar"],
    soil: ["Red Soil", "Black Soil"],
    residue: "Medium",
    cycles: ["Kharif", "Rabi"],
    districts: [
      { name: "Bagalkot", residue: "Medium", crop: "Rice" },
      { name: "Ballari", residue: "Medium", crop: "Rice" },
      { name: "Belagavi", residue: "Medium", crop: "Rice" },
      { name: "Bengaluru Rural", residue: "Medium", crop: "Rice" },
      { name: "Bengaluru Urban", residue: "Medium", crop: "Rice" },
      { name: "Bidar", residue: "Medium", crop: "Rice" },
      { name: "Chamarajanagar", residue: "Medium", crop: "Rice" },
      { name: "Chikkaballapur", residue: "Medium", crop: "Rice" },
      { name: "Chikkamagaluru", residue: "Medium", crop: "Rice" },
      { name: "Chitradurga", residue: "Medium", crop: "Rice" },
      { name: "Dakshina Kannada", residue: "Medium", crop: "Rice" },
      { name: "Davanagere", residue: "Medium", crop: "Rice" },
      { name: "Dharwad", residue: "Medium", crop: "Rice" },
      { name: "Gadag", residue: "Medium", crop: "Rice" },
      { name: "Hassan", residue: "Medium", crop: "Rice" },
      { name: "Haveri", residue: "Medium", crop: "Rice" },
      { name: "Kalaburagi", residue: "Medium", crop: "Rice" },
      { name: "Kodagu", residue: "Medium", crop: "Rice" },
      { name: "Kolar", residue: "Medium", crop: "Rice" },
      { name: "Koppal", residue: "Medium", crop: "Rice" },
      { name: "Mandya", residue: "Medium", crop: "Rice" },
      { name: "Mysuru", residue: "Medium", crop: "Rice" },
      { name: "Raichur", residue: "Medium", crop: "Rice" },
      { name: "Ramanagara", residue: "Medium", crop: "Rice" },
      { name: "Shivamogga", residue: "Medium", crop: "Rice" },
      { name: "Tumakuru", residue: "Medium", crop: "Rice" },
      { name: "Udupi", residue: "Medium", crop: "Rice" },
      { name: "Uttara Kannada", residue: "Medium", crop: "Rice" },
      { name: "Vijayapura", residue: "Medium", crop: "Rice" },
      { name: "Yadgir", residue: "Medium", crop: "Rice" }
    ]
  },
  "Kerala": {
    id: "KL",
    topCrops: ["Rice", "Coconut", "Rubber"],
    soil: ["Laterite Soil", "Alluvial Soil"],
    residue: "Medium",
    cycles: ["Kharif"],
    districts: [
      { name: "Alappuzha", residue: "Medium", crop: "Rice" },
      { name: "Ernakulam", residue: "Medium", crop: "Rice" },
      { name: "Idukki", residue: "Medium", crop: "Rice" },
      { name: "Kannur", residue: "Medium", crop: "Rice" },
      { name: "Kasaragod", residue: "Medium", crop: "Rice" },
      { name: "Kollam", residue: "Medium", crop: "Rice" },
      { name: "Kottayam", residue: "Medium", crop: "Rice" },
      { name: "Kozhikode", residue: "Medium", crop: "Rice" },
      { name: "Malappuram", residue: "Medium", crop: "Rice" },
      { name: "Palakkad", residue: "Medium", crop: "Rice" },
      { name: "Pathanamthitta", residue: "Medium", crop: "Rice" },
      { name: "Thiruvananthapuram", residue: "Medium", crop: "Rice" },
      { name: "Thrissur", residue: "Medium", crop: "Rice" },
      { name: "Wayanad", residue: "Medium", crop: "Rice" }
    ]
  },
  "Madhya Pradesh": {
    id: "MP",
    topCrops: ["Soybean", "Wheat", "Gram"],
    soil: ["Black Soil", "Clay"],
    residue: "Medium (30M Tons)",
    cycles: ["Kharif: Soybean", "Rabi: Wheat"],
    districts: [
      { name: "Agar Malwa", residue: "Medium", crop: "Soybean" },
      { name: "Alirajpur", residue: "Medium", crop: "Soybean" },
      { name: "Anuppur", residue: "Medium", crop: "Soybean" },
      { name: "Ashoknagar", residue: "Medium", crop: "Soybean" },
      { name: "Balaghat", residue: "Medium", crop: "Soybean" },
      { name: "Barwani", residue: "Medium", crop: "Soybean" },
      { name: "Betul", residue: "Medium", crop: "Soybean" },
      { name: "Bhind", residue: "Medium", crop: "Soybean" },
      { name: "Bhopal", residue: "Medium", crop: "Wheat" },
      { name: "Burhanpur", residue: "Medium", crop: "Soybean" },
      { name: "Chhatarpur", residue: "Medium", crop: "Soybean" },
      { name: "Chhindwara", residue: "Medium", crop: "Soybean" },
      { name: "Damoh", residue: "Medium", crop: "Soybean" },
      { name: "Datia", residue: "Medium", crop: "Soybean" },
      { name: "Dewas", residue: "Medium", crop: "Soybean" },
      { name: "Dhar", residue: "Medium", crop: "Soybean" },
      { name: "Dindori", residue: "Medium", crop: "Soybean" },
      { name: "Guna", residue: "Medium", crop: "Soybean" },
      { name: "Gwalior", residue: "Medium", crop: "Soybean" },
      { name: "Harda", residue: "Medium", crop: "Soybean" },
      { name: "Hoshangabad (Narmadapuram)", residue: "Medium", crop: "Soybean" },
      { name: "Indore", residue: "High", crop: "Soybean" },
      { name: "Jabalpur", residue: "Medium", crop: "Soybean" },
      { name: "Jhabua", residue: "Medium", crop: "Soybean" },
      { name: "Katni", residue: "Medium", crop: "Soybean" },
      { name: "Khandwa", residue: "Medium", crop: "Soybean" },
      { name: "Khargone", residue: "Medium", crop: "Soybean" },
      { name: "Maihar", residue: "Medium", crop: "Soybean" },
      { name: "Mandla", residue: "Medium", crop: "Soybean" },
      { name: "Mandsaur", residue: "Medium", crop: "Soybean" },
      { name: "Morena", residue: "Medium", crop: "Soybean" },
      { name: "Narsinghpur", residue: "Medium", crop: "Soybean" },
      { name: "Neemuch", residue: "Medium", crop: "Soybean" },
      { name: "Niwari", residue: "Medium", crop: "Soybean" },
      { name: "Panna", residue: "Medium", crop: "Soybean" },
      { name: "Raisen", residue: "Medium", crop: "Soybean" },
      { name: "Rajgarh", residue: "Medium", crop: "Soybean" },
      { name: "Ratlam", residue: "Medium", crop: "Soybean" },
      { name: "Rewa", residue: "Medium", crop: "Soybean" },
      { name: "Sagar", residue: "Medium", crop: "Soybean" },
      { name: "Satna", residue: "Medium", crop: "Soybean" },
      { name: "Sehore", residue: "Medium", crop: "Soybean" },
      { name: "Seoni", residue: "Medium", crop: "Soybean" },
      { name: "Shahdol", residue: "Medium", crop: "Soybean" },
      { name: "Shajapur", residue: "Medium", crop: "Soybean" },
      { name: "Sheopur", residue: "Medium", crop: "Soybean" },
      { name: "Shivpuri", residue: "Medium", crop: "Soybean" },
      { name: "Sidhi", residue: "Medium", crop: "Soybean" },
      { name: "Singrauli", residue: "Medium", crop: "Soybean" },
      { name: "Tikamgarh", residue: "Medium", crop: "Soybean" },
      { name: "Ujjain", residue: "Medium", crop: "Soybean" },
      { name: "Umaria", residue: "Medium", crop: "Soybean" },
      { name: "Vidisha", residue: "Medium", crop: "Soybean" }
    ]
  },
  "Maharashtra": {
    id: "MH",
    topCrops: ["Cotton", "Sugarcane", "Soybean"],
    soil: ["Black Cotton Soil"],
    residue: "Medium (28M Tons)",
    cycles: ["Kharif: Cotton", "Annual: Sugarcane"],
    districts: [
      { name: "Ahmednagar", residue: "Medium", crop: "Sugarcane" },
      { name: "Akola", residue: "Medium", crop: "Cotton" },
      { name: "Amravati", residue: "Medium", crop: "Cotton" },
      { name: "Beed", residue: "Medium", crop: "Sugarcane" },
      { name: "Bhandara", residue: "Medium", crop: "Cotton" },
      { name: "Buldhana", residue: "Medium", crop: "Cotton" },
      { name: "Chandrapur", residue: "Medium", crop: "Cotton" },
      { name: "Dhule", residue: "Medium", crop: "Cotton" },
      { name: "Gadchiroli", residue: "Medium", crop: "Cotton" },
      { name: "Gondia", residue: "Medium", crop: "Cotton" },
      { name: "Hingoli", residue: "Medium", crop: "Cotton" },
      { name: "Jalgaon", residue: "Medium", crop: "Cotton" },
      { name: "Jalna", residue: "Medium", crop: "Cotton" },
      { name: "Kolhapur", residue: "Medium", crop: "Sugarcane" },
      { name: "Latur", residue: "Medium", crop: "Cotton" },
      { name: "Mumbai City", residue: "Low", crop: "Vegetables" },
      { name: "Mumbai Suburban", residue: "Low", crop: "Vegetables" },
      { name: "Nagpur", residue: "High", crop: "Cotton" },
      { name: "Nanded", residue: "Medium", crop: "Cotton" },
      { name: "Nandurbar", residue: "Medium", crop: "Cotton" },
      { name: "Nashik", residue: "Low", crop: "Grapes" },
      { name: "Osmanabad (Dharashiv)", residue: "Medium", crop: "Cotton" },
      { name: "Palghar", residue: "Medium", crop: "Rice" },
      { name: "Parbhani", residue: "Medium", crop: "Cotton" },
      { name: "Pune", residue: "Medium", crop: "Sugarcane" },
      { name: "Raigad", residue: "Medium", crop: "Rice" },
      { name: "Ratnagiri", residue: "Medium", crop: "Rice" },
      { name: "Sangli", residue: "Medium", crop: "Sugarcane" },
      { name: "Satara", residue: "Medium", crop: "Sugarcane" },
      { name: "Sindhudurg", residue: "Medium", crop: "Rice" },
      { name: "Solapur", residue: "Medium", crop: "Cotton" },
      { name: "Thane", residue: "Medium", crop: "Rice" },
      { name: "Wardha", residue: "Medium", crop: "Cotton" },
      { name: "Washim", residue: "Medium", crop: "Cotton" },
      { name: "Yavatmal", residue: "Medium", crop: "Cotton" }
    ]
  },
  "Manipur": {
    id: "MN",
    topCrops: ["Rice", "Maize", "Potato"],
    soil: ["Red Soil"],
    residue: "Low",
    cycles: ["Kharif"],
    districts: [
      { name: "Bishnupur", residue: "Low", crop: "Rice" },
      { name: "Chandel", residue: "Low", crop: "Rice" },
      { name: "Churachandpur", residue: "Low", crop: "Rice" },
      { name: "Imphal East", residue: "Low", crop: "Rice" },
      { name: "Imphal West", residue: "Low", crop: "Rice" },
      { name: "Jiribam", residue: "Low", crop: "Rice" },
      { name: "Kakching", residue: "Low", crop: "Rice" },
      { name: "Kangpokpi", residue: "Low", crop: "Rice" },
      { name: "Noney", residue: "Low", crop: "Rice" },
      { name: "Pherzawl", residue: "Low", crop: "Rice" },
      { name: "Senapati", residue: "Low", crop: "Rice" },
      { name: "Tamenglong", residue: "Low", crop: "Rice" },
      { name: "Tengnoupal", residue: "Low", crop: "Rice" },
      { name: "Thoubal", residue: "Low", crop: "Rice" },
      { name: "Ukhrul", residue: "Low", crop: "Rice" }
    ]
  },
  "Meghalaya": {
    id: "ML",
    topCrops: ["Rice", "Maize", "Potato"],
    soil: ["Red Soil"],
    residue: "Low",
    cycles: ["Kharif"],
    districts: [
      { name: "East Garo Hills", residue: "Low", crop: "Rice" },
      { name: "East Khasi Hills", residue: "Low", crop: "Rice" },
      { name: "East Jaintia Hills", residue: "Low", crop: "Rice" },
      { name: "North Garo Hills", residue: "Low", crop: "Rice" },
      { name: "Ri Bhoi", residue: "Low", crop: "Rice" },
      { name: "South Garo Hills", residue: "Low", crop: "Rice" },
      { name: "South West Garo Hills", residue: "Low", crop: "Rice" },
      { name: "South West Khasi Hills", residue: "Low", crop: "Rice" },
      { name: "West Garo Hills", residue: "Low", crop: "Rice" },
      { name: "West Khasi Hills", residue: "Low", crop: "Rice" },
      { name: "West Jaintia Hills", residue: "Low", crop: "Rice" }
    ]
  },
  "Mizoram": {
    id: "MZ",
    topCrops: ["Rice", "Maize", "Chillies"],
    soil: ["Red Soil"],
    residue: "Low",
    cycles: ["Kharif"],
    districts: [
      { name: "Aizawl", residue: "Low", crop: "Rice" },
      { name: "Champhai", residue: "Low", crop: "Rice" },
      { name: "Hnahthial", residue: "Low", crop: "Rice" },
      { name: "Khawzawl", residue: "Low", crop: "Rice" },
      { name: "Kolasib", residue: "Low", crop: "Rice" },
      { name: "Lawngtlai", residue: "Low", crop: "Rice" },
      { name: "Lunglei", residue: "Low", crop: "Rice" },
      { name: "Mamit", residue: "Low", crop: "Rice" },
      { name: "Saiha", residue: "Low", crop: "Rice" },
      { name: "Saitual", residue: "Low", crop: "Rice" },
      { name: "Serchhip", residue: "Low", crop: "Rice" }
    ]
  },
  "Nagaland": {
    id: "NL",
    topCrops: ["Rice", "Maize", "Soybean"],
    soil: ["Red Soil"],
    residue: "Low",
    cycles: ["Kharif"],
    districts: [
      { name: "Chümoukedima", residue: "Low", crop: "Rice" },
      { name: "Dimapur", residue: "Low", crop: "Rice" },
      { name: "Kiphire", residue: "Low", crop: "Rice" },
      { name: "Kohima", residue: "Low", crop: "Rice" },
      { name: "Longleng", residue: "Low", crop: "Rice" },
      { name: "Mokokchung", residue: "Low", crop: "Rice" },
      { name: "Mon", residue: "Low", crop: "Rice" },
      { name: "Niuland", residue: "Low", crop: "Rice" },
      { name: "Noklak", residue: "Low", crop: "Rice" },
      { name: "Peren", residue: "Low", crop: "Rice" },
      { name: "Phek", residue: "Low", crop: "Rice" },
      { name: "Tsemyong", residue: "Low", crop: "Rice" },
      { name: "Tuensang", residue: "Low", crop: "Rice" },
      { name: "Wokha", residue: "Low", crop: "Rice" },
      { name: "Zünheboto", residue: "Low", crop: "Rice" }
    ]
  },
  "Odisha": {
    id: "OR",
    topCrops: ["Rice", "Maize", "Pulses"],
    soil: ["Red Soil", "Black Soil"],
    residue: "High",
    cycles: ["Kharif", "Rabi"],
    districts: [
      { name: "Angul", residue: "Medium", crop: "Rice" },
      { name: "Balangir", residue: "Medium", crop: "Rice" },
      { name: "Balasore", residue: "Medium", crop: "Rice" },
      { name: "Bargarh", residue: "Medium", crop: "Rice" },
      { name: "Bhadrak", residue: "Medium", crop: "Rice" },
      { name: "Boudh", residue: "Medium", crop: "Rice" },
      { name: "Cuttack", residue: "Medium", crop: "Rice" },
      { name: "Deogarh", residue: "Medium", crop: "Rice" },
      { name: "Dhenkanal", residue: "Medium", crop: "Rice" },
      { name: "Gajapati", residue: "Medium", crop: "Rice" },
      { name: "Ganjam", residue: "Medium", crop: "Rice" },
      { name: "Jagatsinghpur", residue: "Medium", crop: "Rice" },
      { name: "Jajpur", residue: "Medium", crop: "Rice" },
      { name: "Jharsuguda", residue: "Medium", crop: "Rice" },
      { name: "Kalahandi", residue: "Medium", crop: "Rice" },
      { name: "Kandhamal", residue: "Medium", crop: "Rice" },
      { name: "Kendrapara", residue: "Medium", crop: "Rice" },
      { name: "Kendujhar", residue: "Medium", crop: "Rice" },
      { name: "Khordha", residue: "Medium", crop: "Rice" },
      { name: "Koraput", residue: "Medium", crop: "Rice" },
      { name: "Malkangiri", residue: "Medium", crop: "Rice" },
      { name: "Mayurbhanj", residue: "Medium", crop: "Rice" },
      { name: "Nabarangpur", residue: "Medium", crop: "Rice" },
      { name: "Nayagarh", residue: "Medium", crop: "Rice" },
      { name: "Nuapada", residue: "Medium", crop: "Rice" },
      { name: "Puri", residue: "Medium", crop: "Rice" },
      { name: "Rayagada", residue: "Medium", crop: "Rice" },
      { name: "Sambalpur", residue: "Medium", crop: "Rice" },
      { name: "Subarnapur", residue: "Medium", crop: "Rice" },
      { name: "Sundargarh", residue: "Medium", crop: "Rice" }
    ]
  },
  "Punjab": {
    id: "PB",
    topCrops: ["Wheat", "Rice (Paddy)", "Maize"],
    soil: ["Alluvial Soil", "Loamy Sand"],
    residue: "Very High (22M Tons)",
    cycles: ["Kharif: Rice (Jun-Oct)", "Rabi: Wheat (Nov-Apr)"],
    districts: [
      { name: "Amritsar", residue: "Very High", crop: "Wheat/Rice" },
      { name: "Barnala", residue: "Very High", crop: "Paddy" },
      { name: "Bathinda", residue: "High", crop: "Cotton" },
      { name: "Faridkot", residue: "High", crop: "Cotton" },
      { name: "Fatehgarh Sahib", residue: "Very High", crop: "Rice" },
      { name: "Fazilka", residue: "High", crop: "Cotton" },
      { name: "Ferozepur", residue: "High", crop: "Cotton" },
      { name: "Gurdaspur", residue: "Very High", crop: "Rice" },
      { name: "Hoshiarpur", residue: "Very High", crop: "Rice" },
      { name: "Jalandhar", residue: "Very High", crop: "Rice" },
      { name: "Kapurthala", residue: "Very High", crop: "Rice" },
      { name: "Ludhiana", residue: "Very High", crop: "Wheat/Rice" },
      { name: "Malerkotla", residue: "Very High", crop: "Rice" },
      { name: "Mansa", residue: "High", crop: "Cotton" },
      { name: "Moga", residue: "High", crop: "Cotton" },
      { name: "Pathankot", residue: "Very High", crop: "Rice" },
      { name: "Patiala", residue: "High", crop: "Cotton" },
      { name: "Rupnagar", residue: "Very High", crop: "Rice" },
      { name: "SAS Nagar", residue: "Very High", crop: "Rice" },
      { name: "SBS Nagar", residue: "Very High", crop: "Rice" },
      { name: "Sangrur", residue: "Very High", crop: "Paddy" },
      { name: "Sri Muktsar Sahib", residue: "High", crop: "Cotton" },
      { name: "Tarn Taran", residue: "Very High", crop: "Rice" }
    ]
  },
  "Rajasthan": {
    id: "RJ",
    topCrops: ["Mustard", "Bajra", "Wheat"],
    soil: ["Desert", "Sandy"],
    residue: "Low (12M Tons)",
    cycles: ["Kharif: Bajra", "Rabi: Mustard"],
    districts: [
      { name: "Ajmer", residue: "Medium", crop: "Mustard" },
      { name: "Alwar", residue: "Medium", crop: "Mustard" },
      { name: "Anupgarh", residue: "Medium", crop: "Mustard" },
      { name: "Balotra", residue: "Medium", crop: "Mustard" },
      { name: "Banswara", residue: "Medium", crop: "Mustard" },
      { name: "Baran", residue: "Medium", crop: "Mustard" },
      { name: "Barmer", residue: "Medium", crop: "Mustard" },
      { name: "Beawar", residue: "Medium", crop: "Mustard" },
      { name: "Bharatpur", residue: "Medium", crop: "Mustard" },
      { name: "Bhilwara", residue: "Medium", crop: "Mustard" },
      { name: "Bikaner", residue: "Medium", crop: "Mustard" },
      { name: "Bundi", residue: "Medium", crop: "Mustard" },
      { name: "Chittorgarh", residue: "Medium", crop: "Mustard" },
      { name: "Churu", residue: "Medium", crop: "Mustard" },
      { name: "Dausa", residue: "Medium", crop: "Mustard" },
      { name: "Deeg", residue: "Medium", crop: "Mustard" },
      { name: "Didwana-Kuchaman", residue: "Medium", crop: "Mustard" },
      { name: "Dholpur", residue: "Medium", crop: "Mustard" },
      { name: "Dungarpur", residue: "Medium", crop: "Mustard" },
      { name: "Gangapur City", residue: "Medium", crop: "Mustard" },
      { name: "Hanumangarh", residue: "Medium", crop: "Mustard" },
      { name: "Jaipur North", residue: "Medium", crop: "Mustard" },
      { name: "Jaipur South", residue: "Medium", crop: "Mustard" },
      { name: "Jaisalmer", residue: "Medium", crop: "Mustard" },
      { name: "Jalore", residue: "Medium", crop: "Mustard" },
      { name: "Jhalawar", residue: "Medium", crop: "Mustard" },
      { name: "Jhunjhunu", residue: "Medium", crop: "Mustard" },
      { name: "Jodhpur East", residue: "Medium", crop: "Mustard" },
      { name: "Jodhpur West", residue: "Medium", crop: "Mustard" },
      { name: "Karauli", residue: "Medium", crop: "Mustard" },
      { name: "Kekri", residue: "Medium", crop: "Mustard" },
      { name: "Khairthal-Tijara", residue: "Medium", crop: "Mustard" },
      { name: "Kota", residue: "Medium", crop: "Mustard" },
      { name: "Kotputli-Behror", residue: "Medium", crop: "Mustard" },
      { name: "Nagaur", residue: "Medium", crop: "Mustard" },
      { name: "Neem Ka Thana", residue: "Medium", crop: "Mustard" },
      { name: "Pali", residue: "Medium", crop: "Mustard" },
      { name: "Phalodi", residue: "Medium", crop: "Mustard" },
      { name: "Pratapgarh", residue: "Medium", crop: "Mustard" },
      { name: "Rajsamand", residue: "Medium", crop: "Mustard" },
      { name: "Salumbar", residue: "Medium", crop: "Mustard" },
      { name: "Sawai Madhopur", residue: "Medium", crop: "Mustard" },
      { name: "Sikar", residue: "Medium", crop: "Mustard" },
      { name: "Sirohi", residue: "Medium", crop: "Mustard" },
      { name: "Sri Ganganagar", residue: "High", crop: "Wheat" },
      { name: "Tonk", residue: "Medium", crop: "Mustard" },
      { name: "Udaipur", residue: "Medium", crop: "Mustard" }
    ]
  },
  "Sikkim": {
    id: "SK",
    topCrops: ["Rice", "Maize", "Cardamom"],
    soil: ["Mountain Soil"],
    residue: "Low",
    cycles: ["Kharif"],
    districts: [
      { name: "East Sikkim", residue: "Low", crop: "Rice" },
      { name: "North Sikkim", residue: "Low", crop: "Rice" },
      { name: "South Sikkim", residue: "Low", crop: "Rice" },
      { name: "West Sikkim", residue: "Low", crop: "Rice" }
    ]
  },
  "Tamil Nadu": {
    id: "TN",
    topCrops: ["Rice", "Sugarcane", "Cotton"],
    soil: ["Red Soil", "Black Soil"],
    residue: "Medium",
    cycles: ["Kharif", "Rabi"],
    districts: [
      { name: "Ariyalur", residue: "Medium", crop: "Rice" },
      { name: "Chengalpattu", residue: "Medium", crop: "Rice" },
      { name: "Chennai", residue: "Medium", crop: "Rice" },
      { name: "Coimbatore", residue: "Medium", crop: "Rice" },
      { name: "Cuddalore", residue: "Medium", crop: "Rice" },
      { name: "Dharmapuri", residue: "Medium", crop: "Rice" },
      { name: "Dindigul", residue: "Medium", crop: "Rice" },
      { name: "Erode", residue: "Medium", crop: "Rice" },
      { name: "Kallakurichi", residue: "Medium", crop: "Rice" },
      { name: "Kanchipuram", residue: "Medium", crop: "Rice" },
      { name: "Kanniyakumari", residue: "Medium", crop: "Rice" },
      { name: "Karur", residue: "Medium", crop: "Rice" },
      { name: "Krishnagiri", residue: "Medium", crop: "Rice" },
      { name: "Madurai", residue: "Medium", crop: "Rice" },
      { name: "Mayiladuthurai", residue: "Medium", crop: "Rice" },
      { name: "Nagapattinam", residue: "Medium", crop: "Rice" },
      { name: "Namakkal", residue: "Medium", crop: "Rice" },
      { name: "Nilgiris", residue: "Medium", crop: "Rice" },
      { name: "Perambalur", residue: "Medium", crop: "Rice" },
      { name: "Pudukkottai", residue: "Medium", crop: "Rice" },
      { name: "Ramanathapuram", residue: "Medium", crop: "Rice" },
      { name: "Ranipet", residue: "Medium", crop: "Rice" },
      { name: "Salem", residue: "Medium", crop: "Rice" },
      { name: "Sivaganga", residue: "Medium", crop: "Rice" },
      { name: "Tenkasi", residue: "Medium", crop: "Rice" },
      { name: "Thanjavur", residue: "Medium", crop: "Rice" },
      { name: "Theni", residue: "Medium", crop: "Rice" },
      { name: "Thiruvallur", residue: "Medium", crop: "Rice" },
      { name: "Thiruvarur", residue: "Medium", crop: "Rice" },
      { name: "Thoothukudi", residue: "Medium", crop: "Rice" },
      { name: "Tiruchirappalli", residue: "Medium", crop: "Rice" },
      { name: "Tirunelveli", residue: "Medium", crop: "Rice" },
      { name: "Tirupathur", residue: "Medium", crop: "Rice" },
      { name: "Tiruppur", residue: "Medium", crop: "Rice" },
      { name: "Tiruvannamalai", residue: "Medium", crop: "Rice" },
      { name: "Vellore", residue: "Medium", crop: "Rice" },
      { name: "Viluppuram", residue: "Medium", crop: "Rice" },
      { name: "Virudhunagar", residue: "Medium", crop: "Rice" }
    ]
  },
  "Telangana": {
    id: "TG",
    topCrops: ["Rice", "Cotton", "Maize"],
    soil: ["Red Soil", "Black Soil"],
    residue: "Medium",
    cycles: ["Kharif", "Rabi"],
    districts: [
      { name: "Adilabad", residue: "Medium", crop: "Rice" },
      { name: "Bhadradri Kothagudem", residue: "Medium", crop: "Rice" },
      { name: "Hanamkonda", residue: "Medium", crop: "Rice" },
      { name: "Hyderabad", residue: "Medium", crop: "Rice" },
      { name: "Jagtial", residue: "Medium", crop: "Rice" },
      { name: "Jangaon", residue: "Medium", crop: "Rice" },
      { name: "Jayashankar Bhupalpally", residue: "Medium", crop: "Rice" },
      { name: "Jogulamba Gadwal", residue: "Medium", crop: "Rice" },
      { name: "Kamareddy", residue: "Medium", crop: "Rice" },
      { name: "Karimnagar", residue: "Medium", crop: "Rice" },
      { name: "Khammam", residue: "Medium", crop: "Rice" },
      { name: "Komaram Bheem Asifabad", residue: "Medium", crop: "Rice" },
      { name: "Mahabubabad", residue: "Medium", crop: "Rice" },
      { name: "Mahabubnagar", residue: "Medium", crop: "Rice" },
      { name: "Mancherial", residue: "Medium", crop: "Rice" },
      { name: "Medak", residue: "Medium", crop: "Rice" },
      { name: "Medchal-Malkajgiri", residue: "Medium", crop: "Rice" },
      { name: "Mulugu", residue: "Medium", crop: "Rice" },
      { name: "Nagarkurnool", residue: "Medium", crop: "Rice" },
      { name: "Nalgonda", residue: "Medium", crop: "Rice" },
      { name: "Narayanpet", residue: "Medium", crop: "Rice" },
      { name: "Nirmal", residue: "Medium", crop: "Rice" },
      { name: "Nizamabad", residue: "Medium", crop: "Rice" },
      { name: "Peddapalli", residue: "Medium", crop: "Rice" },
      { name: "Rajanna Sircilla", residue: "Medium", crop: "Rice" },
      { name: "Rangareddy", residue: "Medium", crop: "Rice" },
      { name: "Sangareddy", residue: "Medium", crop: "Rice" },
      { name: "Siddipet", residue: "Medium", crop: "Rice" },
      { name: "Suryapet", residue: "Medium", crop: "Rice" },
      { name: "Vikarabad", residue: "Medium", crop: "Rice" },
      { name: "Wanaparthy", residue: "Medium", crop: "Rice" },
      { name: "Warangal", residue: "Medium", crop: "Rice" },
      { name: "Yadadri Bhuvanagiri", residue: "Medium", crop: "Rice" }
    ]
  },
  "Tripura": {
    id: "TR",
    topCrops: ["Rice", "Jute", "Rubber"],
    soil: ["Red Soil"],
    residue: "Medium",
    cycles: ["Kharif"],
    districts: [
      { name: "Dhalai", residue: "Medium", crop: "Rice" },
      { name: "Gomati", residue: "Medium", crop: "Rice" },
      { name: "Khowai", residue: "Medium", crop: "Rice" },
      { name: "North Tripura", residue: "Medium", crop: "Rice" },
      { name: "Sepahijala", residue: "Medium", crop: "Rice" },
      { name: "South Tripura", residue: "Medium", crop: "Rice" },
      { name: "Unakoti", residue: "Medium", crop: "Rice" },
      { name: "West Tripura", residue: "Medium", crop: "Rice" }
    ]
  },
  "Uttar Pradesh": {
    id: "UP",
    topCrops: ["Sugarcane", "Wheat", "Potato"],
    soil: ["Alluvial", "Loam"],
    residue: "Very High (40M Tons)",
    cycles: ["Kharif: Paddy", "Rabi: Wheat"],
    districts: [
      { name: "Agra", residue: "Medium", crop: "Potato" },
      { name: "Aligarh", residue: "Medium", crop: "Sugarcane" },
      { name: "Ambedkar Nagar", residue: "Medium", crop: "Sugarcane" },
      { name: "Amethi", residue: "Medium", crop: "Sugarcane" },
      { name: "Amroha", residue: "Medium", crop: "Sugarcane" },
      { name: "Auraiya", residue: "Medium", crop: "Sugarcane" },
      { name: "Ayodhya", residue: "Medium", crop: "Sugarcane" },
      { name: "Azamgarh", residue: "Medium", crop: "Sugarcane" },
      { name: "Baghpat", residue: "Medium", crop: "Sugarcane" },
      { name: "Bahraich", residue: "Medium", crop: "Sugarcane" },
      { name: "Ballia", residue: "Medium", crop: "Sugarcane" },
      { name: "Balrampur", residue: "Medium", crop: "Sugarcane" },
      { name: "Banda", residue: "Medium", crop: "Sugarcane" },
      { name: "Barabanki", residue: "Medium", crop: "Sugarcane" },
      { name: "Bareilly", residue: "Medium", crop: "Sugarcane" },
      { name: "Basti", residue: "Medium", crop: "Sugarcane" },
      { name: "Bhadohi", residue: "Medium", crop: "Sugarcane" },
      { name: "Bijnor", residue: "Medium", crop: "Sugarcane" },
      { name: "Budaun", residue: "Medium", crop: "Sugarcane" },
      { name: "Bulandshahr", residue: "Medium", crop: "Sugarcane" },
      { name: "Chandauli", residue: "Medium", crop: "Sugarcane" },
      { name: "Chitrakoot", residue: "Medium", crop: "Sugarcane" },
      { name: "Deoria", residue: "Medium", crop: "Sugarcane" },
      { name: "Etah", residue: "Medium", crop: "Sugarcane" },
      { name: "Etawah", residue: "Medium", crop: "Sugarcane" },
      { name: "Farrukhabad", residue: "Medium", crop: "Sugarcane" },
      { name: "Fatehpur", residue: "Medium", crop: "Sugarcane" },
      { name: "Firozabad", residue: "Medium", crop: "Sugarcane" },
      { name: "Gautam Buddha Nagar", residue: "Medium", crop: "Sugarcane" },
      { name: "Ghaziabad", residue: "Medium", crop: "Sugarcane" },
      { name: "Ghazipur", residue: "Medium", crop: "Sugarcane" },
      { name: "Gonda", residue: "Medium", crop: "Sugarcane" },
      { name: "Gorakhpur", residue: "Medium", crop: "Sugarcane" },
      { name: "Hamirpur", residue: "Medium", crop: "Sugarcane" },
      { name: "Hapur", residue: "Medium", crop: "Sugarcane" },
      { name: "Hardoi", residue: "Medium", crop: "Sugarcane" },
      { name: "Hathras", residue: "Medium", crop: "Sugarcane" },
      { name: "Jalaun", residue: "Medium", crop: "Sugarcane" },
      { name: "Jaunpur", residue: "Medium", crop: "Sugarcane" },
      { name: "Jhansi", residue: "Medium", crop: "Sugarcane" },
      { name: "Kannauj", residue: "Medium", crop: "Sugarcane" },
      { name: "Kanpur Dehat", residue: "Medium", crop: "Sugarcane" },
      { name: "Kanpur Nagar", residue: "Medium", crop: "Sugarcane" },
      { name: "Kasganj", residue: "Medium", crop: "Sugarcane" },
      { name: "Kaushambi", residue: "Medium", crop: "Sugarcane" },
      { name: "Kheri", residue: "Medium", crop: "Sugarcane" },
      { name: "Kushinagar", residue: "Medium", crop: "Sugarcane" },
      { name: "Lalitpur", residue: "Medium", crop: "Sugarcane" },
      { name: "Lucknow", residue: "Medium", crop: "Sugarcane" },
      { name: "Maharajganj", residue: "Medium", crop: "Sugarcane" },
      { name: "Mahoba", residue: "Medium", crop: "Sugarcane" },
      { name: "Mainpuri", residue: "Medium", crop: "Sugarcane" },
      { name: "Mathura", residue: "Medium", crop: "Sugarcane" },
      { name: "Mau", residue: "Medium", crop: "Sugarcane" },
      { name: "Meerut", residue: "High", crop: "Sugarcane" },
      { name: "Mirzapur", residue: "Medium", crop: "Sugarcane" },
      { name: "Moradabad", residue: "Medium", crop: "Sugarcane" },
      { name: "Muzaffarnagar", residue: "Very High", crop: "Sugarcane" },
      { name: "Pilibhit", residue: "Medium", crop: "Sugarcane" },
      { name: "Pratapgarh", residue: "Medium", crop: "Sugarcane" },
      { name: "Prayagraj", residue: "Medium", crop: "Sugarcane" },
      { name: "Raebareli", residue: "Medium", crop: "Sugarcane" },
      { name: "Rampur", residue: "Medium", crop: "Sugarcane" },
      { name: "Saharanpur", residue: "Medium", crop: "Sugarcane" },
      { name: "Sambhal", residue: "Medium", crop: "Sugarcane" },
      { name: "Sant Kabir Nagar", residue: "Medium", crop: "Sugarcane" },
      { name: "Shahjahanpur", residue: "Medium", crop: "Sugarcane" },
      { name: "Shamli", residue: "Medium", crop: "Sugarcane" },
      { name: "Shravasti", residue: "Medium", crop: "Sugarcane" },
      { name: "Siddharthnagar", residue: "Medium", crop: "Sugarcane" },
      { name: "Sitapur", residue: "Medium", crop: "Sugarcane" },
      { name: "Sonbhadra", residue: "Medium", crop: "Sugarcane" },
      { name: "Sultanpur", residue: "Medium", crop: "Sugarcane" },
      { name: "Unnao", residue: "Medium", crop: "Sugarcane" },
      { name: "Varanasi", residue: "Medium", crop: "Sugarcane" }
    ]
  },
  "Uttarakhand": {
    id: "UT",
    topCrops: ["Rice", "Wheat", "Sugarcane"],
    soil: ["Mountain Soil"],
    residue: "Low",
    cycles: ["Kharif", "Rabi"],
    districts: [
      { name: "Almora", residue: "Low", crop: "Rice" },
      { name: "Bageshwar", residue: "Low", crop: "Rice" },
      { name: "Chamoli", residue: "Low", crop: "Rice" },
      { name: "Champawat", residue: "Low", crop: "Rice" },
      { name: "Dehradun", residue: "Low", crop: "Rice" },
      { name: "Haridwar", residue: "Low", crop: "Rice" },
      { name: "Nainital", residue: "Low", crop: "Rice" },
      { name: "Pauri Garhwal", residue: "Low", crop: "Rice" },
      { name: "Pithoragarh", residue: "Low", crop: "Rice" },
      { name: "Rudraprayag", residue: "Low", crop: "Rice" },
      { name: "Tehri Garhwal", residue: "Low", crop: "Rice" },
      { name: "Udham Singh Nagar", residue: "Low", crop: "Rice" },
      { name: "Uttarkashi", residue: "Low", crop: "Rice" }
    ]
  },
  "West Bengal": {
    id: "WB",
    topCrops: ["Rice", "Jute", "Potato"],
    soil: ["Alluvial Soil"],
    residue: "High",
    cycles: ["Kharif", "Rabi"],
    districts: [
      { name: "Alipurduar", residue: "Medium", crop: "Rice" },
      { name: "Bankura", residue: "Medium", crop: "Rice" },
      { name: "Birbhum", residue: "Medium", crop: "Rice" },
      { name: "Cooch Behar", residue: "Medium", crop: "Rice" },
      { name: "Dakshin Dinajpur", residue: "Medium", crop: "Rice" },
      { name: "Darjeeling", residue: "Medium", crop: "Rice" },
      { name: "Hooghly", residue: "Medium", crop: "Rice" },
      { name: "Howrah", residue: "Medium", crop: "Rice" },
      { name: "Jalpaiguri", residue: "Medium", crop: "Rice" },
      { name: "Jhargram", residue: "Medium", crop: "Rice" },
      { name: "Kalimpong", residue: "Medium", crop: "Rice" },
      { name: "Kolkata", residue: "Medium", crop: "Rice" },
      { name: "Malda", residue: "Medium", crop: "Rice" },
      { name: "Murshidabad", residue: "Medium", crop: "Rice" },
      { name: "Nadia", residue: "Medium", crop: "Rice" },
      { name: "North 24 Parganas", residue: "Medium", crop: "Rice" },
      { name: "Paschim Bardhaman", residue: "Medium", crop: "Rice" },
      { name: "Paschim Medinipur", residue: "Medium", crop: "Rice" },
      { name: "Purba Bardhaman", residue: "Medium", crop: "Rice" },
      { name: "Purba Medinipur", residue: "Medium", crop: "Rice" },
      { name: "Purulia", residue: "Medium", crop: "Rice" },
      { name: "South 24 Parganas", residue: "Medium", crop: "Rice" },
      { name: "Uttar Dinajpur", residue: "Medium", crop: "Rice" }
    ]
  },
  "Delhi": {
    id: "DL",
    topCrops: ["Wheat", "Rice", "Vegetables"],
    soil: ["Alluvial Soil"],
    residue: "Medium",
    cycles: ["Kharif", "Rabi"],
    districts: [
      { name: "Central Delhi", residue: "Low", crop: "Vegetables" },
      { name: "East Delhi", residue: "Low", crop: "Vegetables" },
      { name: "New Delhi", residue: "Low", crop: "Vegetables" },
      { name: "North Delhi", residue: "Low", crop: "Vegetables" },
      { name: "North East Delhi", residue: "Low", crop: "Vegetables" },
      { name: "North West Delhi", residue: "Medium", crop: "Wheat" },
      { name: "Shahdara", residue: "Low", crop: "Vegetables" },
      { name: "South Delhi", residue: "Low", crop: "Vegetables" },
      { name: "South East Delhi", residue: "Low", crop: "Vegetables" },
      { name: "South West Delhi", residue: "Medium", crop: "Wheat" },
      { name: "West Delhi", residue: "Medium", crop: "Wheat" }
    ]
  },
  "Jammu and Kashmir": {
    id: "JK",
    topCrops: ["Rice", "Wheat", "Maize"],
    soil: ["Mountain Soil"],
    residue: "Low",
    cycles: ["Kharif", "Rabi"],
    districts: [
      { name: "Anantnag", residue: "Low", crop: "Rice" },
      { name: "Bandipora", residue: "Low", crop: "Rice" },
      { name: "Baramulla", residue: "Low", crop: "Rice" },
      { name: "Budgam", residue: "Low", crop: "Rice" },
      { name: "Doda", residue: "Low", crop: "Maize" },
      { name: "Ganderbal", residue: "Low", crop: "Rice" },
      { name: "Jammu", residue: "Low", crop: "Wheat" },
      { name: "Kathua", residue: "Low", crop: "Wheat" },
      { name: "Kishtwar", residue: "Low", crop: "Maize" },
      { name: "Kulgam", residue: "Low", crop: "Rice" },
      { name: "Kupwara", residue: "Low", crop: "Rice" },
      { name: "Poonch", residue: "Low", crop: "Maize" },
      { name: "Pulwama", residue: "Low", crop: "Rice" },
      { name: "Rajouri", residue: "Low", crop: "Maize" },
      { name: "Ramban", residue: "Low", crop: "Maize" },
      { name: "Reasi", residue: "Low", crop: "Maize" },
      { name: "Samba", residue: "Low", crop: "Wheat" },
      { name: "Shopian", residue: "Low", crop: "Rice" },
      { name: "Srinagar", residue: "Low", crop: "Rice" },
      { name: "Udhampur", residue: "Low", crop: "Maize" }
    ]
  },
  "Ladakh": {
    id: "LA",
    topCrops: ["Barley", "Wheat", "Peas"],
    soil: ["Desert Soil"],
    residue: "Very Low",
    cycles: ["Summer"],
    districts: [
      { name: "Kargil", residue: "Very Low", crop: "Barley" },
      { name: "Leh", residue: "Very Low", crop: "Barley" }
    ]
  },
  "Puducherry": {
    id: "PY",
    topCrops: ["Rice", "Sugarcane", "Cotton"],
    soil: ["Alluvial Soil"],
    residue: "Medium",
    cycles: ["Kharif", "Rabi"],
    districts: [
      { name: "Karaikal", residue: "Medium", crop: "Rice" },
      { name: "Mahe", residue: "Medium", crop: "Rice" },
      { name: "Puducherry", residue: "Medium", crop: "Rice" },
      { name: "Yanam", residue: "Medium", crop: "Rice" }
    ]
  }
};

export const GeoMapScreen = () => {
  const [selectedState, setSelectedState] = useState(null);
  
  // Simple Zoom State
  const [position, setPosition] = useState({ coordinates: [78.9629, 22.5937], zoom: 4 });

  const handleStateClick = (geo) => {
    const rawStateName = geo.properties.NAME_1 || geo.properties.name || geo.properties.st_nm;
    const stateName = STATE_NAME_MAPPING[rawStateName] || rawStateName;
    
    if (STATE_DATA[stateName]) {
      setSelectedState(stateName);
      // Simulate Zoom In
      setPosition({ coordinates: [78.9629, 22.5937], zoom: 6 }); 
    } else {
      // Fallback for other states
      console.log('State not found in data:', rawStateName, '-> mapped to:', stateName);
      setSelectedState(stateName);
      setPosition({ coordinates: [78.9629, 22.5937], zoom: 5 });
    }
  };

  const handleReset = () => {
    setSelectedState(null);
    setPosition({ coordinates: [78.9629, 22.5937], zoom: 4 });
  };

  return (
    <div className="geo-map-container">
      
      {/* LEFT: MAP AREA */}
      <div className="map-area">
         {/* Header Overlay */}
         <div className="map-header-overlay">
             <div className="map-badge">
                <Globe size={16} /> Agri-Intelligence
             </div>
             <h1 className="map-title">
                India Geo-Map
             </h1>
             <p className="map-description">
               Click on a state to analyze crop residue clusters, soil profile, and seasonal cycles.
             </p>
         </div>

         <div className="map-canvas">
            <ComposableMap
              projection="geoMercator"
              projectionConfig={{
                scale: 1000,
                center: [78.9629, 22.5937]
              }}
              style={{ width: "100%", height: "100%" }}
            >
                <ZoomableGroup 
                    zoom={position.zoom} 
                    center={position.coordinates}
                    onMoveEnd={(pos) => setPosition(pos)}
                    minZoom={3}
                    maxZoom={10}
                >
                  <Geographies geography={INDIA_TOPO_JSON}>
                    {({ geographies }) =>
                      geographies.map((geo) => {
                        const rawStateName = geo.properties.NAME_1 || geo.properties.name || geo.properties.st_nm;
                        const stateName = STATE_NAME_MAPPING[rawStateName] || rawStateName;
                        const isSelected = selectedState === stateName;
                        const hasData = STATE_DATA[stateName];

                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            onClick={() => handleStateClick(geo)}
                            data-tooltip-id="map-tooltip"
                            data-tooltip-content={`${stateName} ${hasData ? '• Click to View' : ''}`}
                            style={{
                              default: {
                                fill: isSelected ? "#16a34a" : (hasData ? "#334155" : "#1e293b"),
                                stroke: "#64748b",
                                strokeWidth: 0.5,
                                outline: "none",
                                transition: "all 300ms cubic-bezier(0.4, 0, 0.2, 1)"
                              },
                              hover: {
                                fill: "#22c55e", // Bright green on hover
                                stroke: "#fff",
                                strokeWidth: 1.5,
                                outline: "none",
                                cursor: "pointer",
                                filter: "drop-shadow(0 0 8px rgba(34, 197, 94, 0.5))" // Glow effect
                              },
                              pressed: {
                                fill: "#15803d",
                                outline: "none"
                              }
                            }}
                          />
                        );
                      })
                    }
                  </Geographies>
                </ZoomableGroup>
            </ComposableMap>
            <Tooltip 
                id="map-tooltip" 
                style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                    color: 'white', 
                    borderRadius: '8px', 
                    padding: '8px 12px', 
                    fontSize: '12px', 
                    fontWeight: 'bold',
                    border: '1px solid rgba(255,255,255,0.1)',
                    backdropFilter: 'blur(4px)'
                }} 
            />
         </div>

         {/* Controls */}
         <div className="map-controls">
            <button onClick={() => setPosition(p => ({...p, zoom: p.zoom + 1}))} className="map-control-button">+</button>
            <button onClick={() => setPosition(p => ({...p, zoom: Math.max(2, p.zoom - 1)}))} className="map-control-button">-</button>
            <button onClick={handleReset} className="map-control-button" title="Reset View">
                <ArrowLeft size={18} />
            </button>
         </div>

         {/* Legend */}
         <div className="map-legend">
              <p className="legend-title">Data Layers</p>
              <div className="legend-item">
                  <span className="legend-color legend-low-activity"></span> Low Activity
              </div>
              <div className="legend-item">
                  <span className="legend-color legend-high-activity"></span> High Activity
              </div>
              <div className="legend-item legend-active">
                  <span className="legend-color legend-active"></span> Active/Selected
              </div>
         </div>
      </div>

      {/* RIGHT: INTELLIGENCE PANEL */}
      <div className={`intelligence-panel custom-scrollbar ${selectedState ? 'active' : ''}`}>
        
        {selectedState && STATE_DATA[selectedState] ? (
            <AnimatedContent key={selectedState} direction="horizontal" distance={20}>
                <div className="intelligence-content">
                    <div className="intelligence-header">
                         <h2 className="intelligence-state-name">{selectedState}</h2>
                         <span className="intelligence-state-id">
                            ID: {STATE_DATA[selectedState].id}
                         </span>
                    </div>

                    {/* Key Stat */}
                    <div className="key-stat-card">
                        <div className="key-stat-content">
                            <div className="key-stat-header">
                                <Sprout size={16} /> Crop Residue
                            </div>
                            <p className="key-stat-value">{STATE_DATA[selectedState].residue}</p>
                            <p className="key-stat-description">Estimated annual biomass availability</p>
                        </div>
                        <div className="key-stat-bg-icon">
                             <BarChart3 size={64} />
                        </div>
                    </div>

                    <div className="content-sections">
                        {/* Top Crops */}
                        <div>
                            <h3 className="content-section-title">
                                <Sprout size={14}/> Dominant Crops
                            </h3>
                            <div className="crops-tags">
                                {STATE_DATA[selectedState].topCrops.map((crop, i) => (
                                    <span key={i} className="crop-tag">
                                        {crop}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Soil Profile */}
                        <div>
                            <h3 className="content-section-title">
                                <Layers size={14}/> Soil Type
                            </h3>
                            <div className="soil-info">
                                <p className="soil-text">{STATE_DATA[selectedState].soil.join(", ")}</p>
                            </div>
                        </div>

                         {/* Crop Cycles */}
                        <div>
                            <h3 className="content-section-title">
                                <CloudSun size={14}/> Seasonal Cycles
                            </h3>
                            <div className="cycles-list">
                                {STATE_DATA[selectedState].cycles.map((cycle, i) => (
                                    <div key={i} className="cycle-item">
                                        <span className="cycle-indicator"></span>
                                        {cycle}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* District Breakdown Table */}
                        <div className="districts-section">
                            <h3 className="content-section-title">District-Level Insights</h3>
                            <div className="districts-list">
                                {STATE_DATA[selectedState].districts.map((dist, i) => (
                                    <div key={i} className="district-item">
                                        <div className="district-info">
                                            <h4>{dist.name}</h4>
                                            <p>{dist.crop}</p>
                                        </div>
                                        <div className={`district-risk ${
                                            dist.residue === 'Very High' ? 'very-high' : 
                                            dist.residue === 'High' ? 'high' : 'medium'
                                        }`}>
                                            {dist.residue}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </AnimatedContent>
        ) : (
             // Empty State
             <div className="empty-state">
                <div className="empty-state-icon">
                    <Globe size={40} />
                </div>
                <h2 className="empty-state-title">Waiting for Input...</h2>
                <p className="empty-state-description">
                    Select a state from the map to generate a detailed agricultural report.
                </p>
             </div>
        )}
      </div>
    </div>
  );
};