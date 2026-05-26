/* ══════════════════════════════════════════════════════════════════
   RC Helper — Crypto Hamster Auto-Bot
   Mekanik: ArrowLeft / ArrowRight ile karakter hareket eder
   Strateji: Canvas frame diff ile engel yönünü tespit et,
             karakterin önündeki alanı tara, boş tarafa kaç
   Canvas: 960x720, karakter merkezi ~x=464, y=290
   ══════════════════════════════════════════════════════════════════ */
(function () {
  var _botActive  = false;
  var _loopId     = null;
  var _INTERVAL   = 80;   /* ms — hızlı tepki gerekli */

  var _offscreen  = null;
  var _ctx        = null;
  var _prevData   = null; /* önceki frame piksel verisi */

  /* Canvas bilgileri (analiz raporundan) */
  var _CW = 960, _CH = 720;

  /* Karakter bölgesi: analiz raporunda x=464-480, y=256-320 */
  var _CHAR_X = 464, _CHAR_Y = 288;
  var _CHAR_W = 32,  _CHAR_H = 48;

  /* Tehlike tespiti için tarama bandı:
     Karakterin soluna ve sağına bak (engel var mı?) */
  var _SCAN_Y1     = 200;  /* tarama üst sınır */
  var _SCAN_Y2     = 400;  /* tarama alt sınır */
  var _SCAN_MARGIN = 120;  /* karakterin ne kadar soluna/sağına bak */

  /* Arka plan renkleri (analiz: #414a59 ve #242636) */
  function _isBg(r, g, b) {
    /* Ana arka plan #414a59 */
    if (r > 50 && r < 80 && g > 60 && g < 90 && b > 75 && b < 105) return true;
    /* Koyu #242636 */
    if (r < 50 && g < 55 && b < 70) return true;
    /* Mavi-gri zemin tonları */
    if (r > 80 && r < 110 && g > 95 && g < 120 && b > 120 && b < 155) return true;
    return false;
  }

  /* Engel var mı? (non-bg piksel yoğunluğu) */
  function _obstacleScore(data, w, x1, x2, y1, y2) {
    var score = 0;
    var step  = 4;
    for (var y = y1; y < y2; y += step) {
      for (var x = x1; x < x2; x += step) {
        if (x < 0 || x >= w || y < 0 || y >= _CH) continue;
        var idx = (y * w + x) * 4;
        var r = data[idx], g = data[idx+1], b = data[idx+2];
        if (!_isBg(r, g, b)) score++;
      }
    }
    return score;
  }

  /* Hareket eden engelleri tespit et (frame diff) */
  function _motionScore(prevData, currData, w, x1, x2, y1, y2) {
    if (!prevData) return 0;
    var score = 0;
    var step  = 4;
    for (var y = y1; y < y2; y += step) {
      for (var x = x1; x < x2; x += step) {
        if (x < 0 || x >= w || y < 0 || y >= _CH) continue;
        var idx = (y * w + x) * 4;
        var dr = Math.abs(currData[idx]   - prevData[idx]);
        var dg = Math.abs(currData[idx+1] - prevData[idx+1]);
        var db = Math.abs(currData[idx+2] - prevData[idx+2]);
        if (dr + dg + db > 40) score++;
      }
    }
    return score;
  }

  function _isGame() {
    var sources = [
      (window._activeGame && window._activeGame.name) || '',
      window.currentPlayingGame || '',
      window.lastSelectedGame   || '',
      document.title            || '',
      window.location.href      || ''
    ];
    return sources.some(function(s) {
      var n = s.toLowerCase();
      return n.includes('crypto hamster') || n.includes('cryptohamster');
    });
  }

  function _isOnPlayPage() {
    return window.location.href.includes('/play_game');
  }

  function _getCanvas() {
    return document.querySelector('#phaserGame canvas') || document.querySelector('canvas');
  }

  function _ensureOffscreen(w, h) {
    if (_offscreen && _offscreen.width === w && _offscreen.height === h) return true;
    _offscreen = document.createElement('canvas');
    _offscreen.width = w; _offscreen.height = h;
    _ctx = _offscreen.getContext('2d', { willReadFrequently: true });
    return !!_ctx;
  }

  function _pressKey(key) {
    var codes = { ArrowLeft: 37, ArrowRight: 39 };
    var opts  = { key: key, code: key, keyCode: codes[key], which: codes[key],
                  bubbles: true, cancelable: true };
    var canvas = _getCanvas();
    [window, document, canvas].forEach(function(t) {
      if (!t) return;
      t.dispatchEvent(new KeyboardEvent('keydown', opts));
      setTimeout(function() {
        t.dispatchEvent(new KeyboardEvent('keyup', opts));
      }, 40);
    });
  }

  var _lastMove    = 0;
  var _moveCooldown = 120; /* ms — aynı yöne çok hızlı basma */
  var _lastDir     = null;
  var _stuckCount  = 0;

  function _tick() {
    if (!_botActive) return;
    var canvas = _getCanvas();
    if (!canvas) return;

    var w = canvas.width, h = canvas.height;
    if (!_ensureOffscreen(w, h)) return;

    var currData;
    try {
      _ctx.drawImage(canvas, 0, 0);
      currData = _ctx.getImageData(0, 0, w, h).data;
    } catch(e) { return; }

    var now = Date.now();

    /* Karakterin solundaki ve sağındaki tehlike skorları */
    var charLeft  = Math.max(0, _CHAR_X - _SCAN_MARGIN);
    var charRight = Math.min(w - 1, _CHAR_X + _CHAR_W + _SCAN_MARGIN);
    var charMidL  = _CHAR_X;
    var charMidR  = _CHAR_X + _CHAR_W;

    /* Sol bölge: karakter sol kenarından sola */
    var leftObstacle  = _obstacleScore(currData, w, charLeft, charMidL, _SCAN_Y1, _SCAN_Y2);
    var leftMotion    = _motionScore(_prevData, currData, w, charLeft, charMidL, _SCAN_Y1, _SCAN_Y2);

    /* Sağ bölge: karakter sağ kenarından sağa */
    var rightObstacle = _obstacleScore(currData, w, charMidR, charRight, _SCAN_Y1, _SCAN_Y2);
    var rightMotion   = _motionScore(_prevData, currData, w, charMidR, charRight, _SCAN_Y1, _SCAN_Y2);

    /* Yakında engel var mı? (hareket + varlık birlikte) */
    var leftDanger  = leftObstacle  * 0.4 + leftMotion  * 0.6;
    var rightDanger = rightObstacle * 0.4 + rightMotion * 0.6;

    var dir = null;

    if (leftDanger > 20 && rightDanger > 20) {
      /* Her iki taraf tehlikeli → daha az tehlikeli olanı seç */
      dir = (leftDanger < rightDanger) ? 'ArrowLeft' : 'ArrowRight';
    } else if (leftDanger > 20) {
      dir = 'ArrowRight'; /* soldan tehlike → sağa kaç */
    } else if (rightDanger > 20) {
      dir = 'ArrowLeft';  /* sağdan tehlike → sola kaç */
    }

    /* Takılma koruması: uzun süre aynı yönde gidiyorsa ters dön */
    if (dir === _lastDir) {
      _stuckCount++;
      if (_stuckCount > 15) {
        dir = (dir === 'ArrowLeft') ? 'ArrowRight' : 'ArrowLeft';
        _stuckCount = 0;
      }
    } else {
      _stuckCount = 0;
    }

    if (dir && (now - _lastMove) >= _moveCooldown) {
      _pressKey(dir);
      _lastDir  = dir;
      _lastMove = now;
    }

    _prevData = currData;
  }

  function _start() {
    if (_botActive) return;
    _botActive = true;
    _prevData  = null;
    console.log('[RC-CH] ✅ Crypto Hamster bot BAŞLADI');
    if (window.updateRCStatus) window.updateRCStatus('[RC] 🐹 Crypto Hamster Bot aktif');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();
    _loopId = setInterval(_tick, _INTERVAL);
  }

  function _stop() {
    if (!_botActive) return;
    _botActive = false;
    _prevData  = null;
    if (_loopId) { clearInterval(_loopId); _loopId = null; }
    console.log('[RC-CH] ⏹ Crypto Hamster bot DURDU');
    if (window.updateRCStatus) window.updateRCStatus('[RC] 🐹 Crypto Hamster Bot durdu');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();
  }

  setInterval(function() {
    var enabled = !(window._rcBotEnabled && window._rcBotEnabled['botCryptoHamsterEnabled'] === false);
    var active  = _isOnPlayPage() && _isGame() && !!_getCanvas() && enabled;
    if (active  && !_botActive) _start();
    if (!active && _botActive)  _stop();
  }, 500);

  window._rcCryptoHamster = { start: _start, stop: _stop, isActive: function() { return _botActive; } };
})();
