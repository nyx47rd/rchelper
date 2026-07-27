/* ══════════════════════════════════════════════════════════════════
 R C* Helper — Token Surfer Akıllı Bot (Engel + Boşluk Algılama)
 Manuel başlatılır: window._rcTokenSurfer.start()
 Mekanik: Yaklaşan engelleri ve platform boşluklarını tespit edip zıplar.
 ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var _botActive       = false;
  var _monitorId       = null;
  var _patchedScene    = null;
  var _originalUpdate  = null;
  var _lastJumpTime    = 0;
  var _jumpCooldownMs  = 350; /* Zıplamalar arası bekleme */

  function _isGame() {
    var curGame = (document.body.getAttribute('data-rc-current-game') || '').toLowerCase();
    if (curGame.indexOf('token surfer') !== -1 || curGame.indexOf('tokensurfer') !== -1 || curGame.indexOf('snow ride') !== -1) {
      return true;
    }
    var sources = [document.title || '', window.location.href || ''];
    return sources.some(function(s) {
      var n = s.toLowerCase();
      return n.indexOf('token surfer') !== -1 || n.indexOf('tokensurfer') !== -1 || n.indexOf('snow ride') !== -1;
    });
  }

  function _getCanvas() {
    return document.querySelector('#phaserGame canvas') || document.querySelector('canvas');
  }

  function _findGame() {
    var canvas = _getCanvas();
    if (!canvas) return null;

    var targets = [canvas];
    var ph = document.getElementById('phaserGame');
    if (ph) targets.push(ph);

    for (var i = 0; i < targets.length; i++) {
      var el = targets[i];
      var keys = Object.keys(el);
      for (var j = 0; j < keys.length; j++) {
        if (keys[j].indexOf('__reactFiber$') === 0) {
          var node = el[keys[j]];
          while (node) {
            if (node.stateNode && node.stateNode.game) return node.stateNode.game;
            node = node.return;
          }
        }
      }
    }
    return null;
  }

  function _getActiveScene(game) {
    if (!game || !game.scene || !game.scene.scenes) return null;
    for (var i = 0; i < game.scene.scenes.length; i++) {
      var s = game.scene.scenes[i];
      if (s.sys && s.sys.settings && s.sys.settings.active && s.sys.settings.key === 'Game') {
        return s;
      }
    }
    for (var i2 = 0; i2 < game.scene.scenes.length; i2++) {
      if (game.scene.scenes[i2].sys.settings.active) return game.scene.scenes[i2];
    }
    return null;
  }

  function _triggerJump(scene, player) {
    var now = Date.now();
    if (now - _lastJumpTime < _jumpCooldownMs) return;
    _lastJumpTime = now;

    // 1. Yöntem: Oyunun kendi zıplama fonksiyonu
    if (typeof scene.jump === 'function') {
      try { scene.jump(); return; } catch(e) {}
    }

    // 2. Yöntem: Doğrudan fizik müdahalesi (Fallback)
    if (player && player.body) {
      try {
        player.body.setVelocityY(-550);
        if (scene.sound && typeof scene.sound.play === 'function') {
          scene.sound.play('jump');
        }
        return;
      } catch(e) {}
    }

    // 3. Yöntem: Klavye simülasyonu
    var opts = { bubbles: true, cancelable: true, keyCode: 32, which: 32, key: ' ', code: 'Space' };
    var upOpts = { bubbles: true, cancelable: true, keyCode: 38, which: 38, key: 'ArrowUp', code: 'ArrowUp' };
    var targets = [window, document, _getCanvas()];
    targets.forEach(function(t) {
      if (t) {
        try { t.dispatchEvent(new KeyboardEvent('keydown', opts)); } catch(e) {}
        try { t.dispatchEvent(new KeyboardEvent('keyup', opts)); } catch(e) {}
        try { t.dispatchEvent(new KeyboardEvent('keydown', upOpts)); } catch(e) {}
        try { t.dispatchEvent(new KeyboardEvent('keyup', upOpts)); } catch(e) {}
      }
    });
  }

  function _tickFrame(scene) {
    if (!_botActive || !scene) return;

    var player = scene.player || scene.hamster || scene.surfer;
    if (!player && scene.children && scene.children.list) {
      for (var i = 0; i < scene.children.list.length; i++) {
        var c = scene.children.list[i];
        if (c.active && c.visible && c.texture) {
          var k = String(c.texture.key).toLowerCase();
          if (k.indexOf('hamster') !== -1 || k.indexOf('player') !== -1 || k.indexOf('surfer') !== -1) {
            player = c;
            break;
          }
        }
      }
    }
    if (!player) return;

    var px = player.x || 130;
    var py = player.y || 540;

    // Yerde mi? body yoksa Y pozisyonuna göre tahmin et
    var isOnGround = true;
    if (player.body) {
      var vel = player.body.velocity ? player.body.velocity.y : 0;
      // Hız yukarı doğru yüksekse (zaten zıpladı) veya düşüyor ise zıplama
      isOnGround = !(vel < -50);
    }

    var list = (scene.children && scene.children.list) || [];
    var obstacles = [];

    for (var j = 0; j < list.length; j++) {
      var obj = list[j];
      if (!obj || !obj.active || !obj.visible || obj === player) continue;

      var key = obj.texture ? String(obj.texture.key).toLowerCase() : '';

      // Coin ve UI filtrele
      if (key.indexOf('btc') !== -1 || key.indexOf('doge') !== -1 || key.indexOf('eth') !== -1 ||
        key.indexOf('coin') !== -1 || key.indexOf('score') !== -1 || key.indexOf('lives') !== -1 ||
        key.indexOf('time') !== -1 || key.indexOf('bg') !== -1 || key.indexOf('snow') !== -1 ||
        key.indexOf('hamster') !== -1 || key === '' || key === 'null') {
        continue;
      }

      // Engel tespiti
      var isObstacle = key.indexOf('cart') !== -1 || key.indexOf('light') !== -1 || key.indexOf('dove') !== -1 ||
        key.indexOf('rock') !== -1 || key.indexOf('tree') !== -1 || key.indexOf('cone') !== -1 ||
        key.indexOf('barrier') !== -1 || key.indexOf('fence') !== -1 || key.indexOf('cactus') !== -1 ||
        key.indexOf('obstacle') !== -1 || key.indexOf('garbage') !== -1 || key.indexOf('traffic') !== -1;

      if (isObstacle) {
        // Oyuncunun önünde mi?
        if (obj.x > px - 20 && obj.x < px + 280) {
          obstacles.push(obj);
        }
      }
    }

    if (!isOnGround) return; // Havada iken zıplama

    if (obstacles.length > 0) {
      obstacles.sort(function (a, b) { return a.x - b.x; });
      var closestObs = obstacles[0];
      var distObs = closestObs.x - px;

      if (distObs > 30 && distObs < 230) {
        _triggerJump(scene, player);
      }
    }
  }

  function _unpatchScene() {
    if (_patchedScene && _originalUpdate) {
      try { _patchedScene.update = _originalUpdate; } catch(e) {}
    }
    _patchedScene = null;
    _originalUpdate = null;
  }

  function _patchScene(scene) {
    if (!scene || _patchedScene === scene) return;
    _unpatchScene();

    _patchedScene = scene;
    _originalUpdate = scene.update || function () {};

    scene.update = function (time, delta) {
      try { _originalUpdate.call(scene, time, delta); } catch (e) {}
      if (_botActive) _tickFrame(scene);
    };

    console.log('[RC-TokenSurfer] ✅ Phaser scene.update yamalandı');
  }

  function _monitor() {
    if (!_botActive) return;
    var game = _findGame();
    if (!game) return;
    var scene = _getActiveScene(game);
    if (!scene) return;
    if (_patchedScene !== scene) _patchScene(scene);
  }

  function _start() {
    if (_botActive) return;
    _botActive = true;
    _lastJumpTime = 0;

    try { document.body.setAttribute('data-rc-bot-surfer-active', 'true'); } catch (e) {}
    console.log('[RC-TokenSurfer] ✅ Bot BAŞLADI');
    if (window.updateRCStatus) window.updateRCStatus('[RC] 🏄 Token Surfer Bot aktif');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();

    _monitorId = setInterval(_monitor, 500);
    _monitor();
  }

  function _stop() {
    if (!_botActive) return;
    _botActive = false;
    if (_monitorId) { clearInterval(_monitorId); _monitorId = null; }
    _unpatchScene();

    try { document.body.removeAttribute('data-rc-bot-surfer-active'); } catch (e) {}
    console.log('[RC-TokenSurfer] 🛑 Bot DURDURULDU');
    if (window.updateRCStatus) window.updateRCStatus('[RC] 🏄 Token Surfer Bot durdu');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();
  }

  /* Otomatik başlatma/durdurma */
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
