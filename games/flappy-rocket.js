/* ══════════════════════════════════════════════════════════════════
   RC Helper — Flappy Rocket Zeki Uçuş Botu (v2.5.0)
   Yalnızca /play_game sayfasında inject edilir (manifest.json)
   Tetikleyici: Oyun ekranı algılanınca otomatik başlar
   Mekanik: Phaser scene.update yamalama (monkey-patch) + requestAnimationFrame fallback.
            Karşıdan gelen mum/boru çiftlerini takip ederek boşluk merkezinden
            (targetY) süzülme ve zıplama ivmesi (flap) hesaplayan otopilot.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var _botActive      = false;
  var _patchedScene   = null;
  var _originalUpdate = null;
  var _monitorId      = null;
  var _rafId          = null;

  /* Durum Takip Değişkenleri */
  var _lastFlapTime = 0;

  /* ─── Oyun Tespiti ──────────────────────────────────────────── */
  function _isGame() {
    var attr = (document.body.getAttribute('data-rc-current-game') || '').toLowerCase();
    if (attr.includes('rocket') || attr.includes('flappy')) return true;
    var src = (document.title + window.location.href).toLowerCase();
    return src.includes('rocket') || src.includes('flappy');
  }

  function _isOnPlayPage() {
    return window.location.href.includes('/play_game');
  }

  function _getCanvas() {
    var ph = document.getElementById('phaserGame');
    if (ph) {
      var c = ph.querySelector('canvas');
      if (c) return c;
    }
    var canvases = document.querySelectorAll('canvas');
    for (var i = 0; i < canvases.length; i++) {
      var c = canvases[i];
      if (c.width === 960 && c.height === 828) return c;
    }
    return document.querySelector('#phaserGame canvas') || document.querySelector('canvas');
  }

  /* ─── Phaser Game Bulma ─────────────────────────────────────── */
  function _findGame() {
    var canvas = _getCanvas();
    if (!canvas) return null;

    var targets = [canvas];
    var ph = document.getElementById('phaserGame');
    if (ph) targets.push(ph);

    for (var i = 0; i < targets.length; i++) {
      var el = targets[i];
      var rk = Object.keys(el).find(function (k) { return k.startsWith('__reactFiber$'); });
      if (!rk) continue;
      var node = el[rk];
      while (node) {
        if (node.stateNode && node.stateNode.game) return node.stateNode.game;
        node = node.return;
      }
    }
    return null;
  }

  function _getGameScene(game) {
    if (!game || !game.scene) return null;
    if (typeof game.scene.getScenes === 'function') {
      var actives = game.scene.getScenes(true);
      if (actives && actives.length) return actives[actives.length - 1];
    }
    var found = null;
    (game.scene.scenes || []).forEach(function (s) {
      if (s && s.sys && s.sys.settings && s.sys.settings.active &&
          s.sys.settings.key === 'Game') found = s;
    });
    return found;
  }

  /* ─── Uçuş Tetikleme (Flap) ──────────────────────────────────── */
  function _flap(scene) {
    var now = Date.now();
    if (now - _lastFlapTime < 80) return; /* Aşırı hızlı flap spamlama engeli */
    _lastFlapTime = now;

    // 1. Klavye Space Olayı
    var opts = { bubbles: true, cancelable: true, keyCode: 32, which: 32, key: ' ', code: 'Space' };
    [window, document, document.body].forEach(function (t) {
      if (t) {
        try { t.dispatchEvent(new KeyboardEvent('keydown', opts)); } catch(e) {}
        try { t.dispatchEvent(new KeyboardEvent('keyup', opts)); } catch(e) {}
      }
    });

    // 2. Phaser Pointer Tıklama Olayı (Bypass)
    var canvas = scene.sys && scene.sys.game && scene.sys.game.canvas;
    if (!canvas) canvas = _getCanvas();
    if (canvas) {
      var r = canvas.getBoundingClientRect();
      var evOpts = { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
      try { canvas.dispatchEvent(new PointerEvent('pointerdown', evOpts)); } catch (e) {}
      try { canvas.dispatchEvent(new PointerEvent('pointerup', evOpts)); } catch (e) {}
    }
  }

  /* ─── Ana Karar Döngüsü (60 FPS) ────────────────────────────── */
  function _tickFrame(scene) {
    var sceneKey = scene && scene.sys && scene.sys.settings && scene.sys.settings.key;
    if (sceneKey !== 'Game') return;

    var player = scene.player;
    if (!player || !player.active || !player.body) return;

    var targetY = 414; /* Varsayılan: Ekranın dikey ortası (828 / 2) */

    /* Önümüzdeki en yakın aktif boruları (pipesGroup) analiz et */
    if (scene.pipesGroup && typeof scene.pipesGroup.getChildren === 'function') {
      var activePipes = scene.pipesGroup.getChildren().filter(function (c) {
        return c && c.active && c.visible && c.x > 140; /* Roket x=200 civarındadır */
      });

      if (activePipes.length > 0) {
        /* Aynı X koordinatına sahip boruları grupla (boru çiftleri) */
        var pipesByX = {};
        activePipes.forEach(function (c) {
          var px = Math.round(c.x);
          if (!pipesByX[px]) pipesByX[px] = [];
          pipesByX[px].push(c);
        });

        /* Roketin sağındaki en yakın X koordinatını bul */
        var sortedXs = Object.keys(pipesByX).map(Number).sort(function (a, b) { return a - b; });
        var px = player.x || 200;
        var pw = player.width || 80;
        var minX = px - pw / 2 + 10; /* Roket merkezinden biraz marj bırak */

        var closestX = sortedXs.find(function (x) { return x > minX; });
        if (closestX !== undefined) {
          var pair = pipesByX[closestX];
          var yTop = null;
          var yBottom = null;

          pair.forEach(function (c) {
            if (c.originY === 1) yTop = c.y;    /* Üst borunun alt sınırı */
            if (c.originY === 0) yBottom = c.y; /* Alt borunun üst sınırı */
          });

          if (yTop !== null && yBottom !== null) {
            targetY = (yTop + yBottom) / 2;
          } else if (yTop !== null) {
            targetY = yTop + 160; /* Yalnızca üst boru varsa 160px aşağıyı hedefle */
          } else if (yBottom !== null) {
            targetY = yBottom - 160; /* Yalnızca alt boru varsa 160px yukarıyı hedefle */
          }
        }
      }
    }

    var py = player.y;
    var vy = player.body.velocity ? player.body.velocity.y : 0;

    /* Otopilot zıplama kriteri:
       Eğer roket hedef yüksekliğin altındaysa ve aşağı düşmeye başladıysa (veya hızı yavaşsa) zıplat */
    if (py > targetY + 15 && vy >= -50) {
      _flap(scene);
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

    console.log('[RC-FlappyRocket] ✅ scene.update başarıyla yamalandı');
  }

  /* ─── Monitor ───────────────────────────────────────────────── */
  function _monitor() {
    if (!_botActive) return;

    var game = _findGame();
    if (!game) return;

    var scene = _getGameScene(game);
    if (!scene) return;

    if (_patchedScene !== scene) {
      _patchScene(scene);
    }
  }

  /* ─── Başlatma / Durdurma ───────────────────────────────────── */
  function _start() {
    if (_botActive) return;
    _botActive    = true;
    _lastFlapTime = 0;

    try { document.body.setAttribute('data-rc-bot-rocket-active', 'true'); } catch (e) {}
    console.log('[RC-FlappyRocket] ✅ Bot BAŞLADI');
    if (window.updateRCStatus)          window.updateRCStatus('[RC] 🚀 Flappy Rocket Bot aktif');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();

    _monitorId = setInterval(_monitor, 500);
    _monitor();

    /* RAF Fallback Loop */
    if (_rafId) cancelAnimationFrame(_rafId);
    function _rafLoop() {
      if (!_botActive) return;
      var game = _findGame();
      var scene = game && _getGameScene(game);
      if (scene && _patchedScene !== scene) {
        _tickFrame(scene);
      }
      _rafId = requestAnimationFrame(_rafLoop);
    }
    _rafId = requestAnimationFrame(_rafLoop);
  }

  function _stop() {
    if (!_botActive) return;
    _botActive = false;
    if (_monitorId) { clearInterval(_monitorId); _monitorId = null; }
    if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }

    if (_patchedScene && _originalUpdate) {
      try { _patchedScene.update = _originalUpdate; } catch(e) {}
    }
    _patchedScene   = null;
    _originalUpdate = null;

    try { document.body.setAttribute('data-rc-bot-rocket-active', 'false'); } catch (e) {}
    console.log('[RC-FlappyRocket] ⏹ Bot DURDU');
    if (window.updateRCStatus)          window.updateRCStatus('[RC] 🚀 Flappy Rocket Bot durdu');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();
  }

  /* ─── Otomatik Başlat/Durdur ────────────────────────────────── */
  setInterval(function () {
    var enabled    = document.body.getAttribute('data-rc-bot-rocket-enabled') !== 'false';
    var shouldRun  = _isOnPlayPage() && _isGame() && !!_getCanvas() && enabled;
    if (shouldRun  && !_botActive) _start();
    if (!shouldRun && _botActive)  _stop();
  }, 500);

  window._rcFlappyRocket = { start: _start, stop: _stop, isActive: function () { return _botActive; } };
})();
