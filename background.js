// RC Helper — Background Service Worker

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function encryptData(plaintext, password) {
  const enc = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const aesKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    aesKey,
    enc.encode(plaintext)
  );
  
  return {
    ciphertext: arrayBufferToBase64(ciphertextBuffer),
    iv: arrayBufferToBase64(iv),
    salt: arrayBufferToBase64(salt)
  };
}

async function handleSync(token, refreshToken) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['syncEnabled', 'syncUrl', 'syncPassword', 'syncHfToken'], async (data) => {
      if (!data.syncUrl || !data.syncPassword) {
        return reject(new Error('Bulut eşitleme ayarları (URL veya Şifre) eksik.'));
      }
      
      try {
        const plaintext = JSON.stringify({ token, refreshToken });
        const encrypted = await encryptData(plaintext, data.syncPassword);
        
        let baseUrl = data.syncUrl.replace(/\/$/, "");
        if (baseUrl.startsWith("http://")) {
          baseUrl = baseUrl.replace(/^http:\/\//i, "https://");
        }
        const url = `${baseUrl}/guncelle-token`;
        
        const headers = {
          "Content-Type": "application/json"
        };
        if (data.syncHfToken) {
          headers["Authorization"] = `Bearer ${data.syncHfToken}`;
        }
        
        const response = await fetch(url, {
          method: "POST",
          headers: headers,
          body: JSON.stringify(encrypted)
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        await response.json();
        const timestamp = new Date().toLocaleTimeString();
        const statusText = `Başarılı: ${timestamp}`;
        chrome.storage.local.set({ syncLastStatus: statusText });
        resolve({ success: true, message: statusText });
      } catch (err) {
        const timestamp = new Date().toLocaleTimeString();
        const statusText = `Hata: ${err.message} (${timestamp})`;
        chrome.storage.local.set({ syncLastStatus: statusText });
        reject(err);
      }
    });
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'syncTokens') {
    handleSync(request.token, request.refreshToken)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep message channel open for async response
  }
});