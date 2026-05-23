var autoPlayState = false;
var CURRENT_VERSION = '2.2.7';
var updateAvailable = false;
var latestReleaseUrl = 'https://github.com/nyx47rd/rchelper/releases/latest';

function checkForUpdates() {
  var btnAuto = document.getElementById('btn-auto');
  if (btnAuto) {
    btnAuto.disabled = true;
    btnAuto.style.opacity = '0.4';
    btnAuto.style.cursor = 'not-allowed';
    btnAuto.title = 'Kontrol ediliyor...';
  }

  fetch('https://api.github.com/repos/nyx47rd/rchelper/releases/latest', { cache: 'no-store' })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var latest = (data.tag_name || '').replace('v', '');
      if (!latest) { unlockAutoPlay(); return; }
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
        if (btnAuto) {
          btnAuto.disabled = true;
          btnAuto.style.opacity = '0.4';
          btnAuto.style.cursor = 'not-allowed';
          btnAuto.title = 'Güncelleme gerekiyor';
        }
      } else {
        unlockAutoPlay();
      }
    })
    .catch(function() { unlockAutoPlay(); });
}

function unlockAutoPlay() {
  var btnAuto = document.getElementById('btn-auto');
  if (btnAuto) {
    btnAuto.disabled = false;
    btnAuto.style.opacity = '';
    btnAuto.style.cursor = '';
    btnAuto.title = '';
  }
}

function sendMessage(msg, callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (!tabs || !tabs[0]) { if (callback) callback(null); return; }
    chrome.tabs.sendMessage(tabs[0].id, msg, function(resp) {
      void chrome.runtime.lastError;
      if (callback) callback(resp || null);
    });
  });
}

document.addEventListener('DOMContentLoaded', function() {
  checkForUpdates();

  /* ── Tutorial başlatıcı ── */
  var btnTutorial = document.getElementById('btn-tutorial');
  if (btnTutorial) btnTutorial.onclick = function() { startTutorial(); };
  chrome.storage.local.get(['tutorialDone'], function(data) {
    if (!data.tutorialDone) setTimeout(function() { startTutorial(); }, 300);
  });

  /* ── Mola ayarları ── */
  var inpSession = document.getElementById('inp-session-min');
  var inpBreak   = document.getElementById('inp-break-min');

  chrome.storage.local.get(['breakSessionMin', 'breakDurationMin'], function(data) {
    if (inpSession) inpSession.value = data.breakSessionMin  || 10;
    if (inpBreak)   inpBreak.value   = data.breakDurationMin || 2.5;
  });

  function saveBreakSettings() {
    var sMin = parseFloat(inpSession.value);
    var bMin = parseFloat(inpBreak.value);
    if (isNaN(sMin) || sMin < 1)   { inpSession.value = 1;   sMin = 1; }
    if (isNaN(bMin) || bMin < 0.5) { inpBreak.value   = 0.5; bMin = 0.5; }
    chrome.storage.local.set({ breakSessionMin: sMin, breakDurationMin: bMin });
    sendMessage({ action: 'setBreakSettings', sessionMin: sMin, breakMin: bMin });
  }

  if (inpSession) inpSession.addEventListener('change', saveBreakSettings);
  if (inpBreak)   inpBreak.addEventListener('change', saveBreakSettings);

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
    if (updateAvailable) return;
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

  /* ── İstatistikler ── */
  function formatDuration(ms) {
    if (!ms || ms < 1000) return '0s';
    const sec = Math.round(ms / 1000);
    if (sec < 60) return sec + 's';
    const min = Math.floor(sec / 60);
    const remSec = sec % 60;
    if (min < 60) return remSec > 0 ? min + 'm ' + remSec + 's' : min + 'm';
    const hr = Math.floor(min / 60);
    const remMin = min % 60;
    return hr + 'h ' + remMin + 'm';
  }

  function getWeekKey(date) {
    // ISO hafta başlangıcı: pazartesi
    const d = new Date(date);
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
  }

  function updateStatsCard() {
    chrome.storage.local.get(['gameStats'], (data) => {
      const stats = data.gameStats || {};
      const totalGames = stats.totalGames || 0;
      const today = new Date().toISOString().slice(0, 10);
      const todayGames = (stats.dailyStats && stats.dailyStats[today]) || 0;

      // Bu hafta (son 7 gün)
      let weekGames = 0;
      const weekCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      if (stats.dailyStats) {
        Object.keys(stats.dailyStats).forEach(d => {
          const t = new Date(d + 'T00:00:00').getTime();
          if (!isNaN(t) && t >= weekCutoff) weekGames += stats.dailyStats[d];
        });
      }

      const totalMs = stats.totalPlayTimeMs || 0;
      const avgMs = totalGames > 0 ? totalMs / totalGames : 0;

      // En çok oynanan
      let favGame = '-';
      let maxPlays = 0;
      if (stats.perGame) {
        for (const name in stats.perGame) {
          if (stats.perGame[name].plays > maxPlays) {
            maxPlays = stats.perGame[name].plays;
            favGame = name;
          }
        }
      }

      const activeDays = stats.dailyStats ? Object.keys(stats.dailyStats).length : 0;

      var setT = function(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
      setT('stat-total-games', totalGames);
      setT('stat-today-games', todayGames);
      setT('stat-week-games', weekGames);
      setT('stat-total-time', formatDuration(totalMs));
      setT('stat-avg-time', formatDuration(avgMs));
      setT('stat-longest-time', formatDuration(stats.longestGameMs || 0));
      setT('stat-fav-game', favGame === '-' ? '-' : favGame + (maxPlays ? ' (' + maxPlays + ')' : ''));
      setT('stat-last-game', stats.lastGame || '-');
      setT('stat-active-days', activeDays);
    });

    // Şu an oynanan oyunu content script'ten al
    sendMessage({ action: 'getGameStats' }, function(resp) {
      var el = document.getElementById('stat-current-game');
      if (el) el.textContent = (resp && resp.currentGame) ? resp.currentGame : '-';
    });
  }

  var btnStatsReset = document.getElementById('btn-stats-reset');
  if (btnStatsReset) {
    btnStatsReset.onclick = function() {
      if (!confirm('Tüm oyun istatistiklerini sıfırlamak istediğinden emin misin?')) return;
      chrome.storage.local.set({ gameStats: null }, function() {
        updateStatsCard();
      });
      sendMessage({ action: 'resetGameStats' });
    };
  }

  updateStatsCard();
  setInterval(updateStatsCard, 3000);

  var btnList = document.getElementById('btn-list');
  var gamePicker = document.getElementById('game-picker');
  var gamePickerList = document.getElementById('game-picker-list');
  var gamePickerClose = document.getElementById('game-picker-close');

  function renderGamePicker(games, skipped, permanent) {
    gamePickerList.innerHTML = '';
    if (!games || games.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'game-picker-empty';
      empty.textContent = 'Oyun listesi bulunamadı. Önce oyun seçim sayfasına git.';
      gamePickerList.appendChild(empty);
      return;
    }
    games.forEach(function(name) {
      var isSkipped = skipped && skipped[name];
      var isPerm = permanent && permanent[name];
      var item = document.createElement('div');
      item.className = 'game-picker-item';
      var nameEl = document.createElement('span');
      nameEl.className = 'game-picker-name';
      nameEl.textContent = name;
      if (isSkipped || isPerm) nameEl.style.opacity = '0.4';
      var actions = document.createElement('div');
      actions.className = 'game-picker-actions';
      var btnSkipG = document.createElement('button');
      btnSkipG.className = 'game-picker-btn game-picker-btn-skip';
      btnSkipG.textContent = isSkipped ? '✓ Pas' : 'Pas';
      btnSkipG.onclick = function() {
        sendMessage({ action: 'addSkip', gameName: name });
        chrome.storage.local.get(['skippedGames'], function(d) {
          var s = d.skippedGames || {};
          s[name] = Date.now();
          chrome.storage.local.set({ skippedGames: s }, function() { openGamePicker(); });
        });
      };
      var btnPermG = document.createElement('button');
      btnPermG.className = 'game-picker-btn game-picker-btn-perm';
      btnPermG.textContent = isPerm ? '✓ Daima' : 'Daima';
      btnPermG.onclick = function() {
        sendMessage({ action: 'addPermSkip', gameName: name });
        chrome.storage.local.get(['permanentSkippedGames'], function(d) {
          var p = d.permanentSkippedGames || {};
          p[name] = true;
          chrome.storage.local.set({ permanentSkippedGames: p }, function() { openGamePicker(); });
        });
      };
      actions.appendChild(btnSkipG);
      actions.appendChild(btnPermG);
      item.appendChild(nameEl);
      item.appendChild(actions);
      gamePickerList.appendChild(item);
    });
  }

  function openGamePicker() {
    gamePicker.style.display = 'block';
    gamePickerList.innerHTML = '<div class="game-picker-empty">Yükleniyor...</div>';
    chrome.storage.local.get(['skippedGames', 'permanentSkippedGames', 'knownGames'], function(data) {
      var skipped = data.skippedGames || {};
      var permanent = data.permanentSkippedGames || {};
      sendMessage({ action: 'getAvailableGames' }, function(resp) {
        var games = resp && resp.games ? resp.games : (data.knownGames || null);
        if (games && games.length > 0) {
          chrome.storage.local.set({ knownGames: games });
        }
        renderGamePicker(games, skipped, permanent);
      });
    });
  }

  btnList.onclick = function() {
    if (gamePicker.style.display === 'block') {
      gamePicker.style.display = 'none';
    } else {
      openGamePicker();
    }
  };

  gamePickerClose.onclick = function() {
    gamePicker.style.display = 'none';
  };

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