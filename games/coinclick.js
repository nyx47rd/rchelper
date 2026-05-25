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
  var _MARGIN       = 100;  /* canvas kenarinda bu kadar piksel tarama disi */

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

  /* Gokyuzu/arka plan renklerini ele: turuncu(226,137,79), kahve, gri tas */
  function _isBackground(r, g, b) {
    /* Turuncu gokyuzu: R yuksek, G orta, B orta-yuksek (>60) */
    if (r > 180 && g > 80 && g < 180 && b > 50 && b < 140) return true;
    /* Gri tas/duvar: hepsi 80-235 arasi ve birbirine yakin (207,206,203 gibi) */
    if (r > 70 && g > 60 && b > 50 &&
        Math.max(r,g,b) - Math.min(r,g,b) < 15) return true;
    return false;
  }

  /* Coin tipi dondur, null ise coin degil */
  function _coinType(r, g, b) {
    if (_isBackground(r, g, b)) return null;
    /* MAVI oval (ETH/DASH): B cok baskın */
    if (b > r + 90 && b > g + 30 && b > 140)       return 'BLUE';
    /* TURUNCU oval (BTC): R baskın, B COK dusuk (<50) - gokyuzunden fark bu */
    if (r > 180 && r > g + 60 && b < 50)           return 'BTC';
    /* ALTIN/SARI (DOGE): R ve G yuksek, B cok dusuk */
    if (r > 170 && g > 140 && b < 60)              return 'DOGE';
    /* GUMUS/BEYAZ (LTC): hepsi 220+ ve cok parlak - duvar dokusundan (207,206,203) ayri */
    if (r > 220 && g > 220 && b > 220 &&
        Math.max(r,g,b) - Math.min(r,g,b) < 20)   return 'LTC';
    /* ETH mor-mavi */
    if (b > 150 && r > 40 && r < 120 && g > 60 && g < 150) return 'ETH';
    return null;
  }

  function _isCoin(r, g, b) { return _coinType(r, g, b) !== null; }

  /* Oyun sonu: parlak mavi-yesil cerceve */
  function _isGameOver(r, g, b) {
    return r < 20 && g > 200 && b > 200;
  }

  function _clickCanvas(canvas, cx, cy) {
    var rect    = canvas.getBoundingClientRect();
    var clientX = rect.left + cx * (rect.width  / canvas.width);
    var clientY = rect.top  + cy * (rect.height / canvas.height);
    var mOpts = { bubbles: true, cancelable: true, clientX: clientX, clientY: clientY };
    var pOpts = { bubbles: true, cancelable: true, clientX: clientX, clientY: clientY,
                  pointerId: 1, pointerType: 'mouse', isPrimary: true };
    canvas.dispatchEvent(new PointerEvent('pointerdown', pOpts));
    canvas.dispatchEvent(new MouseEvent('mousedown', mOpts));
    canvas.dispatchEvent(new PointerEvent('pointerup',   pOpts));
    canvas.dispatchEvent(new MouseEvent('mouseup',   mOpts));
    canvas.dispatchEvent(new MouseEvent('click',     mOpts));
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
        var ctype = _coinType(r, g, b);
        if (ctype) {
          _lastHit = Date.now();
          _clickCanvas(canvas, x, y);
          console.log('[RC-CC] 🪙', ctype, 'tiklandi:', x, y, 'rgb('+r+','+g+','+b+')');
          return;
        }
      }
    }
    /* Coin bulunamadiysa debug modda en parlak 5 regi logla */
    if (debugNow) {
      var sample = [], seen = {};
      for (var sx = margin; sx < w - margin && sample.length < 5; sx += 30) {
        for (var sy = margin; sy < h - margin && sample.length < 5; sy += 30) {
          var sp = _avgPixel(data, w, h, sx, sy);
          if (!sp) continue;
          /* Sadece en az bir kanalı yüksek olan parlak pikseller */
          if (Math.max(sp.r, sp.g, sp.b) < 120) continue;
          var key = (sp.r>>4)+','+(sp.g>>4)+','+(sp.b>>4);
          if (!seen[key]) { seen[key] = 1; sample.push(sp.r+','+sp.g+','+sp.b); }
        }
      }
      if (sample.length) console.log('[RC-CC] 🔍 Parlak renkler (coin yok):', sample.join(' | '));
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
