<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=FF3D6B&height=200&section=header&text=RC%20Helper&fontSize=72&fontColor=ffffff&fontAlignY=45&animation=fadeIn" width="100%"/>

<img src="favicon.ico" width="48" height="48" alt="RC Helper Icon"/>

</div>

<div align="center">

<img src="https://readme-typing-svg.demolab.com?font=Inter&weight=700&size=22&pause=1200&color=FF3D6B&center=true&vCenter=true&width=600&lines=Otomatik+oyun+secici+%E2%86%92+daha+fazla+guc;Coin+toplama+otomasyonu;Mola+hatirlaticisi+ile+saglikli+oyun;Klavye+kisayollari+ile+tam+kontrol" alt="Typing SVG" />

<br/><br/>

[![Manifest](https://img.shields.io/badge/Manifest-v3-FF3D6B?style=for-the-badge&logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES2020-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Chrome](https://img.shields.io/badge/Chrome-Extension-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://chrome.google.com/webstore)
[![License](https://img.shields.io/badge/License-MIT-34D399?style=for-the-badge&logoColor=white)](LICENSE)
[![Stars](https://img.shields.io/github/stars/nyx47rd/rchelper?style=for-the-badge&color=FF3D6B&logo=github)](https://github.com/nyx47rd/rchelper/stargazers)

</div>

---

## 🚀 Nedir?

**RC Helper**, [RollerCoin](https://rollercoin.com) platformu için geliştirilmiş bir Chrome eklentisidir. Oyunları sizin yerinize **oynamaz** — oyun seçim ekranında uygun oyunu otomatik seçer ve başlatır, geri kalanını siz yaparsınız. Power toplamayı ve mola yönetimini de otomatikleştirir.

<br/>

<div align="center">

| ⚡ Özellik | 📖 Açıklama |
|:---:|:---|
| 🎮 **Otomatik Oyun Seç** | Pas geçilmeyenler arasından rastgele oyun seçer ve başlatır |
| 💰 **Otomatik Topla** | *Gain Power* ve *Collect* butonlarına otomatik basar |
| ⏸ **Pas Geç · 10dk** | Seçili oyunu 10 dakika boyunca atlar, süre dolunca geri gelir |
| 🚫 **Daima Atla** | Oyunu kalıcı olarak engeller, hiç seçilmez |
| ☕ **Mola Hatırlatıcısı** | 10 dakika sonra tam ekran mola sayacı açar (2.5dk dinlen) |
| 📊 **Canlı İstatistik** | Oyun sayısı, süre ve saatlik tahmin widget'ı |
| ⌨️ **Klavye Kısayolları** | `S` pas geç · `P` daima atla |
| 🔊 **Ses Efektleri** | Oyun seçimi, pas geçme, mola başlangıcı/bitişi, otomasyon açma/kapama için farklı tonlar |

</div>

<br/>

---

## 📦 Kurulum

### Adım 1 — Dosyaları İndirin

1. Aşağıdaki butona tıklayın:

   [![Download ZIP](https://img.shields.io/badge/⬇_Son_Sürümü_İndir-FF3D6B?style=for-the-badge)](https://github.com/nyx47rd/rchelper/releases/latest)

2. ZIP dosyasını masaüstüne çıkartın

---

### Adım 2 — Chrome'a Yükleyin

1. Chrome adres çubuğuna yazın:
   ```
   chrome://extensions
   ```

2. Sağ üst köşedeki **Geliştirici Modu** toggle'ını açın

3. **"Paketlenmemiş öğe yükle"** butonuna basın

4. ZIP'ten çıkardığınız klasörü seçin

5. ✅ Listede **RC Helper** gözükürse kurulum tamamdır!

---

### Adım 3 — Kullanmaya Başlayın

1. [rollercoin.com](https://rollercoin.com) adresine gidin
2. Tarayıcı araç çubuğundaki ⚡ ikonuna tıklayın
3. **Auto-Play: KAPALI** butonuna basın → **Auto-Play: AÇIK** 🟢

> Sayfa içinde sol üstte canlı istatistik widget'ı belirir.

<br/>

---

## 🖥️ Ekran Görüntüleri

<div align="center">

| Popup Paneli | Sayfa İçi Widget |
|:---:|:---:|
| ![Popup](popup.png) | ![Widget](sayfaiciwidget.png) |
| Eklenti ikonuna tıklayarak açılır | Sayfanın sol üstünde sabit durur |

</div>

### Sağ Alt — Oyun Konsolu

Sayfanın sağ alt köşesinde küçük bir konsol widget'ı bulunur. Şu an oynanan oyunun adını gösterir. Kapatmak için sağ üst `✕` butonuna basılabilir, tekrar açmak için liste ikonuna tıklanır.

<div align="center">

![Şu An Oynanan](suanoynanan.png)

</div>

<br/>

---

## ⌨️ Klavye Kısayolları

<div align="center">

| Tuş | Eylem | Detay |
|:---:|:---|:---|
| `S` | **Pas Geç** | Mevcut oyunu 10 dakika atlar |
| `P` | **Daima Atla** | Mevcut oyunu kalıcı olarak engeller |

> Kısayollar yalnızca `rollercoin.com` üzerinde, input/textarea odakta değilken çalışır.

</div>

<br/>

---

## 🔒 İzinler

<div align="center">

| İzin | Neden Gerekli |
|:---:|:---|
| `activeTab` | Aktif sekmede script çalıştırmak için |
| `scripting` | Sayfaya content script enjekte etmek için |
| `tabs` | Popup → sekme arası mesajlaşma için |
| `storage` | Ayarları ve pas geçilen oyunları kaydetmek için |

</div>

<br/>

---

## 🛠️ Teknoloji

<div align="center">

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Chrome](https://img.shields.io/badge/Chrome_API-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)

</div>

<br/>

```
📁 rchelper/
├── 📄 manifest.json      ← Eklenti tanımı (Manifest v3)
├── 📜 content.js         ← Sayfa içi otomasyon + widget UI
├── 📜 popup.js           ← Popup panel mantığı
├── 🎨 popup.html         ← Popup panel arayüzü
├── ⚙️  background.js     ← Service worker
└── 🖼️  icon*.png         ← Eklenti ikonları
```

**Öne çıkan teknik detaylar:**
- `chrome.storage.local` ile kalıcı durum yönetimi
- EMA (Exponential Moving Average) tabanlı saatlik tahmin algoritması
- Break checker 1 saniyelik tick — geri sayım piksel-perfect doğru
- Tüm UI vanilla JS + inline CSS (zero dependency)
- Manifest v3 + Service Worker mimarisi

<br/>

---

## 📈 Nasıl Çalışır?

```mermaid
graph TD
    A([rollercoin.com yüklendi]) --> B{Sayfa türü?}
    B -->|choose_game| C[Oyun listesini tara]
    B -->|play_game| D[Sonucu bekle]
    C --> E{Pas geçilenler var mı?}
    E -->|Evet| F[Filtrele]
    E -->|Hayır| G[Rastgele seç & başlat]
    F --> G
    D --> H[Gain Power / Collect tıkla]
    H --> I{10dk doldu mu?}
    I -->|Evet| J[☕ Mola Ekranı]
    J --> K[2.5dk sonra devam]
    K --> B
    I -->|Hayır| B
```

<br/>

---

<div align="center">

### ⭐ Beğendiyseniz yıldız atmayı unutmayın!

[![Star](https://img.shields.io/github/stars/nyx47rd/rchelper?style=social)](https://github.com/nyx47rd/rchelper/stargazers)
[![Fork](https://img.shields.io/github/forks/nyx47rd/rchelper?style=social)](https://github.com/nyx47rd/rchelper/network/members)

<br/>

<img src="https://capsule-render.vercel.app/api?type=waving&color=FF3D6B&height=100&section=footer" width="100%"/>

</div>
