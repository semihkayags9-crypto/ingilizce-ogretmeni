// tts-plugin/index.js
// @capacitor/core'a bağımlılığı olmayan, doğrudan Web Speech API (speechSynthesis)
// kullanan basit bir TTS sarmalayıcı. Hem Android WebView'da hem tarayıcıda çalışır.
// Capacitor native TTS'e ihtiyaç yoktur çünkü speechSynthesis Android WebView'da desteklenir.

class TextToSpeech {
  constructor() {
    this.speechSynthesis = ('speechSynthesis' in window) ? window.speechSynthesis : null;
    this.supportedVoices = null;
    if (this.speechSynthesis) {
      // Bazı tarayıcılar sesleri asenkron yükler
      const load = () => { this.supportedVoices = this.speechSynthesis.getVoices(); };
      load();
      if (this.speechSynthesis.onvoiceschanged !== undefined) {
        this.speechSynthesis.onvoiceschanged = load;
      }
    }
  }

  isAvailable() {
    return !!this.speechSynthesis;
  }

  async speak(options) {
    if (!this.speechSynthesis) {
      throw new Error('SpeechSynthesis API not available in this browser.');
    }
    this.stop();
    const { text, lang, rate, pitch, volume } = options || {};
    const utterance = new SpeechSynthesisUtterance(text);
    if (lang) utterance.lang = lang;
    if (rate !== undefined) utterance.rate = Math.min(10, Math.max(0.1, rate));
    if (pitch !== undefined) utterance.pitch = Math.min(2, Math.max(0, pitch));
    if (volume !== undefined) utterance.volume = Math.min(1, Math.max(0, volume));
    // Dil için uygun sesi seçmeye çalış
    if (lang && this.supportedVoices && this.supportedVoices.length) {
      const match = this.supportedVoices.find(v => v.lang && v.lang.toLowerCase().startsWith(lang.toLowerCase().split('-')[0]));
      if (match) utterance.voice = match;
    }
    return new Promise((resolve, reject) => {
      utterance.onend = () => resolve();
      utterance.onerror = (e) => reject(e);
      this.speechSynthesis.speak(utterance);
    });
  }

  stop() {
    if (this.speechSynthesis) {
      this.speechSynthesis.cancel();
    }
  }

  getSupportedLanguages() {
    const voices = this.speechSynthesis ? this.speechSynthesis.getVoices() : [];
    const languages = voices.map(v => v.lang).filter((v, i, a) => a.indexOf(v) === i);
    return { languages };
  }
}

// Global olarak erişilebilir yap (renderer.js window.Capacitor.Plugins.TextToSpeech arıyor)
const instance = new TextToSpeech();
if (window.Capacitor && window.Capacitor.Plugins) {
  window.Capacitor.Plugins.TextToSpeech = instance;
} else if (window.Capacitor) {
  window.Capacitor.Plugins = window.Capacitor.Plugins || {};
  window.Capacitor.Plugins.TextToSpeech = instance;
}
// Her durumda global erişim
window.TextToSpeech = instance;

export { TextToSpeech };
export default instance;
