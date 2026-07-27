/* ══════════════════════════════════════════════════════════════════
   R C* Helper — Lambo Rider Akıllı Bot
   Yatay 3 şeritli koşu oyunu için engel kaçırma ve coin toplama.
   Phaser Input API ve window keyboard eventleri ile çalışır.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var _botActive       = false;
  var _monitorId       = null;
  var _patchedScene    = null;
  var _originalUpdate  = null;
  var _lastSwitchTime  = 0;
  var _switchCooldown  = 250; /* Şerit değiştirme arası ms */
  var _cachedLanes     = []; /* Dinamik şerit Y koordinatları */

  function _isGame() {
    var cur = (document.body.getAttribute('data-rc-current-game') || '').toLowerCase();
    if (cur.indexOf('lambo rider') !== -1 || cur.indexOf('lamborider') !== -1 || cur.indexOf('lambo-rider') !== -1) return true;
    var sources = [document.title || '', window.location.href || ''];
    return sources.some(function(s) {
      var n = s.toLowerCase();
      return n.indexOf('lambo rider') !== -1 || n.indexOf('lamborider') !== -1 || n.indexOf('lambo-rider') !== -1;
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
      if (s.sys && s.sys.settings && s.sys.settings.active && s.sys.settings.key === 'Game') return s;
    }
    for (var i2 = 0; i2 < game.scene.scenes.length; i2++) {
      if (game.scene.scenes[i2].sys.settings.active) return game.scene.scenes[i2];
    }
    return null;
  }

  /* Klavye tuşu simülasyonu (Phaser window'u dinler) */
  function _pressKey(key, duration) {
    var keyCode = key === 'ArrowUp' ? 38 : (key === 'ArrowDown' ? 40 : 0);
    if (!keyCode) return;
    
    var opts = { keyCode: keyCode, key: key, code: key, bubbles: true, cancelable: true };
    try { window.dispatchEvent(new KeyboardEvent('keydown', opts)); } catch(e) {}

    setTimeout(function() {
      try { window.dispatchEvent(new KeyboardEvent('keyup', opts)); } catch(e) {}
    }, duration || 50);
  }

  /* Obje filtreleme: Yoldaki gerçek nesneleri ayıkla */
  function _isObstacle(obj) {
    if (!obj || !obj.active || !obj.visible || !obj.texture) return false;
    var key = obj.texture.key ? String(obj.texture.key).toLowerCase() : '';
    if (!key || key === 'playerMove3' || key === 'null') return false;
    /* Coin olmayan her şey engeldir (sewerHatch, traffic, roadWork vb.) */
    return key.indexOf('coin') === -1 && key.indexOf('btc') === -1 && key.indexOf('doge') === -1 && key.indexOf('eth') === -1;
  }

  function _isCoin(obj) {
    if (!obj || !obj.active || !obj.visible || !obj.texture) return false;
    var key = obj.texture.key ? String(obj.texture.key).toLowerCase() : '';
    if (key.indexOf('destroy') !== -1) return false;
    return key.indexOf('coin') !== -1 || key.indexOf('btc') !== -1 || key.indexOf('doge') !== -1 || key.indexOf('eth') !== -1;
  }

  /* Y koordinatlarına göre şeritleri dinamik bul */
  function _detectLanes(objects) {
    var ys = [];
    objects.forEach(function(obj) {
      if (_isObstacle(obj) || _isCoin(obj)) {
        if (ys.indexOf(obj.y) === -1) ys.push(obj.y);
      }
    });
    ys.sort(function(a, b) { return a - b; });
    
    var lanes = [];
    for (var i = 0; i < ys.length; i++) {
      var found = false;
      for (var j = 0; j < lanes.length; j++) {
        if (Math.abs(lanes[j] - ys[i]) < 40) { // 40px tolerans
          found = true;
          break;
        }
      }
      if (!found) lanes.push(ys[i]);
    }
    
    if (lanes.length >= 2) {
      _cachedLanes = lanes.sort(function(a, b) { return a - b; });
    }
    return _cachedLanes;
  }

  function _tickFrame(scene) {
    var player = scene.player || scene.car || scene.lambo;
    if (!player && scene.children && scene.children.list) {
      for (var pIdx = 0; pIdx < scene.children.list.length; pIdx++) {
        var cObj = scene.children.list[pIdx];
        if (cObj && cObj.active && cObj.texture) {
          var tKey = String(cObj.texture.key).toLowerCase();
          if (tKey.indexOf('player') !== -1 || tKey.indexOf('car') !== -1 || tKey.indexOf('lambo') !== -1) {
            player = cObj;
            break;
          }
        }
      }
    }
    if (!_botActive || !scene || !player) return;
    
    var now = Date.now();
    if (now - _lastSwitchTime < _switchCooldown) return; // Spam engelle

    var px = player.x;
    var py = player.y;

    var list = (scene.children && scene.children.list) || [];
    var lanes = _detectLanes(list);
    
    if (lanes.length < 2) return; /* Şeritler tespit edilemediyse bekle */

    /* Oyuncunun hangi şeritte olduğunu bul */
    var currentLaneIdx = 0;
    var minDiff = 9999;
    for (var i = 0; i < lanes.length; i++) {
      var diff = Math.abs(py - lanes[i]);
      if (diff < minDiff) {
        minDiff = diff;
        currentLaneIdx = i;
      }
    }

    /* İleriyi tara (Önümüzdeki 80px - 600px arası) */
    var laneStats = [];
    for (var l = 0; l < lanes.length; l++) {
      laneStats.push({ laneIdx: l, hasObstacle: false, coinCount: 0 });
    }

    for (var j = 0; j < list.length; j++) {
      var obj = list[j];
      if (!obj.active || !obj.visible) continue;
      
      var dist = obj.x - px;
      if (dist > 80 && dist < 600) {
        for (var k = 0; k < lanes.length; k++) {
          if (Math.abs(obj.y - lanes[k]) < 40) {
            if (_isObstacle(obj)) {
              laneStats[k].hasObstacle = true;
            } else if (_isCoin(obj)) {
              laneStats[k].coinCount++;
            }
            break;
          }
        }
      }
    }

    var currentLane = laneStats[currentLaneIdx];

    /* Karar verme aşaması */
    var shouldMove = false;
    var targetLaneIdx = currentLaneIdx;

    /* 1. Mevcut şeritte engel varsa KAÇ */
    if (currentLane.hasObstacle) {
      shouldMove = true;
      
      /* Güvenli ve coinli şerit bul */
      var bestSafeLane = -1;
      var maxCoins = -1;
      
      for (var m = 0; m < laneStats.length; m++) {
        if (!laneStats[m].hasObstacle) {
          if (laneStats[m].coinCount > maxCoins) {
            maxCoins = laneStats[m].coinCount;
            bestSafeLane = m;
          }
        }
      }
      
      /* Güvenli şerit varsa onu seç, yoksa rastgele başka şeride kaç */
      if (bestSafeLane !== -1) {
        targetLaneIdx = bestSafeLane;
      } else {
        targetLaneIdx = (currentLaneIdx + 1) % lanes.length;
      }
    } 
    /* 2. Mevcut şerit güvenli ama coin yok, başka şeritte coin varsa GİT */
    else if (currentLane.coinCount === 0) {
      var bestCoinLane = -1;
      var topCoins = 0;
      for (var n = 0; n < laneStats.length; n++) {
        if (!laneStats[n].hasObstacle && laneStats[n].coinCount > topCoins) {
          topCoins = laneStats[n].coinCount;
          bestCoinLane = n;
        }
      }
      if (bestCoinLane !== -1) {
        shouldMove = true;
        targetLaneIdx = bestCoinLane;
      }
    }

    /* Hareketi uygula */
    if (shouldMove && targetLaneIdx !== currentLaneIdx) {
      if (targetLaneIdx < currentLaneIdx) {
        _pressKey('ArrowUp', 50);
        _lastSwitchTime = now;
      } else {
        _pressKey('ArrowDown', 50);
        _lastSwitchTime = now;
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
    console.log('[RC-Lambo] ✅ Phaser scene.update yamalandı');
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
    _cachedLanes = [];
    try { document.body.setAttribute('data-rc-bot-lambo-active', 'true'); } catch(e) {}
    console.log('[RC-Lambo] ✅ Lambo Rider Bot BAŞLADI');
    if (window.updateRCStatus) window.updateRCStatus('[RC] 🏎️ Lambo Rider Bot aktif');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();

    _monitorId = setInterval(_monitor, 500);
    _monitor();
  }

  function _stop() {
    if (!_botActive) return;
    _botActive = false;
    if (_monitorId) { clearInterval(_monitorId); _monitorId = null; }
    _unpatchScene();

    try { document.body.removeAttribute('data-rc-bot-lambo-active'); } catch(e) {}
    console.log('[RC-Lambo] 🛑 Lambo Rider Bot DURDURULDU');
    if (window.updateRCStatus) window.updateRCStatus('[RC] 🏎️ Lambo Rider Bot durdu');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();
  }

  setInterval(function () {
    var enabled = !(window._rcBotEnabled && window._rcBotEnabled['botLamboEnabled'] === false);
    var active = _isGame() && !!_getCanvas() && enabled;
    if (active && !_botActive) _start();
    if (!active && _botActive) _stop();
  }, 500);

  window._rcLamboRider = {
    start: _start,
    stop: _stop,
    isActive: function () { return _botActive; }
  };
})();
