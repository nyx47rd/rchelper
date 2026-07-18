/* ══════════════════════════════════════════════════════════════════
   RC Helper — Hamster Climber Auto-Bot
   Yalnızca /game/play_game sayfasına inject edilir (manifest.json)
   Tetikleyici: canvas tam ekran yapılınca otomatik başlar
   Mekanik: hedef renk (55,173,67) canvas'ta görününce SPACE bas
   ══════════════════════════════════════════════════════════════════ */
(function () {
  var _botActive   = false;
  var _loopId      = null;
  var _offscreen   = null;
  var _ctx         = null;
  var _lastSpace   = 0;
  var _cooldownMs  = 80;   /* space basımları arası min bekleme */
  var _tolerance   = 2;    /* renk toleransı — Python ile aynı */

  /* Hedef yeşil renk */
  var TARGET_R = 55, TARGET_G = 173, TARGET_B = 67;

  function _isGame() {
    var curGame = (document.body.getAttribute('data-rc-current-game') || '').toLowerCase();
    if (curGame.includes('hamster climber') || curGame.includes('hamsterclimber')) {
      return true;
    }
    var sources = [
      document.title || '',
      window.location.href || ''
    ];
    return sources.some(function(s) {
      var n = s.toLowerCase();
      return n.includes('hamster climber') || n.includes('hamsterclimber');
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

  function _inRange(a, b) { return Math.abs(a - b) <= _tolerance; }

  function _isTarget(r, g, b) {
    return _inRange(r, TARGET_R) && _inRange(g, TARGET_G) && _inRange(b, TARGET_B);
  }

  /* Oyun sonu rengi: r=3, g=225, b=228 */
  function _isGameOver(r, g, b) {
    return r === 3 && g === 225 && b === 228;
  }

  function _pressSpace() {
    /* Canvas'a ve document'a keydown/keyup dispatch et */
    var canvas = _getCanvas();
    var target = canvas || document.body;
    var down = new KeyboardEvent('keydown', { key: ' ', code: 'Space', keyCode: 32, bubbles: true, cancelable: true });
    var up   = new KeyboardEvent('keyup',   { key: ' ', code: 'Space', keyCode: 32, bubbles: true, cancelable: true });
    target.dispatchEvent(down);
    target.dispatchEvent(up);
    /* Phaser bazı oyunlarda window'u dinler */
    window.dispatchEvent(down);
    window.dispatchEvent(up);
    console.log('[RC-HC] ⬆ Space basıldı');
  }

  function _scan() {
    if (!_botActive) return;
    var canvas = _getCanvas();
    if (!canvas || !canvas.width || !canvas.height) return;
    if (Date.now() - _lastSpace < _cooldownMs) return;
    if (!_ensureOffscreen(canvas.width, canvas.height)) return;

    try { _ctx.drawImage(canvas, 0, 0); }
    catch (e) {
      console.warn('[RC-HC] Canvas okunamıyor:', e.message);
      _stop();
      return;
    }

    var w = canvas.width, h = canvas.height, step = 15;
    var data;
    try { data = _ctx.getImageData(0, 0, w, h).data; }
    catch (e) { return; }

    for (var x = 0; x < w; x += step) {
      for (var y = 0; y < h; y += step) {
        var idx = (y * w + x) * 4;
        var r = data[idx], g = data[idx + 1], b = data[idx + 2];

        if (_isGameOver(r, g, b)) {
          _stop();
          return;
        }

        if (_isTarget(r, g, b)) {
          _lastSpace = Date.now();
          _pressSpace();
          return;
        }
      }
    }
  }

  function _start() {
    if (_botActive) return;
    _botActive = true;
    console.log('[RC-HC] ✅ Hamster Climber bot BAŞLADI');
    if (window.updateRCStatus) window.updateRCStatus('[RC] 🐹 Hamster Climber Bot aktif');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();
    _loopId = setInterval(_scan, 50);
  }

  function _stop() {
    if (!_botActive) return;
    _botActive = false;
    if (_loopId) { clearInterval(_loopId); _loopId = null; }
    console.log('[RC-HC] ⏹ Hamster Climber bot DURDU');
    if (window.updateRCStatus) window.updateRCStatus('[RC] 🐹 Hamster Climber Bot durdu');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();
  }

  function _isOnPlayPage() {
    return window.location.href.includes('/play_game');
  }

  /* Fullscreen API'yi de dinle (bazı tarayıcılarda çalışır) */
  document.addEventListener('fullscreenchange', function () {
    if (!!document.fullscreenElement && _isGame()) _start();
    else if (!document.fullscreenElement) _stop();
  });

  /* Ana tetikleyici: sayfa ve canvas hazır olduğunda başlat */
  setInterval(function () {
    var enabled = !(window._rcBotEnabled && window._rcBotEnabled['botHamsterEnabled'] === false);
    var active = _isOnPlayPage() && _isGame() && !!_getCanvas() && enabled;
    if (active && !_botActive)  _start();
    if (!active && _botActive)  _stop();
  }, 500);

  window._rcHamsterClimber = { start: _start, stop: _stop, isActive: function () { return _botActive; } };
  window._rcHamster = window._rcHamsterClimber;
})();
