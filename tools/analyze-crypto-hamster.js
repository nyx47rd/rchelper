/* ══════════════════════════════════════════════════════════════════
   RC Helper — Crypto Hamster Canvas Analyzer
   
   Kullanım:
   1. RollerCoin'de Crypto Hamster oyununu tam ekrana al
   2. F12 → Console → Bu dosyanın içeriğini yapıştır → Enter
   3. 5 saniye oyunu oyna (zıpla, engelleri geç)
   4. "rc-crypto-hamster-analysis.txt" indirilir
   ══════════════════════════════════════════════════════════════════ */

(function () {
  var _offscreen = null;
  var _ctx       = null;
  var _events    = [];  /* yakalanan klavye/mouse eventleri */

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

  function _toHex(r, g, b) {
    return '#' + [r, g, b].map(function(v) { return ('0' + v.toString(16)).slice(-2); }).join('');
  }

  /* ── Klavye ve mouse eventlerini dinle ── */
  var _keyLog = [];
  var _clickLog = [];
  document.addEventListener('keydown', function(e) {
    _keyLog.push({ ts: Date.now(), key: e.key, code: e.code, keyCode: e.keyCode });
  }, true);
  document.addEventListener('click', function(e) {
    _clickLog.push({ ts: Date.now(), x: e.clientX, y: e.clientY, target: e.target.tagName });
  }, true);

  /* ── Snapshot al ── */
  function _snapshot(canvas) {
    var w = canvas.width, h = canvas.height;
    if (!_ensureOffscreen(w, h)) return null;
    try { _ctx.drawImage(canvas, 0, 0); } catch(e) { return null; }
    var data;
    try { data = _ctx.getImageData(0, 0, w, h).data; } catch(e) { return null; }

    /* Tüm canvas'tan step=3 ile renk örnekle */
    var colorMap = {};
    var step = 3;
    for (var y = 0; y < h; y += step) {
      for (var x = 0; x < w; x += step) {
        var idx = (y * w + x) * 4;
        var r = data[idx], g = data[idx+1], b = data[idx+2];
        /* Saf siyah/beyaz atla */
        if (r === 0 && g === 0 && b === 0) continue;
        var hex = _toHex(r, g, b);
        colorMap[hex] = (colorMap[hex] || 0) + 1;
      }
    }

    /* Satır/sütun yoğunluğu — hareket eden obje tespiti için */
    var rowBrightness = [];
    for (var row = 0; row < h; row += 8) {
      var sum = 0, cnt = 0;
      for (var col = 0; col < w; col += 8) {
        var i = (row * w + col) * 4;
        sum += (data[i] + data[i+1] + data[i+2]) / 3;
        cnt++;
      }
      rowBrightness.push({ y: row, avg: Math.round(sum / cnt) });
    }

    /* En parlak 5 satır (karakter/zemin olabilir) */
    rowBrightness.sort(function(a,b){ return b.avg - a.avg; });

    /* En sık 30 renk */
    var sorted = Object.keys(colorMap).map(function(hex) {
      return { hex: hex, count: colorMap[hex],
               r: parseInt(hex.slice(1,3),16),
               g: parseInt(hex.slice(3,5),16),
               b: parseInt(hex.slice(5,7),16) };
    }).sort(function(a,b){ return b.count - a.count; });

    /* Hareket eden objeleri tespit için: önceki frame ile fark */
    return {
      ts: Date.now(),
      canvasW: w, canvasH: h,
      topColors: sorted.slice(0, 30),
      brightRows: rowBrightness.slice(0, 5),
      rawData: data,
      w: w, h: h
    };
  }

  /* ── İki frame arasındaki değişim bölgelerini bul ── */
  function _diffFrames(snap1, snap2) {
    if (!snap1 || !snap2) return [];
    var w = snap1.w, h = snap1.h;
    if (snap2.w !== w || snap2.h !== h) return [];
    var d1 = snap1.rawData, d2 = snap2.rawData;
    var regions = {};
    var blockSize = 16;
    for (var y = 0; y < h; y += 2) {
      for (var x = 0; x < w; x += 2) {
        var idx = (y * w + x) * 4;
        var dr = Math.abs(d1[idx]   - d2[idx]);
        var dg = Math.abs(d1[idx+1] - d2[idx+1]);
        var db = Math.abs(d1[idx+2] - d2[idx+2]);
        if (dr + dg + db > 30) {
          var bx = Math.floor(x / blockSize);
          var by = Math.floor(y / blockSize);
          var key = bx + ',' + by;
          regions[key] = (regions[key] || 0) + 1;
        }
      }
    }
    var active = Object.keys(regions)
      .filter(function(k) { return regions[k] > 5; })
      .map(function(k) {
        var parts = k.split(',');
        return { bx: parseInt(parts[0]), by: parseInt(parts[1]),
                 x: parseInt(parts[0]) * blockSize,
                 y: parseInt(parts[1]) * blockSize,
                 count: regions[k] };
      })
      .sort(function(a,b){ return b.count - a.count; });
    return active.slice(0, 10);
  }

  function _buildReport(snaps) {
    var lines = [];
    lines.push('═══════════════════════════════════════════════════════════');
    lines.push('RC Helper — Crypto Hamster Canvas Analyzer');
    lines.push('Generated: ' + new Date().toISOString());
    lines.push('Canvas boyutu: ' + (snaps[0] ? snaps[0].canvasW + 'x' + snaps[0].canvasH : 'N/A'));
    lines.push('═══════════════════════════════════════════════════════════');

    /* Window / game info */
    lines.push('');
    lines.push('[ OYUN BİLGİSİ ]');
    lines.push('window.currentPlayingGame: ' + (window.currentPlayingGame || 'yok'));
    lines.push('window.lastSelectedGame:   ' + (window.lastSelectedGame   || 'yok'));
    lines.push('window._activeGame:        ' + (window._activeGame ? JSON.stringify(window._activeGame) : 'yok'));
    lines.push('document.title:            ' + document.title);
    lines.push('URL:                       ' + window.location.href);

    /* Klavye eventleri */
    lines.push('');
    lines.push('[ YAKALANAN KLAVYE EVENTLERİ ]');
    if (_keyLog.length === 0) {
      lines.push('  Hiç klavye eventi yakalanmadı');
    } else {
      _keyLog.forEach(function(e) {
        lines.push('  key=' + e.key + ' code=' + e.code + ' keyCode=' + e.keyCode);
      });
    }

    /* Mouse click eventleri */
    lines.push('');
    lines.push('[ YAKALANAN MOUSE CLICK EVENTLERİ ]');
    if (_clickLog.length === 0) {
      lines.push('  Hiç click eventi yakalanmadı');
    } else {
      _clickLog.forEach(function(e) {
        lines.push('  x=' + e.x + ' y=' + e.y + ' target=' + e.target);
      });
    }

    /* Renk analizi */
    lines.push('');
    lines.push('[ EN SIK RENKLER (tüm framelerden birleşik) ]');
    var allColors = {};
    snaps.forEach(function(s) {
      s.topColors.forEach(function(c) {
        allColors[c.hex] = (allColors[c.hex] || 0) + c.count;
      });
    });
    var sorted = Object.keys(allColors).map(function(h) {
      return { hex: h, count: allColors[h],
               r: parseInt(h.slice(1,3),16),
               g: parseInt(h.slice(3,5),16),
               b: parseInt(h.slice(5,7),16) };
    }).sort(function(a,b){ return b.count - a.count; });
    sorted.slice(0, 25).forEach(function(c, i) {
      lines.push('  ' + (i+1) + '. ' + c.hex + '  rgb(' + c.r + ',' + c.g + ',' + c.b + ')  ×' + c.count);
    });

    /* Hareket analizi (frame diff) */
    lines.push('');
    lines.push('[ HAREKET BÖLGELERI (frame diff, en aktif) ]');
    for (var i = 1; i < snaps.length; i++) {
      var diff = _diffFrames(snaps[i-1], snaps[i]);
      if (diff.length > 0) {
        lines.push('  Frame ' + i + '→' + (i+1) + ':');
        diff.slice(0, 5).forEach(function(d) {
          lines.push('    x=' + d.x + ' y=' + d.y + ' aktiflik=' + d.count);
        });
      }
    }

    /* En parlak satırlar */
    lines.push('');
    lines.push('[ EN PARLAK SATIRLAR (karakter/zemin konumu tahmini) ]');
    if (snaps[0]) {
      snaps[0].brightRows.forEach(function(r) {
        lines.push('  y=' + r.y + ' → ortalama parlaklık=' + r.avg);
      });
    }

    lines.push('');
    lines.push('═══════════════════════════════════════════════════════════');
    lines.push('Rapor tamamlandı.');
    return lines.join('\n');
  }

  function _download(text) {
    var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href = url; a.download = 'rc-crypto-hamster-analysis.txt';
    document.body.appendChild(a); a.click();
    setTimeout(function() { URL.revokeObjectURL(url); a.remove(); }, 1000);
    console.log('[RC-ANALYZE] ✅ rc-crypto-hamster-analysis.txt indirildi');
  }

  function _run() {
    var canvas = _getCanvas();
    if (!canvas) { console.warn('[RC-ANALYZE] Canvas bulunamadı!'); return; }
    console.log('[RC-ANALYZE] Canvas: ' + canvas.width + 'x' + canvas.height);
    console.log('[RC-ANALYZE] 5 saniye boyunca oyunu oyna (zıpla/tıkla)!');

    var snaps = [], count = 0, maxSnaps = 10;
    var iv = setInterval(function() {
      var s = _snapshot(canvas);
      if (s) { snaps.push(s); count++; console.log('[RC-ANALYZE] Snapshot ' + count + '/' + maxSnaps); }
      if (count >= maxSnaps) {
        clearInterval(iv);
        _download(_buildReport(snaps));
      }
    }, 500);
  }

  console.log('[RC-ANALYZE] Crypto Hamster Analyzer yüklendi.');
  console.log('[RC-ANALYZE] 1 saniye sonra başlıyor, oyunu oyna!');
  setTimeout(_run, 1000);
})();
