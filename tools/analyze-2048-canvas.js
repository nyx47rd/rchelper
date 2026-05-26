/* ══════════════════════════════════════════════════════════════════
   RC Helper — 2048 Coins Canvas Analyzer
   
   Kullanım:
   1. RollerCoin'de 2048 Coins oyununu aç
   2. DevTools (F12) → Console sekmesine geç
   3. Bu dosyanın tüm içeriğini kopyala → Console'a yapıştır → Enter
   4. Oyunu tam ekrana al
   5. ~3 saniye bekle → otomatik olarak "rc-2048-analysis.txt" indirilir
   ══════════════════════════════════════════════════════════════════ */

(function () {
  var _analyzed = false;
  var _frames   = [];
  var _maxFrames = 30;   /* kaç frame topla */
  var _frameCount = 0;
  var _offscreen = null;
  var _ctx       = null;

  function _getCanvas() {
    return document.querySelector('#phaserGame canvas') || document.querySelector('canvas');
  }

  function _isBigCanvas() {
    var c = _getCanvas();
    if (!c) return false;
    var rect = c.getBoundingClientRect();
    return rect.width > window.innerWidth * 0.6;
  }

  function _ensureOffscreen(w, h) {
    if (_offscreen && _offscreen.width === w && _offscreen.height === h) return true;
    _offscreen = document.createElement('canvas');
    _offscreen.width  = w;
    _offscreen.height = h;
    _ctx = _offscreen.getContext('2d', { willReadFrequently: true });
    return !!_ctx;
  }

  /* Renk → tile değeri tahmini (renk kümesi) */
  function _guessValue(r, g, b) {
    /* Arka plan / boş */
    if (r > 200 && g > 190 && b > 170 && Math.abs(r - g) < 30) return 0;
    /* Sarımsı (2, 4) */
    if (r > 220 && g > 200 && b < 130) return '2/4';
    /* Turuncu (8, 16) */
    if (r > 220 && g > 120 && g < 180 && b < 80) return '8/16';
    /* Kırmızı (32, 64) */
    if (r > 200 && g < 100 && b < 100) return '32/64';
    /* Mavi (128, 256) */
    if (r < 100 && g < 150 && b > 180) return '128/256';
    /* Yeşil (512, 1024) */
    if (r < 100 && g > 150 && b < 100) return '512/1024';
    /* Altın / parıltılı (2048) */
    if (r > 230 && g > 180 && b < 60) return '2048';
    /* Bilinmiyor */
    return '?';
  }

  function _analyzeFrame(canvas) {
    if (!_ensureOffscreen(canvas.width, canvas.height)) return null;
    try { _ctx.drawImage(canvas, 0, 0); } catch(e) { return null; }

    var w = canvas.width, h = canvas.height;
    var data;
    try { data = _ctx.getImageData(0, 0, w, h).data; } catch(e) { return null; }

    var frame = {
      ts: Date.now(),
      canvasW: w,
      canvasH: h,
      rectW: Math.round(canvas.getBoundingClientRect().width),
      rectH: Math.round(canvas.getBoundingClientRect().height),
      colorSamples: [],
      uniqueColors: {},
      gridAnalysis: [],
      dominantRegions: []
    };

    /* ─── 1. Grid analizi: 4x4 grid varsayımıyla her hücrenin merkez rengini al ─── */
    var gridCols = 4, gridRows = 4;
    var cellW = Math.floor(w / gridCols);
    var cellH = Math.floor(h / gridRows);
    /* Oyun alanı genellikle canvas'ın ortasındadır; margin tahmin et */
    var marginX = Math.floor(w * 0.05);
    var marginY = Math.floor(h * 0.1);
    var playW   = w - marginX * 2;
    var playH   = h - marginY * 2;
    var tileW   = Math.floor(playW / gridCols);
    var tileH   = Math.floor(playH / gridRows);

    for (var row = 0; row < gridRows; row++) {
      var rowData = [];
      for (var col = 0; col < gridCols; col++) {
        var cx = marginX + col * tileW + Math.floor(tileW / 2);
        var cy = marginY + row * tileH + Math.floor(tileH / 2);
        var idx = (cy * w + cx) * 4;
        var r = data[idx], g = data[idx+1], b = data[idx+2], a = data[idx+3];
        var guess = _guessValue(r, g, b);
        rowData.push({
          col: col, row: row,
          cx: cx, cy: cy,
          r: r, g: g, b: b, a: a,
          hex: '#' + [r,g,b].map(function(v){return ('0'+v.toString(16)).slice(-2);}).join(''),
          guess: guess
        });
      }
      frame.gridAnalysis.push(rowData);
    }

    /* ─── 2. Tüm canvas'tan 20x20 grid örnekleme ─── */
    var sampleStep = Math.floor(w / 20);
    for (var sy = sampleStep; sy < h - sampleStep; sy += sampleStep) {
      for (var sx = sampleStep; sx < w - sampleStep; sx += sampleStep) {
        var sidx = (sy * w + sx) * 4;
        var sr = data[sidx], sg = data[sidx+1], sb = data[sidx+2];
        var hex = '#' + [sr,sg,sb].map(function(v){return ('0'+v.toString(16)).slice(-2);}).join('');
        frame.colorSamples.push({ x: sx, y: sy, r: sr, g: sg, b: sb, hex: hex });
        frame.uniqueColors[hex] = (frame.uniqueColors[hex] || 0) + 1;
      }
    }

    /* ─── 3. En sık görülen 15 renk ─── */
    var colorList = Object.keys(frame.uniqueColors).map(function(h) {
      return { hex: h, count: frame.uniqueColors[h] };
    });
    colorList.sort(function(a,b){return b.count - a.count;});
    frame.topColors = colorList.slice(0, 15);

    /* ─── 4. Dominant bölgeler: 8x8 grid, renk kümesi ─── */
    var dStep = Math.floor(w / 8);
    for (var dy = 0; dy < h; dy += dStep) {
      for (var dx = 0; dx < w; dx += dStep) {
        var didx = (dy * w + dx) * 4;
        var dr = data[didx], dg = data[didx+1], db = data[didx+2];
        var guess2 = _guessValue(dr, dg, db);
        if (guess2 !== 0) {
          frame.dominantRegions.push({ x: dx, y: dy, r: dr, g: dg, b: db, guess: guess2 });
        }
      }
    }

    return frame;
  }

  function _buildReport(frames) {
    var lines = [];
    lines.push('═══════════════════════════════════════════════════════════');
    lines.push('RC Helper — 2048 Coins Canvas Analysis Report');
    lines.push('Generated: ' + new Date().toISOString());
    lines.push('Frames collected: ' + frames.length);
    lines.push('═══════════════════════════════════════════════════════════');
    lines.push('');

    frames.forEach(function(frame, fi) {
      lines.push('─────────────────────────────────────────────────────────');
      lines.push('FRAME ' + (fi+1) + ' | ts=' + frame.ts + ' | canvas=' + frame.canvasW + 'x' + frame.canvasH + ' | rendered=' + frame.rectW + 'x' + frame.rectH);
      lines.push('─────────────────────────────────────────────────────────');

      lines.push('');
      lines.push('[ 4x4 GRID ANALYSIS ]');
      lines.push('Satır/Sütun renk örnekleri (merkez piksel):');
      frame.gridAnalysis.forEach(function(row) {
        var rowStr = 'Row ' + row[0].row + ': ';
        row.forEach(function(cell) {
          rowStr += '[' + cell.hex + ' ~' + cell.guess + '] ';
        });
        lines.push(rowStr);
      });

      lines.push('');
      lines.push('[ TOP 15 COLORS (frekans sıralı) ]');
      frame.topColors.forEach(function(c, i) {
        lines.push('  ' + (i+1) + '. ' + c.hex + ' × ' + c.count);
      });

      lines.push('');
      lines.push('[ DOMINANT REGIONS (değer tahmini) ]');
      var regionSummary = {};
      frame.dominantRegions.forEach(function(r) {
        var k = String(r.guess);
        regionSummary[k] = (regionSummary[k] || 0) + 1;
      });
      Object.keys(regionSummary).forEach(function(k) {
        lines.push('  ' + k + ': ' + regionSummary[k] + ' bölge');
      });

      lines.push('');
    });

    /* Genel özet */
    lines.push('═══════════════════════════════════════════════════════════');
    lines.push('ÖZET: Tüm framelerden birikim');
    var allTopColors = {};
    frames.forEach(function(f) {
      f.topColors.forEach(function(c) {
        allTopColors[c.hex] = (allTopColors[c.hex] || 0) + c.count;
      });
    });
    var sortedAll = Object.keys(allTopColors).map(function(h){ return { hex: h, count: allTopColors[h] }; });
    sortedAll.sort(function(a,b){return b.count - a.count;});
    lines.push('En sık rastlanan renkler (tüm frameler):');
    sortedAll.slice(0, 20).forEach(function(c, i) {
      var rgb = [
        parseInt(c.hex.slice(1,3),16),
        parseInt(c.hex.slice(3,5),16),
        parseInt(c.hex.slice(5,7),16)
      ];
      lines.push('  ' + (i+1) + '. ' + c.hex + ' rgb(' + rgb.join(',') + ') × ' + c.count + '  ~tile: ' + _guessValue(rgb[0], rgb[1], rgb[2]));
    });

    lines.push('');
    lines.push('[ GRID ÖRNEĞİ (Son Frame) ]');
    if (frames.length > 0) {
      var lastFrame = frames[frames.length - 1];
      lastFrame.gridAnalysis.forEach(function(row) {
        var rowStr = '  ';
        row.forEach(function(cell) {
          var pad = String(cell.guess).padEnd(8);
          rowStr += pad + ' | ';
        });
        lines.push(rowStr);
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
    a.href     = url;
    a.download = 'rc-2048-analysis.txt';
    document.body.appendChild(a);
    a.click();
    setTimeout(function() { URL.revokeObjectURL(url); a.remove(); }, 1000);
    console.log('[RC-ANALYZE] ✅ rc-2048-analysis.txt indirildi');
  }

  function _collectFrames() {
    var canvas = _getCanvas();
    if (!canvas) { console.warn('[RC-ANALYZE] Canvas bulunamadı'); return; }

    console.log('[RC-ANALYZE] Frame toplama başladı... (' + _maxFrames + ' frame, her 100ms)');
    var interval = setInterval(function () {
      var f = _analyzeFrame(canvas);
      if (f) {
        _frames.push(f);
        _frameCount++;
        if (_frameCount % 5 === 0) console.log('[RC-ANALYZE] Frame ' + _frameCount + '/' + _maxFrames);
      }
      if (_frameCount >= _maxFrames) {
        clearInterval(interval);
        console.log('[RC-ANALYZE] Analiz tamamlandı, rapor oluşturuluyor...');
        var report = _buildReport(_frames);
        _download(report);
        _analyzed = true;
      }
    }, 100);
  }

  /* Fullscreen algılama */
  var _checkInterval = setInterval(function() {
    if (_analyzed) { clearInterval(_checkInterval); return; }
    if (_isBigCanvas()) {
      clearInterval(_checkInterval);
      console.log('[RC-ANALYZE] Tam ekran algılandı! 500ms sonra analiz başlıyor...');
      setTimeout(_collectFrames, 500);
    }
  }, 300);

  /* Fullscreen API ile de dinle */
  document.addEventListener('fullscreenchange', function() {
    if (_analyzed) return;
    if (document.fullscreenElement && _isBigCanvas()) {
      clearInterval(_checkInterval);
      console.log('[RC-ANALYZE] Fullscreen event! 500ms sonra analiz başlıyor...');
      setTimeout(_collectFrames, 500);
    }
  });

  console.log('[RC-ANALYZE] 🎮 2048 Coins Canvas Analyzer hazır.');
  console.log('[RC-ANALYZE] Oyunu tam ekrana al → otomatik analiz başlar → rc-2048-analysis.txt indirilir.');
})();
