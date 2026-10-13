import React, { useEffect, useRef, useState } from 'react';
import { Mic, Square, Volume2 } from 'lucide-react';
import { useI18n } from '../../utils/i18n.jsx';

// Voice uses the browser's own speech features, so it needs no server or key.
// Which languages work depends on the phone: Hindi is common, Kannada and Punjabi voices are not on every device.
const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
const Recognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

export const voiceSupported = { speak: Boolean(synth), listen: Boolean(Recognition) };

// Reads a short text aloud in the chosen language. Renders nothing where speech is unavailable.
export const ReadAloud = ({ text, className = '' }) => {
  const { t, speechLang } = useI18n();
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => () => { if (speaking) synth?.cancel(); }, [speaking]);
  if (!synth || !text) return null;

  const toggle = () => {
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = speechLang;
    // Prefer a voice for the language; otherwise the browser's default will mispronounce, so say nothing rather than mislead
    const voice = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith(speechLang.slice(0, 2).toLowerCase()));
    if (voice) u.voice = voice;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    synth.cancel();
    synth.speak(u);
    setSpeaking(true);
  };

  return (
    <button type="button" className={`ui-btn ui-btn-ghost ui-btn-sm voice-btn ${className}`} onClick={toggle} aria-pressed={speaking}>
      {speaking ? <Square size={14} /> : <Volume2 size={14} />} {speaking ? t('voice.stop') : t('voice.listen')}
    </button>
  );
};

// Fills a text field from speech
export const DictateButton = ({ onText }) => {
  const { t, speechLang } = useI18n();
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);
  if (!Recognition) return null;

  const toggle = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new Recognition();
    rec.lang = speechLang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => onText(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  return (
    <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm voice-btn" onClick={toggle} aria-pressed={listening} aria-label={t('voice.speak')} title={t('voice.speak')}>
      {listening ? <Square size={14} /> : <Mic size={14} />}
    </button>
  );
};
