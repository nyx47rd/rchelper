/**
 * RollerCoin - Coinclick Otomasyon Botu (Phaser 3)
 * window._rcCoinClick -> { start, stop, isActive }
 */
(function () {
  'use strict';

  /* ============================= AYARLAR ============================= */
  var CONFIG = {
    detectorIntervalMs: 500,   // oyun tespiti periyodu
    fallbackScanMs: 120,       // update yaması tutmazsa interval taraması
    clickCooldownMs: 900,      // aynı nesneye tekrar tıklama kilidi
    maxClicksPerTick: 6,       // tek taramada max tıklama (burst engeli)
    minClickGapMs: 30,         // iki tıklama arası min. süre
    debug: false
  };

  var COIN_KEYS = [
    'bitcoin', 'dogecoin', 'etherium', 'ethereum', 'lightcoin', 'litecoin',
    'dashcoin', 'dash', 'rollercoin', 'rct', 'bnb', 'matic', 'polygon',
    'solana', 'tron', 'usdt', 'coin'
  ];
  var IGNORE_KEYS = {
    hamstersprite: 1, scoresprite: 1, timesprite: 1,
    portal: 1, bg: 1, mask: 1
  };

  /* ============================= STATE ============================= */
  var state = {
    running: false,
    game: null,
    scene: null,
    patchedScene: null,
    originalUpdate: null,
    hasOwnUpdate: false,
    clicked: new WeakMap(),    // item -> timestamp (GC dostu)
    detectorTimer: null,
    fallbackTimer: null,
    lastClickAt: 0
  };

  function _log() {
    if (CONFIG.debug && window.console) {
      console.log.apply(console, ['[rcCoinClick]'].concat([].slice.call(arguments)));
    }
  }

  /* ======================= 2) OYUN TESPİTİ (_isGame) ======================= */
  function _isGame() {
    try {
      var attr = (document.body && document.body.getAttribute('data-rc-current-game')) || '';
      if (attr.toLowerCase().indexOf('coinclick') !== -1) return true;

      var href = String(location.href || '').toLowerCase();
      if (href.indexOf('coinclick') !== -1) return true;

      var title = String(document.title || '').toLowerCase();
      if (title.indexOf('coinclick') !== -1) return true;
    } catch (e) {}
    return false;
  }

  /* ======================= PHASER GAME / SCENE BULMA ======================= */
  function _findGame() {
    var i, k, g;
    try {
      if (window.Phaser && Array.isArray(window.Phaser.GAMES)) {
        for (i = 0; i < window.Phaser.GAMES.length; i++) {
          g = window.Phaser.GAMES[i];
          if (g && g.scene && g.canvas) return g;
        }
      }
    } catch (e) {}

    var candidates = ['game', '_game', 'rcGame', 'phaserGame', 'coinClickGame'];
    for (i = 0; i < candidates.length; i++) {
      try {
        g = window[candidates[i]];
        if (g && g.scene && g.canvas) return g;
      } catch (e) {}
    }

    try {
      for (k in window) {
        try {
          g = window[k];
          if (g && g.isBooted === true && g.scene && g.canvas && g.loop) return g;
        } catch (e) {}
      }
    } catch (e) {}
    return null;
  }

  function _findScene(game) {
    if (!game || !game.scene || !game.scene.scenes) return null;
    var scenes = game.scene.scenes;
    var i, s, fallback = null;

    for (i = 0; i < scenes.length; i++) {
      s = scenes[i];
      if (!s || !s.sys) continue;
      var active = false;
      try { active = s.sys.isActive(); } catch (e) {}
      if (!active) continue;

      if (s.itemsGroup) return s; // ideal sahne: itemsGroup + aktif
      if (typeof s.isGameOver !== 'undefined' && !fallback) fallback = s;
      if (!fallback) fallback = s;
    }
    return fallback;
  }

  /* ======================= TEXTURE / COIN FİLTRESİ ======================= */
  function _textureKey(item) {
    try {
      if (item.texture && item.texture.key) return String(item.texture.key);
      if (item.frame && item.frame.texture && item.frame.texture.key) {
        return String(item.frame.texture.key);
      }
    } catch (e) {}
    return '';
  }

  function _isCoin(item, fromGroup) {
    var key = _textureKey(item).toLowerCase();
    if (!key) return false;

    // KRİTİK: BOMBA -> KESİNLİKLE PAS GEÇ
    if (key.indexOf('bomb') !== -1) return false;

    // UI / dekor elemanları -> pas geç
    if (IGNORE_KEYS[key]) return false;

    // Bilinen coin texture key'i
    for (var i = 0; i < COIN_KEYS.length; i++) {
      if (key.indexOf(COIN_KEYS[i]) !== -1) return true;
    }

    // itemsGroup içindeyse ve bomba/UI değilse coin varsay
    return fromGroup === true;
  }

  function _eligible(item) {
    return !!(item && item.active === true && item.visible === true);
  }

  function _collectTargets(scene) {
    var out = [];
    var i, it, list = null;

    var grp = scene.itemsGroup;
    if (grp) {
      if (typeof grp.getChildren === 'function') {
        try { list = grp.getChildren(); } catch (e) {}
      } else if (grp.children && Array.isArray(grp.children.entries)) {
        list = grp.children.entries;
      } else if (Array.isArray(grp)) {
        list = grp;
      }
    }

    if (list && list.length) {
      for (i = 0; i < list.length; i++) {
        it = list[i];
        if (_eligible(it) && _isCoin(it, true)) out.push(it);
      }
      return out;
    }

    // Fallback: tüm display list taraması
    var all = scene.children && scene.children.list;
    if (Array.isArray(all)) {
      for (i = 0; i < all.length; i++) {
        it = all[i];
        if (_eligible(it) && _isCoin(it, false)) out.push(it);
      }
    }
    return out;
  }

  /* ======================= 6) MÜKERRER TIKLAMA ENGELİ ======================= */
  function _canClick(item, now) {
    var last = state.clicked.get(item);
    if (typeof last === 'number' && (now - last) < CONFIG.clickCooldownMs) return false;
    if (state.lastClickAt && (now - state.lastClickAt) < CONFIG.minClickGapMs) return false;
    return true;
  }

  function _markClicked(item, now) {
    state.clicked.set(item, now);
    state.lastClickAt = now;
  }

  /* ======================= 5) TIKLAMA MEKANİZMASI ======================= */
  function _clickItem(scene, item) {
    var input = scene.input;
    if (!input) return;

    // Gerçek aktif pointer'ı kullan; yoksa minimal sahte pointer
    var pointer = input.activePointer || {
      x: 0, y: 0, worldX: 0, worldY: 0,
      isDown: false, buttons: 0, button: 0,
      primaryDown: false, wasTouch: false
    };

    // Kamera düzeltmesi (scroll/zoom varsa worldX/worldY doğru kalsın)
    var wx = item.x, wy = item.y;
    try {
      var cam = scene.cameras && scene.cameras.main;
      if (cam) {
        wx = cam.scrollX + (item.x - cam.x) / (cam.zoom || 1);
        wy = cam.scrollY + (item.y - cam.y) / (cam.zoom || 1);
      }
    } catch (e) {}

    try {
      pointer.x = item.x;
      pointer.y = item.y;
      pointer.worldX = wx;
      pointer.worldY = wy;

      // ---- POINTER DOWN ----
      pointer.isDown = true;
      pointer.primaryDown = true;
      pointer.buttons = 1;

      input.emit('gameobjectdown', pointer, item, pointer);
      if (item.emit) item.emit('pointerdown', pointer, item.x, item.y, pointer);

      // ---- POINTER UP ----
      pointer.isDown = false;
      pointer.primaryDown = false;
      pointer.buttons = 0;

      input.emit('gameobjectup', pointer, item, pointer);
      if (item.emit) item.emit('pointerup', pointer, item.x, item.y, pointer);
    } catch (e) {
      _log('emit hatası:', e);
    }

    // ---- FALLBACK: Canvas PointerEvent ----
    _dispatchCanvasPointer(scene, item);
  }

  function _dispatchCanvasPointer(scene, item) {
    try {
      var canvas = (scene.sys && scene.sys.game && scene.sys.game.canvas) ||
                   (state.game && state.game.canvas);
      if (!canvas || !canvas.dispatchEvent) return;

      var rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      var scaleX = rect.width / canvas.width;
      var scaleY = rect.height / canvas.height;
      var clientX = rect.left + item.x * scaleX;
      var clientY = rect.top + item.y * scaleY;

      var base = {
        bubbles: true, cancelable: true, view: window,
        clientX: clientX, clientY: clientY,
        screenX: clientX, screenY: clientY,
        button: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true
      };

      var downOpts = _extend(base, { buttons: 1 });
      var upOpts = _extend(base, { buttons: 0 });

      if (typeof window.PointerEvent === 'function') {
        canvas.dispatchEvent(new PointerEvent('pointerdown', downOpts));
        canvas.dispatchEvent(new PointerEvent('pointerup', upOpts));
      }
      canvas.dispatchEvent(new MouseEvent('mousedown', downOpts));
      canvas.dispatchEvent(new MouseEvent('mouseup', upOpts));
    } catch (e) {
      _log('canvas fallback hatası:', e);
    }
  }

  function _extend(a, b) {
    var o = {}, k;
    for (k in a) o[k] = a[k];
    for (k in b) o[k] = b[k];
    return o;
  }

  /* ======================= 4) TARAMA / TICK ======================= */
  function _tick() {
    if (!state.running) return;

    var scene = state.scene;

    // Sahne geçersizleştiyse (restart / sahne değişimi) yeniden yakala
    if (!scene || !scene.sys || !scene.sys.isActive || !scene.sys.isActive()) {
      _acquire();
      scene = state.scene;
      if (!scene) return;
    }

    // Yama başka sahneye kaldıysa yeniden yamala
    if (state.patchedScene !== scene) _patchScene(scene);

    // Oyun bittiyse hiçbir şeye dokunma
    try {
      if (scene.isGameOver === true) return;
    } catch (e) {}

    var targets = _collectTargets(scene);
    if (!targets.length) return;

    var now = Date.now();
    var clicks = 0;

    for (var i = 0; i < targets.length; i++) {
      if (clicks >= CONFIG.maxClicksPerTick) break;
      var item = targets[i];
      if (!_canClick(item, now)) continue;

      _markClicked(item, now);
      _clickItem(scene, item);
      clicks++;
      _log('coin tıklandı:', _textureKey(item));
    }
  }

  function _acquire() {
    state.game = _findGame();
    state.scene = _findScene(state.game);
    if (state.scene) _patchScene(state.scene);
  }

  /* ======================= SCENE UPDATE YAMASI ======================= */
  function _patchScene(scene) {
    if (!scene || state.patchedScene === scene) return;
    _unpatchScene();

    state.hasOwnUpdate = Object.prototype.hasOwnProperty.call(scene, 'update');
    var orig = null;
    try { orig = scene.update; } catch (e) {}

    state.originalUpdate = (typeof orig === 'function') ? orig : null;
    state.patchedScene = scene;

    scene.update = function (time, delta) {
      if (state.originalUpdate) {
        try { state.originalUpdate.call(this, time, delta); }
        catch (e) { _log('orijinal update hatası:', e); }
      }
      _tick();
    };

    _log('scene.update yamalandı');
  }

  function _unpatchScene() {
    var s = state.patchedScene;
    if (s) {
      try {
        if (state.hasOwnUpdate && state.originalUpdate) {
          s.update = state.originalUpdate;
        } else {
          delete s.update; // prototype zincirine geri dön
        }
      } catch (e) {}
    }
    state.patchedScene = null;
    state.originalUpdate = null;
    state.hasOwnUpdate = false;
  }

  /* ======================= FALLBACK SCANNER ======================= */
  function _startFallbackScan() {
    if (state.fallbackTimer) return;
    state.fallbackTimer = setInterval(function () {
      // Yama sağlıklıysa interval çift iş yapmasın
      if (state.patchedScene && state.patchedScene === state.scene) {
        try {
          if (state.scene.sys && state.scene.sys.isActive()) return;
        } catch (e) {}
      }
      _tick();
    }, CONFIG.fallbackScanMs);
  }

  function _stopFallbackScan() {
    if (state.fallbackTimer) {
      clearInterval(state.fallbackTimer);
      state.fallbackTimer = null;
    }
  }

  /* ======================= 3) START / STOP ======================= */
  function _start() {
    if (state.running) return true;

    _acquire();
    if (!state.game || !state.scene) {
      _log('game/scene henüz bulunamadı, bir sonraki tespitte tekrar denenecek');
      return false;
    }

    state.running = true;
    state.clicked = new WeakMap();
    state.lastClickAt = 0;
    _startFallbackScan();
    _log('BOT BAŞLADI');
    return true;
  }

  function _stop() {
    if (!state.running) return;
    state.running = false;
    _unpatchScene();
    _stopFallbackScan();
    state.scene = null;
    state.game = null;
    _log('BOT DURDURULDU');
  }

  /* ======================= 7) DIŞA AKTARMA ======================= */
  window._rcCoinClick = {
    start: _start,
    stop: _stop,
    isActive: function () { return state.running; }
  };

  /* ======================= OTOMATİK BAŞLATMA DÖNGÜSÜ ======================= */
  state.detectorTimer = setInterval(function () {
    var enabled = !(window._rcBotEnabled && window._rcBotEnabled['botCoinClickEnabled'] === false);
    var inGame = _isGame() && enabled;
    if (inGame && !state.running) {
      _start();
    } else if (!inGame && state.running) {
      _stop();
    }
  }, CONFIG.detectorIntervalMs);

  _log('modül yüklendi, dedektör aktif');
})();
