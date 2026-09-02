#!/usr/bin/env node
// build-app.js
// src/ içindeki index.html + tüm yerel script'leri tek self-contained app.html'e birleştirir.
// Böylece uygulama tek dosya olarak hem APK'ya gömülür hem de uzaktan güncellenebilir.
//
// Kullanım: node build-app.js
// Çıktı: src/app.html  (index.html'in script'leri inline edilmiş hali)
//
// Not: Uzaktan yüklenen script'ler (model-viewer gibi https://...) inline edilmez, olduğu gibi kalır.
// ES module script'leri (<script type="module" src=...>) inline edilirken type="module" korunur.

const fs = require('fs');
const path = require('path');

const SRC = __dirname + '/src';
const APP_SRC = SRC + '/app-src.html';   // asıl uygulama şablonu (script'leriyle)
const OUT = SRC + '/app.html';

// Sürüm bilgisi: kısa commit hash + tarih
let commit = 'dev';
try {
  commit = require('child_process').execSync('git rev-parse --short HEAD', { cwd: __dirname }).toString().trim() || 'dev';
} catch (e) {}
const tarih = new Date().toISOString().slice(0, 10).replace(/-/g, '');
windowAPP_VERSION = commit + '-' + tarih;

let html = fs.readFileSync(APP_SRC, 'utf8');


// <script src="X"></script> ve <script type="module" src="X"></script> etiketlerini bul ve inline et
// Sadece GÖRELİ (yerel) src'leri inline et; http(s):// ile başlayanları (uzaktan) olduğu gibi bırak.
const scriptRe = /<script\b([^>]*?)\bsrc="([^"]+)"([^>]*)><\/script>/gi;

html = html.replace(scriptRe, (match, before, src, after) => {
  // Uzaktan script ise dokunma
  if (/^https?:\/\//i.test(src)) {
    return match;
  }
  const filePath = path.join(SRC, src);
  if (!fs.existsSync(filePath)) {
    console.error('UYARI: script bulunamadı, inline edilmedi:', src);
    return match;
  }
  let code = fs.readFileSync(filePath, 'utf8');
  // </script> içeren bir kod satırı varsa (nadir) kaçışla bozulmasın diye uyar
  if (/<\/script>/i.test(code)) {
    console.error('UYARI: içinde </script> geçen dosya inline edilemez:', src);
    return match;
  }
  const isModule = /type="module"/i.test(before + after);
  const typeAttr = isModule ? ' type="module"' : '';
  return '<script' + typeAttr + '>\n' + code + '\n</script>';
});

// </head> etiketinin öncesine sürüm enjekte et (updater.js bunu okur)
const versionScript = '<script>window.APP_VERSION="' + windowAPP_VERSION + '";<\/script>';
if (html.indexOf('</head>') !== -1) {
  html = html.replace('</head>', versionScript + '\n</head>');
} else {
  html = versionScript + html;
}

fs.writeFileSync(OUT, html, 'utf8');
console.log('app.html üretildi:', OUT, '(' + (fs.statSync(OUT).size / 1024).toFixed(1) + ' KB), sürüm:', windowAPP_VERSION);
