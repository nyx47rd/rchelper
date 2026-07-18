/* ══════════════════════════════════════════════════════════════════
   RC Helper — Cryptonoid (Breakout) Zeki Hafıza Botu
   Yalnızca /game/play_game sayfasında inject edilir (manifest.json)
   Tetikleyici: Oyun ekranı algılanınca otomatik başlar
   Mekanik: Topu takip ederek raketi tam topun altına hizalar
   ══════════════════════════════════════════════════════════════════ */
(function () {
  var _botActive   = false;
  var _loopId      = null;
  var _lastLaunch  = 0;
  var _activeKeys  = {};    /* Basılı tutulan tuşlar */

  function _isGame() {
    var curGame = (document.body.getAttribute('data-rc-current-game') || '').toLowerCase();
    if (curGame.includes('cryptonoid')) {
      return true;
    }
    var sources = [
      document.title || '',
      window.location.href || ''
    ];
    return sources.some(function(s) {
      var n = s.toLowerCase();
      return n.includes('cryptonoid');
    });
  }

  function _isOnPlayPage() {
    return window.location.href.includes('/play_game');
  }

  function _getCanvas() {
    return document.querySelector('#phaserGame canvas') ||
           document.querySelector('canvas');
  }

  /* Klavyeden tuş basma/bırakma simülasyonu */
  function _setKeyState(key, isPressed) {
    if (_activeKeys[key] === isPressed) return;
    _activeKeys[key] = isPressed;

    var type = isPressed ? 'keydown' : 'keyup';
    var codes = { ArrowLeft: 37, ArrowRight: 39, ArrowUp: 38, ArrowDown: 40, Space: 32 };
    var keyCode = codes[key] || 0;
    
    var opts = { 
      key: key === 'Space' ? ' ' : key, 
      code: key, 
      keyCode: keyCode, 
      which: keyCode, 
      bubbles: true, 
      cancelable: true 
    };

    var canvas = _getCanvas();
    var targets = [window, document, canvas, document.body];
    targets.forEach(function(t) {
      if (t) t.dispatchEvent(new KeyboardEvent(type, opts));
    });
  }

  function _pressSpace() {
    _setKeyState('Space', true);
    setTimeout(function() {
      _setKeyState('Space', false);
    }, 30);
  }

  function _clickCanvas(canvas) {
    var rect = canvas.getBoundingClientRect();
    var clientX = rect.left + rect.width / 2;
    var clientY = rect.top + rect.height / 2;
    var opts = { bubbles: true, cancelable: true, clientX: clientX, clientY: clientY };
    canvas.dispatchEvent(new MouseEvent('mousedown', opts));
    canvas.dispatchEvent(new MouseEvent('mouseup', opts));
    canvas.dispatchEvent(new MouseEvent('click', opts));
  }

  function _tick() {
    if (!_botActive) return;
    var canvas = _getCanvas();
    if (!canvas) return;

    // React Fiber ağacından Phaser game nesnesine eriş
    var reactKey = Object.keys(canvas).find(function(k) {
      return k.indexOf('__reactFiber$') === 0;
    });
    if (!reactKey) {
      var parent = document.getElementById('phaserGame');
      if (parent) {
        reactKey = Object.keys(parent).find(function(k) {
          return k.indexOf('__reactFiber$') === 0;
        });
      }
    }
    if (!reactKey) return;

    var node = canvas[reactKey] || (document.getElementById('phaserGame') && document.getElementById('phaserGame')[reactKey]);
    var game = null;
    while (node) {
      if (node.stateNode && node.stateNode.game) {
        game = node.stateNode.game;
        break;
      }
      node = node.return;
    }
    if (!game) return;

    var activeScenes = game.scene.scenes.filter(function(s) {
      return s.sys && s.sys.settings && s.sys.settings.active;
    });
    if (activeScenes.length === 0) return;
    
    var scene = activeScenes[0];
    var paddle = scene.platform;
    var ball = scene.ball;
    if (!paddle || !ball) return;

    // 1. Topu Başlatma Kontrolü (Top raketin üzerinde hareketsiz bekliyorsa fırlat)
    if (ball.y >= 755) {
      var now = Date.now();
      if (now - _lastLaunch > 1500) {
        _lastLaunch = now;
        console.log('[RC-Cryptonoid] 🚀 Topu başlatmak için fırlatma komutu tetiklendi.');
        _pressSpace();
        _clickCanvas(canvas);
      }
    }

    // 2. Raket Takip Kontrolü (Raketi topun tam altına doğrudan konumlandır)
    try {
      // Platform (raket) X koordinatını doğrudan topun X koordinatına eşitle
      paddle.x = ball.x;
      if (paddle.body) {
        paddle.body.x = ball.x - (paddle.width / 2);
      }

      // Phaser'ın fare/imleç girdilerini de topa eşitle (eğer oyun oradan okuyorsa)
      if (scene.input) {
        scene.input.x = ball.x;
        if (scene.input.activePointer) {
          scene.input.activePointer.x = ball.x;
        }
        if (scene.input.mousePointer) {
          scene.input.mousePointer.x = ball.x;
        }
      }
    } catch (e) {
      console.warn('[RC-Cryptonoid] Raket koordinatı eşitlenirken hata oluştu:', e);
    }
  }

  function _start() {
    if (_botActive) return;
    _botActive = true;
    try { document.body.setAttribute('data-rc-bot-cryptonoid-active', 'true'); } catch(e) {}
    console.log('[RC-Cryptonoid] ✅ Cryptonoid bot BAŞLADI (Hafıza Modu)');
    if (window.updateRCStatus) window.updateRCStatus('[RC] 🧱 Cryptonoid Bot aktif');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();
    _loopId = setInterval(_tick, 16); // ~60 FPS buttery smooth takip
  }

  function _stop() {
    if (!_botActive) return;
    _botActive = false;
    try { document.body.setAttribute('data-rc-bot-cryptonoid-active', 'false'); } catch(e) {}
    if (_loopId) { clearInterval(_loopId); _loopId = null; }
    _setKeyState('ArrowLeft', false);
    _setKeyState('ArrowRight', false);
    _setKeyState('Space', false);
    console.log('[RC-Cryptonoid] ⏹ Cryptonoid bot DURDU');
    if (window.updateRCStatus) window.updateRCStatus('[RC] 🧱 Cryptonoid Bot durdu');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();
  }

  document.addEventListener('fullscreenchange', function () {
    if (!!document.fullscreenElement && _isGame()) _start();
    else if (!document.fullscreenElement) _stop();
  });

  setInterval(function () {
    var enabled = document.body.getAttribute('data-rc-bot-cryptonoid-enabled') !== 'false';
    var active = _isOnPlayPage() && _isGame() && !!_getCanvas() && enabled;
    if (active && !_botActive)  _start();
    if (!active && _botActive)  _stop();
  }, 500);

  window._rcCryptonoid = { start: _start, stop: _stop, isActive: function () { return _botActive; } };
})();
