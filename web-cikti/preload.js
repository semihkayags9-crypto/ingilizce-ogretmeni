// preload.js
// Renderer (index.html/renderer.js) ile main.js arasinda guvenli bir kopru kurar.
// nodeIntegration kapali oldugu icin renderer'a sadece burada tanimladigimiz
// fonksiyonlar acik olur.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ogretmenAPI', {
  // Kullanicinin yazdigi/soyledigi metni AI'a gonderir, cevabi dondurur.
  // mode: 'blockly' (varsayilan) | 'python' - hangi ogretmen kimligi/muf­redati
  // kullanilacagini secer (main.js'teki buildSystemPrompt(mode)).
  askAI: (text, mode) => ipcRenderer.invoke('ai:ask', text, mode),
  // Metni Piper TTS ile sese cevirir (kurulu degilse ok:false doner,
  // renderer bu durumda Chromium'un yerlesik sesine geri doner).
  speak: (text) => ipcRenderer.invoke('tts:speak', text),
  // Sohbet gecmisini sifirlar (yeni bir ders/oturum baslatmak icin).
  resetChat: () => ipcRenderer.invoke('ai:reset'),
  // Anahtarin kendisini renderer'a vermeden sadece durumunu bildirir ve kaydeder.
  getApiKeyStatus: () => ipcRenderer.invoke('settings:get-api-key-status'),
  saveApiKey: (apiKey) => ipcRenderer.invoke('settings:save-api-key', apiKey),
  // Bir sablonun denendigini/tamamlandigini kalici cocuk-profiline bildirir
  // (kind: 'attempt' | 'completed'). AI cagirmaz, aninda/ucretsiz.
  reportTemplateProgress: (templateId, kind) => ipcRenderer.invoke('progress:template-event', templateId, kind),
  // Kaydedilmis bir ses parcasini (ArrayBuffer) Groq Whisper ile metne cevirir.
  // Electron'un icindeki ciplak Chromium'da webkitSpeechRecognition GUVENILIR
  // CALISMIYOR (Google'in bulut konusma servisi icin gereken API anahtari
  // ciplak Chromium'da yok) - bunun yerine gercek ses kaydedilip Groq'un
  // /audio/transcriptions ucuna gonderiliyor.
  transcribeAudio: (arrayBuffer, mimeType, language) => ipcRenderer.invoke('audio:transcribe', arrayBuffer, mimeType, language),
  // PYTHON MODU - gercek/calistirilabilir Python (main.js'teki "PYTHON MODU"
  // bolumune bakiniz): kurulum durumu, otomatik kurulum, gercek calistirma,
  // ders ilerlemesi - hepsi mevcut IPC deseninin (thin invoke-wrapper) AYNISI.
  getPythonStatus: () => ipcRenderer.invoke('python:get-status'),
  ensurePythonInstalled: () => ipcRenderer.invoke('python:ensure-installed'),
  runPythonCode: (code) => ipcRenderer.invoke('python:run-code', code),
  reportPythonProgress: (lessonId, kind) => ipcRenderer.invoke('progress:python-event', lessonId, kind)
});
