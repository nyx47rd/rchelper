<div align="center">

<img src="icon128.png" width="96" height="96" alt="RC Helper Logo" style="border-radius:20px"/>

<h1>
  <img src="https://readme-typing-svg.demolab.com?font=Inter&weight=700&size=32&pause=1000&color=FF3D6B&center=true&vCenter=true&width=500&lines=RC+Helper;RollerCoin+Auto+Assistant" alt="RC Helper" />
</h1>

<p>
  <img alt="Manifest v3" src="https://img.shields.io/badge/Manifest-v3-FF3D6B?style=for-the-badge&logo=googlechrome&logoColor=white"/>
  <img alt="JavaScript" src="https://img.shields.io/badge/JavaScript-ES2020+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black"/>
  <img alt="Chrome Extension" src="https://img.shields.io/badge/Chrome-Extension-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white"/>
  <img alt="License MIT" src="https://img.shields.io/badge/License-MIT-34D399?style=for-the-badge"/>
</p>

<p><b>RollerCoin için otomatik oyun seçici, coin toplayıcı ve mola yöneticisi Chrome eklentisi.</b></p>

---

</div>

## ✦ Özellikler

| Özellik | Açıklama |
|---|---|
| **Otomatik Seç** | Oyun seçim ekranında uygun bir oyunu otomatik seçer |
| **Otomatik Topla** | Gain Power ve Collect butonlarına otomatik basar |
| **Pas Geç (10dk)** | Seçili oyunu 10 dakika boyunca atlar |
| **Daima Atla** | Seçili oyunu kalıcı olarak engeller |
| **Mola Hatırlatıcısı** | 10 dakika oynadıktan sonra 2.5 dakika mola hatırlatır |
| **Canlı İstatistik** | Oynanan oyun sayısı, süre ve saatlik tahmin gösterir |
| **Klavye Kısayolları** | `S` → Pas geç, `P` → Daima atla |

---

## ✦ Kurulum

> Eklenti henüz Chrome Web Store'da yayınlanmamıştır. Manuel kurulum gereklidir.

### Adım 1 — Dosyaları İndirin

**Seçenek A — ZIP olarak:**

1. Bu sayfada sağ üstteki **`<> Code`** butonuna tıklayın
2. **Download ZIP** seçeneğini seçin
3. ZIP dosyasını bir klasöre çıkartın

**Seçenek B — Git ile:**

```bash
git clone https://github.com/nyx47rd/rchelper.git
```

---

### Adım 2 — Chrome'a Yükleyin

1. Chrome tarayıcısında adres çubuğuna yazın:
   ```
   chrome://extensions
   ```

2. Sağ üst köşeden **"Geliştirici Modu"**nu açın

   ![Developer Mode](https://img.shields.io/badge/Geliştirici_Modu-Açık-FF3D6B?style=flat-square)

3. **"Paketlenmemiş öğe yükle"** butonuna tıklayın

4. ZIP'ten çıkardığınız **`rchelper`** klasörünü seçin

5. Eklenti listesinde **RC Helper** göründüğünde kurulum tamamdır ✓

---

### Adım 3 — Kullanmaya Başlayın

1. [rollercoin.com](https://rollercoin.com) adresine gidin
2. Sağ üst köşedeki eklenti ikonuna tıklayın
3. **Auto-Play: KAPALI** butonuna basarak otomasyonu başlatın

---

## ✦ Arayüz

<div align="center">

### Popup (Eklenti Paneli)
Eklenti ikonuna tıklayarak açılır. Ayarları buradan yönetebilirsiniz.

```
┌─────────────────────────────┐
│  ⚡ RC Helper                │
│     rollercoin.com          │
├─────────────────────────────┤
│  AYARLAR                    │
│  Otomatik Seç       ●──○    │
│  Otomatik Topla     ●──○    │
│  Mola Hatırlatıcısı ●──○    │
├─────────────────────────────┤
│  [▶ Pas Geç]  [⊘ Daima]    │
│  [▶ Auto-Play: KAPALI     ] │
├─────────────────────────────┤
│  PAS GEÇİLEN · 10DK         │
│  DAIMA ATLANAN              │
│  [🗑 Hafızayı Temizle     ]  │
└─────────────────────────────┘
```

### Float Widget (Sayfa İçi)
Sayfanın sol üstünde her zaman görünür.

```
┌────────────────────┐
│  ⚡ RC Helper       │
│     rollercoin.com │
├────────────────────┤
│  OYUN      SÜRE    │
│   24       12:34   │
├────────────────────┤
│  1 SAATTE: ~80 oyun│
├────────────────────┤
│ [▶ Pas Geç][⊘ Da.] │
└────────────────────┘
```

</div>

---

## ✦ Klavye Kısayolları

| Tuş | Eylem |
|-----|-------|
| `S` | Mevcut oyunu 10 dakika pas geç |
| `P` | Mevcut oyunu daima atla (kalıcı) |

> **Not:** Kısayollar yalnızca `rollercoin.com` üzerinde ve metin alanı odakta değilken çalışır.

---

## ✦ İzinler

| İzin | Neden Gerekli |
|---|---|
| `activeTab` | Aktif sekmedeki sayfayla etkileşim için |
| `scripting` | İçerik scriptini çalıştırmak için |
| `tabs` | Popup'tan sekmeye mesaj göndermek için |
| `storage` | Ayarları ve pas geçilen oyunları kaydetmek için |

---

## ✦ Teknik Notlar

- **Manifest v3** ile geliştirilmiştir
- Service Worker tabanlı arka plan (`background.js`)
- `chrome.storage.local` ile kalıcı durum yönetimi
- Tüm UI bileşenleri vanilla JS ile DOM'a enjekte edilir (framework yok)
- EMA (Exponential Moving Average) tabanlı saatlik oyun tahmini
- Break checker 1 saniyelik tick ile çalışır, geri sayım doğruluğu yüksektir

---

## ✦ Lisans

```
MIT License — © 2025 nyx47rd
```

<div align="center">

---

<sub>Made with ❤️ for RollerCoin players</sub>

</div>
