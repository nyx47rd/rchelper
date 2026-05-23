var autoPlayState = false;
var CURRENT_VERSION = '2.2.5';
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

/* ── Tutorial ── */
var TUT_STEPS = [
  {
    targetId: null,
    title: 'RC Helper\'e Hoş Geldin! 👋',
    desc: 'Bu kısa tur seni <strong>2 dakikada</strong> tüm özelliklerle tanıştıracak. RollerCoin\'de oyun seçimini otomatikleştirmek için tasarlandı.',
  },
  {
    targetId: 'chk-choose',
    title: 'Otomatik Seç',
    desc: '<strong>Oyun seçim ekranında</strong> rastgele bir oyun seçip butona basar. Sen sadece oyunu oynarsın — seçimi o yapar.',
  },
  {
    targetId: 'chk-collect',
    title: 'Otomatik Topla',
    desc: 'Oyun bitince çıkan <strong>"Gain Power"</strong> ve <strong>"Collect"</strong> butonlarına otomatik basar. Power\'ı kaçırmazsın.',
  },
  {
    targetId: 'chk-break',
    title: 'Mola Hatırlatıcısı',
    desc: '<strong>10 dakika</strong> oynayınca tam ekran mola ekranı açılır, <strong>2.5 dakika</strong> dinlenir, sonra otomatik devam eder. Gözlerini koru!',
  },
  {
    targetId: 'btn-skip',
    title: 'Pas Geç (S tuşu)',
    desc: 'Şu anki oyunu <strong>10 dakika</strong> boyunca atlar. Sıkıcı bir oyunla karşılaştında kullan. Klavyeden de <strong>S</strong> tuşuna basabilirsin.',
  },
  {
    targetId: 'btn-skip-perm',
    title: 'Daima Atla (P tuşu)',
    desc: 'Bu oyunu <strong>kalıcı olarak</strong> engeller — bir daha asla seçilmez. Hiç sevmediğin oyunlar için. <strong>P</strong> tuşuyla da çalışır.',
  },
  {
    targetId: 'btn-list',
    title: 'Listeden Seç',
    desc: 'Oyun seçim sayfasına gitmeden <strong>popup\'tan</strong> hangi oyunların pas geçileceğini ayarlayabilirsin.',
  },
  {
    targetId: 'btn-auto',
    title: 'Auto-Play',
    desc: '<strong>Ana buton.</strong> Açıkken her 1 saniyede kontrol eder, oyun seçim ekranındaysan otomatik seçer. Kapatınca her şey durur.',
  },
  {
    targetId: 'stats-card',
    title: 'İstatistikler',
    desc: 'Oynadığın <strong>toplam oyun</strong>, bugün, bu hafta, toplam süre, ortalama süre ve en çok oynadığın oyunu burada görürsün.',
  },
];

function startTutorial(autoShow) {
  var overlay = document.getElementById('tut-overlay');
  if (!overlay) return;
  var step = 0;

  var dotsEl = document.getElementById('tut-dots');
  dotsEl.innerHTML = '';
  TUT_STEPS.forEach(function(_, i) {
    var d = document.createElement('span');
    d.className = 'tut-dot';
    dotsEl.appendChild(d);
  });

  /* Hedef elementin document-relative rect'ini al (scroll dahil) */
  function getDocRect(id) {
    if (!id) return null;
    var el = document.getElementById(id);
    if (!el) return null;
    var br = el.getBoundingClientRect();
    var scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
    var scrollX = window.pageXOffset || document.documentElement.scrollLeft || 0;
    return {
      top:    br.top  + scrollY,
      left:   br.left + scrollX,
      width:  br.width,
      height: br.height,
      bottom: br.top  + scrollY + br.height,
    };
  }

  function getDocH() {
    return Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight
    );
  }

  function getDocW() {
    return document.body.offsetWidth || document.documentElement.offsetWidth || 256;
  }

  function setMasks(r) {
    var W = getDocW();
    var H = getDocH();
    var pad = 5;
    var mTop = document.getElementById('tut-m-top');
    var mBot = document.getElementById('tut-m-bottom');
    var mLft = document.getElementById('tut-m-left');
    var mRgt = document.getElementById('tut-m-right');
    var sp   = document.getElementById('tut-spotlight');

    /* overlay'in yüksekliğini doc boyutuna eşitle */
    overlay.style.height = H + 'px';

    if (!r) {
      mTop.style.cssText = 'position:absolute;left:0;top:0;width:' + W + 'px;height:' + H + 'px;background:rgba(5,7,18,0.85);';
      mBot.style.display = 'none';
      mLft.style.display = 'none';
      mRgt.style.display = 'none';
      sp.style.display   = 'none';
      return;
    }

    var rx = Math.max(0, r.left - pad);
    var ry = Math.max(0, r.top  - pad);
    var rw = r.width  + pad * 2;
    var rh = r.height + pad * 2;

    var bg = 'rgba(5,7,18,0.85)';
    mTop.style.cssText = 'position:absolute;left:0;top:0;width:' + W + 'px;height:' + ry + 'px;background:' + bg + ';';
    mBot.style.cssText = 'position:absolute;left:0;top:' + (ry+rh) + 'px;width:' + W + 'px;height:' + (H - ry - rh) + 'px;background:' + bg + ';display:block;';
    mLft.style.cssText = 'position:absolute;left:0;top:' + ry + 'px;width:' + rx + 'px;height:' + rh + 'px;background:' + bg + ';display:block;';
    mRgt.style.cssText = 'position:absolute;left:' + (rx+rw) + 'px;top:' + ry + 'px;width:' + (W - rx - rw) + 'px;height:' + rh + 'px;background:' + bg + ';display:block;';
    sp.style.cssText   = 'position:absolute;left:' + rx + 'px;top:' + ry + 'px;width:' + rw + 'px;height:' + rh + 'px;' +
                         'border:2px solid #FF3D6B;border-radius:9px;' +
                         'box-shadow:0 0 0 3px rgba(255,61,107,0.2),0 0 16px rgba(255,61,107,0.25);display:block;pointer-events:none;';
  }

  function positionBox(r) {
    var box  = document.getElementById('tut-box');
    var H    = getDocH();
    var GAP  = 10;
    var boxH = 170; /* yaklaşık kutu yüksekliği */

    if (!r) {
      /* Hoş geldin adımı: sayfanın üst 1/3'ü */
      box.style.top = '60px';
      return;
    }

    /* Spotlight'ın altına sığıyor mu? */
    var belowTop = r.bottom + GAP;
    if (belowTop + boxH <= H) {
      box.style.top = belowTop + 'px';
      return;
    }

    /* Üstüne sığıyor mu? */
    var aboveTop = r.top - GAP - boxH;
    if (aboveTop >= 0) {
      box.style.top = aboveTop + 'px';
      return;
    }

    /* İkisi de olmuyorsa ortala */
    box.style.top = Math.max(8, (H - boxH) / 2) + 'px';
  }

  function scrollToStep(r) {
    if (!r) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    var viewH   = window.innerHeight;
    var scrollY = window.pageYOffset || 0;
    var elCenter = r.top + r.height / 2;
    var target  = elCenter - viewH / 2;
    window.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  }

  function render() {
    var s     = TUT_STEPS[step];
    var total = TUT_STEPS.length;

    document.getElementById('tut-badge').textContent = 'Adım ' + (step + 1) + ' / ' + total;
    document.getElementById('tut-title').textContent = s.title;
    document.getElementById('tut-desc').innerHTML    = s.desc;

    var r = getDocRect(s.targetId);
    scrollToStep(r);

    /* Scroll bittikten sonra yeniden hesapla */
    setTimeout(function() {
      var r2 = getDocRect(s.targetId);
      setMasks(r2);
      positionBox(r2);
    }, 180);

    var dots = document.querySelectorAll('.tut-dot');
    dots.forEach(function(d, i) { d.className = 'tut-dot' + (i === step ? ' active' : ''); });

    var nextBtn = document.getElementById('tut-next');
    var prevBtn = document.getElementById('tut-prev');
    var skipBtn = document.getElementById('tut-skip');

    prevBtn.style.display = step === 0 ? 'none' : '';
    if (step === total - 1) {
      nextBtn.textContent = '✓ Tamamla';
      nextBtn.className   = 'tut-btn tut-btn-done';
      skipBtn.style.display = 'none';
    } else {
      nextBtn.textContent = 'İleri ›';
      nextBtn.className   = 'tut-btn tut-btn-next';
      skipBtn.style.display = '';
    }
  }

  function closeTutorial(done) {
    overlay.classList.remove('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (done) chrome.storage.local.set({ tutorialDone: true });
  }

  document.getElementById('tut-next').onclick = function() {
    if (step < TUT_STEPS.length - 1) { step++; render(); }
    else { closeTutorial(true); }
  };
  document.getElementById('tut-prev').onclick = function() {
    if (step > 0) { step--; render(); }
  };
  document.getElementById('tut-skip').onclick = function() { closeTutorial(true); };

  overlay.classList.add('active');
  render();
}

document.addEventListener('DOMContentLoaded', function() {
  checkForUpdates();

  var btnTutorial = document.getElementById('btn-tutorial');
  if (btnTutorial) btnTutorial.onclick = function() { startTutorial(false); };

  chrome.storage.local.get(['tutorialDone'], function(data) {
    if (!data.tutorialDone) {
      setTimeout(function() { startTutorial(true); }, 300);
    }
  });
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