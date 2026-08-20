/* ══════════════════════════════════════════════════════════════════
   RC Helper — Coin Fisher Altın Standart Bot (Phaser 3 Engine)
   - Trigonometrik Olta Açısı ve Balık/Coin Kesişim Matematiği (Ray-Cast)
   - Hedef önceliklendirme (BTC, ETH, DOGE, Altın)
   - Kaya ve engelleri atlayarak sıfır hata ile olta fırlatma
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var _botActive        = false;
  var _monitorId        = null;
  var _patchedScene     = null;
  var _originalUpdate   = null;
  var _lastShootTime    = 0;
  var _activeKeys       = {};

  /* Bilinen Değerli Coin / Balık Texture Anahtarları */
  var PRIORITY_KEYS = ['btc', 'bitcoin', 'eth', 'etherium', 'ethereum', 'doge', 'dogecoin', 'ltc', 'litecoin', 'dash', 'dashcoin', 'gold', 'coin', 'fish'];
  var AVOID_KEYS    = ['rock', 'stone', 'bomb', 'boot', 'trash', 'shoe'];

  function _log() {
    if (window.console) {
      console.log.apply(console, ['[RC-CoinFisher]'].concat([].slice.call(arguments)));
    }
  }

  function _isGame() {
    var cur = (document.body.getAttribute('data-rc-current-game') || '').toLowerCase();
    if (cur.indexOf('coin fisher') !== -1 || cur.indexOf('coinfisher') !== -1 || cur.indexOf('coin-fisher') !== -1) return true;
    var str = (document.title + ' ' + window.location.href).toLowerCase();
    return str.indexOf('coin fisher') !== -1 || str.indexOf('coinfisher') !== -1;
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
      if (s.sys.settings.active && (s.hook || s.claw || s.fishesGroup || s.coinsGroup || s.itemsGroup)) return s;
    }
    for (var j = 0; j < scenes.length; j++) {
      var sc = scenes[j];
      if (sc && sc.sys && sc.sys.settings && sc.sys.settings.active && sc.sys.settings.key === 'Game') return sc;
    }
    return null;
  }

  function _shootHook(scene) {
    var now = Date.now();
    if (now - _lastShootTime < 600) return;
    _lastShootTime = now;
    _log('🎣 Olta fırlatılıyor (Tam Kesişim Yakalandı)...');

    // 1. Sahne üzerindeki ateş fonksiyonları
    if (scene) {
      if (typeof scene.shootHook === 'function') {
        try { scene.shootHook(); return; } catch (e) {}
      }
      if (typeof scene.fireHook === 'function') {
        try { scene.fireHook(); return; } catch (e) {}
      }
      if (typeof scene.launchHook === 'function') {
        try { scene.launchHook(); return; } catch (e) {}
      }
      if (scene.input) {
        try {
          scene.input.emit('pointerdown', scene.input.activePointer);
          scene.input.emit('pointerup', scene.input.activePointer);
        } catch (e) {}
      }
    }

    // 2. DOM Space ve Down tuşu & Canvas Tıklama
    var canvas = _getCanvas();
    var targets = [window, document, canvas, document.body];
    var optsSpace = { key: ' ', code: 'Space', keyCode: 32, which: 32, bubbles: true, cancelable: true };
    var optsDown  = { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, which: 40, bubbles: true, cancelable: true };

    targets.forEach(function (t) {
      if (t) {
        try { t.dispatchEvent(new KeyboardEvent('keydown', optsSpace)); } catch (e) {}
        try { t.dispatchEvent(new KeyboardEvent('keydown', optsDown)); } catch (e) {}
        setTimeout(function () {
          try { t.dispatchEvent(new KeyboardEvent('keyup', optsSpace)); } catch (e) {}
          try { t.dispatchEvent(new KeyboardEvent('keyup', optsDown)); } catch (e) {}
        }, 50);
      }
    });

    if (canvas) {
      try {
        canvas.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        canvas.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      } catch (e) {}
    }
  }

  /* ── 60 FPS Olta Açısı ve Hedef Kesişim Motoru ── */
  function _tickFrame(scene, time, delta) {
    if (!_botActive || !scene) return;

    var hook = scene.hook || scene.claw || scene.player || null;
    var children = (scene.children && scene.children.list) || [];

    if (!hook) {
      for (var i = 0; i < children.length; i++) {
        var obj = children[i];
        if (!obj || !obj.texture) continue;
        var k = String(obj.texture.key).toLowerCase();
        if (k.indexOf('hook') !== -1 || k.indexOf('claw') !== -1 || k.indexOf('rod') !== -1) {
          hook = obj;
          break;
        }
      }
    }

    if (!hook) return;

    // Olta şu anda fırlatılmış ve geri çekiliyorsa bekle
    if (hook.isShooting === true || hook.isRetracting === true) return;
    if (scene.isShooting === true || scene.hookMoving === true) return;

    var hookX = hook.x || 480;
    var hookY = hook.y || 80;
    var hookAngle = (typeof hook.rotation === 'number') ? hook.rotation : ((typeof hook.angle === 'number') ? (hook.angle * Math.PI / 180) : 0);

    // Phaser açısını [0, Math.PI] aralığına normalize et
    var currentRad = hookAngle + (Math.PI / 2); // 0 aşağı bakacak şekilde normalize

    // Sahnedeki değerli hedefleri topla
    var targets = [];
    children.forEach(function (c) {
      if (c === hook || !c.active || !c.visible || !c.texture) return;
      if (c.y <= hookY + 30) return; // Oltanın üstündekileri ele

      var tex = String(c.texture.key).toLowerCase();
      var isAvoid = AVOID_KEYS.some(function (ak) { return tex.indexOf(ak) !== -1; });
      if (isAvoid) return;

      var isTarget = PRIORITY_KEYS.some(function (pk) { return tex.indexOf(pk) !== -1; });
      if (isTarget || c.type === 'Sprite') {
        targets.push(c);
      }
    });

    if (!targets.length) return;

    // Hedefleri olta açısıyla kesişim kontrolünden geçir
    for (var tIdx = 0; tIdx < targets.length; tIdx++) {
      var target = targets[tIdx];
      var dx = target.x - hookX;
      var dy = target.y - hookY;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 40) continue;

      var desiredAngle = Math.atan2(dx, dy); // 0 tam aşağı, pozitif sağ, negatif sol
      var angleDiff = Math.abs(desiredAngle - hookAngle);

      // Kesişim Toleransı: Uzaklığa ve nesne boyutuna göre hassas tolerans
      var targetRadius = (target.displayWidth || target.width || 40) / 2;
      var angularTolerance = Math.atan2(targetRadius + 6, dist);

      if (angleDiff < angularTolerance) {
        _shootHook(scene);
        break;
      }
    }
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

    _log('✅ Coin Fisher 60 FPS motoru yamalandı.');
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
    _lastShootTime = 0;
    _activeKeys = {};

    try { document.body.setAttribute('data-rc-bot-fisher-active', 'true'); } catch (e) {}
    _log('🚀 Coin Fisher Altın Standart Bot BAŞLADI');
    if (window.updateRCStatus) window.updateRCStatus('[RC] 🎣 Coin Fisher Bot aktif');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();

    _monitorId = setInterval(_monitor, 250);
    _monitor();
  }

  function _stop() {
    if (!_botActive) return;
    _botActive = false;
    if (_monitorId) { clearInterval(_monitorId); _monitorId = null; }
    _unpatchScene();

    try { document.body.removeAttribute('data-rc-bot-fisher-active'); } catch (e) {}
    _log('🛑 Coin Fisher Bot DURDURULDU');
    if (window.updateRCStatus) window.updateRCStatus('[RC] 🎣 Coin Fisher Bot durdu');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();
  }

  /* Otomatik Başlatma Döngüsü */
  setInterval(function () {
    var enabled = document.body.getAttribute('data-rc-bot-fisher-enabled') !== 'false';
    var active  = _isGame() && !!_getCanvas() && enabled;
    if (active && !_botActive) _start();
    if (!active && _botActive) _stop();
  }, 400);

  window._rcCoinFisher = {
    start: _start,
    stop: _stop,
    isActive: function () { return _botActive; }
  };
})();
