var autoPlayState = false;
var CURRENT_VERSION = '2.1.5';
var updateAvailable = false;
var latestReleaseUrl = 'https://github.com/nyx47rd/rchelper/releases/latest';

function checkForUpdates() {
  fetch('https://api.github.com/repos/nyx47rd/rchelper/releases/latest', { cache: 'no-store' })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var latest = (data.tag_name || '').replace('v', '');
      if (!latest) return;
      latestReleaseUrl = data.html_url || latestReleaseUrl;
      var cur = CURRENT_VERSION.split('.').map(Number);
      var lat = latest.split('.').map(Number);
      var isOld = false;
      for (var i = 0; i < Math.max(cur.length, lat.length); i++) {
        var c = cur[i] || 0, l = lat[i] || 0;
        if (l > c) { isOld = true; break; }
        if (c > l) break;
      }
      if (isOld) {
        updateAvailable = true;
        var banner = document.getElementById('update-banner');
        var sub = document.getElementById('update-banner-sub');
        var btnUpdate = document.getElementById('btn-update');
        if (banner) banner.style.display = 'block';
        if (sub) sub.textContent = 'v' + latest + ' mevcut. Auto-Play kullanmak için güncellemeniz gerekiyor.';
        if (btnUpdate) btnUpdate.onclick = function() { chrome.tabs.create({ url: latestReleaseUrl }); };
        var btnAuto = document.getElementById('btn-auto');
        if (btnAuto) {
          btnAuto.disabled = true;
          btnAuto.style.opacity = '0.4';
          btnAuto.style.cursor = 'not-allowed';
          btnAuto.title = 'Güncelleme gerekiyor';
        }
      }
    })
    .catch(function() {});
}

function sendMessage(msg) {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (!tabs || !tabs[0]) return;
    chrome.tabs.sendMessage(tabs[0].id, msg, function() {
      void chrome.runtime.lastError;
    });
  });
}

document.addEventListener('DOMContentLoaded', function() {
  checkForUpdates();
  var btnAuto      = document.getElementById('btn-auto');
  var btnSkip      = document.getElementById('btn-skip');
  var btnSkipPerm  = document.getElementById('btn-skip-perm');
  var btnClear     = document.getElementById('btn-clear');
  var chkChoose    = document.getElementById('chk-choose');
  var chkCollect   = document.getElementById('chk-collect');
  var chkBreak    = document.getElementById('chk-break');

  chrome.storage.local.get(['autoPlay', 'autoChoose', 'autoCollect', 'breakReminder'], (data) => {
    autoPlayState = !!data.autoPlay;
    chkChoose.checked  = data.autoChoose  !== false;
    chkCollect.checked = data.autoCollect !== false;
    chkBreak.checked = data.breakReminder !== false;
    updateAutoBtn(autoPlayState);
  });

  btnAuto.onclick = function() {
    autoPlayState = !autoPlayState;
    updateAutoBtn(autoPlayState);
    chrome.storage.local.set({ autoPlay: autoPlayState });
    sendMessage({ action: 'toggleAuto', on: autoPlayState });
  };

  function updateAutoBtn(state) {
    btnAuto.textContent = state ? 'Auto-Play: AÇIK' : 'Auto-Play: KAPALI';
    btnAuto.classList.toggle('active', state);
  }

  function updateSkippedGamesList(skippedGames) {
    var listEl = document.getElementById('skipped-games-list');
    if (!listEl) return;
    
    var now = Date.now();
    var skipDuration = 10 * 60 * 1000;
    var validGames = [];
    
    for (var key in skippedGames) {
      var remaining = Math.ceil((skipDuration - (now - skippedGames[key])) / 60000);
      if (remaining > 0) {
        validGames.push({ name: key, remaining: remaining });
      } else {
        delete skippedGames[key];
      }
    }
    
    var ICON_X = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    if (validGames.length === 0) {
      listEl.innerHTML = '<span class="skip-empty">Henüz yok</span>';
    } else {
      listEl.innerHTML = '';
      validGames.forEach(function(g) {
        var div = document.createElement('div');
        div.className = 'skip-item';
        var nameSpan = document.createElement('span');
        nameSpan.className = 'skip-item-name';
        nameSpan.textContent = g.name;
        var metaSpan = document.createElement('span');
        metaSpan.className = 'skip-item-meta';
        metaSpan.textContent = g.remaining + 'dk';
        var btn = document.createElement('button');
        btn.className = 'skip-item-rm';
        btn.innerHTML = ICON_X;
        btn.onclick = function() {
          chrome.storage.local.get(['skippedGames'], function(data) {
            var skipped = data.skippedGames || {};
            delete skipped[g.name];
            chrome.storage.local.set({ skippedGames: skipped });
            loadSkippedGames();
          });
        };
        div.appendChild(nameSpan);
        div.appendChild(metaSpan);
        div.appendChild(btn);
        listEl.appendChild(div);
      });
    }
  }

  function updatePermanentSkippedList(permanentSkipped) {
    var listEl = document.getElementById('permanent-skipped-list');
    if (!listEl) return;
    
    var games = Object.keys(permanentSkipped);
    
    var ICON_X2 = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    if (games.length === 0) {
      listEl.innerHTML = '<span class="skip-empty">Henüz yok</span>';
    } else {
      listEl.innerHTML = '';
      games.forEach(function(g) {
        var div = document.createElement('div');
        div.className = 'skip-item';
        var nameSpan = document.createElement('span');
        nameSpan.className = 'skip-item-name';
        nameSpan.textContent = g;
        var btn = document.createElement('button');
        btn.className = 'skip-item-rm';
        btn.innerHTML = ICON_X2;
        btn.onclick = function() {
          chrome.storage.local.get(['permanentSkippedGames'], function(data) {
            var permanent = data.permanentSkippedGames || {};
            delete permanent[g];
            chrome.storage.local.set({ permanentSkippedGames: permanent });
            loadSkippedGames();
          });
        };
        div.appendChild(nameSpan);
        div.appendChild(btn);
        listEl.appendChild(div);
      });
    }
  }

  function loadSkippedGames() {
    chrome.storage.local.get(['skippedGames', 'permanentSkippedGames'], (data) => {
      updateSkippedGamesList(data.skippedGames || {});
      updatePermanentSkippedList(data.permanentSkippedGames || {});
    });
  }

  window.removeSkipped = function(gameName) {
    chrome.storage.local.get(['skippedGames'], (data) => {
      var skipped = data.skippedGames || {};
      delete skipped[gameName];
      chrome.storage.local.set({ skippedGames: skipped });
      loadSkippedGames();
    });
  };

  window.removePermanent = function(gameName) {
    chrome.storage.local.get(['permanentSkippedGames'], (data) => {
      var permanent = data.permanentSkippedGames || {};
      delete permanent[gameName];
      chrome.storage.local.set({ permanentSkippedGames: permanent });
      loadSkippedGames();
    });
  };

  setInterval(loadSkippedGames, 5000);
  loadSkippedGames();

  btnSkip.onclick = function() {
    var orig = btnSkip.textContent;
    btnSkip.textContent = 'Geçiliyor...';
    sendMessage({ action: 'skipGame' });
    setTimeout(function() { 
      btnSkip.textContent = orig; 
      loadSkippedGames();
    }, 1500);
  };

  btnSkipPerm.onclick = function() {
    var orig = btnSkipPerm.textContent;
    btnSkipPerm.textContent = '...';
    sendMessage({ action: 'skipGamePermanent' });
    setTimeout(function() { 
      btnSkipPerm.textContent = orig; 
      loadSkippedGames();
    }, 1500);
  };

  chkChoose.onchange  = function() { chrome.storage.local.set({ autoChoose: chkChoose.checked }); sendMessage({ action: 'toggleChoose',  on: chkChoose.checked }); };
  chkCollect.onchange = function() { chrome.storage.local.set({ autoCollect: chkCollect.checked }); sendMessage({ action: 'toggleCollect', on: chkCollect.checked }); };
  chkBreak.onchange = function() {
    chrome.storage.local.set({ breakReminder: chkBreak.checked });
    sendMessage({ action: 'toggleBreak', on: chkBreak.checked });
  };

  btnClear.onclick = function() {
    var existing = document.getElementById('rc-confirm-box');
    if (existing) { existing.remove(); return; }
    var box = document.createElement('div');
    box.id = 'rc-confirm-box';
    box.style.cssText = 'background:#1e2235; border:1px solid #e94560; border-radius:8px; padding:10px; margin-top:6px; font-size:11px; color:#ccc; text-align:center;';
    box.innerHTML = '<div style="margin-bottom:8px;">Emin misin? Tüm ayarlar silinecek.</div>';
    var yes = document.createElement('button');
    yes.textContent = 'Evet, Temizle';
    yes.style.cssText = 'background:#e94560; color:#fff; border:none; border-radius:5px; padding:5px 10px; cursor:pointer; font-size:11px; margin-right:6px;';
    yes.onclick = function() {
      chrome.storage.local.clear(function() {
        box.remove();
        btnClear.textContent = '✓ Temizlendi!';
        btnClear.style.background = '#4ade80';
        btnClear.style.color = '#fff';
        setTimeout(function() {
          btnClear.textContent = '🗑️ Hafızayı Temizle';
          btnClear.style.background = '#1e2235';
          btnClear.style.color = '#666';
        }, 2000);
      });
    };
    var no = document.createElement('button');
    no.textContent = 'İptal';
    no.style.cssText = 'background:#333; color:#888; border:none; border-radius:5px; padding:5px 10px; cursor:pointer; font-size:11px;';
    no.onclick = function() { box.remove(); };
    box.appendChild(yes);
    box.appendChild(no);
    btnClear.parentNode.insertBefore(box, btnClear.nextSibling);
  };
});