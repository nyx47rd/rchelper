/* ══════════════════════════════════════════════════════════════════
   RC Helper — Crypto Hamster Auto-Bot v2
   Mekanik: Doodle Jump benzeri — karakter sürekli zıplar,
            ArrowLeft/Right ile yatay hareket
   Strateji: Canvas'tan karakter x'i ve altındaki platform x'ini
             tespit et, platform merkezine doğru yönlen
   Canvas: 960x720 (analiz raporundan)
   ══════════════════════════════════════════════════════════════════ */
(function () {
  var _botActive  = false;
  var _loopId     = null;
  var _INTERVAL   = 60;   /* ms — hızlı tepki */

  var _offscreen  = null;
  var _ctx        = null;

  /* Arka plan rengi: #414a59 rgb(65,74,89) — analiz raporundan */
  var BG_R = 65, BG_G = 74, BG_B = 89;

  /* Platform renkleri (analiz: gri #adadad, kahve #8a745c, açık gri #c0c0c0) */
  function _isPlatform(r, g, b) {
    /* Gri platform: #adadad */
    if (r > 150 && r < 200 && g > 150 && g < 200 && b > 150 && b < 200 &&
        Math.abs(r-g) < 25 && Math.abs(g-b) < 25) return true;
    /* Kahverengi platform: #8a745c #6c5b48 #9d866d */
    if (r > 90 && r < 180 && g > 70 && g < 160 && b > 50 && b < 120 &&
        r > g && g > b) return true;
    /* Açık gri: #c0c0c0 */
    if (r > 175 && r < 215 && g > 175 && g < 215 && b > 175 && b < 215) return true;
    return false;
  }

  /* Arka plan mı? */
  function _isBg(r, g, b) {
    var diff = Math.abs(r - BG_R) + Math.abs(g - BG_G) + Math.abs(b - BG_B);
    return diff < 35;
  }

  /* ── Karakter x konumunu bul ──
     Karakteri canvas'ın ortasında ara: y=180~500, x=her yer
     Arka plandan en farklı & en yoğun renk kümesinin merkezi */
  function _findCharX(data, w, h) {
    var colScore = new Float32Array(w);
    var y1 = Math.floor(h * 0.25), y2 = Math.floor(h * 0.75);
    for (var y = y1; y < y2; y += 3) {
      for (var x = 0; x < w; x += 3) {
        var idx = (y * w + x) * 4;
        var r = data[idx], g = data[idx+1], b = data[idx+2];
        if (!_isBg(r, g, b) && !_isPlatform(r, g, b)) {
          /* Arka plan ve platform dışı = karakter pikseli */
          colScore[x]++;
        }
      }
    }
    /* En yoğun sütun bölgesini bul (sliding window 40px) */
    var winW = 40, bestX = -1, bestScore = 0;
    for (var x2 = 0; x2 < w - winW; x2++) {
      var s = 0;
      for (var dx = 0; dx < winW; dx++) s += colScore[x2 + dx];
      if (s > bestScore) { bestScore = s; bestX = x2 + winW / 2; }
    }
    return bestX > 0 ? bestX : Math.floor(w / 2);
  }

  /* ── Karakterin altındaki en yakın platform x merkezini bul ──
     charX etrafında ±300px, charY'nin altında ara */
  function _findPlatformBelow(data, w, h, charX, charY) {
    /* Platformlar karakterin hemen altında veya biraz aşağıda */
    var searchY1 = Math.min(h - 1, charY + 10);
    var searchY2 = Math.min(h - 1, charY + 200);
    var searchX1 = Math.max(0, charX - 350);
    var searchX2 = Math.min(w - 1, charX + 350);

    /* Her satırda platform piksel sayısını say */
    var bestRow = -1, bestRowScore = 0;
    for (var y = searchY1; y < searchY2; y += 2) {
      var rowScore = 0;
      for (var x = searchX1; x < searchX2; x += 3) {
        var idx = (y * w + x) * 4;
        if (_isPlatform(data[idx], data[idx+1], data[idx+2])) rowScore++;
      }
      if (rowScore > bestRowScore) { bestRowScore = rowScore; bestRow = y; }
    }

    if (bestRow < 0 || bestRowScore < 3) return -1;

    /* O satırdaki platform x aralığını bul */
    var minX = w, maxX = 0;
    for (var x3 = searchX1; x3 < searchX2; x3 += 2) {
      var idx2 = (bestRow * w + x3) * 4;
      if (_isPlatform(data[idx2], data[idx2+1], data[idx2+2])) {
        if (x3 < minX) minX = x3;
        if (x3 > maxX) maxX = x3;
      }
    }
    return Math.round((minX + maxX) / 2);
  }

  function _isOnPlayPage() {
    return window.location.href.includes('/play_game');
  }

  function _getCanvas() {
    return document.querySelector('#phaserGame canvas') || document.querySelector('canvas');
  }

  function _isBigCanvas() {
    var c = _getCanvas();
    if (!c) return false;
    return c.getBoundingClientRect().width > window.innerWidth * 0.6;
  }

  /* Canvas köşe renklerini örnekleyerek Crypto Hamster arka planını doğrula
     Baskın renk #414a59 (65,74,89) ise bu oyun */
  function _isCryptoHamsterCanvas() {
    var c = _getCanvas();
    if (!c || c.width < 100 || c.height < 100) return false;
    if (!_ensureOffscreen(c.width, c.height)) return false;
    try { _ctx.drawImage(c, 0, 0); } catch(e) { return false; }
    var matches = 0;
    var samplePoints = [
      [10, 10], [c.width - 10, 10], [10, c.height - 10],
      [c.width - 10, c.height - 10], [Math.floor(c.width/2), Math.floor(c.height*0.1)]
    ];
    try {
      samplePoints.forEach(function(p) {
        var d = _ctx.getImageData(p[0], p[1], 1, 1).data;
        var diff = Math.abs(d[0] - BG_R) + Math.abs(d[1] - BG_G) + Math.abs(d[2] - BG_B);
        if (diff < 40) matches++;
      });
    } catch(e) { return false; }
    return matches >= 2;
  }

  function _ensureOffscreen(w, h) {
    if (_offscreen && _offscreen.width === w && _offscreen.height === h) return true;
    _offscreen = document.createElement('canvas');
    _offscreen.width = w; _offscreen.height = h;
    _ctx = _offscreen.getContext('2d', { willReadFrequently: true });
    return !!_ctx;
  }

  /* Tuşa basılı tut (keydown sürekli) */
  var _heldKey = null;
  function _holdKey(key) {
    if (_heldKey === key) return;
    _releaseKey();
    _heldKey = key;
    var codes = { ArrowLeft: 37, ArrowRight: 39 };
    var canvas = _getCanvas();
    var opts = { key: key, code: key, keyCode: codes[key], which: codes[key],
                 bubbles: true, cancelable: true };
    [window, document, canvas].forEach(function(t) {
      if (t) t.dispatchEvent(new KeyboardEvent('keydown', opts));
    });
  }

  function _releaseKey() {
    if (!_heldKey) return;
    var codes = { ArrowLeft: 37, ArrowRight: 39 };
    var canvas = _getCanvas();
    var opts = { key: _heldKey, code: _heldKey,
                 keyCode: codes[_heldKey], which: codes[_heldKey],
                 bubbles: true, cancelable: true };
    [window, document, canvas].forEach(function(t) {
      if (t) t.dispatchEvent(new KeyboardEvent('keyup', opts));
    });
    _heldKey = null;
  }

  /* Fallback: platform bulunamazsa sağa-sola sallan */
  var _fallbackDir = 'ArrowRight';
  var _fallbackCount = 0;

  function _tick() {
    if (!_botActive) return;
    var canvas = _getCanvas();
    if (!canvas) return;

    var w = canvas.width, h = canvas.height;
    if (!_ensureOffscreen(w, h)) return;

    var data;
    try {
      _ctx.drawImage(canvas, 0, 0);
      data = _ctx.getImageData(0, 0, w, h).data;
    } catch(e) { return; }

    /* Karakter x'ini bul */
    var charX = _findCharX(data, w, h);
    /* Karakter y'si: ortanın biraz altı (analiz: y=264-352 arası) */
    var charY = Math.floor(h * 0.42);

    /* Altındaki platform merkezini bul */
    var platX = _findPlatformBelow(data, w, h, charX, charY);

    if (platX >= 0) {
      /* Platform bulundu: karakteri platform merkezine yönlendir */
      var diff = platX - charX;
      var deadZone = 20; /* bu kadar yakınsa tuş basma */
      _fallbackCount = 0;
      if (diff > deadZone) {
        _holdKey('ArrowRight');
      } else if (diff < -deadZone) {
        _holdKey('ArrowLeft');
      } else {
        _releaseKey(); /* tam üstündeyiz */
      }
    } else {
      /* Platform bulunamadı → fallback: sağa-sola sallan */
      _fallbackCount++;
      if (_fallbackCount % 20 === 0) {
        _fallbackDir = (_fallbackDir === 'ArrowRight') ? 'ArrowLeft' : 'ArrowRight';
      }
      _holdKey(_fallbackDir);
    }
  }

  function _start() {
    if (_botActive) return;
    _botActive = true;
    console.log('[RC-CH] ✅ Crypto Hamster bot BAŞLADI');
    if (window.updateRCStatus) window.updateRCStatus('[RC] 🐹 Crypto Hamster Bot aktif');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();
    _loopId = setInterval(_tick, _INTERVAL);
  }

  function _stop() {
    if (!_botActive) return;
    _botActive = false;
    _releaseKey();
    if (_loopId) { clearInterval(_loopId); _loopId = null; }
    console.log('[RC-CH] ⏹ Crypto Hamster bot DURDU');
    if (window.updateRCStatus) window.updateRCStatus('[RC] 🐹 Crypto Hamster Bot durdu');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();
  }

  setInterval(function() {
    var enabled = !(window._rcBotEnabled && window._rcBotEnabled['botCryptoHamsterEnabled'] === false);
    var active  = _isOnPlayPage() && _isBigCanvas() && _isCryptoHamsterCanvas() && enabled;
    if (active  && !_botActive) _start();
    if (!active && _botActive)  _stop();
  }, 500);

  window._rcCryptoHamster = { start: _start, stop: _stop, isActive: function() { return _botActive; } };
})();
