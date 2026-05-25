/* ══════════════════════════════════════════════════════════════════
   RC Helper — CoinClick Auto-Bot
   Yalnızca /game/play_game sayfasına inject edilir (manifest.json)
   Tetikleyici: canvas tam ekran yapılınca otomatik başlar
   ══════════════════════════════════════════════════════════════════ */
(function () {
  var _botActive    = false;
  var _loopId       = null;
  var _offscreen    = null;
  var _ctx          = null;
  var _lastHit      = 0;
  var _startedAt    = 0;    /* bot ne zaman baslatildi */
  var _warmupMs     = 3000; /* ilk 3sn tiklama yapma, sayim bekleniyor */
  var _cooldownMs   = 80;
  var _debugUntil   = 0;
  var _TOL          = 12;   /* renk toleransi */
  var _MARGIN       = 60;   /* canvas kenarinda bu kadar piksel tarama disi */

  function _isGame() {
    var sources = [
      (window._activeGame && window._activeGame.name) || '',
      window.currentPlayingGame || '',
      window.lastSelectedGame || '',
      document.title || ''
    ];
    return sources.some(function(s) {
      var n = s.toLowerCase();
      return n.includes('coinclick') || n.includes('coin click');
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

  /* 3x3 bolge ortalamasini al - gurultu azalt */
  function _avgPixel(data, w, h, cx, cy) {
    var sr = 0, sg = 0, sb = 0, cnt = 0;
    for (var dx = -2; dx <= 2; dx++) {
      for (var dy = -2; dy <= 2; dy++) {
        var px = cx + dx, py = cy + dy;
        if (px < 0 || py < 0 || px >= w || py >= h) continue;
        var i = (py * w + px) * 4;
        sr += data[i]; sg += data[i+1]; sb += data[i+2];
        cnt++;
      }
    }
    return cnt ? { r: sr/cnt|0, g: sg/cnt|0, b: sb/cnt|0 } : null;
  }

  function _near(a, t) { return Math.abs(a - t) <= _TOL; }

  /* Coin tespiti - ekran goruntusuyle uyumlu renkler:
     ETH/DASH : parlak mavi oval   — yuksek B, dusuk R
     BTC      : turuncu oval       — yuksek R, dusuk B, G orta
                AMA arka plan da turuncu! Fark: coin cok parlak (r>200)
                ve B deger dusuk (<60)
     LTC      : acik gri/gumus     — R,G,B hepsi yuksek ve esit
     DOGE     : altin sari         — yuksek R+G, dusuk B        */
  function _isCoin(r, g, b) {
    /* ETH/mavi oval: R dusuk, B cok yuksek */
    if (r < 80 && b > 160 && g > 80 && g < 220)   return true;
    /* DASH/koyu mavi */
    if (r < 30 && b > 140 && g < 120)             return true;
    /* BTC/turuncu: R cok yuksek (>200), G orta (80-160), B cok dusuk (<60) */
    if (r > 200 && g > 80 && g < 170 && b < 60)   return true;
    /* LTC/gumus: hepsi > 180 ve birbirine yakin */
    if (r > 180 && g > 180 && b > 180 && Math.max(r,g,b)-Math.min(r,g,b) < 30) return true;
    /* DOGE/altin: R+G yuksek, B dusuk */
    if (r > 170 && g > 150 && b < 80)             return true;
    return false;
  }

  /* Oyun sonu: parlak mavi-yesil cerceve */
  function _isGameOver(r, g, b) {
    return r < 20 && g > 200 && b > 200;
  }

  function _clickCanvas(canvas, cx, cy) {
    var rect    = canvas.getBoundingClientRect();
    var clientX = rect.left + cx * (rect.width  / canvas.width);
    var clientY = rect.top  + cy * (rect.height / canvas.height);
    var opts = { bubbles: true, cancelable: true, clientX: clientX, clientY: clientY };
    canvas.dispatchEvent(new MouseEvent('mousedown', opts));
    canvas.dispatchEvent(new MouseEvent('mouseup',   opts));
    canvas.dispatchEvent(new MouseEvent('click',     opts));
  }

  function _scan() {
    if (!_botActive) return;
    var canvas = _getCanvas();
    if (!canvas || !canvas.width || !canvas.height) return;
    if (Date.now() - _lastHit < _cooldownMs) return;
    if (Date.now() - _startedAt < _warmupMs) return;
    if (!_ensureOffscreen(canvas.width, canvas.height)) return;

    try { _ctx.drawImage(canvas, 0, 0); }
    catch (e) {
      console.warn('[RC-CC] Canvas okunamıyor:', e.message);
      _stop();
      return;
    }

    var w = canvas.width, h = canvas.height, step = 8;
    var data;
    try { data = _ctx.getImageData(0, 0, w, h).data; }
    catch (e) { return; }

    var debugNow = Date.now() < _debugUntil;
    var margin = _MARGIN;

    for (var x = margin; x < w - margin; x += step) {
      for (var y = margin; y < h - margin; y += step) {
        var px = _avgPixel(data, w, h, x, y);
        if (!px) continue;
        var r = px.r, g = px.g, b = px.b;

        if (_isGameOver(r, g, b)) { _stop(); return; }
        if (_isCoin(r, g, b)) {
          _lastHit = Date.now();
          _clickCanvas(canvas, x, y);
          console.log('[RC-CC] 🪙 Coin tıklandı:', x, y, 'rgb('+r+','+g+','+b+')');
          return;
        }
      }
    }
    if (debugNow) {
      /* Her 2sn'de bir ornek piksel logla */
      var sample = [];
      for (var sx = margin; sx < w - margin; sx += 40) {
        for (var sy = margin; sy < h - margin; sy += 40) {
          var sp = _avgPixel(data, w, h, sx, sy);
          if (sp) {
            var key = sp.r+','+sp.g+','+sp.b;
            if (sample.length < 6 && !sample.includes(key)) sample.push(key);
          }
        }
      }
      if (sample.length) console.log('[RC-CC] 🔍 Ornek renkler:', sample.join(' | '));
    }
  }

  function _start() {
    if (_botActive) return;
    _botActive = true;
    _startedAt  = Date.now();
    _debugUntil = Date.now() + 13000; /* warmup bittikten sonra 10sn debug */
    console.log('[RC-CC] ✅ CoinClick bot BAŞLADI (10sn debug aktif)');
    if (window.updateRCStatus) window.updateRCStatus('[RC] 🪙 CoinClick Bot aktif');
    _loopId = setInterval(_scan, 50);
  }

  function _stop() {
    if (!_botActive) return;
    _botActive = false;
    if (_loopId) { clearInterval(_loopId); _loopId = null; }
    console.log('[RC-CC] ⏹ CoinClick bot DURDU');
    if (window.updateRCStatus) window.updateRCStatus('[RC] 🪙 CoinClick Bot durdu');
  }

  document.addEventListener('fullscreenchange', function () {
    if (!!document.fullscreenElement && _isGame()) _start();
    else if (!document.fullscreenElement) _stop();
  });

  setInterval(function () {
    var big = _isBigCanvas() && _isGame();
    if (big && !_botActive)  _start();
    if (!big && _botActive)  _stop();
  }, 500);

  window._rcCoinClick = { start: _start, stop: _stop, isActive: function () { return _botActive; } };
})();
