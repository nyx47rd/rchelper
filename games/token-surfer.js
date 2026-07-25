/* ══════════════════════════════════════════════════════════════════
   RC Helper — Token Surfer Auto-Bot
   Yalnızca /game/play_game sayfasına inject edilir (manifest.json)
   Tetikleyici: Token Surfer oyunu açıldığında otomatik başlar
   Mekanik: Yaklaşan engelleri (garbageCart, trafficLights, dove) tespit edip scene.jump() tetikler
   ══════════════════════════════════════════════════════════════════ */
(function () {
  var _botActive       = false;
  var _monitorId       = null;
  var _rafId           = null;
  var _patchedScene    = null;
  var _originalUpdate  = null;
  var _lastJumpTime    = 0;
  var _jumpCooldownMs = 450; /* Zıplamalar arası bekleme */

  function _isGame() {
    var curGame = (document.body.getAttribute('data-rc-current-game') || '').toLowerCase();
    if (curGame.includes('token surfer') || curGame.includes('tokensurfer') || curGame.includes('snow ride')) {
      return true;
    }
    var sources = [
      document.title || '',
      window.location.href || ''
    ];
    return sources.some(function(s) {
      var n = s.toLowerCase();
      return n.includes('token surfer') || n.includes('tokensurfer') || n.includes('snow ride');
    });
  }

  function _getCanvas() {
    return document.querySelector('#phaserGame canvas') || document.querySelector('canvas');
  }

  function _findGame() {
    var canvas = _getCanvas();
    if (!canvas) return null;
    var reactKey = Object.keys(canvas).find(function (k) { return k.startsWith('__reactFiber$'); }) ||
                   (document.getElementById('phaserGame') && Object.keys(document.getElementById('phaserGame')).find(function (k) { return k.startsWith('__reactFiber$'); }));
    if (!reactKey) return null;
    var node = canvas[reactKey] || (document.getElementById('phaserGame') && document.getElementById('phaserGame')[reactKey]);
    while (node) {
      if (node.stateNode && node.stateNode.game) return node.stateNode.game;
      node = node.return;
    }
    return null;
  }

  function _getActiveScene(game) {
    if (!game || !game.scene || !game.scene.scenes) return null;
    return game.scene.scenes.find(function (s) {
      return s.sys && s.sys.settings && s.sys.settings.active && s.sys.settings.key === 'Game';
    }) || null;
  }

  function _triggerJump(scene) {
    var now = Date.now();
    if (now - _lastJumpTime < _jumpCooldownMs) return;
    _lastJumpTime = now;

    console.log('[RC-TokenSurfer] 🦘 Zıplama tetikleniyor...');

    /* 1. Öncelik: Doğrudan scene.jump() metodunu çağır */
    try {
      if (typeof scene.jump === 'function') {
        scene.jump();
        return;
      }
    } catch(e) {}

    /* 2. Öncelik: Keyboard Space / ArrowUp olayları gönder */
    var opts = { bubbles: true, cancelable: true, keyCode: 32, which: 32, key: ' ', code: 'Space' };
    [window, document, _getCanvas()].forEach(function(t) {
      if (t) {
        try { t.dispatchEvent(new KeyboardEvent('keydown', opts)); } catch(e) {}
        try { t.dispatchEvent(new KeyboardEvent('keyup',   opts)); } catch(e) {}
      }
    });

    var upOpts = { bubbles: true, cancelable: true, keyCode: 38, which: 38, key: 'ArrowUp', code: 'ArrowUp' };
    [window, document, _getCanvas()].forEach(function(t) {
      if (t) {
        try { t.dispatchEvent(new KeyboardEvent('keydown', upOpts)); } catch(e) {}
        try { t.dispatchEvent(new KeyboardEvent('keyup',   upOpts)); } catch(e) {}
      }
    });
  }

  /* ─── Ana Karar Döngüsü (60 FPS) ────────────────────────────── */
  function _tickFrame(scene) {
    if (!_botActive || !scene) return;

    var player = scene.player || scene.hamster || scene.surfer;
    if (!player && scene.children && scene.children.list) {
      player = scene.children.list.find(function (c) {
        return c.active && c.visible && c.texture && String(c.texture.key).toLowerCase().includes('hamster');
      });
    }

    if (!player) return;

    var px = player.x || 130;
    var py = player.y || 540;

    /* Yaklaşan engelleri topla */
    var list = (scene.children && scene.children.list) || [];
    var obstacles = list.filter(function (c) {
      if (!c || !c.active || !c.visible) return false;
      var k = c.texture ? String(c.texture.key).toLowerCase() : '';
      if (!k || k === 'btc' || k === 'doge' || k === 'score' || k === 'lives' || k === 'time' || k === 'hamster' || k === 'snow') {
        return false;
      }
      /* Oyuncunun önündeki engeller */
      return c.x > px - 30 && c.x < px + 280;
    });

    if (obstacles.length > 0) {
      /* En yakın engeli sırala */
      obstacles.sort(function (a, b) { return a.x - b.x; });
      var closest = obstacles[0];
      var dist = closest.x - px;

      /* Engel zıplama mesafesinde mi? (50px - 210px arası) */
      if (dist > 40 && dist < 210) {
        _triggerJump(scene);
      }
    }
  }

  /* ─── Sahne Yamalama ────────────────────────────────────────── */
  function _patchScene(scene) {
    if (!scene || _patchedScene === scene) return;

    if (_patchedScene && _originalUpdate) {
      try { _patchedScene.update = _originalUpdate; } catch(e) {}
    }

    _patchedScene   = scene;
    _originalUpdate = scene.update || function () {};

    scene.update = function (time, delta) {
      try { _originalUpdate.call(scene, time, delta); } catch (e) {}
      if (_botActive) _tickFrame(scene);
    };

    console.log('[RC-TokenSurfer] ✅ Phaser scene.update yamalandı');
  }

  function _rafLoop() {
    if (!_botActive) return;
    if (_patchedScene) {
      _tickFrame(_patchedScene);
    }
    _rafId = requestAnimationFrame(_rafLoop);
  }

  function _monitor() {
    var game = _findGame();
    if (!game) return;
    var scene = _getActiveScene(game);
    if (!scene) return;
    if (_patchedScene !== scene) {
      _patchScene(scene);
    }
  }

  function _start() {
    if (_botActive) return;
    _botActive = true;
    _lastJumpTime = 0;

    try { document.body.setAttribute('data-rc-bot-surfer-active', 'true'); } catch (e) {}
    console.log('[RC-TokenSurfer] ✅ Bot BAŞLADI');
    if (window.updateRCStatus)          window.updateRCStatus('[RC] 🏄 Token Surfer Bot aktif');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();

    _monitorId = setInterval(_monitor, 500);
    _monitor();
    _rafId = requestAnimationFrame(_rafLoop);
  }

  function _stop() {
    if (!_botActive) return;
    _botActive = false;
    if (_monitorId) clearInterval(_monitorId);
    if (_rafId) cancelAnimationFrame(_rafId);

    if (_patchedScene && _originalUpdate) {
      try { _patchedScene.update = _originalUpdate; } catch (e) {}
      _patchedScene = null;
    }

    try { document.body.removeAttribute('data-rc-bot-surfer-active'); } catch (e) {}
    console.log('[RC-TokenSurfer] 🛑 Bot DURDURULDU');
    if (window.updateRCStatus)          window.updateRCStatus('[RC] Bot durduruldu');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();
  }

  setInterval(function () {
    var enabled = !(window._rcBotEnabled && window._rcBotEnabled['botSurferEnabled'] === false);
    var active = _isGame() && !!_getCanvas() && enabled;
    if (active && !_botActive)  _start();
    if (!active && _botActive)  _stop();
  }, 500);

  window._rcTokenSurfer = {
    start:    _start,
    stop:     _stop,
    isActive: function () { return _botActive; }
  };
})();
