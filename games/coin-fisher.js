/* ══════════════════════════════════════════════════════════════════
   RC Helper — Coin Fisher Auto-Bot
   Yalnızca /game/play_game sayfasına inject edilir (manifest.json)
   Tetikleyici: canvas tam ekran yapılınca otomatik başlar
   ══════════════════════════════════════════════════════════════════ */
(function () {
  var _cfBotActive   = false;
  var _cfLoopId      = null;
  var _cfOffscreen   = null;
  var _cfCtx         = null;
  var _cfLastHit     = 0;
  var _cfCooldownMs  = 80;   /* ms: tıklamalar arası bekleme */
  var _cfBlocked     = [];   /* { x, y, until } */
  var _cfBlockMs     = 400;  /* ms: bir nokta ne kadar bloklu kalır */
  var _cfBlockRadius = 25;   /* piksel yarıçap */

  /* Coin Fisher oyununda mıyız? */
  function _isCoinFisher() {
    var sources = [
      (window._activeGame && window._activeGame.name) || '',
      window.currentPlayingGame || '',
      window.lastSelectedGame || '',
      document.title || ''
    ];
    return sources.some(function(s) {
      var n = s.toLowerCase();
      return n.includes('coin fisher') || n.includes('coinfisher');
    });
  }

  function _getCanvas() {
    return document.querySelector('#phaserGame canvas') ||
           document.querySelector('canvas');
  }

  function _ensureOffscreen(w, h) {
    if (_cfOffscreen && _cfOffscreen.width === w && _cfOffscreen.height === h) return true;
    try {
      _cfOffscreen = document.createElement('canvas');
      _cfOffscreen.width  = w;
      _cfOffscreen.height = h;
      _cfCtx = _cfOffscreen.getContext('2d', { willReadFrequently: true });
      return !!_cfCtx;
    } catch (e) { return false; }
  }

  function _isCoin(r, g, b) {
    if (r > 240 && g > 130 && g < 170 && b < 50)                          return true; /* BTC */
    if (r > 220 && g > 190 && b > 80  && b < 120)                         return true; /* DOGE/GOLD */
    if (r > 110 && r < 150 && g > 130 && g < 180 && b > 240)              return true; /* ETH */
    if (r > 210 && g > 210 && b > 210 && Math.abs(r - b) < 5)             return true; /* LTC */
    if (r < 50  && g > 100 && g < 150 && b > 190 && b < 230)              return true; /* DASH */
    return false;
  }

  function _isBlocked(x, y) {
    var now = Date.now();
    _cfBlocked = _cfBlocked.filter(function (b) { return b.until > now; });
    return _cfBlocked.some(function (b) {
      return Math.abs(b.x - x) < _cfBlockRadius && Math.abs(b.y - y) < _cfBlockRadius;
    });
  }

  function _blockCoord(x, y) {
    _cfBlocked.push({ x: x, y: y, until: Date.now() + _cfBlockMs });
  }

  function _clickCanvas(canvas, cx, cy) {
    var rect    = canvas.getBoundingClientRect();
    var clientX = rect.left + cx * (rect.width  / canvas.width);
    var clientY = rect.top  + cy * (rect.height / canvas.height);
    var opts = { bubbles: true, cancelable: true, clientX: clientX, clientY: clientY };
    canvas.dispatchEvent(new MouseEvent('mousedown', opts));
    canvas.dispatchEvent(new MouseEvent('mouseup',   opts));
    canvas.dispatchEvent(new MouseEvent('click',     opts));
    console.log('[RC-CF] 🪙 Coin tıklandı:', cx, cy);
    /* Aninda blokla — setTimeout yoktu, gecikme nedeniyle ayni nokta tekrar seçiliyordu */
    _blockCoord(cx, cy);
  }

  function _cfScan() {
    if (!_cfBotActive) return;
    var canvas = _getCanvas();
    if (!canvas || !canvas.width || !canvas.height) return;
    if (Date.now() - _cfLastHit < _cfCooldownMs) return;
    if (!_ensureOffscreen(canvas.width, canvas.height)) return;

    try { _cfCtx.drawImage(canvas, 0, 0); }
    catch (e) {
      console.warn('[RC-CF] Canvas okunamıyor (tainted):', e.message);
      _cfStop();
      return;
    }

    var w = canvas.width, h = canvas.height, step = 18, margin = 50;
    var data;
    try { data = _cfCtx.getImageData(0, 0, w, h).data; }
    catch (e) { return; }

    var candidates = [];
    for (var x = margin; x < w - margin; x += step) {
      for (var y = margin; y < h - margin; y += step) {
        var idx = (y * w + x) * 4;
        if (_isCoin(data[idx], data[idx + 1], data[idx + 2])) {
          candidates.push({ x: x, y: y });
        }
      }
    }

    var available = candidates.filter(function (c) { return !_isBlocked(c.x, c.y); });
    if (available.length === 0 && candidates.length > 0) {
      _cfBlocked = [];
      available = candidates;
    }
    if (available.length > 0) {
      /* Rastgele aday seç — hep sol üstten başlamayı önle */
      var pick = available[Math.floor(Math.random() * available.length)];
      _cfLastHit = Date.now();
      _clickCanvas(canvas, pick.x, pick.y);
    }
  }

  function _cfStart() {
    if (_cfBotActive) return;
    _cfBotActive = true;
    console.log('[RC-CF] ✅ Coin Fisher bot BAŞLADI');
    if (window.updateRCStatus) window.updateRCStatus('[RC] 🎣 Coin Fisher Bot aktif');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();
    _cfLoopId = setInterval(_cfScan, 30);
  }

  function _cfStop() {
    if (!_cfBotActive) return;
    _cfBotActive = false;
    if (_cfLoopId) { clearInterval(_cfLoopId); _cfLoopId = null; }
    console.log('[RC-CF] ⏹ Coin Fisher bot DURDU');
    if (window.updateRCStatus) window.updateRCStatus('[RC] 🎣 Coin Fisher Bot durdu');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();
  }

  /* Canvas "büyük" mü? — fullscreen API yerine boyut kontrolü */
  function _isBigCanvas() {
    var c = _getCanvas();
    if (!c) return false;
    var rect = c.getBoundingClientRect();
    /* canvas genişliği viewport'un %60'ından büyükse aktif say */
    return rect.width > window.innerWidth * 0.6;
  }

  /* Fullscreen API'yi de dinle (bazı tarayıcılarda çalışır) */
  document.addEventListener('fullscreenchange', function () {
    if (!!document.fullscreenElement && _isCoinFisher()) _cfStart();
    else if (!document.fullscreenElement) _cfStop();
  });

  /* Ana tetikleyici: canvas büyüdüğünde başlat, küçüldüğünde durdur */
  setInterval(function () {
    var enabled = !(window._rcBotEnabled && window._rcBotEnabled['botFisherEnabled'] === false);
    var big = _isBigCanvas() && _isCoinFisher() && enabled;
    if (big && !_cfBotActive)  _cfStart();
    if (!big && _cfBotActive)  _cfStop();
  }, 500);

  window._rcCoinFisher = {
    start:    _cfStart,
    stop:     _cfStop,
    isActive: function () { return _cfBotActive; }
  };
})();
