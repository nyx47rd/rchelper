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
        if (r === 0 && g === 0 && b === 0) continue;
        var hex = _toHex(r, g, b);
        colorMap[hex] = (colorMap[hex] || 0) + 1;
      }
    }

    /* ── PLATFORM TESPİTİ: Her sütunda renk değişim satırlarını bul ──
       Platform = yatay çizgi, arka plandan farklı renk.
       Her x sütununu tara, arka planla kontrast olan piksel satırlarını kaydet */
    var platformRows = {}; /* y → o satırdaki platform piksel sayısı */
    var BG_R = 65, BG_G = 74, BG_B = 89; /* #414a59 */
    for (var py = 0; py < h; py += 2) {
      var rowScore = 0;
      for (var px = 0; px < w; px += 4) {
        var pi = (py * w + px) * 4;
        var pr = data[pi], pg = data[pi+1], pb = data[pi+2];
        var diff = Math.abs(pr - BG_R) + Math.abs(pg - BG_G) + Math.abs(pb - BG_B);
        if (diff > 60) rowScore++;
      }
      if (rowScore > 5) platformRows[py] = rowScore;
    }
    /* En yoğun 20 satır → platform adayları */
    var platformCandidates = Object.keys(platformRows).map(function(y) {
      return { y: parseInt(y), score: platformRows[y] };
    }).sort(function(a,b){ return b.score - a.score; }).slice(0, 20);

    /* ── PLATFORM X KONUMU: Her platform satırı için merkez x bul ── */
    var platformDetails = platformCandidates.map(function(p) {
      var minX = w, maxX = 0;
      for (var px2 = 0; px2 < w; px2 += 2) {
        var pi2 = (p.y * w + px2) * 4;
        var pr2 = data[pi2], pg2 = data[pi2+1], pb2 = data[pi2+2];
        var diff2 = Math.abs(pr2 - BG_R) + Math.abs(pg2 - BG_G) + Math.abs(pb2 - BG_B);
        if (diff2 > 60) { if (px2 < minX) minX = px2; if (px2 > maxX) maxX = px2; }
      }
      return { y: p.y, score: p.score, minX: minX, maxX: maxX,
               centerX: Math.round((minX + maxX) / 2),
               width: maxX - minX };
    }).filter(function(p) { return p.width > 20 && p.width < w * 0.9; }); /* gerçek platform = orta genişlikte */

    /* ── KARAKTERİ BUL: En fazla hareket eden bölge ── */
    var charCandidates = [];
    /* Canvas ortasına odaklan (karakter genellikle ortada) */
    var cx0 = Math.floor(w * 0.2), cx1 = Math.floor(w * 0.8);
    var cy0 = Math.floor(h * 0.3), cy1 = Math.floor(h * 0.8);
    for (var cy = cy0; cy < cy1; cy += 8) {
      for (var cx = cx0; cx < cx1; cx += 8) {
        var ci = (cy * w + cx) * 4;
        var cr = data[ci], cg = data[ci+1], cb2 = data[ci+2];
        var cdiff = Math.abs(cr - BG_R) + Math.abs(cg - BG_G) + Math.abs(cb2 - BG_B);
        if (cdiff > 80) charCandidates.push({ x: cx, y: cy, diff: cdiff });
      }
    }
    charCandidates.sort(function(a,b){ return b.diff - a.diff; });
    var charCenter = charCandidates.length > 0 ? charCandidates[0] : { x: Math.floor(w/2), y: Math.floor(h/2) };

    /* En sık 30 renk */
    var sorted = Object.keys(colorMap).map(function(hex) {
      return { hex: hex, count: colorMap[hex],
               r: parseInt(hex.slice(1,3),16),
               g: parseInt(hex.slice(3,5),16),
               b: parseInt(hex.slice(5,7),16) };
    }).sort(function(a,b){ return b.count - a.count; });

    return {
      ts: Date.now(),
      canvasW: w, canvasH: h,
      topColors: sorted.slice(0, 30),
      platformDetails: platformDetails.slice(0, 10),
      charCenter: charCenter,
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

    /* Platform tespiti */
    lines.push('');
    lines.push('[ PLATFORM TESPİTİ (her snapshot) ]');
    snaps.forEach(function(snap, si) {
      lines.push('  Snapshot ' + (si+1) + ' | karakter: x=' + snap.charCenter.x + ' y=' + snap.charCenter.y);
      if (snap.platformDetails.length === 0) {
        lines.push('    Platform bulunamadı');
      } else {
        snap.platformDetails.slice(0, 5).forEach(function(p) {
          lines.push('    Platform: y=' + p.y + ' x=' + p.minX + '~' + p.maxX + ' merkez=' + p.centerX + ' genişlik=' + p.width + ' skor=' + p.score);
        });
      }
    });

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
