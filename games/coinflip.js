/* ══════════════════════════════════════════════════════════════════
   RC Helper — CoinFlip (Hafıza Kartı) Zeki Hafıza Botu (v2.4.0)
   Yalnızca /play_game sayfasında inject edilir (manifest.json)
   Tetikleyici: Oyun ekranı algılanınca otomatik başlar
   Mekanik: Phaser scene.update yamalama (monkey-patch) + requestAnimationFrame fallback.
            Kartların görsellerini/render frame'lerini (c.frame.name) takip eden,
            reklam engellerinden etkilenmeyen doğrudan Phaser Pointer event tetikleyici.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var _botActive      = false;
  var _patchedScene   = null;
  var _originalUpdate = null;
  var _monitorId      = null;
  var _rafId          = null;

  /* Durum Takip Değişkenleri */
  var _lastActionTime = 0;

  /* ─── Oyun Tespiti ──────────────────────────────────────────── */
  function _isGame() {
    var attr = (document.body.getAttribute('data-rc-current-game') || '').toLowerCase();
    if (attr.includes('coinflip') || attr.includes('coin_flip') || attr.includes('coin-flip') || attr.includes('memory')) return true;
    var src = (document.title + window.location.href).toLowerCase();
    return src.includes('coinflip') || src.includes('coin_flip') || src.includes('coin-flip');
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

  /* ─── Kart Tıklama (Phaser Event Injection) ───────────────────── */
  function _clickCard(card, canvas, scene) {
    if (scene && scene.input) {
      try {
        var cardCenterX = card.x + (card.width  || 171) / 2;
        var cardCenterY = card.y + (card.height || 171) / 2;

        /* Phaser Pointer koordinatlarını güncelle */
        var pointer = scene.input.activePointer || {};
        pointer.x = cardCenterX;
        pointer.y = cardCenterY;
        pointer.worldX = cardCenterX;
        pointer.worldY = cardCenterY;

        /* Doğrudan Phaser olaylarını tetikle */
        card.emit('pointerdown', pointer);
        card.emit('pointerup', pointer);
        scene.input.emit('gameobjectdown', pointer, card);
        console.log('[RC-CoinFlip] ✓ Phaser olayı enjekte edildi:', card.texture && card.texture.key);
      } catch(e) {
        console.log('[RC-CoinFlip] ❌ Phaser olay tetikleme hatası:', e);
      }
    }
  }

  /* ─── Ana Karar Döngüsü (60 FPS) ────────────────────────────── */
  function _tickFrame(scene) {
    var sceneKey = scene && scene.sys && scene.sys.settings && scene.sys.settings.key;
    if (sceneKey !== 'Game') return;

    /* Phaser input kilitliyse (animasyon dönemi vb.) işlem yapma */
    if (scene.input && !scene.input.enabled) return;

    var canvas = scene.sys && scene.sys.game && scene.sys.game.canvas;
    if (!canvas) canvas = _getCanvas();
    if (!canvas) return;

    var cards = scene.cards;
    if (!cards || !cards.length) return;

    var now = Date.now();
    if (now - _lastActionTime < 350) return; /* Eylemler arası minimum 350ms bekleme */

    /* Eşleşmemiş, aktif olan kartları filtrele */
    var activeCards = cards.filter(function (c) {
      return c && c.active && c.visible;
    });
    if (activeCards.length === 0) return;

    /* Açık olan kartları render frame'ine (c.frame.name) bakarak tespit et.
       Kapak görseli frame index'i daima 1'dir. 1 olmayanlar görsel olarak açıktır. */
    var openCards = activeCards.filter(function (c) {
      return c.frame && c.frame.name !== 1 && String(c.frame.name) !== '1';
    });

    if (openCards.length === 0) {
      /* 1. Hiç açık kart yok: İlk aktif kapalı kartı aç. */
      var target = activeCards[0];
      console.log('[RC-CoinFlip] 🎴 Kart açılıyor:', target.texture && target.texture.key);
      _clickCard(target, canvas, scene);
      _lastActionTime = now;
    } 
    else if (openCards.length === 1) {
      /* 2. Tam 1 kart açık: Eşini bul ve tıkla. */
      var opened = openCards[0];
      var openedKey = opened.texture && opened.texture.key;
      
      /* Kapalı olanlar arasından aynı textureKey'e sahip olanı bul */
      var partner = activeCards.find(function (c) {
        return c !== opened && c.texture && c.texture.key === openedKey;
      });

      if (partner) {
        console.log('[RC-CoinFlip] 🎯 Eş bulundu! Eşleştiriliyor:', openedKey);
        _clickCard(partner, canvas, scene);
        /* Eşleşme animasyonu için uzun cooldown (1.2sn) */
        _lastActionTime = now + 1200;
      }
    } 
    else {
      /* 3. 2 veya daha fazla kart açık: Animasyonların tamamlanmasını bekle. */
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

    console.log('[RC-CoinFlip] ✅ scene.update başarıyla yamalandı');
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
    _botActive      = true;
    _lastActionTime = 0;

    try { document.body.setAttribute('data-rc-bot-coinflip-active', 'true'); } catch (e) {}
    console.log('[RC-CoinFlip] ✅ Bot BAŞLADI');
    if (window.updateRCStatus)          window.updateRCStatus('[RC] 🃏 CoinFlip Bot aktif');
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

    try { document.body.setAttribute('data-rc-bot-coinflip-active', 'false'); } catch (e) {}
    console.log('[RC-CoinFlip] ⏹ Bot DURDU');
    if (window.updateRCStatus)          window.updateRCStatus('[RC] 🃏 CoinFlip Bot durdu');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();
  }

  /* ─── Otomatik Başlat/Durdur ────────────────────────────────── */
  setInterval(function () {
    var enabled    = document.body.getAttribute('data-rc-bot-coinflip-enabled') !== 'false';
    var shouldRun  = _isOnPlayPage() && _isGame() && !!_getCanvas() && enabled;
    if (shouldRun  && !_botActive) _start();
    if (!shouldRun && _botActive)  _stop();
  }, 500);

  window._rcCoinFlip = { start: _start, stop: _stop, isActive: function () { return _botActive; } };
})();
