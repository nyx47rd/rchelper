# RC Helper - Detaylı Proje ve Yayınlama Rehberi

## 📋 Proje Genel Bilgisi

**RC Helper**, RollerCoin.com için geliştirilmiş bir Chrome Extension'dur.
- **Amaç**: Oyun seçim ekranında otomatik oyun seçimi, pas geçme, power toplama
- **Oyun Oynamaz**: Sadece "oyun seç" butonuna basar, oyunu sen oynarsın
- **Versiyon**: v2.2.17 (Manifest v3)
- **Repo**: https://github.com/nyx47rd/rchelper

---

## 🗂️ Dosya Yapısı

```
/home/ysr/rollercoinclaimer/
├── manifest.json               # Chrome extension manifest (v3)
├── content.js                  # Ana mantık - oyun seçim, auto-play, skip, widget
├── popup.js                    # Popup UI mantığı, versiyon kontrolü
├── popup.html                  # Popup arayüz HTML/CSS
├── background.js               # Background service worker
├── i18n.js                     # Çok dilli destek (TR/EN) — t(), setLang(), initLang()
├── tutorial.js                 # İnteraktif tutorial adımları + spotlight mantığı
├── tutorial.css                # Tutorial overlay stilleri + lang-btn stili
├── make_release_body.py        # Commit logunu markdown release notuna çeviren script
├── release.sh                  # Otomatik yayın scripti (bash)
├── GITHUB_CONTEXT_DETAILED.md  # Bu dosya
├── README.md                   # Türkçe kullanım kılavuzu
├── README.en.md                # İngilizce kullanım kılavuzu
├── icon16.png
├── icon48.png
├── icon128.png
└── favicon.ico
```

---

## 🔄 GitHub Yayınlama Süreci

### 1. Versiyon Mantığı (Semantic Versioning)

```
vMAJOR.MINOR.PATCH
  │     │    │
  │     │    └── Patch: Bug fix, küçük değişiklikler
  │     │
  │     -------- Minor: Yeni özellikler
  │
  ------------- Major: Breaking changes
```

### 2. Release Script Kullanımı

```bash
# Patch versiyon (2.2.1 -> 2.2.2)
bash release.sh

# Minor versiyon (2.2.1 -> 2.3.0)
bash release.sh --minor

# Major versiyon (2.2.1 -> 3.0.0)
bash release.sh --major
```

### 3. Release Script Ne Yapar?

| Adım | İşlem | Dosya(lar) |
|------|-------|-----------|
| 1 | Git tag'lerini çeker | GitHub API |
| 2 | Son versiyonu okur | `git tag --sort=-version:refname` |
| 3 | Yeni versiyon hesaplar | Auto increment |
| 4 | `manifest.json` günceller | `"version": "X.Y.Z"` |
| 5 | `popup.js` günceller | `var CURRENT_VERSION = 'X.Y.Z'` |
| 6 | `content.js` günceller | `const RC_VERSION = 'X.Y.Z'` |
| 7 | Versiyon commit'i | `chore: bump version to vX.Y.Z [skip release]` |
| 8 | Push eder | `git push origin master` |
| 9 | ZIP oluşturur | `rchelper-vX.Y.Z.zip` |
| 10 | GitHub release oluşturur | API POST /releases |
| 11 | ZIP'i release asset olarak yükler | API POST /assets |
| 12 | Başarılı olursa local ZIP'i siler | `rm -f rchelper-vX.Y.Z.zip` |

### 4. ZIP İçeriği

ZIP sadece bu dosyaları içerir:
- `manifest.json`
- `content.js`
- `popup.html`
- `popup.js`
- `background.js`
- `icon16.png`, `icon48.png`, `icon128.png`
- `favicon.ico`

**HARİÇLER**: `release.sh`, `LICENSE`, `README.md`, `*.png` ekran görüntüleri, `.github/`, `.windsurf/`, `*.zip`

### 5. GitHub Release Formatı

```markdown
RC Helper vX.Y.Z

Değişiklikler
* fix: ...
* feat: ...

---

Kurulum
1. Aşağıdaki ZIP dosyasını indir: rchelper-vX.Y.Z.zip
2. ZIP'i bir klasöre çıkar
3. Chrome'da chrome://extensions sayfasını aç
4. Sağ üstten "Geliştirici modu" aç
5. "Paketlenmemiş öğe yükle" butonuna tıkla
6. Çıkardığın rchelper klasörünü seç
```

---

## 🏗️ Kod Yapısı

### content.js - Ana Mantık

**Global Değişkenler:**
```javascript
window.autoPlayActive           // Auto-play durumu
window.gameSelectionInProgress  // Oyun seçimi devam ediyor mu?
window.skippedGames           // {gameName: timestamp} - 10dk pas
window.permanentSkippedGames  // {gameName: true} - daima pas
window.recentGames            // Son oynanan oyunlar array
window.lastSelectedGame       // Son seçilen oyun adı
```

**Ana Fonksiyonlar:**

| Fonksiyon | Açıklama |
|-----------|----------|
| `pickAndPlay()` | Oyun listesinden rastgele seçim ve tıklama |
| `getGameName(item)` | DOM element'inden oyun adını çıkarır |
| `skipToChooseGame()` | Mevcut oyunu 10dk pas geçer |
| `skipGamePermanent()` | Mevcut oyunu daima pas geçer |
| `startAutoPlay()` | Auto-play başlatır, 1sn interval kurar |
| `stopAutoPlay()` | Auto-play durdurur |
| `updateSkippedDisplay()` | UI'da pas geçilen oyunları gösterir |

**Message Handler'lar (chrome.runtime):**

```javascript
{
  'toggleAuto': (msg.on) => başlat/durdur,
  'skipGame': () => skipToChooseGame(),
  'skipGamePermanent': () => skipGamePermanent(),
  'toggleChoose': (msg.on) => autoChoose = on,
  'toggleCollect': (msg.on) => autoCollect = on,
  'toggleBreak': (msg.on) => breakReminder = on,
  'getAvailableGames': () => oyun listesini döndür,
  'addSkip': (msg.gameName) => storage'a pas ekle,
  'addPermSkip': (msg.gameName) => storage'a daima pas ekle
}
```

### popup.js - UI Mantığı

**Global Değişkenler:**
```javascript
var autoPlayState = false
var CURRENT_VERSION = '2.2.17'
var updateAvailable = false
var latestReleaseUrl = 'https://github.com/nyx47rd/rchelper/releases/latest'
```

**Ana Fonksiyonlar:**

| Fonksiyon | Açıklama |
|-----------|----------|
| `checkForUpdates()` | GitHub API'den son sürümü kontrol eder |
| `unlockAutoPlay()` | Auto-play butonunu aktif eder |
| `sendMessage(msg, callback)` | Content script'e mesaj gönderir |
| `renderGamePicker()` | Listeden oyun seçim panelini doldurur |
| `openGamePicker()` | Oyun listesi panelini açar |
| `updateSkippedGamesList()` | Pas geçilen oyunları listeler |
| `updatePermanentSkippedList()` | Daima pas geçilenleri listeler |

**Versiyon Kontrol Mantığı:**

```javascript
// GitHub API'den son release'i çeker
fetch('https://api.github.com/repos/nyx47rd/rchelper/releases/latest')

// Versiyon karşılaştırma (semver)
current = [2, 2, 1]
latest  = [2, 2, 2]  -> updateAvailable = true

// Eğer eski versiyon varsa:
- Banner göster
- Auto-play butonunu disable et
- "Güncelleme gerekiyor" tooltip göster
```

### popup.html - UI Yapısı

**Ana Bileşenler:**

```html
1. Update Banner          # Yeni sürüm uyarısı (gizli başlar)
2. Header                 # RC Helper logosu ve başlık
3. Settings Card          # Toggle'lar (Auto-Choose, Auto-Collect, Break)
4. Game Picker Panel      # Listeden oyun seçim modalı (gizli)
5. Skip/Perm/Daima Row    # Butonlar (Pas Geç, Daima Atla, Listeden Seç)
6. Auto-Play Button     # Ana toggle buton
7. Temp Skipped Card      # 10dk pas geçilenler listesi
8. Permanent Skipped Card # Daima pas geçilenler listesi
9. Footer                 # GitHub linki ve credits
```

---

## 🎯 Ana Özellikler

### 1. Auto-Play
- 1 saniyede bir kontrol eder
- `choose_game` sayfasındaysa çalışır
- `play_game` sayfasındaysa durur
- Son N oyunu tekrar seçmeme (history window)
- Coming soon ve wait durumlu oyunları atlar

### 2. Pas Geçme (Skip)
- **10dk Pas**: Seçili oyunu 10 dakika boyunca atlar
- **Daima Atla**: Oyunu kalıcı olarak engeller
- **Listeden Seç**: Oyun seçim sayfasına gitmeden popup'tan atla

### 3. Otomatik Toplama
- Gain Power butonuna otomatik basar
- Collect butonuna otomatik basar

### 4. Mola Hatırlatıcısı
- 10 dakika oyun oynama sonrası tam ekran mola sayacı
- 2.5 dakika dinlenme süresi
- Otomatik devam etme

### 5. Klavye Kısayolları
| Tuş | İşlem |
|-----|-------|
| `S` | Mevcut oyunu pas geç (10dk) |
| `P` | Mevcut oyunu daima atla |
| `A` | Auto-play toggle |
| `R` | Pas geçilen listesini temizle |

---

## 🔒 Güvenlik ve Kontroller

### Versiyon Zorlaması
- Eski versiyon varsa auto-play çalışmaz
- Banner gösterilir, güncelleme linki sunulur
- Content script ve popup aynı versiyon kontrolünü yapar

### Sender Validation
```javascript
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return;  // Sadece kendi extension
  // ...
});
```

### XSS Önlemleri
- `innerHTML` kullanılmaz, `textContent` kullanılır
- DOM oluşturma `createElement` ile yapılır
- Güvensiz string concatenation yok

---

## 🔧 Troubleshooting

### Yayınlama Sorunları

**Token Geçersiz Hatası:**
```bash
# RC_PAT ortam değişkenini kontrol et
echo ${RC_PAT}

# Eğer yeni satır karakteri varsa temizle:
CLEAN_PAT=$(echo -n "${RC_PAT}" | tr -d '\n\r')
git push "https://nyx47rd:${CLEAN_PAT}@github.com/nyx47rd/rchelper.git" master
```

**Release Zaten Var:**
- Script otomatik patch increment yapar (v2.2.1 -> v2.2.2)
- Manuel olarak tag silip tekrar denenebilir

**ZIP Oluşturma Hatası:**
- `zip` komutunun yüklü olduğundan emin ol
- `_ziptmp` klasörü otomatik oluşturulur ve silinir

---

## 📊 Son Değişiklikler (v2.2.17)

| Değişiklik | Açıklama |
|------------|----------|
| i18n sistemi | Tam TR/EN çok dil desteği (popup + widget + break) |
| Dil butonu | SVG bayraklı modern pill buton, dil değişince popup reload |
| Widget i18n | content.js'de cT() ile anlık dil güncellemesi |
| Break banner i18n | Mola ekranı tamamen çevrildi |
| Sıfırla butonu | Hover'da yazı gösteren modern reset butonu |
| Manifest | Description İngilizce yapıldı |
| Tutorial | getTutSteps sözdizimi düzeltildi |

---

## 🚀 Gelecek İyileştirmeler (Fikirler)

- [ ] Favori oyun listesi
- [ ] Oyun başına istatistik (oynama süresi, power kazancı)
- [ ] Belirli oyunları "önce dene" listesi
- [ ] Pas süresi ayarlanabilir olabilir
- [ ] Günlük/haftalık rapor

---

**Son Güncelleme**: 2026-05-23  
**Son Release**: v2.2.17  
**Sonraki Muhtemel Release**: v2.2.18 (patch) veya v2.3.0 (minor)
