# Öğretmen AI — Temel İskelet (8 yaş / Blok Kodlama)

Bu, Windows'ta çalışan, 8 yaş grubuna basit blok-kodlama mantığını
sesli ve yazılı sohbetle öğretmeyi hedefleyen bir başlangıç iskeletidir.
Şu an **çalışan bir demo** — gerçek AI bağlantısı ve gelişmiş ses
motoru olmadan da açılıp test edilebilir.

## İçindekiler
```
ogretmen-ai/
├── package.json      → Electron proje tanımı
├── main.js            → Electron ana süreç (pencere + AI köprüsü)
├── src/
│   ├── preload.js      → Renderer <-> Node güvenli köprü
│   ├── index.html       → Arayüz (Blockly alanı + sohbet paneli)
│   └── renderer.js      → Bloklar, basit çalıştırıcı, sohbet/ses mantığı
└── README.md
```

## Kurulum (Windows)

1. [Node.js](https://nodejs.org) kurulu olmalı (LTS sürüm yeterli).
2. Proje klasöründe:
   ```
   npm install
   npm start
   ```
   Bu, Electron'u indirir ve uygulamayı açar.

## Şu an neler çalışıyor?

- **Blok kodlama alanı**: Blockly ile "ileri git", "dön", "zıpla",
  "N kere tekrarla" blokları. Bloklar sürüklenip "Çalıştır"a
  basıldığında, karakter altta Canvas üzerinde **gerçekten** ızgara
  boyunca ilerliyor, dönüyor, engel varsa üstünden zıplayıp geçiyor;
  hedef bayrağa ulaşınca "🎉 Hedefe ulaştın!" mesajı çıkıyor.
- **Şablon (senaryo) seçici**: Üstteki açılır menüden farklı
  seviyeler/senaryolar seçilebiliyor (düz yol, köşe dönme, tekrar
  bloğu pratiği, engelli parkur, serbest alan). Yeni şablon eklemek
  kod içindeki bir diziye obje eklemek kadar basit — detay aşağıda.
- **Sohbet paneli**: Yazılı mesaj gönderilebiliyor, `main.js`
  içindeki `ai:ask` fonksiyonuna gidiyor (şu an sahte/örnek cevap
  döndürüyor — bkz. aşağıdaki "AI Bağlantısı" bölümü).
- **Ses**: Metin→ses için önce **Piper TTS** (açık kaynak, ücretsiz,
  yerel çalışan nöral ses motoru — kurulum adımları aşağıda)
  deneniyor; kurulu değilse otomatik olarak Chromium'un yerleşik
  sesine geri dönülüyor, yani kurmadan da uygulama çalışır. Ses→metin
  için Chromium'un yerleşik `SpeechRecognition` API'si kullanılıyor
  (ücretsiz ama internet gerektiriyor).
- **Uyandırma kelimesi ("amca")**: Uygulama açılır açılmaz arka
  planda hafif bir dinleyici sürekli çalışır ve sadece "amca"
  kelimesini bekler. Yeğenin "amca" dediği an tam sesli sohbet
  moduna otomatik geçilir — mikrofon butonuna basmasına gerek yok.
  Sesli sohbet başladıktan sonra döngü kendiliğinden devam eder:
  o konuşur → AI cevap verir (yazılı + sesli) → cevap bitince
  otomatik tekrar dinlemeye geçer. Mikrofon butonuna (🔴) basarak
  sesli sohbet elle durdurulabilir; durdurulduğunda "amca" dinleyicisi
  tekrar arka planda aktif olur.

## Kurulum

### 1. API anahtarını ayarla (ZORUNLU — bu olmadan çalışmaz)

Uygulama **Groq** API'sini kullanıyor (ücretsiz katmanı var).

1. https://console.groq.com adresine gir, ücretsiz hesap aç
2. API anahtarı oluştur
3. Proje klasöründeki `.env.example` dosyasını `.env` olarak kopyala:
   ```
   cp .env.example .env
   ```
4. `.env` dosyasını aç, anahtarını yaz:
   ```
   GROQ_API_KEY=gsk_buraya_kendi_anahtarin
   ```

**Anahtarı asla paylaşma.** `.gitignore` dosyası `.env`'i koruma altına
alıyor, ama yine de zip'lerken/gönderirken dikkat et.

**Model seçimi:** Varsayılan `llama-3.3-70b-versatile` (kaliteli ama
günlük limiti daha düşük). Limite takılırsan `.env` içinde
`GROQ_MODEL=llama-3.1-8b-instant` yaparak daha hızlı/yüksek limitli
modele geçebilirsin — 8 yaş seviyesi sorular için muhtemelen yeterli.

### 2. Bağımlılıkları kur ve çalıştır
```
npm install
npm start
```

### Ücretsiz limit hakkında
Groq'un ücretsiz katmanı günlük istek/token sınırlı. Tek bir çocuğun
kullanımı için fazlasıyla yeterli. Eğer limite takılırsan uygulama
"biraz bekle" diye nazik bir mesaj döndürür, çökmez.

### Konuşma hafızası (kısa vadeli)
`main.js` son 20 mesajı hafızada tutuyor, yani çocuk her soruda
sıfırdan başlamıyor — "az önce dediğin şey" gibi ifadeleri anlıyor.
Uygulama kapanınca BU kısım sıfırlanır (kasıtlı olarak basit tutuldu) —
ama aşağıdaki çocuk profili KALICI, o sıfırlanmaz.

### Çocuk profili (kalıcı hafıza — Aven çocuğu tanır)
Uygulama, çocukla ilgili öğrendiklerini `.env` ile aynı yazılabilir
konuma (`userData/child-profile.json`) kalıcı olarak kaydeder — uygulama
kapanıp açılsa da, "API Anahtarı" ile aynı klasörde durur, silinmez.

- Her ~6 mesajda bir (ayrıca ücretsiz/hızlı, ana sohbeti bekletmeyen bir
  arka plan isteğiyle) Aven, o ana kadarki konuşmaya bakıp çocuğun öğrenme
  tarzı, zorlandığı/kolay kavradığı konular ve ilgi alanları hakkında kısa
  bir özet üretip bu dosyaya yazar.
- Her yeni oturumda bu özet öğretmenin sistem talimatına otomatik eklenir
  — yani Aven çocuğu sıfırdan tanımaz, kaldığı yerden devam eder.
- Blockly'de hangi şablonun kaç kez denendiği/tamamlandığı da (AI
  gerekmeden, anında) aynı dosyaya kaydedilir.
- Bu dosyayı silmek "hafızayı sıfırlamak" anlamına gelir — Aven o
  çocuğu bir daha tanımadığı yerden başlar. Konum: Linux'ta
  `~/.config/ogretmen-ai/child-profile.json`, Windows'ta
  `%APPDATA%/ogretmen-ai/child-profile.json`.

### Öğretmenin kişiliğini değiştirmek
`main.js` içindeki `SYSTEM_PROMPT` değişkenini düzenleyerek öğretmenin
tarzını, ne öğrettiğini, nasıl konuştuğunu tamamen değiştirebilirsin.

### 2. Daha kaliteli ses — PİPER TTS (önerilen, ücretsiz)
Uygulama artık **önce Piper'ı deniyor**, kurulu değilse otomatik
olarak Chromium'un yerleşik sesine geri dönüyor — yani Piper'ı hemen
kurmasan da uygulama çalışır, ama kurunca ses çok daha doğal olur.

**Piper kurulumu (tek seferlik, ücretsiz):**

1. [Piper GitHub sayfasından](https://github.com/rhasspy/piper/releases)
   Windows için hazır `piper.exe` dosyasını indir.
2. Piper'ın resmi ses modelleri listesinden bir **Türkçe** model indir
   (örn. `tr_TR-fahrettin-medium` veya `tr_TR-dfki-medium`) —
   `.onnx` ve `.onnx.json` olmak üzere iki dosya birlikte gelir.
3. Şu klasör yapısını oluştur (proje klasörünün içinde):
   ```
   ogretmen-ai/
   └── piper/
       ├── piper.exe
       └── models/
           ├── tr_TR-model.onnx
           └── tr_TR-model.onnx.json
   ```
   (Not: `main.js` içindeki `PIPER_MODEL` sabiti `tr_TR-model.onnx`
   adını arıyor — indirdiğin dosyanın adını buna göre değiştir ya da
   `main.js`'deki yolu kendi dosya adına göre güncelle.)
4. Uygulamayı yeniden başlat (`npm start`). Artık sesler Piper'dan
   gelecek — Chromium'a göre belirgin şekilde daha doğal ve akıcı.

Piper kurulmazsa hiçbir şey bozulmaz, uygulama otomatik olarak
Chromium'un yerleşik sesiyle çalışmaya devam eder.

### 4. Daha da doğal ses (opsiyonel, ileri seviye)
İstersen ticari bulut TTS servislerine (ElevenLabs, Azure vb.)
geçilebilir — Piper'dan bile daha doğal olurlar ama ücretlidirler ve
internet gerektirirler. Günde 1-2 saatlik kullanım için Piper zaten
gayet iyi bir denge sunuyor, bu adım şart değil.

### 5. Şablon sistemi — "onlarca senaryo" için genişletme
Sol alttaki sahne artık **gerçek görsel hareket** içeriyor: karakter
ızgara üzerinde gerçekten ileri gidiyor, dönüyor, zıplayıp engelleri
aşabiliyor; hedef bayrağa ulaşınca "🎉 Hedefe ulaştın!" mesajı çıkıyor.

Bu, tek bir sabit sahne değil — `renderer.js` içindeki `TEMPLATES`
dizisinde tanımlı birden fazla **şablon (senaryo/seviye)** arasından
üstteki açılır menüden seçim yapılabiliyor. Şu an 5 örnek şablonla
başlıyor (düz yol, köşe dönme, tekrar bloğu pratiği, engelli parkur,
serbest alan). "Onlarca şablon" hedefine ulaşmak için tek gereken,
aynı formatta yeni objeler eklemek:

```js
{
  id: 'yeni-sablon-id',
  name: '6) Şablonun Görünen Adı',
  cols: 8, rows: 6,              // ızgara boyutu
  start: { x: 1, y: 1, angle: 0 }, // baslangic konumu/yonu
  goal: { x: 6, y: 4 },            // hedef bayragi (opsiyonel)
  obstacle: { x: 3, y: 4 },        // engel (opsiyonel)
  hint: 'Bu şablonda ne öğretilecek, kısa açıklama.'
}
```

**Bu şablonları kim üretecek?** Şu an mimari, senin (ya da ileride
Aven'in) bu formatta yeni obje üretip diziye eklemesine göre kuruldu
— yani Aven'i "bu JSON formatında yeni bir seviye tasarla" diye
yönlendirirsen, çıktısını buraya kopyalaman yeterli olur. Aven'in bu
formatı gerçek zamanlı, kod değiştirmeden (örn. bir JSON dosyasından
okuyarak) üretmesi istenirse, bu bir sonraki mimari adım olur — şu an
için dizi doğrudan kod içinde, elle düzenleniyor.

**Not:** "Zıpla" bloğu şu an sadece tam önündeki bir engeli aşıyor
(engel yoksa yerinde zıplama animasyonu gösteriyor). "Dön" bloğu
sadece saat yönünde 90° dönüyor (basitlik için sol/sağ ayrımı
yok) — bu, 8 yaş grubu için kafa karıştırmamak amacıyla bilinçli bir
tercih; istenirse "sağa dön"/"sola dön" olarak ikiye ayrılabilir.

## Notlar
- Blockly şu an CDN üzerinden (`unpkg.com`) yükleniyor — bu yüzden
  ilk açılışta internet gerekiyor. Tamamen offline yapmak istersen
  Blockly dosyalarını indirip `src/vendor/` gibi bir klasöre koyup
  `index.html`'deki `<script src="...">` satırını yerel yola
  çevirmen yeterli.
- Bu iskelet kasıtlı olarak sade tutuldu — amaç, mimarinin
  çalıştığını görüp üstüne katman katman eklemen.
- **"Amca" uyandırma kelimesi hakkında**: Chromium'un yerleşik
  `SpeechRecognition`'ı, sürekli (continuous) modda saatlerce
  kesintisiz çalışmak üzere tasarlanmamış — bazı Windows/Chromium
  sürümlerinde birkaç dakikada bir kendiliğinden durabiliyor.
  Kodda bunu otomatik yeniden başlatan bir mekanizma var, ama
  tamamen sorunsuz/7-24 kararlı bir uyandırma kelimesi istersen
  ileride Vosk gibi offline bir motorla (özellikle "keyword
  spotting" için eğitilmiş küçük bir model) değiştirmek daha
  sağlam olur. Ayrıca "amca" gibi kısa/yaygın bir kelime bazen
  yanlış pozitif tetiklenebilir (başka bir kelimeyle karıştırılabilir)
  — gerekirse `renderer.js` içindeki `wakeRecognition.onresult`
  bloğunda kelimeyi değiştirebilir ya da daha ayırt edici bir
  ifade ("hey öğretmen" gibi) seçebilirsin.

## Yeğenin için gerçek bir .exe kurulum dosyası üretme

Şimdiye kadar `npm start` ile çalıştırıyordun — bu, Node.js/npm bilmesi
gereken bir yöntem. Yeğenin için basit, çift tıklayınca kuran gerçek bir
Windows kurulum dosyası (.exe) üretmek için:

### 1. Gerekli paketleri kur (bir kere, internetin olduğu yerde)
```
cd ogretmen-ai
npm install
```
Bu, `electron-builder` paketini de kuracak (paketleme aracı).

### 2. Windows .exe kurulum dosyasını üret
```
npm run build:win
```
Bu komut **Ubuntu'dan bile çalışır** — electron-builder, Windows
hedefli bir kurulum dosyasını Linux üzerinde üretebiliyor (Wine'ı
arka planda otomatik kullanıyor, ayrıca Wine kurmana gerek yok, ilk
çalıştırmada kendi indirir).

### 3. Sonuç nerede?
`dist/` klasörü altında, örneğin:
```
dist/Ogretmen AI Setup 0.1.0.exe
```

Bu tek dosyayı yeğenine (USB, WhatsApp, Drive — nasıl istersen)
gönderirsin. O, dosyaya çift tıklar, normal bir Windows programı gibi
kurulur — masaüstünde kısayol, başlat menüsünde kayıt, hepsi otomatik.
Node.js/npm bilmesine hiç gerek kalmaz.

**Not:** İlk `npm run build:win` çalıştırman internet ister (Electron'un
Windows ikili dosyalarını indirmesi gerekiyor, birkaç yüz MB). Sonraki
seferler önbellekten çalıştığı için çok daha hızlı olur.

**Ubuntu için de aynı mantık:** `npm run build:linux` ile bir
`.AppImage` dosyası üretebilirsin — kendi Ubuntu makinende çift
tıklayıp çalıştırabileceğin, kurulum gerektirmeyen tek dosyalık bir
format.
