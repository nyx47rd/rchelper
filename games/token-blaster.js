/* ══════════════════════════════════════════════════════════════════
   RC Helper — Token Blaster Altın Standart Bot (Phaser 3 Engine)
   - 60 FPS scene.update senkronizasyonu ile sıfır gecikmeli kaçış
   - Mermi ve düşman vektör öngörüsü (Collision Raycast)
   - Aralıksız lazer atışı ve öncelikli tehdit imhası
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var _botActive        = false;
  var _monitorId        = null;
  var _patchedScene     = null;
  var _originalUpdate   = null;
  var _lastSpaceTime    = 0;
  var _activeKeys       = {};
  var _velocities       = new Map();
  var _frameCount       = 0;

  function _log() {
    if (window.console) {
      console.log.apply(console, ['[RC-TokenBlaster]'].concat([].slice.call(arguments)));
    }
  }

  function _isGame() {
    var cur = (document.body.getAttribute('data-rc-current-game') || '').toLowerCase();
    if (cur.indexOf('token blaster') !== -1 || cur.indexOf('tokenblaster') !== -1 || cur.indexOf('token-blaster') !== -1) return true;
    var str = (document.title + ' ' + window.location.href).toLowerCase();
    return str.indexOf('token blaster') !== -1 || str.indexOf('tokenblaster') !== -1;
  }

  function _getCanvas() {
    return document.querySelector('#phaserGame canvas') || document.querySelector('canvas');
  }

  /* ── Phaser Game Instance Bulucu ── */
  function _findGame() {
    var canvas = _getCanvas();
    if (!canvas) return null;

    var targets = [canvas, document.getElementById('phaserGame')].filter(Boolean);
    for (var i = 0; i < targets.length; i++) {
      var keys = Object.keys(targets[i]);
      for (var j = 0; j < keys.length; j++) {
        if (keys[j].indexOf('__reactFiber$') === 0) {
          var node = targets[i][keys[j]];
          while (node) {
            if (node.stateNode && node.stateNode.game) return node.stateNode.game;
            node = node.return;
          }
        }
      }
    }

    if (window.Phaser && Array.isArray(window.Phaser.GAMES) && window.Phaser.GAMES.length > 0) {
      for (var gIdx = 0; gIdx < window.Phaser.GAMES.length; gIdx++) {
        var g = window.Phaser.GAMES[gIdx];
        if (g && g.scene) return g;
      }
    }
    if (window.game && window.game.scene) return window.game;
    return null;
  }

  /* ── Aktif Sahneyi Bulma ── */
  function _getActiveScene(game) {
    if (!game || !game.scene || !game.scene.scenes) return null;
    var scenes = game.scene.scenes;

    for (var i = 0; i < scenes.length; i++) {
      var s = scenes[i];
      if (!s || !s.sys || !s.sys.settings) continue;
      if (s.sys.settings.active && (s.spaceship || s.ship || s.player)) return s;
    }
    for (var j = 0; j < scenes.length; j++) {
      var sc = scenes[j];
      if (sc && sc.sys && sc.sys.settings && sc.sys.settings.active && sc.sys.settings.key === 'Game') return sc;
    }
    return null;
  }

  /* ── Klavye Tuş Yönetimi ── */
  function _setKey(codeName, isDown) {
    if (_activeKeys[codeName] === isDown) return;
    _activeKeys[codeName] = isDown;

    var keyCodeMap = { ArrowLeft: 37, ArrowRight: 39, ArrowUp: 38, ArrowDown: 40, Space: 32 };
    var keyCode = keyCodeMap[codeName] || 0;
    var type = isDown ? 'keydown' : 'keyup';
    var opts = { key: codeName === 'Space' ? ' ' : codeName, code: codeName, keyCode: keyCode, which: keyCode, bubbles: true, cancelable: true };

    var canvas = _getCanvas();
    var targets = [window, document, canvas, document.body];
    for (var i = 0; i < targets.length; i++) {
      if (targets[i]) {
        try { targets[i].dispatchEvent(new KeyboardEvent(type, opts)); } catch (e) {}
      }
    }
  }

  function _fireLaser(scene) {
    var now = Date.now();
    if (now - _lastSpaceTime < 45) return;
    _lastSpaceTime = now;

    // 1. Phaser Sahnesinde ateş fonksiyonu varsa doğrudan çağır
    if (scene && typeof scene.fireBullet === 'function') {
      try { scene.fireBullet(); } catch (e) {}
    }
    if (scene && typeof scene.shoot === 'function') {
      try { scene.shoot(); } catch (e) {}
    }

    // 2. DOM Space tuş atışı
    _setKey('Space', true);
    setTimeout(function () { _setKey('Space', false); }, 25);
  }

  /* ── 60 FPS Sahne Çerçeve Motoru ── */
  function _tickFrame(scene, time, delta) {
    if (!_botActive || !scene) return;
    _frameCount++;

    var ship = scene.spaceship || scene.ship || scene.player;
    if (!ship || !ship.active || !ship.visible) return;

    var children = (scene.children && scene.children.list) || [];
    var currentIds = new Set();

    // 1. Hız Vektörlerini Güncelle
    children.forEach(function (c) {
      if (!c || !c.active || !c.visible) return;
      if (!c.__id) c.__id = Math.random().toString(36).substr(2, 9);
      currentIds.add(c.__id);

      var prev = _velocities.get(c.__id);
      if (prev) {
        var vx = c.x - prev.lastX;
        var vy = c.y - prev.lastY;
        prev.vx = prev.vx * 0.6 + vx * 0.4;
        prev.vy = prev.vy * 0.6 + vy * 0.4;
        prev.lastX = c.x;
        prev.lastY = c.y;
      } else {
        _velocities.set(c.__id, { lastX: c.x, lastY: c.y, vx: 0, vy: 0 });
      }
    });

    if (_frameCount % 60 === 0) {
      for (var key of _velocities.keys()) {
        if (!currentIds.has(key)) _velocities.delete(key);
      }
    }

    // 2. Tehditleri ve Hedefleri Ayrıştır
    var threats = [];
    var enemies = [];

    children.forEach(function (c) {
      if (c === ship || !c.texture || !c.texture.key || !c.active || !c.visible) return;

      var k = String(c.texture.key).toLowerCase();
      var isPlayerBullet = k.indexOf('bullet') >= 0 && k.indexOf('alien') < 0;
      var isBg = k.indexOf('star') >= 0 || k.indexOf('bg') >= 0 || k.indexOf('particle') >= 0;
      if (isPlayerBullet || isBg) return;

      var vel = _velocities.get(c.__id) || { vx: 0, vy: 0 };
      var isEnemyBullet = k.indexOf('alienbullet') !== -1 || k.indexOf('enemybullet') !== -1;
      var isDescending = vel.vy > 0.1 || (c.y > ship.y - 220 && c.y < ship.y + 40);

      if (isEnemyBullet || isDescending) {
        threats.push(c);
      }

      if (k.indexOf('bullet') < 0 && c.y < ship.y - 80 && c.y > 40) {
        enemies.push(c);
      }
    });

    // En tehlikeli/en yakın düşmanı hedef seç
    var targetX = ship.x;
    if (enemies.length > 0) {
      enemies.sort(function (a, b) { return b.y - a.y; });
      targetX = enemies[0].x;
    }

    // 3. Şerit ve Tehlike Analizi (Evasion Math)
    var candidates = [];
    for (var i = -8; i <= 8; i++) {
      candidates.push(ship.x + (i * 35));
    }

    var bestX = ship.x;
    var minDanger = Infinity;
    var bestDist = Infinity;

    candidates.forEach(function (cx) {
      if (cx < 45 || cx > 915) return;

      var danger = 0;
      threats.forEach(function (t) {
        var vel = _velocities.get(t.__id) || { vx: 0, vy: 0 };
        var pVy = vel.vy;
        var pVx = vel.vx;
        var isBullet = String(t.texture.key).toLowerCase().indexOf('bullet') !== -1;

        var timeToShip = -1;
        if (pVy > 0.4) {
          timeToShip = (ship.y - t.y) / pVy;
        } else if (t.y > ship.y - 60 && t.y < ship.y + 20) {
          timeToShip = 0;
        }

        var intersectX = t.x;
        var willHit = false;

        if (timeToShip >= 0 && timeToShip < 50) {
          willHit = true;
          intersectX = t.x + (pVx * timeToShip);
        } else if (t.y > ship.y - 250 && t.y < ship.y + 30) {
          willHit = true;
          intersectX = t.x;
        }

        if (willHit) {
          var radius = isBullet ? 60 : 80;
          var dx = Math.abs(intersectX - cx);
          if (dx < radius) {
            var severity = 1 - (dx / radius);
            danger += severity * (isBullet ? 25 : 35);
          }
        }
      });

      var distToTarget = Math.abs(cx - targetX);
      if (danger < minDanger - 0.2) {
        minDanger = danger;
        bestDist = distToTarget;
        bestX = cx;
      } else if (Math.abs(danger - minDanger) <= 0.2) {
        if (distToTarget < bestDist) {
          bestDist = distToTarget;
          bestX = cx;
        }
      }
    });

    // 4. Gemiyi 60 FPS Kesin Konumlandır & Ateş Et
    var diff = bestX - ship.x;
    var maxMove = (1200 * (delta || 16.6)) / 1000;
    var step = Math.max(-maxMove, Math.min(maxMove, diff * 0.85));

    ship.x += step;
    if (ship.body) {
      ship.body.x = ship.x - (ship.body.halfWidth || 30);
      if (ship.body.velocity) ship.body.velocity.x = 0;
    }

    if (diff > 5) {
      _setKey('ArrowLeft', false);
      _setKey('ArrowRight', true);
    } else if (diff < -5) {
      _setKey('ArrowRight', false);
      _setKey('ArrowLeft', true);
    } else {
      _setKey('ArrowLeft', false);
      _setKey('ArrowRight', false);
    }

    // Sürekli aralıksız hızlı lazer ateşi
    _fireLaser(scene);
  }

  /* ── Sahne Yaması (Lifecycle) ── */
  function _unpatchScene() {
    if (_patchedScene && _originalUpdate) {
      try { _patchedScene.update = _originalUpdate; } catch (e) {}
    }
    _patchedScene   = null;
    _originalUpdate = null;
  }

  function _patchScene(scene) {
    if (!scene || _patchedScene === scene) return;
    _unpatchScene();

    _patchedScene   = scene;
    _originalUpdate = scene.update || function () {};

    scene.update = function (time, delta) {
      try { _originalUpdate.call(scene, time, delta); } catch (e) {}
      if (_botActive) {
        try { _tickFrame(scene, time, delta); } catch (e) {}
      }
    };

    _log('✅ Token Blaster 60 FPS motoru yamalandı.');
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
    _velocities.clear();
    _frameCount = 0;
    _lastSpaceTime = 0;
    _activeKeys = {};

    try { document.body.setAttribute('data-rc-bot-blaster-active', 'true'); } catch (e) {}
    _log('🚀 Token Blaster Altın Standart Bot BAŞLADI');
    if (window.updateRCStatus) window.updateRCStatus('[RC] 🚀 Token Blaster Bot aktif');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();

    _monitorId = setInterval(_monitor, 250);
    _monitor();
  }

  function _stop() {
    if (!_botActive) return;
    _botActive = false;
    if (_monitorId) { clearInterval(_monitorId); _monitorId = null; }
    _unpatchScene();

    _setKey('ArrowLeft', false);
    _setKey('ArrowRight', false);
    _setKey('Space', false);

    try { document.body.removeAttribute('data-rc-bot-blaster-active', 'false'); } catch (e) {}
    _log('🛑 Token Blaster Bot DURDURULDU');
    if (window.updateRCStatus) window.updateRCStatus('[RC] 🚀 Token Blaster Bot durdu');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();
  }

  /* Otomatik Başlatma Döngüsü */
  setInterval(function () {
    var enabled = document.body.getAttribute('data-rc-bot-blaster-enabled') !== 'false';
    var active  = _isGame() && !!_getCanvas() && enabled;
    if (active && !_botActive) _start();
    if (!active && _botActive) _stop();
  }, 400);

  window._rcTokenBlaster = {
    start: _start,
    stop: _stop,
    isActive: function () { return _botActive; }
  };
})();
