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
  var _cfCooldownMs  = 40;   /* ms: tıklamalar arası bekleme */
  var _cfBlocked     = [];   /* { x, y, until } */
  var _cfBlockMs     = 250;  /* ms: bir nokta ne kadar bloklu kalır */
  var _cfBlockRadius = 20;   /* piksel yarıçap */
  var _cfClusterR    = 60;   /* piksel: küme yarıçapı */
  /* Hareket takibi: { cx, cy, vx, vy, ts } */
  var _cfTracked     = [];   /* son 5 framedeki coin konumları */
  var _cfMaxTrack    = 6;    /* kaç frame geçmiş tutulsun */

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

  /* Adayları kümelere ayır; her küme için merkez + sayı döndür */
  function _cluster(candidates) {
    var clusters = [];
    candidates.forEach(function (c) {
      var found = null;
      for (var i = 0; i < clusters.length; i++) {
        var cl = clusters[i];
        if (Math.abs(cl.cx - c.x) < _cfClusterR && Math.abs(cl.cy - c.y) < _cfClusterR) {
          found = cl; break;
        }
      }
      if (found) {
        found.cx = Math.round((found.cx * found.count + c.x) / (found.count + 1));
        found.cy = Math.round((found.cy * found.count + c.y) / (found.count + 1));
        found.count++;
      } else {
        clusters.push({ cx: c.x, cy: c.y, count: 1 });
      }
    });
    return clusters;
  }

  /* Hareket tahmini: coin in _cfTracked geçmişinden velocity hesapla */
  function _predictHit(cx, cy) {
    var now = Date.now();
    /* Yakın geçmişteki bu coin için eşleşen kayıtlar */
    var hist = _cfTracked.filter(function (t) {
      return Math.abs(t.cx - cx) < _cfClusterR && Math.abs(t.cy - cy) < _cfClusterR;
    });
    if (hist.length < 2) return { px: cx, py: cy }; /* yeterli veri yok, olduğu yere tıkla */

    /* Son iki kayıttan hız hesapla */
    var a = hist[hist.length - 2];
    var b = hist[hist.length - 1];
    var dt = b.ts - a.ts;
    if (dt <= 0) return { px: cx, py: cy };
    var vx = (b.cx - a.cx) / dt; /* px/ms */
    var vy = (b.cy - a.cy) / dt;

    /* İnternet gecikme tahmini ~60ms + tıklama işleme ~40ms = 100ms */
    var lag = 100;
    return {
      px: Math.round(cx + vx * lag),
      py: Math.round(cy + vy * lag)
    };
  }

  /* Mevcut frame coinlerini geçmiş listesine ekle */
  function _trackCoins(clusters) {
    var now = Date.now();
    clusters.forEach(function (cl) {
      _cfTracked.push({ cx: cl.cx, cy: cl.cy, ts: now });
    });
    /* Sadece son _cfMaxTrack * cluster_count kadar tut */
    if (_cfTracked.length > _cfMaxTrack * 10) {
      _cfTracked = _cfTracked.slice(-_cfMaxTrack * 10);
    }
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

    var w = canvas.width, h = canvas.height, step = 12, margin = 30;
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

    if (candidates.length === 0) return;

    /* Küme analizi yap */
    var clusters = _cluster(candidates);

    /* Hareket geçmişine kaydet */
    _trackCoins(clusters);

    /* En büyük kümeyi (en çok coin bir arada) seç */
    clusters.sort(function (a, b) { return b.count - a.count; });

    /* Bloklu olmayan en büyük kümeyi bul */
    var best = null;
    for (var i = 0; i < clusters.length; i++) {
      if (!_isBlocked(clusters[i].cx, clusters[i].cy)) {
        best = clusters[i];
        break;
      }
    }
    if (!best) {
      _cfBlocked = [];
      best = clusters[0];
    }

    /* Hareket tahminiyle hedef koordinatı hesapla */
    var predicted = _predictHit(best.cx, best.cy);
    /* Sınır dışına çıkma */
    predicted.px = Math.max(margin, Math.min(w - margin, predicted.px));
    predicted.py = Math.max(margin, Math.min(h - margin, predicted.py));

    _cfLastHit = Date.now();
    _clickCanvas(canvas, predicted.px, predicted.py);
  }

  function _cfStart() {
    if (_cfBotActive) return;
    _cfBotActive = true;
    console.log('[RC-CF] ✅ Coin Fisher bot BAŞLADI');
    if (window.updateRCStatus) window.updateRCStatus('[RC] 🎣 Coin Fisher Bot aktif');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();
    _cfLoopId = setInterval(_cfScan, 20);
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
