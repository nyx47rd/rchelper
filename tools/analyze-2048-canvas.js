/* ══════════════════════════════════════════════════════════════════
   RC Helper — 2048 Coins Canvas Analyzer v2
   
   Kullanım:
   1. RollerCoin'de 2048 Coins oyununu tam ekrana al (oyun başlamış olsun)
   2. DevTools (F12) → Console sekmesine geç
   3. Bu dosyanın tüm içeriğini kopyala → Console'a yapıştır → Enter
   4. Birkaç hamle yap (WASD veya ok tuşları)
   5. ~5 saniye sonra "rc-2048-analysis-v2.txt" otomatik indirilir
   ══════════════════════════════════════════════════════════════════ */

(function () {
  var _offscreen = null;
  var _ctx       = null;

  function _getCanvas() {
    return document.querySelector('#phaserGame canvas') || document.querySelector('canvas');
  }

  function _ensureOffscreen(w, h) {
    if (_offscreen && _offscreen.width === w && _offscreen.height === h) return true;
    _offscreen = document.createElement('canvas');
    _offscreen.width  = w;
    _offscreen.height = h;
    _ctx = _offscreen.getContext('2d', { willReadFrequently: true });
    return !!_ctx;
  }

  function _toHex(r, g, b) {
    return '#' + [r, g, b].map(function(v) { return ('0' + v.toString(16)).slice(-2); }).join('');
  }

  /* ── Arka plan mı? (koyu mavi-gri tonları = board bg) ── */
  function _isBg(r, g, b) {
    /* #35384f → rgb(53,56,79) ve #242636 → rgb(36,38,54) */
    if (r < 80 && g < 80 && b < 100) return true;
    /* Genel koyu */
    if (r < 100 && g < 100 && b < 120 && Math.max(r,g,b) < 120) return true;
    return false;
  }

  /* ── Tüm canvas'tan NON-BG piksel haritası çıkar ── */
  function _scanAllPixels(data, w, h) {
    var step = 4; /* her 4 pikselde bir örnekle */
    var nonBg = [];
    var colorMap = {};
    for (var y = 0; y < h; y += step) {
      for (var x = 0; x < w; x += step) {
        var idx = (y * w + x) * 4;
        var r = data[idx], g = data[idx+1], b = data[idx+2];
        if (!_isBg(r, g, b)) {
          var hex = _toHex(r, g, b);
          nonBg.push({ x: x, y: y, r: r, g: g, b: b, hex: hex });
          colorMap[hex] = (colorMap[hex] || 0) + 1;
        }
      }
    }
    return { nonBg: nonBg, colorMap: colorMap };
  }

  /* ── Non-BG pikselleri dikdörtgen bölgelere grupla (tile tespiti) ── */
  function _findTileRegions(nonBg, w, h) {
    /* Canvas'ı 32x32 hücrelere böl, her hücredeki non-bg yoğunluğunu say */
    var cellSize = 32;
    var cols = Math.ceil(w / cellSize);
    var rows = Math.ceil(h / cellSize);
    var grid = [];
    for (var i = 0; i < rows * cols; i++) grid.push({ count: 0, colors: {} });

    nonBg.forEach(function(p) {
      var col = Math.floor(p.x / cellSize);
      var row = Math.floor(p.y / cellSize);
      var ci  = row * cols + col;
      if (grid[ci]) {
        grid[ci].count++;
        grid[ci].colors[p.hex] = (grid[ci].colors[p.hex] || 0) + 1;
      }
    });

    /* Yoğun hücreleri bul (tile içeriyor olabilir) */
    var maxCount = Math.max.apply(null, grid.map(function(c){return c.count;}));
    var threshold = Math.max(3, maxCount * 0.15);
    var activeCells = [];
    grid.forEach(function(cell, ci) {
      if (cell.count >= threshold) {
        var col = ci % cols;
        var row = Math.floor(ci / cols);
        var topColor = Object.keys(cell.colors).sort(function(a,b){return cell.colors[b]-cell.colors[a];})[0];
        activeCells.push({
          col: col, row: row,
          x: col * cellSize, y: row * cellSize,
          count: cell.count,
          topColor: topColor
        });
      }
    });
    return activeCells;
  }

  /* ── Aktif hücrelerden oyun grid sınırlarını tahmin et ── */
  function _estimateGameBounds(activeCells, w, h) {
    if (activeCells.length === 0) return { x: 0, y: 0, w: w, h: h };
    var xs = activeCells.map(function(c){return c.x;});
    var ys = activeCells.map(function(c){return c.y;});
    var minX = Math.min.apply(null, xs);
    var maxX = Math.max.apply(null, xs) + 32;
    var minY = Math.min.apply(null, ys);
    var maxY = Math.max.apply(null, ys) + 32;
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  /* ── Renk frekansından tile renk haritası oluştur ── */
  function _buildColorProfile(colorMap) {
    var sorted = Object.keys(colorMap).map(function(hex) {
      var r = parseInt(hex.slice(1,3),16);
      var g = parseInt(hex.slice(3,5),16);
      var b = parseInt(hex.slice(5,7),16);
      return { hex: hex, r: r, g: g, b: b, count: colorMap[hex] };
    });
    sorted.sort(function(a,b){return b.count - a.count;});
    return sorted;
  }

  /* ── Satır/sütun yoğunluk analizi ── */
  function _rowColDensity(nonBg, w, h) {
    var rows = {}, cols = {};
    nonBg.forEach(function(p) {
      var ry = Math.floor(p.y / 16) * 16;
      var cx = Math.floor(p.x / 16) * 16;
      rows[ry] = (rows[ry] || 0) + 1;
      cols[cx] = (cols[cx] || 0) + 1;
    });
    var rowArr = Object.keys(rows).map(function(k){return{y:parseInt(k), count:rows[k]};}).sort(function(a,b){return b.count-a.count;});
    var colArr = Object.keys(cols).map(function(k){return{x:parseInt(k), count:cols[k]};}).sort(function(a,b){return b.count-a.count;});
    return { topRows: rowArr.slice(0,10), topCols: colArr.slice(0,10) };
  }

  /* ── 4x4 grid örnekleme (bulunan sınırlar içinde) ── */
  function _sampleGrid(data, w, bounds) {
    var result = [];
    var tileW = bounds.w / 4;
    var tileH = bounds.h / 4;
    for (var row = 0; row < 4; row++) {
      var rowData = [];
      for (var col = 0; col < 4; col++) {
        /* Her tile'dan 3x3 = 9 nokta örnekle, en baskın rengi al */
        var tileSamples = {};
        for (var dy = 0; dy < 3; dy++) {
          for (var dx = 0; dx < 3; dx++) {
            var px = Math.round(bounds.x + col * tileW + tileW * (0.25 + dx * 0.25));
            var py = Math.round(bounds.y + row * tileH + tileH * (0.25 + dy * 0.25));
            if (px >= w || py >= (bounds.y + bounds.h)) continue;
            var idx = (py * w + px) * 4;
            var r = data[idx], g = data[idx+1], b = data[idx+2];
            var hex = _toHex(r, g, b);
            tileSamples[hex] = (tileSamples[hex] || 0) + 1;
          }
        }
        var bestHex = Object.keys(tileSamples).sort(function(a,b){return tileSamples[b]-tileSamples[a];})[0] || '#000000';
        var isEmpty = _isBg(parseInt(bestHex.slice(1,3),16), parseInt(bestHex.slice(3,5),16), parseInt(bestHex.slice(5,7),16));
        rowData.push({
          col: col, row: row,
          hex: bestHex,
          empty: isEmpty,
          samples: tileSamples
        });
      }
      result.push(rowData);
    }
    return result;
  }

  function _buildReport(snapshots) {
    var lines = [];
    lines.push('═══════════════════════════════════════════════════════════');
    lines.push('RC Helper — 2048 Coins Canvas Analyzer v2');
    lines.push('Generated: ' + new Date().toISOString());
    lines.push('Snapshots: ' + snapshots.length);
    lines.push('═══════════════════════════════════════════════════════════');

    snapshots.forEach(function(snap, si) {
      lines.push('');
      lines.push('──────────────── SNAPSHOT ' + (si+1) + ' ────────────────');
      lines.push('Canvas: ' + snap.canvasW + 'x' + snap.canvasH + ' | Non-BG pixels: ' + snap.nonBgCount);
      lines.push('Tahmin edilen oyun alanı: x=' + snap.bounds.x + ' y=' + snap.bounds.y + ' w=' + snap.bounds.w + ' h=' + snap.bounds.h);

      lines.push('');
      lines.push('[ NON-BG RENK PROFİLİ (ilk 25) ]');
      snap.colorProfile.slice(0, 25).forEach(function(c, i) {
        lines.push('  ' + (i+1) + '. ' + c.hex + '  rgb(' + c.r + ',' + c.g + ',' + c.b + ')  ×' + c.count);
      });

      lines.push('');
      lines.push('[ SATIR YOĞUNLUĞU (en yoğun 10 satır, y koordinatı) ]');
      snap.density.topRows.forEach(function(r) {
        lines.push('  y=' + r.y + ' → ' + r.count + ' piksel');
      });

      lines.push('');
      lines.push('[ SÜTUN YOĞUNLUĞU (en yoğun 10 sütun, x koordinatı) ]');
      snap.density.topCols.forEach(function(c) {
        lines.push('  x=' + c.x + ' → ' + c.count + ' piksel');
      });

      lines.push('');
      lines.push('[ 4x4 GRID (tahmini sınırlara göre) ]');
      snap.gridSample.forEach(function(row) {
        var rowStr = '  ';
        row.forEach(function(cell) {
          rowStr += (cell.empty ? '[  EMPTY  ]' : '[' + cell.hex + ']') + ' ';
        });
        lines.push(rowStr);
      });

      lines.push('');
      lines.push('[ AKTİF HÜCRELER (non-bg yoğun 32px gridler) ]');
      snap.activeCells.slice(0, 20).forEach(function(cell) {
        lines.push('  col=' + cell.col + ' row=' + cell.row + ' x=' + cell.x + ' y=' + cell.y + ' count=' + cell.count + ' topColor=' + cell.topColor);
      });
    });

    /* ÖZET */
    lines.push('');
    lines.push('═══════════════════════════════════════════════════════════');
    lines.push('ÖZET — TÜM SNAPSHOTLARDAN BİRİKİM');
    var allColors = {};
    snapshots.forEach(function(snap) {
      snap.colorProfile.forEach(function(c) {
        allColors[c.hex] = (allColors[c.hex] || 0) + c.count;
      });
    });
    var allSorted = Object.keys(allColors).map(function(h){
      return { hex: h, count: allColors[h],
               r: parseInt(h.slice(1,3),16), g: parseInt(h.slice(3,5),16), b: parseInt(h.slice(5,7),16) };
    }).sort(function(a,b){return b.count-a.count;});

    lines.push('En sık Non-BG renkler (bunlar tile renkleri):');
    allSorted.slice(0, 20).forEach(function(c, i) {
      lines.push('  ' + (i+1) + '. ' + c.hex + '  rgb(' + c.r + ',' + c.g + ',' + c.b + ')  ×' + c.count);
    });

    lines.push('');
    lines.push('BOARD BOUNDS TAHMİNİ (ilk snapshot):');
    if (snapshots.length > 0) {
      var b = snapshots[0].bounds;
      lines.push('  x=' + b.x + ' y=' + b.y + ' w=' + b.w + ' h=' + b.h);
      lines.push('  Tile boyutu: ~' + Math.round(b.w/4) + 'x' + Math.round(b.h/4) + 'px');
    }

    lines.push('');
    lines.push('Rapor tamamlandı.');
    lines.push('═══════════════════════════════════════════════════════════');
    return lines.join('\n');
  }

  function _snapshot(canvas) {
    var w = canvas.width, h = canvas.height;
    if (!_ensureOffscreen(w, h)) return null;
    try { _ctx.drawImage(canvas, 0, 0); } catch(e) { return null; }
    var data;
    try { data = _ctx.getImageData(0, 0, w, h).data; } catch(e) { return null; }

    var scan        = _scanAllPixels(data, w, h);
    var activeCells = _findTileRegions(scan.nonBg, w, h);
    var bounds      = _estimateGameBounds(activeCells, w, h);
    var colorProfile= _buildColorProfile(scan.colorMap);
    var density     = _rowColDensity(scan.nonBg, w, h);
    var gridSample  = _sampleGrid(data, w, bounds);

    return {
      ts: Date.now(),
      canvasW: w, canvasH: h,
      nonBgCount: scan.nonBg.length,
      bounds: bounds,
      colorProfile: colorProfile,
      density: density,
      gridSample: gridSample,
      activeCells: activeCells
    };
  }

  function _download(text) {
    var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href     = url;
    a.download = 'rc-2048-analysis-v2.txt';
    document.body.appendChild(a);
    a.click();
    setTimeout(function() { URL.revokeObjectURL(url); a.remove(); }, 1000);
    console.log('[RC-ANALYZE] ✅ rc-2048-analysis-v2.txt indirildi');
  }

  function _run() {
    var canvas = _getCanvas();
    if (!canvas) { console.warn('[RC-ANALYZE] Canvas bulunamadı!'); return; }
    console.log('[RC-ANALYZE] Canvas bulundu: ' + canvas.width + 'x' + canvas.height);
    console.log('[RC-ANALYZE] 5 saniye boyunca her 500ms bir snapshot alınıyor...');
    console.log('[RC-ANALYZE] Birkaç hamle yap (ok tuşları) şimdi!');

    var snaps = [];
    var count = 0;
    var maxSnaps = 10;
    var iv = setInterval(function() {
      var s = _snapshot(canvas);
      if (s) { snaps.push(s); count++; console.log('[RC-ANALYZE] Snapshot ' + count + '/' + maxSnaps + ' | non-bg=' + s.nonBgCount); }
      if (count >= maxSnaps) {
        clearInterval(iv);
        var report = _buildReport(snaps);
        _download(report);
      }
    }, 500);
  }

  /* ── Phaser game objesi üzerinden board state okumayı dene ── */
  function _tryPhaserRead() {
    var lines = ['', '═══ PHASER STATE PROBE ═══'];
    try {
      /* Phaser 3: window.game veya canvas.__phaser */
      var game = window.game || (window.Phaser && window.Phaser.game);
      if (!game) {
        /* phaserGame container'dan bul */
        var container = document.getElementById('phaserGame');
        if (container && container.__phaser) game = container.__phaser;
      }
      if (game) {
        lines.push('Phaser game nesnesi bulundu!');
        lines.push('Phaser version: ' + (game.VERSION || 'unknown'));
        var scene = game.scene && game.scene.scenes && game.scene.scenes[0];
        if (scene) {
          lines.push('Aktif scene: ' + (scene.sys && scene.sys.settings && scene.sys.settings.key));
          /* Board verisini ara */
          var keys = Object.keys(scene).filter(function(k) {
            var v = scene[k];
            return v && (k.toLowerCase().includes('board') || k.toLowerCase().includes('grid') ||
                         k.toLowerCase().includes('tile') || k.toLowerCase().includes('cell'));
          });
          lines.push('Board/grid ilgili anahtarlar: ' + (keys.join(', ') || 'yok'));
          /* Tüm scene anahtarlarını say */
          lines.push('Scene anahtar sayısı: ' + Object.keys(scene).length);
          lines.push('Scene anahtarları (ilk 30): ' + Object.keys(scene).slice(0,30).join(', '));
        } else {
          lines.push('Scene bulunamadı');
          lines.push('game.scene anahtarları: ' + Object.keys(game.scene || {}).join(', '));
        }
      } else {
        lines.push('Phaser game nesnesi bulunamadı');
        lines.push('window anahtarları (2048 ile ilgili): ' + Object.keys(window).filter(function(k){
          return k.toLowerCase().includes('2048') || k.toLowerCase().includes('game') ||
                 k.toLowerCase().includes('board') || k.toLowerCase().includes('phaser');
        }).join(', '));
      }
    } catch(e) {
      lines.push('Phaser okuma hatası: ' + e.message);
    }
    lines.push('═══════════════════════════════');
    return lines.join('\n');
  }

  /* Hemen çalıştır — zaten fullscreen varsayılıyor */
  console.log('[RC-ANALYZE] v2 yüklendi. Hemen başlıyor...');
  /* Önce Phaser probe */
  console.log(_tryPhaserRead());
  setTimeout(_run, 300);
})();
