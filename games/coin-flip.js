/* ══════════════════════════════════════════════════════════════════
   RC Helper — Coin Flip (Hafıza Kartı) Akıllı Bot
   Phaser scene.cards üzerinden tüm çiftleri önceden okur,
   sıfır hata ile eşleştirir.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var _botActive      = false;
  var _monitorId      = null;
  var _patchedScene   = null;
  var _originalUpdate = null;
  var _pairMap        = {};   /* texture_key → [card1, card2] */
  var _pairQueue      = [];   /* [{c1, c2}, ...] sırayla tıklanacaklar */
  var _clickedFirst   = false;
  var _waitUntil      = 0;
  var _clickDelay     = 500;  /* İki kart arası ms */
  var _pairDelay      = 900;  /* Çift tamamlandıktan sonra ms */

  /* ── Oyun tespiti ── */
  function _isGame() {
    var cur = (document.body.getAttribute('data-rc-current-game') || '').toLowerCase();
    if (cur.indexOf('coin-flip') !== -1 || cur.indexOf('coin flip') !== -1 || cur.indexOf('coinflip') !== -1) return true;
    /* URL / title fallback */
    var href = window.location.href.toLowerCase();
    var title = document.title.toLowerCase();
    if (href.indexOf('/play_game') !== -1) {
      if (title.indexOf('coin flip') !== -1 || title.indexOf('coin-flip') !== -1) return true;
    }
    return false;
  }

  function _getCanvas() {
    return document.querySelector('#phaserGame canvas') || document.querySelector('canvas');
  }

  /* ── Phaser game/scene bulucular ── */
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
    if (window.game && window.game.scene) return window.game;
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

  /* ── Kartları oku ve çiftleri eşleştir ── */
  function _getCardList(scene) {
    var cards = scene.cards;
    if (!cards) return [];
    /* Phaser Group */
    if (typeof cards.getChildren === 'function') return cards.getChildren();
    /* Phaser Group via .children.entries */
    if (cards.children && Array.isArray(cards.children.entries)) return cards.children.entries;
    /* Plain array */
    if (Array.isArray(cards)) return cards;
    return [];
  }

  function _buildPairMap(scene) {
    _pairMap  = {};
    _pairQueue = [];

    var list = _getCardList(scene);

    /* Fallback: children.list içinden de ara */
    if (!list.length && scene.children && scene.children.list) {
      list = scene.children.list.filter(function(c) {
        if (!c || !c.texture || !c.input) return false;
        var k = String(c.texture.key).toLowerCase();
        return k !== 'null' && k !== '' && k.indexOf('shell') === -1 &&
               k.indexOf('header') === -1 && k.indexOf('score') === -1 &&
               k.indexOf('time') === -1 && k.indexOf('main') === -1 &&
               k.indexOf('bg') === -1;
      });
    }

    if (!list.length) { console.log('[RC-CoinFlip] ⚠️ Kart listesi boş!'); return; }

    for (var i = 0; i < list.length; i++) {
      var card = list[i];
      if (!card || !card.active) continue;
      var key = card.texture ? String(card.texture.key).toLowerCase() : 'unknown_' + i;
      if (!_pairMap[key]) _pairMap[key] = [];
      _pairMap[key].push(card);
    }

    /* Çiftleri kuyruğa al */
    for (var tex in _pairMap) {
      var pair = _pairMap[tex];
      if (pair.length >= 2) {
        _pairQueue.push({ c1: pair[0], c2: pair[1] });
      }
    }

    console.log('[RC-CoinFlip] 🃏 ' + _pairQueue.length + ' çift bulundu:', Object.keys(_pairMap));
  }

  /* ── Karta tıkla: Phaser pointer pipeline'ını simüle et ── */
  function _clickCard(scene, card) {
    if (!card || !card.active) return;

    /* Yöntem 1: Phaser'ın activePointer'ını karta konumlandır ve input pipeline'ı tetikle */
    try {
      var inp = scene.input;
      var ptr = inp && inp.activePointer;
      if (ptr && inp) {
        /* Pointer'ı kart merkezine taşı */
        ptr.x       = card.x;
        ptr.y       = card.y;
        ptr.worldX  = card.x;
        ptr.worldY  = card.y;
        ptr.downX   = card.x;
        ptr.downY   = card.y;
        ptr.isDown  = true;
        ptr.button  = 0;

        /* Kartın input handler'larını direkt çağır */
        if (card.input) {
          inp.emit('gameobjectdown', ptr, card, ptr);
          card.emit('pointerdown',   ptr, card.x, card.y, ptr);
          ptr.isDown = false;
          inp.emit('gameobjectup',   ptr, card, ptr);
          card.emit('pointerup',     ptr, card.x, card.y, ptr);
          return;
        }
      }
    } catch(e) {}

    /* Yöntem 2: Ham canvas olayı */
    try {
      var canvas = _getCanvas();
      if (!canvas) return;
      var camera = scene.cameras && scene.cameras.main;
      var zoom   = camera ? camera.zoom : 1;
      var cX     = card.x * zoom;
      var cY     = card.y * zoom;
      var rect   = canvas.getBoundingClientRect();
      var sx     = rect.width  / canvas.width;
      var sy     = rect.height / canvas.height;
      var opts   = {
        bubbles: true, cancelable: true, composed: true,
        clientX: rect.left + cX * sx,
        clientY: rect.top  + cY * sy,
        button: 0, buttons: 1,
        pointerId: 1, pointerType: 'mouse', isPrimary: true
      };
      canvas.dispatchEvent(new PointerEvent('pointermove',  opts));
      canvas.dispatchEvent(new PointerEvent('pointerdown',  opts));
      canvas.dispatchEvent(new PointerEvent('pointerup',    opts));
    } catch(e) {}
  }

  /* ── Ana tick ── */
  var _step = 0; /* 0=bekle, 1=ilk kart tıkla, 2=ikinci kart tıkla, 3=pair arası bekle */
  var _curPair = null;

  function _tickFrame(scene) {
    if (!_botActive || !scene) return;
    var now = Date.now();
    if (now < _waitUntil) return;

    /* Sıra boşsa yeniden oku (cards.length yerine _pairQueue'yu esas al) */
    if (_pairQueue.length === 0) {
      _buildPairMap(scene);
      if (_pairQueue.length === 0) return;
      _step = 0;
    }

    /* Oyun hâlâ animasyon yapıyorsa bekle (openedCard varsa ikinci tıklamayı yap) */
    if (_step === 0) {
      /* Kullanılmış / eşleşmiş çiftleri kuyruktan temizle */
      _pairQueue = _pairQueue.filter(function(p) {
        return p.c1.active && p.c2.active;
      });
      if (_pairQueue.length === 0) return;

      _curPair = _pairQueue.shift();
      _step = 1;
    }

    if (_step === 1) {
      /* İlk kartı tıkla */
      if (!_curPair.c1.active) { _step = 0; return; }
      _clickCard(scene, _curPair.c1);
      _waitUntil = now + _clickDelay;
      _step = 2;
      return;
    }

    if (_step === 2) {
      /* İkinci kartı tıkla */
      if (!_curPair.c2.active) { _step = 0; return; }
      _clickCard(scene, _curPair.c2);
      _waitUntil = now + _pairDelay;
      _step = 0;
      return;
    }
  }

  /* ── Sahne yamalama ── */
  function _unpatchScene() {
    if (_patchedScene && _originalUpdate) {
      try { _patchedScene.update = _originalUpdate; } catch(e) {}
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
      try { _originalUpdate.call(scene, time, delta); } catch(e) {}
      if (_botActive) _tickFrame(scene);
    };
    /* Çiftleri hemen oku */
    _buildPairMap(scene);
    _step      = 0;
    _waitUntil = Date.now() + 800; /* Oyunun açılış animasyonu bitmesi için kısa bekleme */
    console.log('[RC-CoinFlip] ✅ Sahne yamalandı');
  }

  function _monitor() {
    if (!_botActive) return;
    var game = _findGame();
    if (!game) return;
    var scene = _getActiveScene(game);
    if (!scene) return;
    if (_patchedScene !== scene) _patchScene(scene);
  }

  /* ── Başlat / Durdur ── */
  function _start() {
    if (_botActive) return;
    _botActive  = true;
    _pairMap    = {};
    _pairQueue  = [];
    _step       = 0;
    _waitUntil  = 0;

    try { document.body.setAttribute('data-rc-bot-coinflip-active', 'true'); } catch(e) {}
    console.log('[RC-CoinFlip] ✅ Bot BAŞLADI');
    if (window.updateRCStatus)        window.updateRCStatus('[RC] 🪙 Coin Flip Bot aktif');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();

    _monitorId = setInterval(_monitor, 500);
    _monitor();
  }

  function _stop() {
    if (!_botActive) return;
    _botActive = false;
    if (_monitorId) { clearInterval(_monitorId); _monitorId = null; }
    _unpatchScene();

    try { document.body.removeAttribute('data-rc-bot-coinflip-active'); } catch(e) {}
    console.log('[RC-CoinFlip] 🛑 Bot DURDURULDU');
    if (window.updateRCStatus)        window.updateRCStatus('[RC] 🪙 Coin Flip Bot durdu');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();
  }

  /* ── Otomatik başlatma ── */
  setInterval(function () {
    var enabled = !(window._rcBotEnabled && window._rcBotEnabled['botCoinFlipEnabled'] === false);
    var active  = _isGame() && !!_getCanvas() && enabled;
    if (active  && !_botActive) _start();
    if (!active &&  _botActive) _stop();
  }, 500);

  window._rcCoinFlip = {
    start:    _start,
    stop:     _stop,
    isActive: function () { return _botActive; }
  };
})();
