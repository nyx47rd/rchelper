/* ══════════════════════════════════════════════════════════════════
   RC Helper — Token Blaster Auto-Bot
   Yalnızca /game/play_game sayfasına inject edilir (manifest.json)
   Tetikleyici: canvas tam ekran yapılınca otomatik başlar
   Mekanik: Gemiyi yatayda tarayarak bulur, mermilerden kaçar ve ateş eder.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  var _botActive   = false;
  var _loopId      = null;
  var _offscreen   = null;
  var _ctx         = null;
  var _lastSpace   = 0;
  var _spaceInterval = 100; /* Ateş etme sıklığı (ms) */
  
  var _shipX       = 480;   /* Tahmini gemi konumu */
  var _shipY       = 740;   /* Tahmini gemi Y seviyesi */
  var _shipWidth   = 60;
  var _sweepDir    = 1;     /* 1: sağa, -1: sola süpürme */
  
  var _activeKeys  = {};    /* Basılı tutulan tuşlar */

  function _isGame() {
    var sources = [
      (window._activeGame && window._activeGame.name) || '',
      window.currentPlayingGame || '',
      window.lastSelectedGame || '',
      document.title || ''
    ];
    return sources.some(function(s) {
      var n = s.toLowerCase();
      return n.includes('token blaster') || n.includes('tokenblaster');
    });
  }

  function _isBigCanvas() {
    var c = _getCanvas();
    if (!c) return false;
    return c.getBoundingClientRect().width > window.innerWidth * 0.6;
  }

  function _getCanvas() {
    return document.querySelector('#phaserGame canvas') ||
           document.querySelector('canvas');
  }

  function _ensureOffscreen(w, h) {
    if (_offscreen && _offscreen.width === w && _offscreen.height === h) return true;
    try {
      _offscreen = document.createElement('canvas');
      _offscreen.width  = w;
      _offscreen.height = h;
      _ctx = _offscreen.getContext('2d', { willReadFrequently: true });
      return !!_ctx;
    } catch (e) { return false; }
  }

  /* Klavyeden tuş basma/bırakma simülasyonu */
  function _setKeyState(key, isPressed) {
    if (_activeKeys[key] === isPressed) return;
    _activeKeys[key] = isPressed;

    var type = isPressed ? 'keydown' : 'keyup';
    var codes = { ArrowLeft: 37, ArrowRight: 39, ArrowUp: 38, ArrowDown: 40, Space: 32 };
    var keyCode = codes[key] || 0;
    
    var opts = { 
      key: key === 'Space' ? ' ' : key, 
      code: key, 
      keyCode: keyCode, 
      which: keyCode, 
      bubbles: true, 
      cancelable: true 
    };

    var canvas = _getCanvas();
    var targets = [window, document, canvas, document.body];
    targets.forEach(function(t) {
      if (t) t.dispatchEvent(new KeyboardEvent(type, opts));
    });
  }

  function _pressSpace() {
    _setKeyState('Space', true);
    setTimeout(function() {
      _setKeyState('Space', false);
    }, 40);
  }

  function _scan() {
    if (!_botActive) return;
    var canvas = _getCanvas();
    if (!canvas || !canvas.width || !canvas.height) return;
    if (!_ensureOffscreen(canvas.width, canvas.height)) return;

    try { _ctx.drawImage(canvas, 0, 0); }
    catch (e) {
      console.warn('[RC-TB] Canvas okunamıyor:', e.message);
      _stop();
      return;
    }

    var w = canvas.width, h = canvas.height;
    var data;
    try { data = _ctx.getImageData(0, 0, w, h).data; }
    catch (e) { return; }

    // 1. Gemi Konumunu Bul (Yapay Zeka Taraması)
    // Gemi Y seviyesi yaklaşık alt kısımdadır (h - 85)
    var scanY = Math.round(h * 0.88); 
    var minX = -1, maxX = -1;
    
    for (var x = 50; x < w - 50; x += 4) {
      var idx = (scanY * w + x) * 4;
      var r = data[idx], g = data[idx + 1], b = data[idx + 2];
      // Renklilik kontrolü (renkli pikseller gemiyi temsil eder, siyah/gri/yıldızları eler)
      var maxColor = Math.max(r, g, b);
      var minColor = Math.min(r, g, b);
      if (maxColor > 50 && (maxColor - minColor) > 40) {
        if (minX === -1) minX = x;
        maxX = x;
      }
    }

    if (minX !== -1 && maxX !== -1) {
      _shipX = Math.round((minX + maxX) / 2);
      _shipWidth = maxX - minX;
      _shipY = scanY;
    }

    // 2. Tehlikeleri Algıla (Düşman lazerleri veya süzülen canavarlar)
    // Geminin üzerindeki koridor taranır
    var threatLeft = 0, threatRight = 0;
    var detectHeight = 120;
    var startY = _shipY - detectHeight;
    var endY = _shipY - 15;
    var detectWidth = Math.max(80, _shipWidth + 20);

    for (var dy = startY; dy < endY; dy += 6) {
      for (var dx = _shipX - detectWidth/2; dx < _shipX + detectWidth/2; dx += 6) {
        if (dx < 0 || dx >= w) continue;
        var idx = (dy * w + Math.round(dx)) * 4;
        var r = data[idx], g = data[idx + 1], b = data[idx + 2];
        
        var maxColor = Math.max(r, g, b);
        var minColor = Math.min(r, g, b);
        
        // Siyah (arka plan) ve beyaz (yıldızlar) olmayan tüm renkli cisimler tehdittir
        if (maxColor > 30 && (maxColor - minColor) > 30) {
          // Oyuncu kendi lazerini elemek için mavi/kırmızı ayrımını filtreleyebilir
          // Ancak basitlik ve güvenlik için geminin üstündeki hareketli renkli her şey tehdittir
          if (dx < _shipX) {
            threatLeft++;
          } else {
            threatRight++;
          }
        }
      }
    }

    // 3. Karar Verme ve Hareket
    var targetDir = _sweepDir;
    
    if (threatLeft > 0 || threatRight > 0) {
      // Tehlike varsa ters yöne kaç
      if (threatLeft > threatRight) {
        targetDir = 1;  // Solda tehlike var, sağa kaç
      } else {
        targetDir = -1; // Sağda tehlike var, sola kaç
      }
    } else {
      // Tehlike yoksa süpürme hareketine devam et
      if (_shipX > w - 80) {
        _sweepDir = -1; // Sınıra geldik, sola dön
      } else if (_shipX < 80) {
        _sweepDir = 1;  // Sınıra geldik, sağa dön
      }
      targetDir = _sweepDir;
    }

    // Tuşları yönlendir
    if (targetDir === 1) {
      _setKeyState('ArrowLeft', false);
      _setKeyState('ArrowRight', true);
    } else if (targetDir === -1) {
      _setKeyState('ArrowRight', false);
      _setKeyState('ArrowLeft', true);
    }

    // Sürekli ateş et
    if (Date.now() - _lastSpace > _spaceInterval) {
      _lastSpace = Date.now();
      _pressSpace();
    }
  }

  function _start() {
    if (_botActive) return;
    _botActive = true;
    console.log('[RC-TB] ✅ Token Blaster bot BAŞLADI');
    if (window.updateRCStatus) window.updateRCStatus('[RC] 🚀 Token Blaster Bot aktif');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();
    _loopId = setInterval(_scan, 40);
  }

  function _stop() {
    if (!_botActive) return;
    _botActive = false;
    if (_loopId) { clearInterval(_loopId); _loopId = null; }
    _setKeyState('ArrowLeft', false);
    _setKeyState('ArrowRight', false);
    _setKeyState('Space', false);
    console.log('[RC-TB] ⏹ Token Blaster bot DURDU');
    if (window.updateRCStatus) window.updateRCStatus('[RC] 🚀 Token Blaster Bot durdu');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();
  }

  document.addEventListener('fullscreenchange', function () {
    if (!!document.fullscreenElement && _isGame()) _start();
    else if (!document.fullscreenElement) _stop();
  });

  setInterval(function () {
    var enabled = !(window._rcBotEnabled && window._rcBotEnabled['botBlasterEnabled'] === false);
    var big = _isBigCanvas() && _isGame() && enabled;
    if (big && !_botActive)  _start();
    if (!big && _botActive)  _stop();
  }, 500);

  window._rcTokenBlaster = { start: _start, stop: _stop, isActive: function () { return _botActive; } };
})();
