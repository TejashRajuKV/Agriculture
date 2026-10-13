import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../components/Common/Button.jsx';
import { Camera, Upload, X, Sprout, FlaskConical, Mountain, BookOpen, Lightbulb, Activity } from 'lucide-react';
import { analyzeFarmInput } from '../utils/aiWasteAnalyzer.js';
import { onVisionProgress, isVisionModelReady } from '../utils/localVision.js';
import './LearningHubScreen.css';

export const LearningHubScreen = () => {
  const [image, setImage] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [modelProgress, setModelProgress] = useState(isVisionModelReady() ? 100 : null);
  const fileInputRef = useRef(null);

  useEffect(() => onVisionProgress((p) => setModelProgress(p.ready ? 100 : p.percent)), []);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result);
        setAnalysis(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!image) return;
    setIsLoading(true);
    try {
      const result = await analyzeFarmInput(image);
      setAnalysis(result);
    } catch (e) {
      console.error('Analysis failed:', e);
      alert(`Analysis failed: ${e.message}. Check your internet connection the first time (the AI model needs to download once).`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="learning-hub-container">
      {/* Header */}
      <div className="learning-hub-header">
        <h1 className="learning-hub-title">
          <BookOpen size={32} /> Farmer Learning Hub
        </h1>
        <p className="learning-hub-subtitle">
          Take a photo of your soil, crop or fertilizer to get simple, general guidance. It is not a lab test.
        </p>
      </div>

      {/* Upload Section */}
      <div className="upload-section">
        <h2 className="upload-title">What do you want to learn about?</h2>
        
        {!image ? (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="upload-area"
          >
             <div className="upload-icons">
                <div className="upload-icon upload-icon-green">
                   <Sprout size={24} />
                </div>
                 <div className="upload-icon upload-icon-amber">
                   <Mountain size={24} />
                </div>
                 <div className="upload-icon upload-icon-blue">
                   <FlaskConical size={24} />
                </div>
             </div>
             <p className="upload-text">Tap to Scan Crop, Soil, or Fertilizer</p>
             <p className="upload-subtext">Analysed on your device – no photo is uploaded</p>
          </div>
        ) : (
           <div className="image-preview">
              <img src={image} className="preview-image" alt="Input" />
              <button 
                onClick={() => { setImage(null); setAnalysis(null); }}
                className="remove-image-btn"
              >
                <X size={20} />
              </button>
           </div>
        )}
        <input 
            type="file" 
            ref={fileInputRef} 
            className="file-input" 
            accept="image/*" 
            onChange={handleFileChange}
        />

        {image && !analysis && (
            <div className="analyze-section">
                <Button onClick={handleAnalyze} isLoading={isLoading} className="analyze-btn">
                    Analyze Image
                </Button>
                {isLoading && modelProgress !== null && modelProgress < 100 && (
                    <p className="model-progress">Downloading AI model (first time only)… {modelProgress}%</p>
                )}
            </div>
        )}
      </div>

      {/* Results Section */}
      {analysis && (
        <div className="results-section">
            
            {/* Main Info Card */}
            <div className="analysis-card">
                <div className={`analysis-header ${
                    analysis.type === 'CROP' ? 'analysis-header-crop' : 
                    analysis.type === 'SOIL' ? 'analysis-header-soil' : 
                    analysis.type === 'FERTILIZER' ? 'analysis-header-fertilizer' : 'analysis-header-unknown'
                }`}>
                    <div>
                        <div className="analysis-type">
                            {analysis.type === 'CROP' && <Sprout size={16} />}
                            {analysis.type === 'SOIL' && <Mountain size={16} />}
                            {analysis.type === 'FERTILIZER' && <FlaskConical size={16} />}
                            {analysis.type} DETECTED
                        </div>
                        <h2 className="analysis-name">{analysis.name}</h2>
                    </div>
                    {['CROP', 'SOIL'].includes(analysis.type) && analysis.healthScore !== undefined && (
                        <div className="health-score">
                             <Activity size={20} />
                             <span className="score-value score-value-text">
                                {analysis.healthScore >= 70 ? 'Looks fine' : analysis.healthScore >= 50 ? 'Keep watching' : 'Needs attention'}
                             </span>
                             <span className="score-label">{Math.round((analysis.confidence || 0) * 100)}% match</span>
                        </div>
                    )}
                </div>
                
                <div className="analysis-content">
                     {analysis.type !== 'UNKNOWN' && (analysis.confidence || 0) < 0.4 && (
                        <p className="analysis-caution" role="alert">
                            We are not sure about this photo ({Math.round((analysis.confidence || 0) * 100)}% match). Try a clear, close-up photo in daylight before relying on this.
                        </p>
                     )}
                     <p className="analysis-summary">
                        {analysis.summary}
                     </p>
                     <p className="analysis-disclaimer">
                        This is basic guidance from a photo, not a lab test or a diagnosis. For pests, diseases or what to spray, call the free Kisan Call Centre on <a href="tel:18001801551">1800-180-1551</a> or ask your nearest Krishi Vigyan Kendra (KVK).
                     </p>
                     
                     <div className="tips-section">
                        <h3 className="tips-title">
                            <Lightbulb size={20} /> Smart Tips
                        </h3>
                        <ul className="tips-list">
                            {analysis.tips.map((tip, idx) => (
                                <li key={idx} className="tip-item">
                                    <span className="tip-number">
                                        {idx + 1}
                                    </span>
                                    {tip}
                                </li>
                            ))}
                        </ul>
                     </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};