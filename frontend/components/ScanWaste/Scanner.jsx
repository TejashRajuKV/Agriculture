import React, { useState, useRef, useEffect } from 'react';
import { analyzeCropWaste } from '../../utils/aiWasteAnalyzer.js';
import { preloadVisionModel, onVisionProgress, isVisionModelReady } from '../../utils/localVision.js';
import { resizeImageFile } from '../../utils/image.js';
import { useToast } from '../Common/Toast.jsx';

export const Scanner = ({ onScanComplete, onCancel }) => {
  const toast = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [model, setModel] = useState({ ready: isVisionModelReady(), percent: 0, error: '' });
  const fileInputRef = useRef(null);

  // Start downloading the on-device model as soon as the scanner opens
  useEffect(() => {
    const off = onVisionProgress((p) => setModel((m) => ({ ...m, ...p })));
    preloadVisionModel()
      .then(() => setModel((m) => ({ ...m, ready: true })))
      .catch((e) => setModel((m) => ({ ...m, error: e.message })));
    return off;
  }, []);

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;

    setIsAnalyzing(true);
    try {
      const base64Image = await resizeImageFile(file);
      const analysis = await analyzeCropWaste(base64Image);
      onScanComplete(base64Image, analysis);
    } catch (error) {
      console.error('Analysis failed:', error);
      toast.error(`Could not analyse the photo: ${error.message}. Please try another photo.`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div style={{ 
      position: 'fixed', 
      inset: 0, 
      background: 'rgba(0,0,0,0.8)', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      zIndex: 200, // above the sticky app header
      padding: '20px'
    }}>
      <div style={{ 
        background: 'white', 
        borderRadius: '20px', 
        padding: '40px', 
        maxWidth: '500px', 
        width: '100%',
        textAlign: 'center'
      }}>
        <h2 style={{ marginBottom: '20px', color: '#1f2937' }}>Scan Crop Waste</h2>
        
        {!isAnalyzing ? (
          <>
            <p style={{ color: '#6b7280', marginBottom: '20px' }}>
              Upload a photo of your crop residue. It is analysed on your phone – nothing is uploaded.
            </p>

            <ModelStatus model={model} />

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{ 
                  padding: '12px 24px', 
                  background: '#16a34a', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '8px', 
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Choose Image
              </button>
              
              <button
                onClick={onCancel}
                style={{ 
                  padding: '12px 24px', 
                  background: '#6b7280', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '8px', 
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <div>
            <p style={{ color: '#16a34a', fontSize: '18px', fontWeight: 'bold' }}>
              {model.ready ? 'Analyzing image...' : `Downloading AI model… ${model.percent}%`}
            </p>
            <div style={{ 
              width: '40px', 
              height: '40px', 
              border: '4px solid #e5e7eb', 
              borderTop: '4px solid #16a34a', 
              borderRadius: '50%', 
              animation: 'spin 1s linear infinite',
              margin: '20px auto'
            }}></div>
          </div>
        )}
      </div>
      
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

// One-time model download status (cached by the browser afterwards)
const ModelStatus = ({ model }) => {
  if (model.error) {
    return (
      <p style={{ color: '#b91c1c', fontSize: '13px', marginBottom: '20px' }}>
        Could not download the AI model: {model.error}. Check your internet connection and reopen the scanner.
      </p>
    );
  }
  if (!model.ready && model.percent >= 100) {
    return (
      <p style={{ color: '#6b7280', fontSize: '13px', marginBottom: '20px' }}>
        Loading AI model…
      </p>
    );
  }
  if (model.ready) {
    return (
      <p style={{ color: '#047857', fontSize: '13px', fontWeight: 600, marginBottom: '20px' }}>
        ✓ AI model ready (works offline)
      </p>
    );
  }
  return (
    <div style={{ marginBottom: '20px' }}>
      <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 6px' }}>
        Downloading AI model (first time only)… {model.percent}%
        {model.totalMB ? ` of ${Math.round(model.totalMB)} MB` : ''}
      </p>
      <div style={{ height: '6px', background: '#e5e7eb', borderRadius: '99px', overflow: 'hidden' }}>
        <div style={{ width: `${model.percent}%`, height: '100%', background: '#16a34a', transition: 'width 0.3s' }} />
      </div>
    </div>
  );
};