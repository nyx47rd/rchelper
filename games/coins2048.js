/* ══════════════════════════════════════════════════════════════════
   RC Helper — 2048 Coins Auto-Bot v4 (Hibrit Yapay Zeka + Fallback)
   Yalnızca /game/play_game sayfasına inject edilir (manifest.json)
   Tetikleyici: Oyun ekranı algılanınca otomatik başlar
   ══════════════════════════════════════════════════════════════════ */
(function () {
  var _botActive   = false;
  var _loopId      = null;
  var _INTERVAL    = 150;     /* Daha hızlı hamle için interval 150ms yapıldı */

  /* Fallback olarak kullanılan Körleme Corner-snake Döngüsü */
  var _MAIN_CYCLE  = ['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowDown',
                      'ArrowLeft', 'ArrowDown', 'ArrowLeft', 'ArrowDown'];
  var _cycleIdx    = 0;

  var _lastKey       = null;
  var _noMoveStreak  = 0;
  var _rescueSeq     = [];

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

  /* Klavye olayını fırlatan ve oyunu zorla uyanık tutan metot */
  function _pressKey(key, gameObj) {
    var opts = { 
      key: key, 
      code: key, 
      keyCode: 0, 
      which: 0,
      bubbles: true, 
      cancelable: true 
    };
    var codes = { ArrowLeft: 37, ArrowRight: 39, ArrowUp: 38, ArrowDown: 40 };
    opts.keyCode = codes[key]; 
    opts.which = codes[key];
    
    // Arka planda/odak dışındayken Phaser'ın donmasını önle
    if (gameObj && gameObj.events) {
      gameObj.events.emit('focus');
      gameObj.events.emit('resume');
    }

    var canvas = _getCanvas();
    var targets = [window, document, canvas, document.body];
    targets.forEach(function(t) {
      if (t) {
        t.dispatchEvent(new KeyboardEvent('keydown', opts));
        t.dispatchEvent(new KeyboardEvent('keyup', opts));
      }
    });
  }

  /* 2048 Çözücü Yardımcı Fonksiyonları */
  function _getEvaluation(board) {
    var weights = [
      [ 2,  4,  8, 16],
      [32, 16,  8,  4],
      [64, 32, 16,  8],
      [128, 64, 32, 16] // Sol-alt köşeyi büyük sayılar için koruyoruz
    ];
    
    var score = 0;
    var emptyCells = 0;
    for (var r = 0; r < 4; r++) {
      for (var c = 0; c < 4; c++) {
        var val = board[r][c];
        score += val * weights[r][c];
        if (val === 0) emptyCells++;
      }
    }
    score += emptyCells * 150;
    return score;
  }

  function _slideLeft(board) {
    var changed = false;
    var next = board.map(function(row) {
      var line = row.filter(function(x) { return x !== 0; });
      var newLine = [];
      for (var i = 0; i < line.length; i++) {
        if (i + 1 < line.length && line[i] === line[i+1]) {
          newLine.push(line[i] * 2);
          i++;
        } else {
          newLine.push(line[i]);
        }
      }
      while (newLine.length < 4) newLine.push(0);
      if (JSON.stringify(row) !== JSON.stringify(newLine)) changed = true;
      return newLine;
    });
    return { board: next, changed: changed };
  }

  function _rotateCounterClockwise(board) {
    var next = [];
    for (var c = 3; c >= 0; c--) {
      var row = [];
      for (var r = 0; r < 4; r++) row.push(board[r][c]);
      next.push(row);
    }
    return next;
  }

  function _simulateMove(board, dir) {
    var b = board.map(function(r) { return [].concat(r); });
    var rotations = 0;
    if (dir === 'ArrowUp') rotations = 1;
    else if (dir === 'ArrowRight') rotations = 2;
    else if (dir === 'ArrowDown') rotations = 3;
    
    for (var i = 0; i < rotations; i++) b = _rotateCounterClockwise(b);
    var res = _slideLeft(b);
    var nextB = res.board;
    var backRotations = (4 - rotations) % 4;
    for (var i = 0; i < backRotations; i++) nextB = _rotateCounterClockwise(nextB);
    
    return { board: nextB, changed: res.changed };
  }

  /* Ana Tick Fonksiyonu: Önce yapay zekayı dener, hata veya başarısızlıkta körleme yönteme döner */
  function _tick() {
    if (!_botActive) return;

    var canvas = _getCanvas();
    var scene = null;
    var gameObj = null;

    // 1. Phaser active scene ve game nesnesine erişimi dene
    try {
      if (canvas) {
        var reactKey = Object.keys(canvas).find(function(k) { return k.indexOf('__reactFiber$') === 0; });
        if (!reactKey) {
          var parent = document.getElementById('phaserGame');
          if (parent) reactKey = Object.keys(parent).find(function(k) { return k.indexOf('__reactFiber$') === 0; });
        }
        if (reactKey) {
          var node = canvas[reactKey] || (document.getElementById('phaserGame') && document.getElementById('phaserGame')[reactKey]);
          while (node) {
            if (node.stateNode && node.stateNode.game) { gameObj = node.stateNode.game; break; }
            node = node.return;
          }
          if (gameObj) {
            var activeScenes = gameObj.scene.scenes.filter(function(s) {
              return s.sys && s.sys.settings && s.sys.settings.active;
            });
            if (activeScenes.length > 0) scene = activeScenes[0];
          }
        }
      }
    } catch(e) {
      console.warn('[RC-2048] Phaser erişim hatası, fallback devrede:', e.message);
    }

    // 2. Yapay Zeka Hamle Kararını Uygula (scene ve fieldArray mevcutsa)
    if (scene && scene.fieldArray) {
      try {
        var board = [];
        for (var r = 0; r < 4; r++) {
          var row = [];
          for (var c = 0; c < 4; c++) {
            var tile = scene.fieldArray[r] ? scene.fieldArray[r][c] : null;
            row.push((tile && tile.tileValue !== undefined) ? tile.tileValue : 0);
          }
          board.push(row);
        }

        var dirs = ['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp'];
        var bestDir = null;
        var bestScore = -1;

        dirs.forEach(function(dir) {
          var res = _simulateMove(board, dir);
          if (res.changed) {
            var score = _getEvaluation(res.board);
            if (score > bestScore) {
              bestScore = score;
              bestDir = dir;
            }
          }
        });

        if (bestDir) {
          _pressKey(bestDir, gameObj);
          return; // Başarıyla hamle yapıldı, döngüyü sonlandır
        }
      } catch(aiError) {
        console.warn('[RC-2048] AI karar hatası, fallback devrede:', aiError.message);
      }
    }

    // 3. Fallback: Körleme Yöntem (Phaser veya AI kararı çalışmazsa devrededir)
    var fallbackKey;

    if (_rescueSeq.length > 0) {
      fallbackKey = _rescueSeq.shift();
      _pressKey(fallbackKey, gameObj);
      return;
    }

    fallbackKey = _MAIN_CYCLE[_cycleIdx];
    _cycleIdx = (_cycleIdx + 1) % _MAIN_CYCLE.length;

    if (fallbackKey === _lastKey) {
      _noMoveStreak++;
    } else {
      _noMoveStreak = 0;
    }
    _lastKey = fallbackKey;

    if (_noMoveStreak >= 4) {
      _noMoveStreak = 0;
      _cycleIdx = 0;
      _rescueSeq = ['ArrowUp', 'ArrowRight', 'ArrowUp', 'ArrowDown',
                    'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowDown'];
      fallbackKey = _rescueSeq.shift();
    }

    _pressKey(fallbackKey, gameObj);
  }

  function _start() {
    if (_botActive) return;
    _botActive = true;
    try { document.body.setAttribute('data-rc-bot-2048-active', 'true'); } catch(e) {}
    console.log('[RC-2048] ✅ 2048 bot BAŞLADI (Yapay Zeka Modu)');
    if (window.updateRCStatus) window.updateRCStatus('[RC] 🔢 2048 Bot aktif');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();
    _loopId = setInterval(_tick, _INTERVAL);
  }

  function _stop() {
    if (!_botActive) return;
    _botActive = false;
    try { document.body.setAttribute('data-rc-bot-2048-active', 'false'); } catch(e) {}
    if (_loopId) { clearInterval(_loopId); _loopId = null; }
    console.log('[RC-2048] ⏹ 2048 bot DURDU');
    if (window.updateRCStatus) window.updateRCStatus('[RC] 🔢 2048 Bot durdu');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();
  }

  setInterval(function () {
    var enabled = document.body.getAttribute('data-rc-bot-2048-enabled') !== 'false';
    var active = _isOnPlayPage() && _isGame() && !!_getCanvas() && enabled;
    if (active && !_botActive)  _start();
    if (!active && _botActive)  _stop();
  }, 500);

  window._rc2048 = { start: _start, stop: _stop, isActive: function () { return _botActive; } };
})();
