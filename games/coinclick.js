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
  var _cooldownMs   = 80;
  var _debugUntil   = 0;   /* debug log bitis zamani */
  var _TOL          = 15;  /* renk toleransi: +/-15 */

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

  function _near(a, t) { return Math.abs(a - t) <= _TOL; }

  /* Renk eşleşme — toleranslı */
  function _isCoin(r, g, b) {
    if (_near(r,0)   && _near(b,183))               return true; /* DASH */
    if (_near(r,200) && _near(b,64))                return true; /* DOGE */
    if (_near(r,231) && _near(b,33))                return true; /* BTC  */
    if (_near(r,230) && _near(b,230) && _near(r,g)) return true; /* LTC  */
    if (_near(r,66)  && _near(g,105) && _near(b,207)) return true; /* ETH */
    return false;
  }

  /* Oyun sonu: mavi-yeşil çerçeve rengi */
  function _isGameOver(r, g, b) {
    return _near(r,3) && _near(g,225) && _near(b,228);
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
    if (!_ensureOffscreen(canvas.width, canvas.height)) return;

    try { _ctx.drawImage(canvas, 0, 0); }
    catch (e) {
      console.warn('[RC-CC] Canvas okunamıyor:', e.message);
      _stop();
      return;
    }

    var w = canvas.width, h = canvas.height, step = 5;
    var data;
    try { data = _ctx.getImageData(0, 0, w, h).data; }
    catch (e) { return; }

    var debugNow = Date.now() < _debugUntil;
    var sampleColors = [];

    for (var x = 0; x < w; x += step) {
      for (var y = 0; y < h; y += step) {
        var idx = (y * w + x) * 4;
        var r = data[idx], g = data[idx + 1], b = data[idx + 2];

        /* Debug: ilk 5 saniyede farkli renkleri topla */
        if (debugNow && sampleColors.length < 8) {
          var key = Math.round(r/30)*30+','+Math.round(g/30)*30+','+Math.round(b/30)*30;
          if (!sampleColors.includes(key)) sampleColors.push(key);
        }

        if (_isGameOver(r, g, b)) { _stop(); return; }
        if (_isCoin(r, g, b)) {
          _lastHit = Date.now();
          _clickCanvas(canvas, x, y);
          console.log('[RC-CC] 🪙 Coin tıklandı:', x, y, 'rgb('+r+','+g+','+b+')');
          return;
        }
      }
    }
    if (debugNow && sampleColors.length > 0) {
      console.log('[RC-CC] 🔍 Canvasta görülen renkler (~30 yuvarlak):', sampleColors.join(' | '));
    }
  }

  function _start() {
    if (_botActive) return;
    _botActive = true;
    _debugUntil = Date.now() + 10000; /* 10 sn debug */
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
