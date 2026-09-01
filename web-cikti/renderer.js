// renderer.js
// İngilizce Öğretmeni Aven - arayüz mantığı.
// Seviyeye (A1-C1) göre ders modülleri sunar, Aven robot ile sohbet ve
// sesli konuşma pratiği yapar. AI köprüsü main.js üzerinden Groq API'ye bağlanır.
// Android (Capacitor) ortamında window.ogretmenAPI yoksa doğrudan HTTP ile çalışır.

// ---------------------------------------------------------------
// 0.5 ANDROID FALLBACK (Capacitor / WebView)
// ---------------------------------------------------------------
if (!window.ogretmenAPI) {
  const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
  const GROQ_TRANSCRIBE_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
  const GROQ_MODEL = 'llama-3.1-8b-instant';
  const KEY_STORE = 'ingilizce-ogretmeni-groq-key';

  function getKey() {
    try { return localStorage.getItem(KEY_STORE) || ''; } catch (e) { return ''; }
  }

  window.ogretmenAPI = {
    speak(text) {
      try {
        if (window.speechSynthesis) {
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(text);
          u.lang = 'en-US';
          u.rate = 0.95;
          window.speechSynthesis.speak(u);
        }
      } catch (e) { /* yoksay */ }
    },
    async askAI(text, lang) {
      const key = getKey();
      if (!key) return 'API anahtarı bulunamadı. Sağ üstteki ⚙ düğmesinden Groq API anahtarını gir.';
      const system = lang === 'tr'
        ? 'Sen Aven, 8 yaş grubuna İngilizce öğreten sabırlı bir öğretmensin. Türkçe açıkla, İngilizce örnek ver.'
        : 'You are Aven, a patient English teacher for kids. Explain in simple English, give examples.';
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: text }
          ],
          temperature: 0.7
        })
      });
      if (!res.ok) throw new Error('Groq API hatası: ' + res.status);
      const data = await res.json();
      return data.choices && data.choices[0] ? data.choices[0].message.content : '';
    },
    async transcribeAudio(arrayBuffer, mimeType, language) {
      const key = getKey();
      if (!key) return '';
      const blob = new Blob([arrayBuffer], { type: mimeType || 'audio/webm' });
      const form = new FormData();
      form.append('model', 'whisper-large-v3-turbo');
      form.append('language', language || 'en');
      form.append('file', blob, 'recording.webm');
      const res = await fetch(GROQ_TRANSCRIBE_URL, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + key },
        body: form
      });
      if (!res.ok) throw new Error('Transkripsiyon hatası: ' + res.status);
      const data = await res.json();
      return data.text || '';
    },
    async getApiKeyStatus() {
      return { configured: Boolean(getKey()) };
    },
    async saveApiKey(key) {
      try { localStorage.setItem(KEY_STORE, key); return { ok: true }; }
      catch (e) { return { ok: false }; }
    }
  };
}

// ---------------------------------------------------------------
// 0. DİL (TR/EN)
// ---------------------------------------------------------------
let voiceLanguage = 'tr-TR';
try { voiceLanguage = localStorage.getItem('ingilizce-ogretmeni-voice-lang') || 'tr-TR'; } catch (e) {}

const UI_TEXT = {
  'tr-TR': {
    chatHeaderTitle: '🧑‍🏫 İngilizce Öğretmeni Aven',
    showRobotBtn: '🤖 Aven’i Göster',
    apiKeyBtn: '⚙ API Anahtarı',
    apiKeyBtnConfigured: '⚙ API Anahtarı ✓',
    apiKeyBtnTitleConfigured: 'API anahtarı kayıtlı — değiştirmek için tıkla',
    apiKeyBtnTitleUnconfigured: 'Groq API anahtarını gir',
    hideRobotBtnTitle: 'Aven’i gizle',
    teacherGreetingBubble: 'Merhaba! Ben Aven, İngilizce öğretmenin. Hangi seviyedesin?',
    micBtnStart: '🎤 Konuş',
    micBtnStartTitle: 'Aven ile sesli konuşmayı başlat',
    micBtnStop: '⏹ Durdur',
    micBtnStopTitle: 'Sesli sohbeti durdur',
    chatInputPlaceholder: 'İngilizce ya da Türkçe yaz...',
    sendBtn: 'Gönder',
    apiKeyDialogTitle: 'Groq API Anahtarı',
    apiKeyDialogDesc: 'Anahtar sadece bu bilgisayardaki .env dosyasına kaydedilir. Anahtarını kimseyle paylaşma.',
    apiKeyInputLabel: 'API anahtarı',
    cancelBtn: 'Vazgeç',
    saveBtn: 'Kaydet',
    apiKeySavedMsg: 'API anahtarı kaydedildi. Artık sorularını yanıtlayabilirim!',
    apiKeySaveFailed: 'Anahtar kaydedilemedi.',
    micPermissionMsg: 'Aven’in seni duyabilmesi için mikrofon izni vermen gerekiyor.',
    micPermissionMsg2: 'Mikrofonu kullanabilmem için izin vermen gerekiyor.',
    wakeWordHeard: '(uyandırma kelimesi duyuldu: "Aven")',
    initialGreeting: 'Merhaba! Ben Aven, İngilizce öğretmenin. “Aven” dersen ya da “Konuş” düğmesine basarsan seninle sesli konuşmaya başlarım.',
    voiceLangBtnLabel: '🌐 TR',
    voiceLangBtnTitle: 'Mikrofon ve arayüz şu an Türkçe - İngilizce\'ye geçmek için tıkla',
    levelLabel: '📚 İngilizce Seviyen',
    moduleLabel: '📖 Ders Modülleri',
    moduleVocab: '🔤 Kelime',
    moduleGrammar: '📐 Gramer',
    moduleSentences: '✍️ Cümle Kurma',
    moduleSpeaking: '🎤 Konuşma',
    moduleListening: '👂 Dinleme',
    speakBtn: '🔊 Dinle',
    checkBtn: 'Kontrol Et',
    correctMsg: '✅ Doğru!',
    wrongMsg: '❌ Tekrar dene. İpucu:',
    listeningHint: 'Aven’in söylediğini dinle, sonra ne anladığını yaz.'
  },
  'en-US': {
    chatHeaderTitle: '🧑‍🏫 English Teacher Aven',
    showRobotBtn: '🤖 Show Aven',
    apiKeyBtn: '⚙ API Key',
    apiKeyBtnConfigured: '⚙ API Key ✓',
    apiKeyBtnTitleConfigured: 'API key saved — click to change it',
    apiKeyBtnTitleUnconfigured: 'Enter your Groq API key',
    hideRobotBtnTitle: 'Hide Aven',
    teacherGreetingBubble: 'Hi! I\'m Aven, your English teacher. What level are you?',
    micBtnStart: '🎤 Talk',
    micBtnStartTitle: 'Start talking with Aven',
    micBtnStop: '⏹ Stop',
    micBtnStopTitle: 'Stop the voice chat',
    chatInputPlaceholder: 'Type in English or Turkish...',
    sendBtn: 'Send',
    apiKeyDialogTitle: 'Groq API Key',
    apiKeyDialogDesc: 'The key is only saved to the .env file on this computer. Don\'t share your key with anyone.',
    apiKeyInputLabel: 'API key',
    cancelBtn: 'Cancel',
    saveBtn: 'Save',
    apiKeySavedMsg: 'API key saved. I can answer your questions now!',
    apiKeySaveFailed: 'Could not save the key.',
    micPermissionMsg: 'I need microphone permission so Aven can hear you.',
    micPermissionMsg2: 'I need permission to use the microphone.',
    wakeWordHeard: '(wake word heard: "Aven")',
    initialGreeting: 'Hi! I\'m Aven, your English teacher. Say "Aven" or press "Talk" to start a voice conversation.',
    voiceLangBtnLabel: '🌐 EN',
    voiceLangBtnTitle: 'Microphone and UI are in English - click to switch to Turkish',
    levelLabel: '📚 Your English Level',
    moduleLabel: '📖 Lesson Modules',
    moduleVocab: '🔤 Vocabulary',
    moduleGrammar: '📐 Grammar',
    moduleSentences: '✍️ Sentence Building',
    moduleSpeaking: '🎤 Speaking',
    moduleListening: '👂 Listening',
    speakBtn: '🔊 Listen',
    checkBtn: 'Check',
    correctMsg: '✅ Correct!',
    wrongMsg: '❌ Try again. Hint:',
    listeningHint: 'Listen to what Aven says, then write what you understood.'
  }
};

function uiText(key) { return (UI_TEXT[voiceLanguage] || UI_TEXT['tr-TR'])[key] || ''; }

// ---------------------------------------------------------------
// 1. DERS İÇERİKLERİ - seviyeye (A1-C1) göre gerçek İngilizce müfredatı
// ---------------------------------------------------------------
const LESSONS = window.ENGLISH_LESSONS;

// ---------------------------------------------------------------
// 2. DOM referansları
// ---------------------------------------------------------------
const levelSelect = document.getElementById('levelSelect');
const moduleBtns = document.querySelectorAll('.module-btn');
const lessonTitle = document.getElementById('lessonTitle');
const lessonDesc = document.getElementById('lessonDesc');
const lessonBody = document.getElementById('lessonBody');
const chatLog = document.getElementById('chatLog');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const micBtn = document.getElementById('micBtn');
const teacherSpeech = document.getElementById('teacherSpeech');
const teacherStage = document.getElementById('teacherStage');
const apiKeyBtn = document.getElementById('apiKeyBtn');
const voiceLangBtn = document.getElementById('voiceLangBtn');
const showRobotBtn = document.getElementById('showRobotBtn');
const hideRobotBtn = document.getElementById('hideRobotBtn');
const apiKeyDialog = document.getElementById('apiKeyDialog');
const apiKeyForm = document.getElementById('apiKeyForm');
const apiKeyInput = document.getElementById('apiKeyInput');
const apiKeyStatus = document.getElementById('apiKeyStatus');
const cancelApiKeyBtn = document.getElementById('cancelApiKeyBtn');

let currentLevel = 'A1';
let currentModule = 'vocab';
let currentLesson = null;
let isListening = false;
let mediaRecorder = null;
let audioChunks = [];
let chatHistory = [];

// ---------------------------------------------------------------
// 3. Ders görüntüleme
// ---------------------------------------------------------------
function renderLesson() {
  const levelData = LESSONS[currentLevel];
  if (!levelData || !levelData[currentModule]) return;
  const lesson = levelData[currentModule];
  currentLesson = lesson;
  lessonTitle.textContent = lesson.title;
  lessonDesc.textContent = lesson.desc;
  lessonBody.innerHTML = '';

  if (currentModule === 'vocab') {
    lesson.items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'vocab-card';
      card.innerHTML = `<div class="vocab-word">${item.word}</div>
        <div class="vocab-tr">${item.tr}</div>
        <div class="vocab-example">“${item.example}”</div>
        <button class="speak-btn" data-speak="${item.word}">${uiText('speakBtn')}</button>`;
      lessonBody.appendChild(card);
    });
  } else if (currentModule === 'grammar') {
    lesson.items.forEach(item => {
      const box = document.createElement('div');
      box.className = 'grammar-box';
      box.innerHTML = `<div class="grammar-rule">${item.rule}</div>
        <div class="grammar-example">${item.example}</div>
        <button class="speak-btn" data-speak="${item.example}">${uiText('speakBtn')}</button>`;
      lessonBody.appendChild(box);
    });
  } else if (currentModule === 'sentences') {
    lesson.items.forEach((item, idx) => {
      const box = document.createElement('div');
      box.className = 'exercise-box';
      box.innerHTML = `<h4>${idx + 1}. ${item.prompt}</h4>
        <input class="exercise-input" type="text" placeholder="Cevabını yaz..." />
        <button class="exercise-btn" data-answer="${item.answer}">${uiText('checkBtn')}</button>
        <div class="exercise-feedback"></div>`;
      lessonBody.appendChild(box);
    });
  } else if (currentModule === 'speaking') {
    lesson.items.forEach((item, idx) => {
      const box = document.createElement('div');
      box.className = 'exercise-box';
      box.innerHTML = `<h4>${idx + 1}. ${item.prompt}</h4>
        <div class="grammar-example">Örnek: ${item.example}</div>
        <button class="speak-btn" data-speak="${item.example}">${uiText('speakBtn')}</button>
        <button class="exercise-btn" data-practice="${item.prompt}">🎤 Pratik Yap</button>`;
      lessonBody.appendChild(box);
    });
  } else if (currentModule === 'listening') {
    lesson.items.forEach((item, idx) => {
      const box = document.createElement('div');
      box.className = 'exercise-box';
      box.innerHTML = `<h4>${idx + 1}. ${uiText('listeningHint')}</h4>
        <button class="speak-btn" data-speak="${item.text}">🔊 ${uiText('speakBtn')}</button>
        <input class="exercise-input" type="text" placeholder="Ne anladığını yaz..." />
        <button class="exercise-btn" data-answer="${item.tr}">${uiText('checkBtn')}</button>
        <div class="exercise-feedback"></div>`;
      lessonBody.appendChild(box);
    });
  }

  lessonBody.querySelectorAll('[data-speak]').forEach(btn => {
    btn.addEventListener('click', () => {
      window.ogretmenAPI.speak(btn.dataset.speak);
    });
  });

  lessonBody.querySelectorAll('.exercise-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const box = btn.closest('.exercise-box');
      const feedback = box.querySelector('.exercise-feedback');
      if (btn.dataset.answer) {
        const input = box.querySelector('.exercise-input');
        const userAnswer = input.value.trim().toLowerCase();
        const correct = btn.dataset.answer.toLowerCase();
        if (userAnswer === correct) {
          feedback.textContent = uiText('correctMsg');
          feedback.className = 'exercise-feedback correct';
        } else {
          feedback.textContent = `${uiText('wrongMsg')} ${btn.dataset.answer}`;
          feedback.className = 'exercise-feedback wrong';
        }
      } else if (btn.dataset.practice) {
        askAI(`Konuşma pratiği (seviye ${currentLevel}): ${btn.dataset.practice}. Bana bu konuda İngilizce örnek cümleler ver ve benimle pratik yap.`);
      }
    });
  });
}

// ---------------------------------------------------------------
// 4. Sohbet
// ---------------------------------------------------------------
function addMsg(text, who) {
  const div = document.createElement('div');
  div.className = 'msg ' + who;
  div.textContent = text;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}

async function askAI(text) {
  addMsg(text, 'user');
  chatInput.value = '';
  const thinking = document.createElement('div');
  thinking.className = 'msg ai';
  thinking.textContent = '...';
  chatLog.appendChild(thinking);
  try {
    const reply = await window.ogretmenAPI.askAI(text, 'english');
    thinking.textContent = reply;
    teacherSpeech.textContent = reply;
    window.ogretmenAPI.speak(reply);
  } catch (e) {
    thinking.textContent = 'Hata: ' + e.message;
  }
  chatLog.scrollTop = chatLog.scrollHeight;
}

// ---------------------------------------------------------------
// 5. Sesli konuşma (mikrofon)
// ---------------------------------------------------------------
async function toggleListening() {
  if (isListening) {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    isListening = false;
    micBtn.textContent = uiText('micBtnStart');
    micBtn.classList.remove('listening');
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
    mediaRecorder.onstop = async () => {
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      const buf = await blob.arrayBuffer();
      const lang = voiceLanguage === 'en-US' ? 'en' : 'tr';
      try {
        const text = await window.ogretmenAPI.transcribeAudio(buf, 'audio/webm', lang);
        if (text && text.trim()) {
          chatInput.value = text.trim();
          askAI(text.trim());
        }
      } catch (e) {
        addMsg('Ses anlaşılamadı: ' + e.message, 'ai');
      }
      stream.getTracks().forEach(t => t.stop());
    };
    mediaRecorder.start();
    isListening = true;
    micBtn.textContent = uiText('micBtnStop');
    micBtn.classList.add('listening');
  } catch (e) {
    alert(uiText('micPermissionMsg'));
  }
}

// ---------------------------------------------------------------
// 6. API anahtarı
// ---------------------------------------------------------------
async function refreshApiKeyBtn() {
  try {
    const status = await window.ogretmenAPI.getApiKeyStatus();
    if (status && status.configured) {
      apiKeyBtn.textContent = uiText('apiKeyBtnConfigured');
      apiKeyBtn.title = uiText('apiKeyBtnTitleConfigured');
    } else {
      apiKeyBtn.textContent = uiText('apiKeyBtn');
      apiKeyBtn.title = uiText('apiKeyBtnTitleUnconfigured');
    }
  } catch (e) { /* yoksay */ }
}

apiKeyBtn.addEventListener('click', () => {
  apiKeyStatus.textContent = '';
  apiKeyInput.value = '';
  apiKeyDialog.showModal();
});
cancelApiKeyBtn.addEventListener('click', () => apiKeyDialog.close());
apiKeyForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const key = apiKeyInput.value.trim();
  if (!key) return;
  try {
    const result = await window.ogretmenAPI.saveApiKey(key);
    if (result && result.ok) {
      apiKeyStatus.textContent = uiText('apiKeySavedMsg');
      apiKeyStatus.style.color = '#1a7a3c';
      setTimeout(() => apiKeyDialog.close(), 1200);
      refreshApiKeyBtn();
    } else {
      apiKeyStatus.textContent = uiText('apiKeySaveFailed');
    }
  } catch (err) {
    apiKeyStatus.textContent = uiText('apiKeySaveFailed');
  }
});

// ---------------------------------------------------------------
// 7. Dil değiştirme
// ---------------------------------------------------------------
function applyLanguage() {
  voiceLangBtn.textContent = uiText('voiceLangBtnLabel');
  voiceLangBtn.title = uiText('voiceLangBtnTitle');
  apiKeyBtn.textContent = uiText('apiKeyBtn');
  micBtn.textContent = uiText('micBtnStart');
  micBtn.title = uiText('micBtnStartTitle');
  chatInput.placeholder = uiText('chatInputPlaceholder');
  sendBtn.textContent = uiText('sendBtn');
  showRobotBtn.textContent = uiText('showRobotBtn');
  hideRobotBtn.title = uiText('hideRobotBtnTitle');
  document.querySelector('#levelBar h2').textContent = uiText('levelLabel');
  document.querySelector('#moduleBar h3').textContent = uiText('moduleLabel');
  const mods = document.querySelectorAll('.module-btn');
  const modKeys = ['moduleVocab', 'moduleGrammar', 'moduleSentences', 'moduleSpeaking', 'moduleListening'];
  mods.forEach((m, i) => { if (modKeys[i]) m.textContent = uiText(modKeys[i]); });
  renderLesson();
}

voiceLangBtn.addEventListener('click', () => {
  voiceLanguage = voiceLanguage === 'tr-TR' ? 'en-US' : 'tr-TR';
  try { localStorage.setItem('ingilizce-ogretmeni-voice-lang', voiceLanguage); } catch (e) {}
  applyLanguage();
});

// ---------------------------------------------------------------
// 8. Robot göster/gizle
// ---------------------------------------------------------------
hideRobotBtn.addEventListener('click', () => {
  teacherStage.hidden = true;
  showRobotBtn.classList.add('visible');
});
showRobotBtn.addEventListener('click', () => {
  teacherStage.hidden = false;
  showRobotBtn.classList.remove('visible');
});

// ---------------------------------------------------------------
// 9. Olay bağlama ve başlatma
// ---------------------------------------------------------------
levelSelect.addEventListener('change', () => {
  currentLevel = levelSelect.value;
  renderLesson();
});
moduleBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    moduleBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentModule = btn.dataset.module;
    renderLesson();
  });
});
sendBtn.addEventListener('click', () => {
  const text = chatInput.value.trim();
  if (text) askAI(text);
});
chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const text = chatInput.value.trim();
    if (text) askAI(text);
  }
});
micBtn.addEventListener('click', toggleListening);

// Başlat
applyLanguage();
refreshApiKeyBtn();
renderLesson();
teacherSpeech.textContent = uiText('teacherGreetingBubble');
addMsg(uiText('initialGreeting'), 'ai');
