// updater.js
// Ingilizce Ogretmeni Aven - OTA (Over-The-Air) guncelleme kontrolu.
// Uygulama acilista GitHub'dan en son surumu kontrol eder,
// fark varsa kullaniciya bildirim gosterir, onaylayinca yeni app.html'i
// cihaz depolamasina indirip yeniden baslatir.
//
// Barindirma: GitHub 'ota' branch'i -> raw.githubusercontent.com
// Mevcut surum: window.APP_VERSION (build script enjekte eder)

(function () {
  'use strict';

  // Kullanici semihkayags9-crypto reposu; ota branch'i guncellemeleri icerir.
  var REPO = 'semihkayags9-crypto/ingilizce-ogretmeni';
  var OTA_BRANCH = 'ota';
  var VERSION_URL = 'https://raw.githubusercontent.com/' + REPO + '/' + OTA_BRANCH + '/version.json';
  var APP_URL = 'https://raw.githubusercontent.com/' + REPO + '/' + OTA_BRANCH + '/app.html';

  var VERSION_KEY = 'aven-app-version';
  var UPDATES_DIR = 'aven-updates';
  var FILE_NAME = 'app.html';

  // Build script bu degeri enjekte eder (tarih + commit hash).
  var MEVCUT_SURUM = window.APP_VERSION || '0';

  function log(msg) { try { console.log('[updater]', msg); } catch (e) {} }

  async function fetchJson(url) {
    var res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  async function fetchText(url) {
    var res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.text();
  }

  // Mevcut kullanici surumunu localStorage'dan oku; yoksa gomulu surumu kullan
  function getYerelSurum() {
    try {
      return localStorage.getItem(VERSION_KEY) || MEVCUT_SURUM;
    } catch (e) { return MEVCUT_SURUM; }
  }

  // Yeni app.html'i cihaz depolamasina yaz (DATA klasoru)
  async function yeniAppYiYaz(html) {
    var cap = window.Capacitor;
    var FS = cap && cap.Plugins && cap.Plugins.Filesystem;
    if (!FS) {
      // Web ortaminda test: localStorage'a da yaz (istatistik icin, gercek guncelleme degil)
      log('Native degil, guncelleme dosyasi yazilamadi (web modu)');
      return false;
    }
    // Klasoru olustur (varsa hata verir, yut)
    try { await FS.mkdir({ path: UPDATES_DIR, directory: 'DATA' }); } catch (e) {}
    await FS.writeFile({
      path: UPDATES_DIR + '/' + FILE_NAME,
      data: html,
      directory: 'DATA',
      encoding: 'utf8'
    });
    return true;
  }

  // Kullaniciya bildirim goster + onay al
  function bildirimGoster(yeniSurum) {
    return new Promise(function (resolve) {
      var overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;';
      var kutu = document.createElement('div');
      kutu.style.cssText = 'background:#fff;border-radius:16px;padding:24px;max-width:340px;width:90%;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,0.3);';
      kutu.innerHTML =
        '<div style="font-size:40px;margin-bottom:8px;">🔄</div>' +
        '<div style="font-size:18px;font-weight:700;color:#1a1a1a;margin-bottom:6px;">Yeni güncelleme var!</div>' +
        '<div style="font-size:14px;color:#555;margin-bottom:16px;">İngilizce Öğretmeni Aven güncellenmiş sürümü yüklendi. Şimdi uygula?</div>' +
        '<div style="display:flex;gap:10px;justify-content:center;">' +
        '<button id="upd-simdi" style="flex:1;padding:12px;background:#1a73e8;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;">Şimdi Güncelle</button>' +
        '<button id="upd-sonra" style="flex:1;padding:12px;background:#e9ecef;color:#333;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;">Sonra</button>' +
        '</div>';
      overlay.appendChild(kutu);
      document.body.appendChild(overlay);

      var simdi = kutu.querySelector('#upd-simdi');
      var sonra = kutu.querySelector('#upd-sonra');
      simdi.addEventListener('click', function () { overlay.remove(); resolve(true); });
      sonra.addEventListener('click', function () { overlay.remove(); resolve(false); });
    });
  }

  async function guncellemeyiKontrolEt() {
    try {
      // Sadece native ortamda calis (web testi icin engelleme yok, ama sessiz gec)
      var cap = window.Capacitor;
      var isNative = cap && cap.isNativePlatform && cap.isNativePlatform();

      var yerel = getYerelSurum();

      var uzak;
      try {
        uzak = await fetchJson(VERSION_URL);
      } catch (e) {
        log('Surum dosyasi alinamadi (internet yok olabilir):', e.message);
        return;
      }

      var yeniSurum = String(uzak.version || '0');
      if (yeniSurum === yerel) {
        log('Guncel surumdesin:', yeniSurum);
        return;
      }
      if (!isNative) {
        log('Native degil ama yeni surum var (gosterilmiyor):', yeniSurum);
        return;
      }

      log('Yeni surum bulundu:', yeniSurum, '(yerel:', yerel + ')');
      var onay = await bildirimGoster(yeniSurum);
      if (!onay) { log('Kullanici erteledi'); return; }

      // Yeni app.html'i indir
      var html = await fetchText(APP_URL);
      var yazildi = await yeniAppYiYaz(html);
      if (!yazildi) { log('Yazma basarisiz'); return; }

      // Surumu kaydet ve yeniden baslat
      try { localStorage.setItem(VERSION_KEY, yeniSurum); } catch (e) {}
      log('Guncelleme kuruldu:', yeniSurum);
      // Guncel app.html'i WebView'da yeniden yukle (dogrudan data yolundan)
      await appYiYenidenYukle();
    } catch (err) {
      log('Guncelleme kontrol hatasi:', err.message);
    }
  }

  // Indirilen yeni app.html'i WebView'da yukle (bootstrap'e donme, dogrudan hedefle)
  async function appYiYenidenYukle() {
    var cap = window.Capacitor;
    var FS = cap && cap.Plugins && cap.Plugins.Filesystem;
    if (!FS) { location.reload(); return; }
    try {
      var uri = await FS.getUri({ path: UPDATES_DIR + '/' + FILE_NAME, directory: 'DATA' });
      var webUrl = cap.convertFileSrc(uri.uri);
      window.location.href = webUrl;
    } catch (e) {
      log('Yeniden baslatma hatasi, reload:', e.message);
      location.reload();
    }
  }

  // Uygulama tamamen yuklendikten sonra calis
  function baslat() {
    // Uygulama arayuzunun olusmasini bekle (DOM + renderer.js basladiysa)
    var deneme = 0;
    var bekleyen = setInterval(function () {
      deneme++;
      // Arayuz hazir mi? (renderer.js'in UI icin bir element biraktigi kabul edilir)
      // Guvenli kontrol: bir kac saniye bekleyip calistir
      if (deneme >= 2) {
        clearInterval(bekleyen);
        guncellemeyiKontrolEt();
      }
    }, 1500);
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    baslat();
  } else {
    document.addEventListener('DOMContentLoaded', baslat);
  }
})();
