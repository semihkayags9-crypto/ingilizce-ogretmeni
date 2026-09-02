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
  const GROQ_MODEL = 'openai/gpt-oss-20b';
  const KEY_STORE = 'ingilizce-ogretmeni-groq-key';

  function getKey() {
    try { return localStorage.getItem(KEY_STORE) || ''; } catch (e) { return ''; }
  }

  window.ogretmenAPI = {
    speak(text, lang) {
      const rate = parseFloat(localStorage.getItem('aven-rate')) || 1.05;
      const pitch = parseFloat(localStorage.getItem('aven-pitch')) || 1.0;
      const useLang = lang || voiceLanguage;
      const doWebSpeak = () => {
        try {
          if (!window.speechSynthesis) return;
          const synth = window.speechSynthesis;
          synth.cancel();
          // İngilizce örnekler genelde tırnak içinde gelir -> onları en-US ile oku,
          // kalan açıklamayı ana dille (tr-TR) oku. Böylece İngilizce kelimeler
          // Türkçe telaffuzla okunmaz, konuşma akıcı olur.
          const parts = [];
          const re = /"([^"]*)"|'([^']*)'|“([^”]*)”/g;
          let last = 0, m;
          while ((m = re.exec(text)) !== null) {
            if (m.index > last) parts.push({ t: text.slice(last, m.index), lang: useLang });
            const q = m[1] ?? m[2] ?? m[3];
            if (q && q.trim()) parts.push({ t: q, lang: 'en-US' });
            last = re.lastIndex;
          }
          if (last < text.length) parts.push({ t: text.slice(last), lang: useLang });
          if (parts.length === 0) parts.push({ t: text, lang: useLang });
          for (const p of parts) {
            if (!p.t.trim()) continue;
            const u = new SpeechSynthesisUtterance(p.t);
            u.lang = p.lang; u.rate = rate; u.pitch = pitch;
            synth.speak(u);
          }
        } catch (e) { }
      };
      // Web Speech her ortamda (tarayıcı + Android WebView + Capacitor) çalışır.
      // Capacitor native plugin'e güvenmek yerine doğrudan speechSynthesis kullan.
      doWebSpeak();
    },
    async askAI(text, lang, contextNote, history) {
      const key = getKey();
      if (!key) return 'API anahtarı bulunamadı. Sağ üstteki ⚙ düğmesinden Groq API anahtarını gir.';
      const system = (lang === 'tr'
        ? 'Sen Aven, İngilizce öğreten sabırlı, samimi ve canlı bir öğretmensin. Öğrencinin SEVİYESİNE GÖRE (A1-A2 başlangıç, B1-B2 orta, C1 ileri) ders anlatırsın: çok basit cümlelerle başlayıp öğrenci hazır oldukça zorlaştırırsın. Her derste YENİ KELİMELER öğretirsin (kelime haznesi geniş olsun — günlük hayat, okul, aile, yemek, seyahat, iş, teknoloji, duygular, hava, spor vb. konulardan), her kelime için 2-3 gerçek örnek cümle verirsin, doğru telaffuzu gösterirsin. Öğrenciye AKTİF ALIŞTIRMA yaptırırsın: "Şimdi bu kelimeyle bir cümle kur", "Bu cümleyi İngilizce söyler misin?" gibi. Öğrencinin hatalarını nazikçe düzeltir, nedenini kısaca açıklarsın, sonra doğru halini örnekle pekiştirirsin. Bir konuyu öğrettikten sonra mutlaka KISA BİR TEKRAR/ÖZET yaparsın ve öğrenciye devam edip etmeyeceğini sorarsın. İngilizce kelime ve örnek cümleleri HER ZAMAN çift tırnak içinde ver: "apple", "Hello, how are you?" gibi. Türkçe açıklarken İngilizce örnekleri bol kullan. SADECE düz, akıcı ve samimi metinle konuş. Asla markdown (**, *, #, _, ```, listeler), token sayısı, API adı, model adı, kod parçası ya da teknik bilgi yazma. Kısa, net ve öğretici cümleler kur. Öğrenci bir kelimeyi/konuyu anlamadıysa sabırla farklı bir örnekle tekrar açıkla.'
        : 'You are Aven, a patient, warm and lively English teacher. Teach according to the student\'s LEVEL (A1-A2 beginner, B1-B2 intermediate, C1 advanced): start with very simple sentences and gently increase difficulty as the student is ready. In every lesson teach NEW WORDS (broad vocabulary — everyday life, school, family, food, travel, work, technology, emotions, weather, sports etc.), give 2-3 real example sentences for each word, and show correct pronunciation. Give ACTIVE PRACTICE: "Now make a sentence with this word", "Can you say this in English?". Correct mistakes kindly, briefly explain why, then reinforce with a correct example. After teaching a topic always give a SHORT RECAP/SUMMARY and ask the student if they want to continue. ALWAYS put English words and example sentences inside double quotes, like "apple", "Hello, how are you?". Use plenty of English examples while explaining. Speak ONLY in clean, fluent, plain text. Never use markdown (**, *, #, _, ```, lists), token counts, API names, model names, code snippets, or any technical info. Keep sentences short, clear and instructive. If the student doesn\'t understand, patiently re-explain with a different example.')
        + (contextNote ? '\n\n' + contextNote : '');
      const msgs = [{ role: 'system', content: system }];
      // Geçmiş mesajları ekle (bağlam kayması olmasın)
      if (Array.isArray(history)) {
        history.forEach(m => {
          if (m && m.role && m.content) msgs.push({ role: m.role, content: m.content });
        });
      }
      msgs.push({ role: 'user', content: text });
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: msgs,
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
    listeningHint: 'Aven’in söylediğini dinle, sonra ne anladığını yaz.',
    tabLessons: '📚 Dersler',
    tabChat: '💬 Sohbet',
    levelA1: 'A1 — Başlangıç',
    levelA2: 'A2 — Temel',
    levelB1: 'B1 — Orta',
    levelB2: 'B2 — Orta-Üstü',
    levelC1: 'C1 — İleri',
    voiceSetBtn: '🔊 Ses',
    voiceSetRatePrompt: 'Ses hızı (0.5 = yavaş, 1 = normal, 2 = hızlı):\nŞu an: ',
    voiceSetPitchPrompt: 'Ses tonu (0.5 = kalın, 1 = normal, 2 = ince):\nŞu an: ',
    voiceSetUpdated: 'Ses ayarları güncellendi: hız ',
    voiceSetUpdated2: ', ton ',
    exercisePlaceholder: 'Cevabını yaz...',
    listeningPlaceholder: 'Ne anladığını yaz...',
    speakingExample: 'Örnek: ',
    practiceBtn: '🎤 Pratik Yap',
    memoryRestored: '(Önceki oturumdan hatırlandı — bağlam korunuyor)',
    memoryResume: 'Önceki oturumda kaldığın yer: seviye ',
    memoryResume2: ', modül ',
    memoryResume3: '. Devam edebilirsin!',
    apiKeyMissing: 'API anahtarı bulunamadı. Sağ üstteki ⚙ düğmesinden Groq API anahtarını gir.',
    transcribeFailed: 'Ses anlaşılamadı: ',
    ctxResume: 'Öğrencinin kaldığı ders: seviye ',
    ctxResume2: ', modül ',
    ctxProfile: '\nÖğrencinin öğrenme profili: ',
    ctxProfile2: '. Bu profile göre ders anlat: ',
    ctxProfile3: '. Öğrenci ',
    ctxProfile4: ' ağırlıklı öğreniyor, ',
    ctxProfile5: ' destekle güçlendir.\n',
    moduleBarTitle: '📖 Ders Modülleri',
    modVocab: '🔤 Kelime',
    modGrammar: '📐 Gramer',
    modSentences: '✍️ Cümle Kurma',
    modSpeaking: '🎤 Konuşma',
    modListening: '👂 Dinleme'
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
    listeningHint: 'Listen to what Aven says, then write what you understood.',
    tabLessons: '📚 Lessons',
    tabChat: '💬 Chat',
    levelA1: 'A1 — Beginner',
    levelA2: 'A2 — Elementary',
    levelB1: 'B1 — Intermediate',
    levelB2: 'B2 — Upper-Intermediate',
    levelC1: 'C1 — Advanced',
    voiceSetBtn: '🔊 Voice',
    voiceSetRatePrompt: 'Speech rate (0.5 = slow, 1 = normal, 2 = fast):\nCurrent: ',
    voiceSetPitchPrompt: 'Voice pitch (0.5 = deep, 1 = normal, 2 = high):\nCurrent: ',
    voiceSetUpdated: 'Voice settings updated: rate ',
    voiceSetUpdated2: ', pitch ',
    exercisePlaceholder: 'Type your answer...',
    listeningPlaceholder: 'Write what you understood...',
    speakingExample: 'Example: ',
    practiceBtn: '🎤 Practice',
    memoryRestored: '(Restored from previous session — context preserved)',
    memoryResume: 'Where you left off: level ',
    memoryResume2: ', module ',
    memoryResume3: '. You can continue!',
    apiKeyMissing: 'API key not found. Click the ⚙ button in the top right to enter your Groq API key.',
    transcribeFailed: 'Could not understand audio: ',
    ctxResume: 'Student\'s last lesson: level ',
    ctxResume2: ', module ',
    ctxProfile: '\nStudent learning profile: ',
    ctxProfile2: '. Teach according to this profile: ',
    ctxProfile3: '. Student learns primarily via ',
    ctxProfile4: ', reinforce with ',
    ctxProfile5: '.\n',
    moduleBarTitle: '📖 Lesson Modules',
    modVocab: '🔤 Vocabulary',
    modGrammar: '📐 Grammar',
    modSentences: '✍️ Sentence Building',
    modSpeaking: '🎤 Speaking',
    modListening: '👂 Listening'
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
        <input class="exercise-input" type="text" placeholder="${uiText('exercisePlaceholder')}" />
        <button class="exercise-btn" data-answer="${item.answer}">${uiText('checkBtn')}</button>
        <div class="exercise-feedback"></div>`;
      lessonBody.appendChild(box);
    });
  } else if (currentModule === 'speaking') {
    lesson.items.forEach((item, idx) => {
      const box = document.createElement('div');
      box.className = 'exercise-box';
      box.innerHTML = `<h4>${idx + 1}. ${item.prompt}</h4>
        <div class="grammar-example">${uiText('speakingExample')}${item.example}</div>
        <button class="speak-btn" data-speak="${item.example}">${uiText('speakBtn')}</button>
        <button class="exercise-btn" data-practice="${item.prompt}">${uiText('practiceBtn')}</button>`;
      lessonBody.appendChild(box);
    });
  } else if (currentModule === 'listening') {
    lesson.items.forEach((item, idx) => {
      const box = document.createElement('div');
      box.className = 'exercise-box';
      box.innerHTML = `<h4>${idx + 1}. ${uiText('listeningHint')}</h4>
        <button class="speak-btn" data-speak="${item.text}">🔊 ${uiText('speakBtn')}</button>
        <input class="exercise-input" type="text" placeholder="${uiText('listeningPlaceholder')}" />
        <button class="exercise-btn" data-answer="${item.tr}">${uiText('checkBtn')}</button>
        <div class="exercise-feedback"></div>`;
      lessonBody.appendChild(box);
    });
  }

  lessonBody.querySelectorAll('[data-speak]').forEach(btn => {
    btn.addEventListener('click', () => {
      // Öğrenme stili tespiti: dinleme etkileşimini kaydet
      trackInteraction(currentModule === 'listening' ? 'listen' : currentModule);
      saveStyleToFile();
      window.ogretmenAPI.speak(btn.dataset.speak, 'en-US');
    });
  });

  lessonBody.querySelectorAll('.exercise-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      trackInteraction(currentModule);
      saveStyleToFile();
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
        const practicePrompt = voiceLanguage === 'en-US'
          ? `Speaking practice (level ${currentLevel}): ${btn.dataset.practice}. Give me English example sentences about this and practice with me.`
          : `Konuşma pratiği (seviye ${currentLevel}): ${btn.dataset.practice}. Bana bu konuda İngilizce örnek cümleler ver ve benimle pratik yap.`;
        askAI(practicePrompt);
      }
    });
  });
}

// ---------------------------------------------------------------
// 4. Sohbet
// ---------------------------------------------------------------
// AI cevabindaki markdown/kalinti karakterleri temizle -> ari, dogal metin
function cleanAiText(raw) {
  if (!raw) return '';
  let t = String(raw);
  t = t.replace(/```[\s\S]*?```/g, ' ');       // kod bloklari
  t = t.replace(/`([^`]+)`/g, '$1');            // satir ici kod
  t = t.replace(/\*\*\*([^*]+)\*\*\*/g, '$1');  // ***bold***
  t = t.replace(/\*\*([^*]+)\*\*/g, '$1');      // **bold**
  t = t.replace(/\*([^*]+)\*/g, '$1');          // *italic*
  t = t.replace(/__([^_]+)__/g, '$1');          // __text__
  t = t.replace(/_([^_]+)_/g, '$1');            // _text_
  t = t.replace(/^#{1,6}\s*/gm, '');            // baslik isaretleri
  t = t.replace(/^\s*[-*+]\s+/gm, '');          // liste madde isaretleri (basa)
  t = t.replace(/^\s*\d+[.)]\s+/gm, '');        // numarali liste
  t = t.replace(/[ \t]{2,}/g, ' ');            // fazla bosluk/tab (yeni satirlari KORU)
  t = t.replace(/[ \t]+$/gm, '');              // satir sonu bosluklar
  t = t.replace(/\n{3,}/g, '\n\n');            // fazla satir
  return t.trim();
}

function addMsg(text, who, save = true) {
  const div = document.createElement('div');
  div.className = 'msg ' + who;
  div.textContent = text;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
  // Kalıcı hafıza: mesajı chatHistory'e ekle ve localStorage'a kaydet
  if (save) {
    chatHistory.push({ role: who === 'user' ? 'user' : 'assistant', content: text });
    saveMemory();
  }
}

// ---- Kalıcı hafıza (localStorage) ----
const MEM_KEYS = {
  history: 'aven-memory-history',
  context: 'aven-memory-last-context',
};

const MEM_FILE = 'aven-memory.json';

// Gerçek dosyaya yaz (Capacitor Filesystem - Android'de kalıcı) + localStorage yedeği
function saveMemory() {
  try {
    // Mesajlar + kaldığı ders birlikte tek objede sakla
    const payload = {
      messages: chatHistory.slice(-12),
      level: currentLevel,
      module: currentModule,
    };
    const data = JSON.stringify(payload);
    localStorage.setItem(MEM_KEYS.history, data);
    // Capacitor Filesystem varsa gerçek dosyaya yaz (kalıcı depo)
    const FS = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem;
    if (FS) {
      FS.writeFile({ path: MEM_FILE, data, directory: 'DOCUMENTS', encoding: 'utf8' })
        .then(() => {}).catch(() => {});
    }
  } catch (e) {}
}

function loadMemory() {
  try {
    // Önce gerçek dosyadan okumayı dene (kalıcı depo), yoksa localStorage
    const FS = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem;
    if (FS) {
      FS.readFile({ path: MEM_FILE, directory: 'DOCUMENTS', encoding: 'utf8' })
        .then(r => { if (r.data) hydrateMemory(r.data); })
        .catch(() => { const h = localStorage.getItem(MEM_KEYS.history); if (h) hydrateMemory(h); });
    } else {
      const h = localStorage.getItem(MEM_KEYS.history);
      if (h) hydrateMemory(h);
    }
  } catch (e) {
    try { const h = localStorage.getItem(MEM_KEYS.history); if (h) hydrateMemory(h); } catch (e2) {}
  }
}

// Okunan JSON hafızayı arayüze geri yükle (önceki oturum son 4 mesajı ekranda görünür)
function hydrateMemory(data) {
  try {
    const obj = JSON.parse(data);
    // Eski format (düz dizi) ile yeni format (obje) uyumlu olsun
    const msgs = Array.isArray(obj) ? obj : (obj.messages || []);
    chatHistory = msgs;
    // Kaldığı son ders modülünü geri yükle (öncelik: dosyadaki context)
    let lastLvl = null, lastMod = null;
    if (!Array.isArray(obj)) { lastLvl = obj.level; lastMod = obj.module; }
    if (!lastLvl) lastLvl = localStorage.getItem('aven-last-level');
    if (!lastMod) lastMod = localStorage.getItem('aven-last-module');
    if (lastLvl && lastMod && LESSONS[lastLvl] && LESSONS[lastLvl][lastMod]) {
      currentLevel = lastLvl;
      currentModule = lastMod;
    }
    // Önceki oturumun son 4 mesajını ekranda göster (bağlam kayması olmasın)
    const last4 = chatHistory.slice(-4);
    if (last4.length && typeof chatLog !== 'undefined' && chatLog) {
      last4.forEach(m => {
        if (m && m.content) addMsg(m.content, m.role === 'assistant' ? 'ai' : 'user', false);
      });
    }
  } catch (e) {}
}

function saveLastContext() {
  try {
    localStorage.setItem(MEM_KEYS.context, JSON.stringify({
      level: currentLevel,
      module: currentModule,
    }));
    localStorage.setItem('aven-last-level', currentLevel);
    localStorage.setItem('aven-last-module', currentModule);
    // Seviye/modül değiştiğinde dosyaya da yaz (veri temizlense bile kalsın)
    saveMemory();
  } catch (e) {}
}

// =============================================================
// Öğrenme stili profili (kişilik analizi → adaptif eğitim modeli)
// Kullanıcının etkileşimlerini izler, kural tabanlı olarak nasıl
// öğrendiğini (görsel/işitsel/kinestetik/okuma-yazma) tespit eder.
// Sonuçlar localStorage + dosyada saklanır, AI'ya bağlam olarak verilir.
// =============================================================
const STYLE_KEYS = {
  profile: 'aven-learner-style',
  stats: 'aven-learner-stats',
};

function loadStyleStats() {
  try { return JSON.parse(localStorage.getItem(STYLE_KEYS.stats) || '{}'); }
  catch (e) { return {}; }
}

function saveStyleStats(s) {
  try { localStorage.setItem(STYLE_KEYS.stats, JSON.stringify(s)); }
  catch (e) {}
}

// Bir modül/değerlendirme etkileşimini kaydet
function trackInteraction(kind) {
  // Modül adını öğrenme stili anahtarına eşle (listen/speak/write/vocab/grammar)
  const map = { listening: 'listen', speaking: 'speak', sentences: 'write', vocab: 'vocab', grammar: 'grammar' };
  const key = map[kind] || kind;
  const s = loadStyleStats();
  s[key] = (s[key] || 0) + 1;
  // Son 40 etkileşim penceresi içinde oranlar anlamlı olsun
  const total = Object.values(s).reduce((a, b) => a + b, 0);
  saveStyleStats(s);
  return s;
}

// Kural tabanlı öğrenme stili analizi
function analyzeLearningStyle() {
  const s = loadStyleStats();
  const listen = s.listen || 0;       // Dinleme tıklaması (işitsel)
  const speak = s.speak || 0;        // Konuşma pratiği (kinestetik)
  const write = s.write || s.sentence || s.sentences || 0;  // Cümle kurma (okuma-yazma)
  const vocab = s.vocab || 0;        // Kelime kartı görüntüleme (görsel)
  const grammar = s.grammar || 0;    // Gramer kuralı (mantıksal/kurallı)
  const total = listen + speak + write + vocab + grammar;
  if (total < 3) return null; // yeterli veri yok

  const ratio = { listen, speak, write, vocab, grammar };
  const sorted = Object.entries(ratio).sort((a, b) => b[1] - a[1]);
  const primary = sorted[0][0];
  const secondary = sorted[1] ? sorted[1][0] : primary;

  const MAP = {
    listen:   voiceLanguage === 'en-US'
      ? { desc: 'Auditory (learns by hearing)', coach: 'Say words and sentences aloud, give listening exercises.', primary: 'listening', secondary: 'visual' }
      : { desc: 'İşitsel (duyarak öğrenir)',            coach: 'Kelimeleri ve cümleleri sesli söyle, dinleme egzersizleri ver.',             primary: 'dinleme',  secondary: 'görsel' },
    speak:    voiceLanguage === 'en-US'
      ? { desc: 'Kinesthetic (learns by doing)', coach: 'Have them practice speaking, build sentences, apply actively.', primary: 'speaking', secondary: 'listening' }
      : { desc: 'Kinestetik (yaparak öğrenir)',         coach: 'Konuşma pratiği yaptır, cümle kurmasını iste, aktif uygulat.',             primary: 'konuşma',  secondary: 'dinleme' },
    write:    voiceLanguage === 'en-US'
      ? { desc: 'Reading-writing (learns by writing)', coach: 'Have them write sentences, give fill-in-the-blank and translation exercises.', primary: 'writing', secondary: 'grammar' }
      : { desc: 'Okuma-yazma (yazarak öğrenir)',        coach: 'Cümleleri yazdır, boşluk doldurma ve çeviri egzersizleri ver.',            primary: 'yazma',    secondary: 'gramer' },
    vocab:    voiceLanguage === 'en-US'
      ? { desc: 'Visual (learns by seeing)', coach: 'Use flashcards, pictures and example sentences for visual presentation.', primary: 'visual', secondary: 'listening' }
      : { desc: 'Görsel (görerek öğrenir)',             coach: 'Kelime kartları, resim/örnek cümlelerle görsel sunum yap.',                primary: 'görsel',   secondary: 'dinleme' },
    grammar:  voiceLanguage === 'en-US'
      ? { desc: 'Logical (learns by rules)', coach: 'Explain grammar rules step by step, give structured examples.', primary: 'logical', secondary: 'writing' }
      : { desc: 'Mantıksal (kurallarla öğrenir)',       coach: 'Gramer kurallarını adım adım açıkla, yapılandırılmış örnekler ver.',       primary: 'mantıksal', secondary: 'yazma' },
  };
  const p = MAP[primary] || MAP.vocab;
  return { desc: p.desc, coach: p.coach, primary: p.primary, secondary: p.secondary };
}

// Öğrenme stili profilini kalıcı dosyaya da yaz (veri temizlense kalsın)
function saveStyleToFile() {
  try {
    const data = JSON.stringify({ stats: loadStyleStats() });
    localStorage.setItem(STYLE_KEYS.profile, JSON.stringify(analyzeLearningStyle()));
    const FS = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem;
    if (FS) FS.writeFile({ path: 'aven-style.json', data, directory: 'DOCUMENTS', encoding: 'utf8' }).then(() => {}).catch(() => {});
  } catch (e) {}
}

function buildContextPrompt() {
  // Önceki oturumdan kalan bağlam ve son 4 mesajı AI'ya bağlam olarak ver
  let ctx = '';
  try {
    const lastCtx = JSON.parse(localStorage.getItem(MEM_KEYS.context) || '{}');
    if (lastCtx.level) {
      ctx += uiText('ctxResume') + lastCtx.level + uiText('ctxResume2') + lastCtx.module + '. ';
    }
  } catch (e) {}
  // Öğrenme stili profilini AI'ya tanıt (kişilik analizi → adaptif eğitim modeli)
  const style = analyzeLearningStyle();
  if (style) {
    ctx += uiText('ctxProfile') + style.desc + uiText('ctxProfile2') + style.coach + uiText('ctxProfile3') + style.primary + uiText('ctxProfile4') + style.secondary + uiText('ctxProfile5');
  }
  // Mevcut dersin içeriğini AI'ya ver → o derse özel "birebir" ders anlatsın
  try {
    const levelData = LESSONS[currentLevel];
    const lesson = levelData && levelData[currentModule];
    if (lesson && lesson.title) {
      ctx += `\nŞU ANKİ DERS: seviye ${currentLevel}, ${lesson.title}` + (lesson.desc ? ` (${lesson.desc})` : '') + '. ';
      if (Array.isArray(lesson.items) && lesson.items.length) {
        ctx += 'Bu dersteki kelimeler/örnekler: ';
        const wlist = lesson.items.slice(0, 25).map(it => it.word + ' = ' + (it.tr || '') + (it.example ? ' ("' + it.example + '")' : '')).join(', ');
        ctx += wlist + '. Bu dersteki kelimeleri öğret, örnek cümlelerle pekiştir, öğrenciyle bu kelimeler üzerinden pratik yap.\n';
      }
    }
  } catch (e) {}
  // chatHistory zaten last-8 içeriyor; son 4'ünü ayrıca bağlam olarak ekle
  if (chatHistory.length > 0) {
    const last4 = chatHistory.slice(-4).map(m => `${m.role}: ${m.content}`).join('\n');
    const contNote = voiceLanguage === 'en-US'
      ? '\nContinuing from previous conversation (keep context):\n'
      : '\nÖnceki konuşmadan devam (bağlam kayması olmasın):\n';
    ctx += contNote + last4 + '\n';
  }
  return ctx;
}

async function askAI(text) {
  addMsg(text, 'user');
  chatInput.value = '';
  const thinking = document.createElement('div');
  thinking.className = 'msg ai';
  thinking.textContent = '...';
  chatLog.appendChild(thinking);
  try {
    // Bağlam bilgisi + son mesaj geçmişi
    const contextNote = buildContextPrompt();
    const reply = await window.ogretmenAPI.askAI(text, voiceLanguage === 'en-US' ? 'en' : 'tr', contextNote, chatHistory.slice(-6));
    const cleanReply = cleanAiText(reply);
    addMsg(cleanReply, 'ai');
    thinking.remove();
    teacherSpeech.textContent = cleanReply;
    window.ogretmenAPI.speak(cleanReply, voiceLanguage);
  } catch (e) {
    thinking.textContent = uiText('apiKeyMissing');
  }
  chatLog.scrollTop = chatLog.scrollHeight;
  saveLastContext();
}

// ---------------------------------------------------------------
// 5. Sesli konuşma (mikrofon)
// ---------------------------------------------------------------
async function toggleListening() {
  if (isListening) { _stopVoice(); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    _startVoice(stream);
  } catch (e) { alert(uiText('micPermissionMsg')); }
}

let audioCtx = null;
let analyser = null;
let silentMs = 0;
let speaking = false;
let lastLevel = 0;
let voiceStream = null;

function _startVoice(stream) {
  if (voiceStream) { voiceStream.getTracks().forEach(t => t.stop()); }  // eski stream'i kapat
  voiceStream = stream;
  isListening = true;
  micBtn.textContent = uiText('micBtnStop');
  micBtn.classList.add('listening');
  audioChunks = [];
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (!analyser) {
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.6;
    }
    const src = audioCtx.createMediaStreamSource(stream);
    src.connect(analyser);
  } catch (e) {}
  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
  mediaRecorder.onstop = async () => {
    const blob = new Blob(audioChunks, { type: 'audio/webm' });
    const buf = await blob.arrayBuffer();
    const lang = voiceLanguage === 'en-US' ? 'en' : 'tr';
    try {
      const text = await window.ogretmenAPI.transcribeAudio(buf, 'audio/webm', lang);
      audioChunks = [];
      if (text && text.trim()) { chatInput.value = text.trim(); askAI(text.trim()); }
    } catch (e) { addMsg(uiText('transcribeFailed') + e.message, 'ai'); }
    // Konuşma modu açıksa otomatik yeniden dinlemeye başla (sürekli sohbet)
    if (isListening) {
      setTimeout(async () => {
        try {
          const s = await navigator.mediaDevices.getUserMedia({ audio: true });
          _startVoice(s);
        } catch (e) {}
      }, 500);
    }
  };
  mediaRecorder.start();
  // Ses seviyesini örnekle; 1.2 sn sessizlik olunca otomatik gönder
  const buf = new Uint8Array(analyser ? analyser.frequencyBinCount : 0);
  const checkTimer = setInterval(() => {
    if (!isListening) { clearInterval(checkTimer); return; }
    let level = 0;
    if (analyser) {
      analyser.getByteFrequencyData(buf);
      let sum = 0; for (let i = 0; i < buf.length; i++) sum += buf[i];
      level = sum / buf.length;
    }
    if (level > 18) { speaking = true; silentMs = 0; }
    else if (speaking) { silentMs += 120; if (silentMs >= 1200) {
      clearInterval(checkTimer);
      if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    } }
    lastLevel = level;
  }, 120);
}

function _stopVoice() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  isListening = false;
  micBtn.textContent = uiText('micBtnStart');
  micBtn.classList.remove('listening');
  if (voiceStream) { voiceStream.getTracks().forEach(t => t.stop()); voiceStream = null; }
}

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

  // --- Eksik kalan sabit metinleri de güncelle ---
  // Chat başlığı
  const chatHeaderTitleEl = document.getElementById('chatHeaderTitle');
  if (chatHeaderTitleEl) chatHeaderTitleEl.textContent = uiText('chatHeaderTitle');
  // Mobil sekmeler
  const tabLessons = document.getElementById('tabLessons');
  if (tabLessons) tabLessons.textContent = uiText('tabLessons');
  const tabChat = document.getElementById('tabChat');
  if (tabChat) tabChat.textContent = uiText('tabChat');
  // Seviye seçenekleri
  const optA1 = document.getElementById('optA1'); if (optA1) optA1.textContent = uiText('levelA1');
  const optA2 = document.getElementById('optA2'); if (optA2) optA2.textContent = uiText('levelA2');
  const optB1 = document.getElementById('optB1'); if (optB1) optB1.textContent = uiText('levelB1');
  const optB2 = document.getElementById('optB2'); if (optB2) optB2.textContent = uiText('levelB2');
  const optC1 = document.getElementById('optC1'); if (optC1) optC1.textContent = uiText('levelC1');
  // API anahtarı dialogu
  const apiKeyTitle = document.getElementById('apiKeyTitle'); if (apiKeyTitle) apiKeyTitle.textContent = uiText('apiKeyDialogTitle');
  const apiKeyDesc = document.getElementById('apiKeyDesc'); if (apiKeyDesc) apiKeyDesc.textContent = uiText('apiKeyDialogDesc');
  const apiKeyInputLabel = document.getElementById('apiKeyInputLabel'); if (apiKeyInputLabel) apiKeyInputLabel.textContent = uiText('apiKeyInputLabel');
  const cancelApiKeyBtnEl = document.getElementById('cancelApiKeyBtn'); if (cancelApiKeyBtnEl) cancelApiKeyBtnEl.textContent = uiText('cancelBtn');
  const saveApiKeyBtnEl = document.getElementById('saveApiKeyBtn'); if (saveApiKeyBtnEl) saveApiKeyBtnEl.textContent = uiText('saveBtn');
  // Ses butonu
  const voiceSetBtnEl = document.getElementById('voiceSetBtn'); if (voiceSetBtnEl) voiceSetBtnEl.textContent = uiText('voiceSetBtn');
  // Ders modülleri (moduleLabel/moduleVocab zaten yukarıda .module-btn ile güncelleniyor)
  const moduleBarTitle = document.getElementById('moduleBarTitle'); if (moduleBarTitle) moduleBarTitle.textContent = uiText('moduleLabel');
  // Öğretmen balonu
  teacherSpeech.textContent = uiText('teacherGreetingBubble');
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
    trackInteraction(currentModule);
    saveStyleToFile();
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

// Ses hızı/tonu ayarı
const voiceSetBtn = document.getElementById('voiceSetBtn');
if (voiceSetBtn) {
  voiceSetBtn.addEventListener('click', () => {
    let curRate = 1.0, curPitch = 1.0;
    try {
      curRate = parseFloat(localStorage.getItem('aven-rate')) || 1.0;
      curPitch = parseFloat(localStorage.getItem('aven-pitch')) || 1.0;
    } catch (e) {}
    const rate = prompt(uiText('voiceSetRatePrompt') + curRate, curRate);
    if (rate !== null && !isNaN(parseFloat(rate))) {
      const r = Math.min(2, Math.max(0.5, parseFloat(rate)));
      localStorage.setItem('aven-rate', r);
    }
    const pitch = prompt(uiText('voiceSetPitchPrompt') + curPitch, curPitch);
    if (pitch !== null && !isNaN(parseFloat(pitch))) {
      const p = Math.min(2, Math.max(0.5, parseFloat(pitch)));
      localStorage.setItem('aven-pitch', p);
    }
    try { window.ogretmenAPI.speak(uiText('voiceSetUpdated') + (localStorage.getItem('aven-rate')||'1') + uiText('voiceSetUpdated2') + (localStorage.getItem('aven-pitch')||'1'), voiceLanguage); } catch (e) {}
  });
}

// Mobil sekmeler
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const target = document.getElementById(btn.dataset.tab);
    document.querySelectorAll('#lessonArea, #chatPanel').forEach(p => p.classList.remove('tab-active'));
    if (target) target.classList.add('tab-active');
  });
});

// Başlat
loadMemory();
applyLanguage();
refreshApiKeyBtn();
renderLesson();
teacherSpeech.textContent = uiText('teacherGreetingBubble');
addMsg(uiText('initialGreeting'), 'ai');
