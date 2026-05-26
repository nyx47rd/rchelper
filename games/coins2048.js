/* ══════════════════════════════════════════════════════════════════
   RC Helper — 2048 Coins Auto-Bot v2
   Strateji: Canvas board okuma + corner strateji (greedy)
   Tile renk haritası analiz raporundan türetildi
   ══════════════════════════════════════════════════════════════════ */
(function () {
  var _botActive  = false;
  var _loopId     = null;
  var _INTERVAL   = 220;
  var _offscreen  = null;
  var _ctx2048    = null;
  var _lastBoard  = null;
  var _stuckCount = 0;

  /* ── Canvas boyutundan board grid sınırlarını hesapla ── */
  /* Analiz: 960x828 canvas, grid y~110 başlar, 4x4 tile ~190px yükseklik, ~220px genişlik */
  function _getBoardBounds(w, h) {
    /* Üst bar ~%13, alt padding ~%2 */
    var topPad  = Math.round(h * 0.13);
    var botPad  = Math.round(h * 0.02);
    var sidePad = Math.round(w * 0.05);
    return {
      x: sidePad,
      y: topPad,
      w: w - sidePad * 2,
      h: h - topPad - botPad
    };
  }

  /* ── Tile renk haritası (analizden) ── */
  function _isTileColor(r, g, b) {
    /* Boş tile: #6c7aa3 mavi-gri */
    if (r > 90 && r < 130 && g > 105 && g < 145 && b > 145 && b < 185) return false;
    /* Separator/grid çizgisi: #98a7af, #adbec7 */
    if (r > 140 && r < 185 && g > 155 && g < 205 && b > 165 && b < 215) return false;
    /* Genel koyu arka plan */
    if (r < 70 && g < 70 && b < 100) return false;
    return true;
  }

  function _tileValue(r, g, b) {
    /* Boş */
    if (!_isTileColor(r, g, b)) return 0;
    /* Cyan: #03e1e4 → 2 veya 4 */
    if (r < 30 && g > 200 && b > 200) return 2;
    /* Pembe/kırmızımsı: #ffcfcf #fff3f3 #ffe7e7 → 8/16/32 */
    if (r > 230 && g > 190 && b > 190) return 16;
    /* Turuncu/altın: #ec9626 #f4b932 → 64/128 */
    if (r > 200 && g > 130 && b < 80) return 64;
    /* Koyu altın: #ba9f34 #7b6c28 → 256+ */
    if (r > 100 && r < 210 && g > 90 && g < 175 && b < 70) return 256;
    /* Yeşil: #59b89d → 128 */
    if (r < 120 && g > 160 && b > 130 && b < 180) return 128;
    /* Mavi: #6085ec → 32 */
    if (r < 130 && g > 110 && g < 165 && b > 200) return 32;
    /* Koyu mavi: #1c74b0 → 512 */
    if (r < 60 && g > 90 && g < 150 && b > 140 && b < 200) return 512;
    /* Bilinmeyen dolu tile */
    return 1;
  }

  function _isGame() {
    var sources = [
      (window._activeGame && window._activeGame.name) || '',
      window.currentPlayingGame || '',
      window.lastSelectedGame   || '',
      document.title            || '',
      window.location.href      || ''
    ];
    return sources.some(function (s) {
      var n = s.toLowerCase();
      return n.includes('2048');
    });
  }

  function _isOnPlayPage() {
    return window.location.href.includes('/play_game');
  }

  function _getCanvas() {
    return document.querySelector('#phaserGame canvas') || document.querySelector('canvas');
  }

  function _pressKey(key) {
    var opts = { key: key, code: key, keyCode: 0, which: 0,
                 bubbles: true, cancelable: true };
    var codes = { ArrowLeft: 37, ArrowRight: 39, ArrowUp: 38, ArrowDown: 40 };
    opts.keyCode = codes[key]; opts.which = codes[key];
    var canvas = _getCanvas();
    [window, document, canvas].forEach(function(t) {
      if (!t) return;
      t.dispatchEvent(new KeyboardEvent('keydown', opts));
      t.dispatchEvent(new KeyboardEvent('keyup',   opts));
    });
  }

  /* ── Canvas'tan 4x4 board oku ── */
  function _readBoard(canvas) {
    var w = canvas.width, h = canvas.height;
    if (!_offscreen || _offscreen.width !== w || _offscreen.height !== h) {
      _offscreen = document.createElement('canvas');
      _offscreen.width = w; _offscreen.height = h;
      _ctx2048 = _offscreen.getContext('2d', { willReadFrequently: true });
    }
    try { _ctx2048.drawImage(canvas, 0, 0); } catch(e) { return null; }
    var data;
    try { data = _ctx2048.getImageData(0, 0, w, h).data; } catch(e) { return null; }

    var bounds = _getBoardBounds(w, h);
    var tileW  = bounds.w / 4;
    var tileH  = bounds.h / 4;
    var board  = [];

    for (var row = 0; row < 4; row++) {
      var rowArr = [];
      for (var col = 0; col < 4; col++) {
        /* Tile merkezini örnekle (3x3 nokta, majority vote) */
        var votes = {};
        for (var dy = -1; dy <= 1; dy++) {
          for (var dx = -1; dx <= 1; dx++) {
            var px = Math.round(bounds.x + col * tileW + tileW * 0.5 + dx * tileW * 0.2);
            var py = Math.round(bounds.y + row * tileH + tileH * 0.5 + dy * tileH * 0.2);
            px = Math.max(0, Math.min(w-1, px));
            py = Math.max(0, Math.min(h-1, py));
            var idx = (py * w + px) * 4;
            var v = _tileValue(data[idx], data[idx+1], data[idx+2]);
            votes[v] = (votes[v] || 0) + 1;
          }
        }
        var best = 0, bestCount = 0;
        Object.keys(votes).forEach(function(k) {
          if (votes[k] > bestCount) { bestCount = votes[k]; best = parseInt(k); }
        });
        rowArr.push(best);
      }
      board.push(rowArr);
    }
    return board;
  }

  /* ── Board simülasyonu (gerçek 2048 mantığı) ── */
  function _cloneBoard(b) {
    return b.map(function(r) { return r.slice(); });
  }

  function _slideRow(row) {
    var arr = row.filter(function(v) { return v > 0; });
    var merged = [];
    var score  = 0;
    for (var i = 0; i < arr.length; i++) {
      if (i + 1 < arr.length && arr[i] === arr[i+1]) {
        merged.push(arr[i] * 2);
        score += arr[i] * 2;
        i++;
      } else {
        merged.push(arr[i]);
      }
    }
    while (merged.length < 4) merged.push(0);
    return { row: merged, score: score };
  }

  function _applyMove(board, dir) {
    var b    = _cloneBoard(board);
    var score = 0;
    var moved = false;

    if (dir === 'ArrowLeft') {
      for (var r = 0; r < 4; r++) {
        var res = _slideRow(b[r]);
        if (res.row.join() !== b[r].join()) moved = true;
        b[r]  = res.row; score += res.score;
      }
    } else if (dir === 'ArrowRight') {
      for (var r = 0; r < 4; r++) {
        var res = _slideRow(b[r].slice().reverse());
        var newRow = res.row.reverse();
        if (newRow.join() !== b[r].join()) moved = true;
        b[r]  = newRow; score += res.score;
      }
    } else if (dir === 'ArrowUp') {
      for (var c = 0; c < 4; c++) {
        var col = [b[0][c], b[1][c], b[2][c], b[3][c]];
        var res = _slideRow(col);
        for (var rr = 0; rr < 4; rr++) {
          if (b[rr][c] !== res.row[rr]) moved = true;
          b[rr][c] = res.row[rr];
        }
        score += res.score;
      }
    } else if (dir === 'ArrowDown') {
      for (var c = 0; c < 4; c++) {
        var col = [b[0][c], b[1][c], b[2][c], b[3][c]].reverse();
        var res = _slideRow(col);
        var newCol = res.row.reverse();
        for (var rr = 0; rr < 4; rr++) {
          if (b[rr][c] !== newCol[rr]) moved = true;
          b[rr][c] = newCol[rr];
        }
        score += res.score;
      }
    }
    return { board: b, score: score, moved: moved };
  }

  /* ── Heuristic: köşe skoru + boş hücre + merge fırsatları ── */
  function _heuristic(board) {
    var score  = 0;
    var empty  = 0;
    var maxVal = 0;

    /* Ağırlık matrisi: sol-alt köşeye yüksek değerleri topla */
    var weights = [
      [  7,  6,  5,  4],
      [  6,  5,  4,  3],
      [  5,  4,  3,  2],
      [  4,  3,  2,  1]
    ];

    for (var r = 0; r < 4; r++) {
      for (var c = 0; c < 4; c++) {
        var v = board[r][c];
        if (v === 0) { empty++; continue; }
        if (v > maxVal) maxVal = v;
        score += v * weights[r][c];
        /* Komşu eşleşme bonusu */
        if (c < 3 && board[r][c+1] === v) score += v;
        if (r < 3 && board[r+1][c] === v) score += v;
      }
    }
    score += empty * 50;
    /* Maksimum değer köşedeyse büyük bonus */
    if (board[0][0] === maxVal) score += maxVal * 4;
    return score;
  }

  /* ── En iyi hamleri seç (1-seviye lookahead) ── */
  function _bestMove(board) {
    var dirs = ['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp'];
    var best = null, bestScore = -Infinity;

    dirs.forEach(function(dir) {
      var res = _applyMove(board, dir);
      if (!res.moved) return;
      var h = _heuristic(res.board) + res.score * 2;
      if (h > bestScore) { bestScore = h; best = dir; }
    });
    return best;
  }

  function _tick() {
    if (!_botActive) return;
    var canvas = _getCanvas();
    if (!canvas) return;

    /* Board oku */
    var board = _readBoard(canvas);
    var key   = null;

    if (board) {
      /* Board değişmedi mi? (takılı kalmış) */
      var boardStr = JSON.stringify(board);
      if (boardStr === _lastBoard) {
        _stuckCount++;
      } else {
        _stuckCount = 0;
        _lastBoard  = boardStr;
      }

      if (_stuckCount >= 3) {
        /* Takılı → yukarı dene */
        key = 'ArrowUp';
        _stuckCount = 0;
      } else {
        key = _bestMove(board);
      }
    }

    /* Canvas okunamazsa fallback: sol→aşağı döngüsü */
    if (!key) {
      var fallback = ['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowDown'];
      key = fallback[Math.floor(Date.now() / _INTERVAL) % fallback.length];
    }

    _pressKey(key);
  }

  function _start() {
    if (_botActive) return;
    _botActive = true;
    console.log('[RC-2048] ✅ 2048 bot BAŞLADI');
    if (window.updateRCStatus) window.updateRCStatus('[RC] 🔢 2048 Bot aktif');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();
    _loopId = setInterval(_tick, _INTERVAL);
  }

  function _stop() {
    if (!_botActive) return;
    _botActive = false;
    if (_loopId) { clearInterval(_loopId); _loopId = null; }
    console.log('[RC-2048] ⏹ 2048 bot DURDU');
    if (window.updateRCStatus) window.updateRCStatus('[RC] 🔢 2048 Bot durdu');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();
  }

  setInterval(function () {
    var enabled = !(window._rcBotEnabled && window._rcBotEnabled['bot2048Enabled'] === false);
    var active = _isOnPlayPage() && _isGame() && !!_getCanvas() && enabled;
    if (active && !_botActive)  _start();
    if (!active && _botActive)  _stop();
  }, 500);

  window._rc2048 = { start: _start, stop: _stop, isActive: function () { return _botActive; } };
})();
