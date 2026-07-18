/* ══════════════════════════════════════════════════════════════════
   RC Helper — CoinFlip (Hafıza Kartı) Zeki Hafıza Botu (v2.2.95)
   Yalnızca /play_game sayfasında inject edilir (manifest.json)
   Tetikleyici: Oyun ekranı algılanınca otomatik başlar
   Mekanik: Phaser bellekten tüm kart texture'larını okur →
            çiftleri anında tespit edip tıklar (hafıza gerektirmez)
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var _botActive   = false;
  var _solving     = false;
  var _monitorId   = null;
  var _lastSolveAt = 0;

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

  /* ─── Kart Tıklama ──────────────────────────────────────────── */
  function _clickCard(card, canvas, scene) {
    var rect   = canvas.getBoundingClientRect();
    var scaleX = rect.width  / (canvas.width  || 960);
    var scaleY = rect.height / (canvas.height || 828);

    /* Kart origin {0,0} → merkeze tıkla */
    var cardCenterX = card.x + (card.width  || 171) / 2;
    var cardCenterY = card.y + (card.height || 171) / 2;

    var cx = rect.left + cardCenterX * scaleX;
    var cy = rect.top  + cardCenterY * scaleY;

    /* Phaser activePointer koordinatlarını manuel güncelle */
    if (scene && scene.input) {
      try {
        if (scene.input.activePointer) {
          scene.input.activePointer.x = cardCenterX;
          scene.input.activePointer.y = cardCenterY;
        }
        if (scene.input.mousePointer) {
          scene.input.mousePointer.x = cardCenterX;
          scene.input.mousePointer.y = cardCenterY;
        }
      } catch(e) {}
    }

    var evOpts = { bubbles: true, cancelable: true, clientX: cx, clientY: cy, isPrimary: true, pointerId: 1 };

    /* 1. Pointer Events */
    ['pointerdown', 'pointerup'].forEach(function (t) {
      try { canvas.dispatchEvent(new PointerEvent(t, evOpts)); } catch (e) {}
    });

    /* 2. Mouse Events */
    ['mousedown', 'mouseup', 'click'].forEach(function (t) {
      try { canvas.dispatchEvent(new MouseEvent(t, evOpts)); } catch (e) {}
    });
  }

  /* ─── Çift Çözücü ───────────────────────────────────────────── */
  function _solvePairs(scene, canvas) {
    if (_solving) return;

    var cards = scene.cards;
    if (!cards || !cards.length) return;

    /* Texture key'e göre aktif kartları grupla */
    var groups = {};
    cards.forEach(function (card) {
      if (!card || !card.active) return; /* zaten eşleşmiş */
      var key = card.texture && card.texture.key;
      if (!key || key === '__DEFAULT' || key === '__MISSING') return;
      if (!groups[key]) groups[key] = [];
      groups[key].push(card);
    });

    /* Tam 2 elemanlı gruplardan çift listesi oluştur */
    var pairs = [];
    Object.keys(groups).forEach(function (key) {
      var g = groups[key];
      if (g.length >= 2) pairs.push([g[0], g[1]]);
    });

    if (!pairs.length) return;

    _solving = true;
    console.log('[RC-CoinFlip] 🃏 ' + pairs.length + ' çift bulundu → anlık çözülüyor!');

    var idx = 0;

    function clickNext() {
      if (!_botActive) { _solving = false; return; }

      /* Sahne hâlâ Game mi? */
      var sk = scene.sys && scene.sys.settings && scene.sys.settings.key;
      if (sk !== 'Game') { _solving = false; return; }

      if (idx >= pairs.length) {
        _solving = false;
        console.log('[RC-CoinFlip] ✅ Tüm çiftler tamamlandı!');
        return;
      }

      var pair = pairs[idx++];
      var c1 = pair[0];
      var c2 = pair[1];

      /* İlk kartı tıkla */
      if (c1.active) _clickCard(c1, canvas, scene);

      /* Kısa bekleyip 2. kartı tıkla, sonra animasyon için bekle */
      setTimeout(function () {
        if (!_botActive) { _solving = false; return; }
        if (c2.active) _clickCard(c2, canvas, scene);
        setTimeout(clickNext, 850); /* eşleşme animasyonu için bekle */
      }, 550); /* kartın açılma animasyonu için bekle */
    }

    /* Oyunun hazır olması için küçük bir başlangıç gecikmesi */
    setTimeout(clickNext, 400);
  }

  /* ─── Monitor ───────────────────────────────────────────────── */
  function _monitor() {
    if (!_botActive) return;

    var game = _findGame();
    if (!game) return;

    var scene = _getGameScene(game);
    if (!scene) return;

    var sk = scene.sys && scene.sys.settings && scene.sys.settings.key;
    if (sk !== 'Game') return;

    /* Çözülecek kart varsa ve şu an çözülmüyorsa başlat */
    if (!_solving && scene.countAlive > 0) {
      var now = Date.now();
      if (now - _lastSolveAt > 1500) {
        _lastSolveAt = now;
        var canvas = _getCanvas();
        if (canvas) _solvePairs(scene, canvas);
      }
    }
  }

  /* ─── Başlatma / Durdurma ───────────────────────────────────── */
  function _start() {
    if (_botActive) return;
    _botActive   = true;
    _solving     = false;
    _lastSolveAt = 0;
    try { document.body.setAttribute('data-rc-bot-coinflip-active', 'true'); } catch (e) {}
    console.log('[RC-CoinFlip] ✅ Bot BAŞLADI');
    if (window.updateRCStatus)          window.updateRCStatus('[RC] 🃏 CoinFlip Bot aktif');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();

    _monitorId = setInterval(_monitor, 1000);
    _monitor(); /* hemen bir kez çalıştır */
  }

  function _stop() {
    if (!_botActive) return;
    _botActive = false;
    _solving   = false;
    if (_monitorId) { clearInterval(_monitorId); _monitorId = null; }
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
