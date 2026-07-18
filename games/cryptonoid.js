/* ══════════════════════════════════════════════════════════════════
   RC Helper — Cryptonoid (Breakout) Zeki Hafıza Botu (v2.2.90)
   Yalnızca /game/play_game sayfasında inject edilir (manifest.json)
   Tetikleyici: Oyun ekranı algılanınca otomatik başlar
   Mekanik: Phaser scene.update yamalama (monkey-patch) + requestAnimationFrame fallback
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var _botActive           = false;
  var _lastLaunch          = 0;
  var _paddleOffset        = 0;
  var _offsetPrepared      = false;
  var _lastBallY           = 0;
  var _lastBallX           = 0;
  var _ballStationaryCount = 0;
  var _monitorId           = null;
  var _rafId               = null;
  var _patchedScene        = null;  /* Şu an yamalı olan sahne referansı */
  var _originalUpdate      = null;

  /* ─── Oyun Tespiti ──────────────────────────────────────────── */
  function _isGame() {
    var attr = (document.body.getAttribute('data-rc-current-game') || '').toLowerCase();
    if (attr.includes('cryptonoid')) return true;
    return (document.title + window.location.href).toLowerCase().includes('cryptonoid');
  }

  function _isOnPlayPage() {
    return window.location.href.includes('/play_game');
  }

  function _getCanvas() {
    return document.querySelector('#phaserGame canvas') || document.querySelector('canvas');
  }

  /* ─── Phaser Game Nesnesi Bulma ─────────────────────────────── */
  function _findGame() {
    /* Yöntem 1: React Fiber aracılığı */
    var canvas = _getCanvas();
    if (!canvas) return null;

    /* canvas ve #phaserGame üzerinde React key ara */
    var searchTargets = [canvas];
    var ph = document.getElementById('phaserGame');
    if (ph) searchTargets.push(ph);

    for (var i = 0; i < searchTargets.length; i++) {
      var el = searchTargets[i];
      var rk = Object.keys(el).find(function (k) { return k.startsWith('__reactFiber$'); });
      if (!rk) continue;
      var node = el[rk];
      while (node) {
        if (node.stateNode && node.stateNode.game) return node.stateNode.game;
        node = node.return;
      }
    }

    /* Yöntem 2: window içinde Phaser.Game örneği ara */
    if (window.Phaser && window.Phaser.GameObjects) {
      for (var key in window) {
        try {
          var val = window[key];
          if (val && val.scene && typeof val.scene.getScenes === 'function') return val;
        } catch(e) {}
      }
    }

    return null;
  }

  /* ─── Aktif Sahneleri Al ────────────────────────────────────── */
  function _getActiveScene(game) {
    if (!game || !game.scene) return null;

    /* getScenes() ile aktif olanı bul */
    if (typeof game.scene.getScenes === 'function') {
      var all = game.scene.getScenes(true); // true = sadece aktifler
      if (all && all.length > 0) return all[0];
    }

    /* scenes dizisiyle bul */
    if (game.scene.scenes) {
      var found = null;
      game.scene.scenes.forEach(function (s) {
        if (s && s.sys && s.sys.settings && s.sys.settings.active && !found) {
          found = s;
        }
      });
      if (found) return found;
    }

    return null;
  }

  /* ─── Klavye / Fare Simülasyonu ─────────────────────────────── */
  var _activeKeys = {};
  function _setKeyState(key, pressed) {
    if (_activeKeys[key] === pressed) return;
    _activeKeys[key] = pressed;
    var codes = { ArrowLeft: 37, ArrowRight: 39, Space: 32 };
    var kc = codes[key] || 0;
    var opts = { key: key === 'Space' ? ' ' : key, code: key, keyCode: kc, which: kc, bubbles: true, cancelable: true };
    var type = pressed ? 'keydown' : 'keyup';
    var cv = _getCanvas();
    [window, document, cv, document.body].forEach(function (t) { if (t) t.dispatchEvent(new KeyboardEvent(type, opts)); });
  }

  function _pressSpace() {
    _setKeyState('Space', true);
    setTimeout(function () { _setKeyState('Space', false); }, 50);
  }

  function _clickCanvas(canvas) {
    var r = canvas.getBoundingClientRect();
    var cx = r.left + r.width / 2;
    var cy = r.top + r.height / 2;
    var opts = { bubbles: true, cancelable: true, clientX: cx, clientY: cy };
    ['mousedown', 'mouseup', 'click'].forEach(function (t) {
      canvas.dispatchEvent(new MouseEvent(t, opts));
    });
  }

  /* ─── Sahne Yamalama ────────────────────────────────────────── */
  function _patchScene(scene) {
    /* Aynı sahneye iki kez yama yapma */
    if (!scene || _patchedScene === scene) return;

    /* Önceki yamalı sahneyi geri al */
    if (_patchedScene && _originalUpdate) {
      try { _patchedScene.update = _originalUpdate; } catch(e) {}
    }

    _patchedScene   = scene;
    _originalUpdate = scene.update || function () {};

    scene.update = function (time, delta) {
      try { _originalUpdate.call(scene, time, delta); } catch (e) {}
      if (_botActive) _tickFrame(scene);
    };

    console.log('[RC-Cryptonoid] ✅ Phaser scene.update yamalandı → sahne:', (scene.sys && scene.sys.settings && scene.sys.settings.key) || '?');
  }

  /* ─── Ana Kare Döngüsü (60 FPS) ────────────────────────────── */
  function _tickFrame(scene) {
    /* Sadece asıl oyun sahnesinde çalış — GameOver/Start/LoadGame'de DUR */
    var sceneKey = scene && scene.sys && scene.sys.settings && scene.sys.settings.key;
    if (sceneKey !== 'Game') return;

    var canvas = _getCanvas();
    if (!canvas) return;

    var paddle = scene.platform;
    var ball   = scene.ball;
    if (!paddle || !ball) return;

    /* Top aktif ve görünür değilse (oyun bitti) hiçbir şey yapma */
    if (!ball.active || !ball.visible) return;

    /* === 1. Hız Tespiti (fizik motorundan bağımsız) === */
    var vy = ball.y - _lastBallY;
    var vx = ball.x - _lastBallX;

    if (Math.abs(vy) < 0.05 && Math.abs(vx) < 0.05) {
      _ballStationaryCount++;
    } else {
      _ballStationaryCount = 0;
    }
    _lastBallX = ball.x;
    _lastBallY = ball.y;

    var isStationary = _ballStationaryCount > 15;

    /* === 2. Top Fırlatma — yalnızca top GERÇEKTEN rakette beklerken === */
    if (isStationary && ball.y >= 740) {
      var now = Date.now();
      if (now - _lastLaunch > 2000) {
        _lastLaunch = now;
        console.log('[RC-Cryptonoid] 🚀 Top fırlatılıyor...');
        _pressSpace();
        var r2 = canvas.getBoundingClientRect();
        var scaleX2 = r2.width / (canvas.width || 960);
        var clickOpts = { bubbles: true, cancelable: true,
          clientX: r2.left + ball.x * scaleX2,
          clientY: r2.top  + ball.y * (r2.height / (canvas.height || 900)) };
        canvas.dispatchEvent(new MouseEvent('pointerdown', clickOpts));
        canvas.dispatchEvent(new MouseEvent('pointerup',   clickOpts));
      }
    }

    /* === 3. Aktif Karoların Merkezi (scene.Blocks) === */
    var brickCenterX = 480; // Varsayılan: ekran ortası
    var brickCount   = 0;
    if (scene.Blocks) {
      var allBricks = [];
      try {
        if (typeof scene.Blocks.getChildren === 'function') {
          allBricks = scene.Blocks.getChildren();
        } else if (scene.Blocks.children && scene.Blocks.children.entries) {
          allBricks = scene.Blocks.children.entries;
        }
      } catch(e) {}

      var sumBX = 0;
      for (var bi = 0; bi < allBricks.length; bi++) {
        var bk = allBricks[bi];
        if (bk && bk.active && bk.visible) {
          sumBX += bk.x;
          brickCount++;
        }
      }
      if (brickCount > 0) brickCenterX = sumBX / brickCount;
    }

    /* === 4. Hedef X Belirleme === */
    var halfW  = (paddle.width / 2) || 40;
    var targetX;

    if (vy > 0.5) {
      /*
       * Top AŞAĞI DÜŞÜYOR → raket topu karşılarken aynı zamanda yön veriyor.
       *
       * Phaser Breakout fiziği: top rakete nerede çarparsa o yöne gider.
       *   ball.x > paddle.x  → top SAĞA gider
       *   ball.x < paddle.x  → top SOLA gider
       *
       * Karo merkezi topun SAĞINDAysa → topu sağa göndermek istiyoruz
       *   → paddle.x < ball.x (raket topun SOLUNDA olmalı)
       *   → aimShift negatif
       *
       * Karo merkezi topun SOLUNDAysa → topu sola göndermek istiyoruz
       *   → paddle.x > ball.x (raket topun SAĞINDA olmalı)
       *   → aimShift pozitif
       */
      var brickDelta = brickCenterX - ball.x;           // + = karolar sağda, - = karolar solda
      var aimShift   = -(brickDelta * 0.55);            // ters yönde kaydır
      var maxShift   = halfW * 0.75;                    // raket genişliğinin %75'i kadar max kaydır
      aimShift = Math.max(-maxShift, Math.min(maxShift, aimShift));
      targetX  = ball.x + aimShift;

    } else {
      /*
       * Top YUKARI ÇIKIYOR veya HAREKETSIZ → bonus yakala yoksa topa yakın dur
       */
      targetX = ball.x; // varsayılan: topu izle

      if (scene.BonusGroup) {
        var bonuses = [];
        try {
          if (typeof scene.BonusGroup.getChildren === 'function') {
            bonuses = scene.BonusGroup.getChildren();
          } else if (scene.BonusGroup.children && scene.BonusGroup.children.entries) {
            bonuses = scene.BonusGroup.children.entries;
          }
        } catch (e) {}

        var activeB = bonuses.filter(function (b) {
          return b && b.active && b.visible && b.y < paddle.y;
        });

        if (activeB.length > 0) {
          activeB.sort(function (a, b) { return b.y - a.y; });
          targetX = activeB[0].x; // en alttaki bonusu yakala
        }
      }
    }

    /* === 5. Raket Konumunu Güncelle === */
    var finalX = Math.max(halfW + 10, Math.min(960 - halfW - 10, targetX));

    paddle.x = finalX;
    if (paddle.body) paddle.body.x = finalX - halfW;

    if (scene.input) {
      /* scene.input.x is a read-only getter — do NOT write it */
      try { if (scene.input.activePointer) scene.input.activePointer.x = finalX; } catch(e) {}
      try { if (scene.input.mousePointer)  scene.input.mousePointer.x  = finalX; } catch(e) {}
    }
  }

  /* ─── RAF Fallback: Yamalama başarısız olursa kendin çalıştır ─ */
  function _rafLoop() {
    if (!_botActive) return;
    if (_patchedScene) {
      _tickFrame(_patchedScene);
    }
    _rafId = requestAnimationFrame(_rafLoop);
  }

  /* ─── Monitor: Her 500ms sahneyi kontrol et ve yamala ───────── */
  function _monitor() {
    var game = _findGame();
    if (!game) {
      console.log('[RC-Cryptonoid] ⚠ Phaser game bulunamadı, bekleniyor...');
      return;
    }

    var scene = _getActiveScene(game);
    if (!scene) {
      console.log('[RC-Cryptonoid] ⚠ Aktif sahne bulunamadı...');
      return;
    }

    /* Sahne değişmiş ya da hiç yamalanmamışsa yamala */
    if (_patchedScene !== scene) {
      _patchScene(scene);
    }
  }

  /* ─── Başlatma / Durdurma ───────────────────────────────────── */
  function _start() {
    if (_botActive) return;
    _botActive            = true;
    _lastBallY            = 0;
    _ballStationaryCount  = 0;
    _lastLaunch           = 0;
    _paddleOffset         = 0;
    _offsetPrepared       = false;

    try { document.body.setAttribute('data-rc-bot-cryptonoid-active', 'true'); } catch (e) {}
    console.log('[RC-Cryptonoid] ✅ Bot BAŞLADI');
    if (window.updateRCStatus)        window.updateRCStatus('[RC] 🧱 Cryptonoid Bot aktif');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();

    _monitorId = setInterval(_monitor, 500);
    _monitor(); // Hemen bir kez çalıştır

    /* RAF fallback — sahne yamalanmamış olsa bile çalışır */
    if (_rafId) cancelAnimationFrame(_rafId);
    _rafLoop();
  }

  function _stop() {
    if (!_botActive) return;
    _botActive = false;

    if (_monitorId) { clearInterval(_monitorId); _monitorId = null; }
    if (_rafId)     { cancelAnimationFrame(_rafId); _rafId = null; }

    /* Yamalı sahneyi geri al */
    if (_patchedScene && _originalUpdate) {
      try { _patchedScene.update = _originalUpdate; } catch (e) {}
    }
    _patchedScene  = null;
    _originalUpdate = null;

    try { document.body.setAttribute('data-rc-bot-cryptonoid-active', 'false'); } catch (e) {}
    console.log('[RC-Cryptonoid] ⏹ Bot DURDU');
    if (window.updateRCStatus)        window.updateRCStatus('[RC] 🧱 Cryptonoid Bot durdu');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();
  }

  /* ─── Tam Ekran Dinleyicisi ─────────────────────────────────── */
  document.addEventListener('fullscreenchange', function () {
    if (document.fullscreenElement && _isGame()) _start();
    else if (!document.fullscreenElement) _stop();
  });

  /* ─── Ana İzleme Döngüsü (500ms) ───────────────────────────── */
  setInterval(function () {
    var enabled = document.body.getAttribute('data-rc-bot-cryptonoid-enabled') !== 'false';
    var shouldRun = _isOnPlayPage() && _isGame() && !!_getCanvas() && enabled;
    if (shouldRun && !_botActive)  _start();
    if (!shouldRun && _botActive)  _stop();
  }, 500);

  window._rcCryptonoid = { start: _start, stop: _stop, isActive: function () { return _botActive; } };
})();
