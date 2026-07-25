/* ══════════════════════════════════════════════════════════════════
 R C* Helper — Coin Fisher Gelişmiş Combo ve Salınım Takip Botu
 Yalnızca /game/play_game sayfasına inject edilir (manifest.json)
 Manuel başlatma: window._rcCoinFisher.start()
 ══════════════════════════════════════════════════════════════════ */
(function () {
  var _cfBotActive   = false;
  var _cfLoopId      = null;
  var _cfOffscreen   = null;
  var _cfCtx         = null;
  var _cfBlocked     = [];
  var _cfBlockMs     = 200;  /* ms: bir nokta ne kadar bloklu kalır */
  var _cfBlockRadius = 22;   /* piksel yarıçap */
  var _cfClusterR    = 65;   /* piksel: küme yarıçapı (coin grupları için) */

  /* Küme takip için hafıza (salınım analizi yapar) */
  var _cfClusterTracks = [];

  function _isCoinFisher() {
    var curGame = (document.body.getAttribute('data-rc-current-game') || '').toLowerCase();
    if (curGame.includes('coin fisher') || curGame.includes('coinfisher')) {
      return true;
    }
    var sources = [
      document.title || '',
 window.location.href || ''
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

  /* Adayları kümelere ayır; her küme için merkez, sayı ve içindeki noktaları döndür */
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
        found.points.push(c);
      } else {
        clusters.push({ cx: c.x, cy: c.y, count: 1, points: [c] });
      }
    });
    return clusters;
  }

  /* Küme içinde birbirine çok yakın (aynı coin) olanları ele, tekil coinleri bul */
  function _deduplicatePoints(points, minDist) {
    var result = [];
    points.forEach(function(p) {
      var tooClose = result.some(function(r) {
        return Math.abs(r.x - p.x) < minDist && Math.abs(r.y - p.y) < minDist;
      });
      if (!tooClose) result.push(p);
    });
      return result;
  }

  /* Salınım analizi için kümeyi takip et */
  function _updateClusterTrack(cx, cy) {
    var now = Date.now();
    var found = null;
    for (var i = 0; i < _cfClusterTracks.length; i++) {
      var t = _cfClusterTracks[i];
      var lastPos = t.history[t.history.length - 1];
      if (Math.abs(lastPos.x - cx) < _cfClusterR && Math.abs(lastPos.y - cy) < _cfClusterR) {
        found = t; break;
      }
    }

    if (found) {
      found.history.push({ x: cx, y: cy, ts: now });
      if (found.history.length > 6) found.history.shift(); /* Son 6 frame'i tut */
        found.lastSeen = now;
      return found;
    } else {
      var newTrack = { history: [{ x: cx, y: cy, ts: now }], lastSeen: now };
      _cfClusterTracks.push(newTrack);
      return newTrack;
    }
  }

  /* Eski takip kayıtlarını temizle */
  function _cleanTracks() {
    var now = Date.now();
    _cfClusterTracks = _cfClusterTracks.filter(function(t) {
      return now - t.lastSeen < 600;
    });
  }

  /* Salınım ve hıza dayalı isabet tahmini */
  function _predictHit(track, cx, cy) {
    if (!track || track.history.length < 3) {
      return { px: cx, py: cy }; /* Yeterli veri yok, olduğu yere tıkla */
    }
    var hist = track.history;
    var n = hist.length;

    var p0 = hist[n - 3];
    var p1 = hist[n - 2];
    var p2 = hist[n - 1];

    var dx1 = p1.x - p0.x;
    var dy1 = p1.y - p0.y;
    var dx2 = p2.x - p1.x;
    var dy2 = p2.y - p1.y;

    /* Yön değişimi varsa salınım (bobbing) yapıyor demektir */
    var isBobbing = (dx1 * dx2 < 0) || (dy1 * dy2 < 0);

    if (isBobbing) {
      /* Salınım yapıyorsa uzağa gitme, son konuma çok hafif bir düzeltme yap */
      var dt2 = p2.ts - p1.ts;
      if (dt2 <= 0) return { px: cx, py: cy };
      var vx2 = dx2 / dt2;
      var vy2 = dy2 / dt2;
      return { px: Math.round(cx + vx2 * 20), py: Math.round(cy + vy2 * 20) };
    } else {
      /* Düz çizgi hareketi varsa gelecekteki pozisyonu tahmin et */
      var dt = p2.ts - p1.ts;
      if (dt <= 0) return { px: cx, py: cy };
      var vx = dx2 / dt;
      var vy = dy2 / dt;
      var lag = 60; /* Internet ve render gecikmesi */
      return { px: Math.round(cx + vx * lag), py: Math.round(cy + vy * lag) };
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
  }

  function _cfScan() {
    if (!_cfBotActive) return;
    var canvas = _getCanvas();
    if (!canvas || !canvas.width || !canvas.height) return;
    if (!_ensureOffscreen(canvas.width, canvas.height)) return;

    try { _cfCtx.drawImage(canvas, 0, 0); }
    catch (e) {
      console.warn('[RC-CF] Canvas okunamıyor (tainted):', e.message);
      _cfStop();
      return;
    }

    var w = canvas.width, h = canvas.height, step = 10, margin = 25;
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

    _cleanTracks();

    if (candidates.length === 0) return;

    /* 1. Kümeleme yap ve coin sayısı en çok olan bölgeyi bul */
    var clusters = _cluster(candidates);
    clusters.sort(function (a, b) { return b.count - a.count; });
    var best = clusters[0];

    /* 2. Seçilen kümeyi hafızaya kaydet (salınım analizi için) */
    var track = _updateClusterTrack(best.cx, best.cy);

    /* 3. Küme içindeki tekil coinleri bul (20px'den yakın olanları aynı coin say) */
    var uniqueCoins = _deduplicatePoints(best.points, 20);

    /* 4. Bu kümedeki tüm coinleri aynı anda tıkla (Combo için) */
    for (var i = 0; i < uniqueCoins.length; i++) {
      var coin = uniqueCoins[i];
      if (_isBlocked(coin.x, coin.y)) continue; /* Yakında tıklanmadıysa işle */

        var predicted = _predictHit(track, coin.x, coin.y);
      predicted.px = Math.max(margin, Math.min(w - margin, predicted.px));
      predicted.py = Math.max(margin, Math.min(h - margin, predicted.py));

      _clickCanvas(canvas, predicted.px, predicted.py);
      _blockCoord(coin.x, coin.y); /* Tekrar tıklanmaması için geçici blokla */
    }
  }

  function _cfStart() {
    if (_cfBotActive) return;
    _cfBotActive = true;
    _cfBlocked = [];
    _cfClusterTracks = [];
    console.log('[RC-CF] ✅ Coin Fisher bot BAŞLADI (Gelişmiş Combo Modu)');
    if (window.updateRCStatus) window.updateRCStatus('[RC] 🎣 Coin Fisher Bot aktif');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();
    _cfLoopId = setInterval(_cfScan, 25);
  }

  function _cfStop() {
    if (!_cfBotActive) return;
    _cfBotActive = false;
    if (_cfLoopId) { clearInterval(_cfLoopId); _cfLoopId = null; }
    console.log('[RC-CF] ⏹ Coin Fisher bot DURDU');
    if (window.updateRCStatus) window.updateRCStatus('[RC] 🎣 Coin Fisher Bot durdu');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();
  }

  /* Auto-start (Otomatik başlatma) tamamen kaldırıldı.
   *Sadece manuel kullanım için expose ediliyor. */
  window._rcCoinFisher = {
    start:    _cfStart,
 stop:     _cfStop,
 isActive: function () { return _cfBotActive; }
  };
})();
