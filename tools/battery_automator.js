/**
 * RC Helper — Cloud-Based Battery Automator
 * 
 * Bu script, eklenti Selenium (Hugging Face Spaces, Docker vb.) ile çalıştırıldığında
 * RollerCoin ana sayfasındaki batarya doldurma işlemini otomatik ve güvenli (organik gecikmeyle) yapar.
 */
(function() {
  // Sayfanın tam olarak oyun ana sayfası (/game) olduğundan emin ol
  const currentUrl = window.location.href.split('?')[0].split('#')[0].replace(/\/$/, "");
  if (currentUrl !== "https://rollercoin.com/game") {
    return;
  }

  // RollerCoin batarya şarj butonunun güncel CSS selector'ı:
  // İçindeki div öğesinde mask-image style niteliğiyle pil ikonu (.svg) barındıran butonu yakalar
  const BATTERY_BUTTON_SELECTOR = 'button:has(div[style*="mask-image"][style*="svg"])';

  console.log("[RC-Battery] 🔋 Battery Automator modülü aktifleşti. Buton tespiti bekleniyor...");

  // Sayfa yüklendikten sonra butonu periyodik olarak tarayan döngü
  const checkInterval = setInterval(() => {
    if (!BATTERY_BUTTON_SELECTOR) {
      console.warn("[RC-Battery] ⚠️ BATTERY_BUTTON_SELECTOR boş bırakılamaz.");
      clearInterval(checkInterval);
      return;
    }

    const batteryBtn = document.querySelector(BATTERY_BUTTON_SELECTOR);
    if (batteryBtn) {
      clearInterval(checkInterval); // Buton bulundu, taramayı durdur

      // Butonun pasif (devre dışı/dolu) olup olmadığını kontrol et
      const isDisabled = batteryBtn.disabled || 
                         batteryBtn.classList.contains("disabled") || 
                         batteryBtn.getAttribute("disabled") !== null;

      if (!isDisabled) {
        // İnsansı davranışı simüle etmek için 3 ila 5 saniye arasında rastgele bir bekleme ekle
        const delay = Math.floor(Math.random() * 2000) + 3000;
        console.log(`[RC-Battery] ⚡ Şarj butonu aktif! ${delay}ms içinde tıklanacak...`);

        setTimeout(() => {
          try {
            batteryBtn.click();
            console.log("[RC-Battery] ✅ Batarya doldurma butonuna başarıyla tıklandı!");
          } catch (error) {
            console.error("[RC-Battery] ❌ Butona tıklanırken hata oluştu:", error);
          }
        }, delay);
      } else {
        console.log("[RC-Battery] ℹ️ Batarya zaten dolu veya şarj butonu şu an pasif durumda.");
      }
    }
  }, 1000);

  // Sayfa yükleme hatası veya butonun hiç gelmemesi durumunda 30 saniye sonra aramayı sonlandır
  setTimeout(() => {
    clearInterval(checkInterval);
  }, 30000);
})();
