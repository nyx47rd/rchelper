/* ══════════════════════════════════════════════════════════════════
   RC Helper — Cryptonoid Altın Standart Bot (Phaser 3 Engine)
   Teşhis Verilerine Göre Özel Olarak İnşa Edildi:
   - platform.y = 786.5, ball.y = 761.5, Canvas = 960x828
   - ballOnPlatform doğrudan çözülüp ballSpeed ile fırlatılır
   - 60 FPS Raycast ile duvar sekme noktası 0ms gecikmeyle yakalanır
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var _botActive           = false;
  var _monitorId           = null;
  var _patchedScene        = null;
  var _originalUpdate      = null;

  /* Fizik ve Takip Hafızası */
  var _lastBallX           = 0;
  var _lastBallY           = 0;
  var _lastBallVX          = 0;
  var _lastBallVY          = 0;
  var _lastLaunchTime      = 0;
  var _debugFrameCounter   = 0;
  var _activeKeys          = {};

  /* Oyun Alanı Sınırları (960x828 Teşhis Boyutları) */
  var GAME_WIDTH           = 960;
  var GAME_HEIGHT          = 828;
  var PADDLE_Y             = 786.5;
  var WALL_LEFT            = 20;
  var WALL_RIGHT           = 940;

  function _log() {
    if (window.console) {
      console.log.apply(console, ['[RC-Cryptonoid]'].concat([].slice.call(arguments)));
    }
  }

  function _isGame() {
    var cur = (document.body.getAttribute('data-rc-current-game') || '').toLowerCase();
    if (cur.indexOf('cryptonoid') !== -1 || cur.indexOf('crypto-noid') !== -1 || cur.indexOf('crypto_noid') !== -1) return true;
    var str = (document.title + ' ' + window.location.href).toLowerCase();
    return str.indexOf('cryptonoid') !== -1 || str.indexOf('crypto-noid') !== -1;
  }

  function _getCanvas() {
    return document.querySelector('#phaserGame canvas') || document.querySelector('canvas');
  }

  /* ── Phaser Game Instance Bulucu ── */
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

    if (window.Phaser && Array.isArray(window.Phaser.GAMES) && window.Phaser.GAMES.length > 0) {
      for (var gIdx = 0; gIdx < window.Phaser.GAMES.length; gIdx++) {
        var g = window.Phaser.GAMES[gIdx];
        if (g && g.scene) return g;
      }
    }
    if (window.game && window.game.scene) return window.game;
    return null;
  }

  /* ── Aktif 'Game' Sahnesini Bulma ── */
  function _getActiveScene(game) {
    if (!game || !game.scene || !game.scene.scenes) return null;
    var scenes = game.scene.scenes;

    for (var i = 0; i < scenes.length; i++) {
      var s = scenes[i];
      if (!s || !s.sys || !s.sys.settings) continue;
      if (s.sys.settings.active && (s.platform && s.ball)) return s;
    }
    for (var j = 0; j < scenes.length; j++) {
      var sc = scenes[j];
      if (sc && sc.sys && sc.sys.settings && sc.sys.settings.active && sc.sys.settings.key === 'Game') return sc;
    }
    return null;
  }

  /* ── Tuş ve Mouse Yönetimi ── */
  function _setKey(codeName, isDown) {
    if (_activeKeys[codeName] === isDown) return;
    _activeKeys[codeName] = isDown;

    var keyCodeMap = { ArrowLeft: 37, ArrowRight: 39, Space: 32 };
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

  function _dispatchPointerMove(x, y) {
    var canvas = _getCanvas();
    if (!canvas) return;
    var rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    var scaleX = rect.width / (canvas.width || GAME_WIDTH);
    var scaleY = rect.height / (canvas.height || GAME_HEIGHT);
    var clientX = rect.left + x * scaleX;
    var clientY = rect.top + y * scaleY;

    var opts = { bubbles: true, cancelable: true, view: window, clientX: clientX, clientY: clientY, screenX: clientX, screenY: clientY, button: 0, buttons: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true };

    try { canvas.dispatchEvent(new PointerEvent('pointermove', opts)); } catch (e) {}
    try { canvas.dispatchEvent(new MouseEvent('mousemove', opts)); } catch (e) {}
  }

  /* ── Kesin Fırlatma Mekanizması ── */
  function _forceLaunchBall(scene) {
    var now = Date.now();
    if (now - _lastLaunchTime < 300) return;
    _lastLaunchTime = now;
    _log('🚀 Top fırlatılıyor...');

    // 1. Sahne Durumunu Doğrudan Değiştir
    scene.ballOnPlatform = false;

    // 2. Topa Doğrudan Hız Ver (Eğer hızı sıfırsa)
    if (scene.ball && scene.ball.body) {
      var vx = scene.ball.body.velocity.x;
      var vy = scene.ball.body.velocity.y;
      if (Math.abs(vx) < 5 && Math.abs(vy) < 5) {
        var speed = scene.ballSpeed || 450;
        var initAngle = (Math.random() * 0.6) - 0.3; // Hafif açılı fırlat
        scene.ball.body.setVelocity(speed * initAngle, -speed);
      }
    }

    // 3. Phaser Input ve Pointer Eventleri Tetikle
    if (scene.input) {
      var ptr = scene.input.activePointer || { x: scene.platform ? scene.platform.x : 480, y: PADDLE_Y };
      try { scene.input.emit('pointerdown', ptr); } catch (e) {}
      try { scene.input.emit('pointerup', ptr); } catch (e) {}
    }

    // 4. DOM Tıklama ve Space
    _setKey('Space', true);
    setTimeout(function () { _setKey('Space', false); }, 50);

    var canvas = _getCanvas();
    if (canvas) {
      try {
        canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, buttons: 1 }));
        canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, buttons: 0 }));
        canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      } catch (e) {}
    }
  }

  /* ── Raycasting: Duvar Sekmeli İniş X Koordinatı Hesaplama ── */
  function _predictLandingX(ballX, ballY, vx, vy, targetY) {
    if (vy <= 0.05) return ballX;
    var dy = targetY - ballY;
    if (dy <= 0) return ballX;

    var playWidth = WALL_RIGHT - WALL_LEFT;
    if (playWidth <= 0) return ballX;

    var timeToTarget = dy / vy;
    var totalDx = vx * timeToTarget;
    var rawX = (ballX + totalDx) - WALL_LEFT;

    var period = 2 * playWidth;
    var rel = ((rawX % period) + period) % period;
    if (rel > playWidth) rel = period - rel;

    return WALL_LEFT + rel;
  }

  /* ── Kalan Tuğlaların Ağırlık Merkezini Bulma ── */
  function _getTargetBrickBias(scene) {
    var bricks = [];
    if (scene.Blocks) {
      if (typeof scene.Blocks.getChildren === 'function') bricks = scene.Blocks.getChildren();
      else if (scene.Blocks.children && scene.Blocks.children.entries) bricks = scene.Blocks.children.entries;
      else if (Array.isArray(scene.Blocks)) bricks = scene.Blocks;
    }
    if (!bricks.length && scene.children && scene.children.list) {
      bricks = scene.children.list.filter(function (c) {
        if (!c || !c.texture) return false;
        var k = String(c.texture.key).toLowerCase();
        return k.indexOf('brick') !== -1 || k.indexOf('tile') !== -1 || k.indexOf('block') !== -1 || c.type === 'Container';
      });
    }

    var activeBricks = bricks.filter(function (b) { return b.active !== false && b.visible !== false && b.y < PADDLE_Y - 100; });
    if (!activeBricks.length) return 0;

    var sumX = 0;
    for (var i = 0; i < activeBricks.length; i++) {
      sumX += activeBricks[i].x;
    }
    var avgX = sumX / activeBricks.length;
    var centerDist = avgX - (GAME_WIDTH / 2);

    var bias = (centerDist / (GAME_WIDTH / 2)) * 26;
    return Math.max(-30, Math.min(30, bias));
  }

  /* ── 60 FPS Sahne Çerçeve Motoru ── */
  function _tickFrame(scene, time, delta) {
    if (!_botActive || !scene) return;
    _debugFrameCounter++;

    var paddle = scene.platform;
    var ball   = scene.ball;

    if (!paddle || !ball) return;

    if (paddle.y) PADDLE_Y = paddle.y;
    if (scene.scale && scene.scale.width)  GAME_WIDTH  = scene.scale.width;
    if (scene.scale && scene.scale.height) GAME_HEIGHT = scene.scale.height;
    WALL_RIGHT = GAME_WIDTH - 20;

    // 1. Top fırlatma kontrolü
    if (scene.ballOnPlatform === true || (Math.abs(ball.y - paddle.y) < 45 && Math.abs(ball.x - paddle.x) < 30)) {
      _forceLaunchBall(scene);
      return;
    }

    // Top hız hesaplaması
    var dpx = ball.x - _lastBallX;
    var dpy = ball.y - _lastBallY;
    _lastBallX = ball.x;
    _lastBallY = ball.y;

    var vx = 0, vy = 0;
    if (ball.body && ball.body.velocity) {
      vx = ball.body.velocity.x || 0;
      vy = ball.body.velocity.y || 0;
    }
    if ((Math.abs(vx) < 0.5 || Math.abs(vy) < 0.5) && delta && delta > 0) {
      var s = delta / 1000;
      if (Math.abs(vx) < 0.5) vx = dpx / s;
      if (Math.abs(vy) < 0.5) vy = dpy / s;
    }
    _lastBallVX = vx;
    _lastBallVY = vy;

    // 2. Hedef X Hesaplama (Raycasting)
    var targetLandingX = _predictLandingX(ball.x, ball.y, vx, vy, PADDLE_Y - 15);
    var desiredPaddleX = targetLandingX;

    if (vy > 10) {
      var brickBias = _getTargetBrickBias(scene);
      desiredPaddleX -= brickBias;
    } else {
      desiredPaddleX = (targetLandingX + (GAME_WIDTH / 2)) / 2;
    }

    var halfPaddle = (paddle.displayWidth || paddle.width || 120) / 2;
    desiredPaddleX = Math.max(WALL_LEFT + halfPaddle, Math.min(WALL_RIGHT - halfPaddle, desiredPaddleX));

    // Periyodik Canlı Log
    if (_debugFrameCounter % 60 === 0) {
      _log('🎾 Canlı Takip:', {
        top: '(' + Math.round(ball.x) + ',' + Math.round(ball.y) + ')',
        hız: '(' + Math.round(vx) + ',' + Math.round(vy) + ')',
        palet: Math.round(paddle.x),
        hedefX: Math.round(desiredPaddleX)
      });
    }

    // 3. Paleti Hedefe Taşıma (Tüm Kanallarla Senkronize)
    var diff = desiredPaddleX - paddle.x;

    // Kanal 1: Doğrudan Sprite Koordinatı
    paddle.x = desiredPaddleX;
    if (paddle.body) {
      paddle.body.x = desiredPaddleX - (paddle.body.halfWidth || halfPaddle);
      if (typeof paddle.body.setVelocityX === 'function') {
        paddle.body.setVelocityX(0);
      }
    }

    // Kanal 2: Phaser Input Pointer
    if (scene.input) {
      try {
        scene.input.x = desiredPaddleX;
        scene.input.y = PADDLE_Y;
        if (scene.input.activePointer) {
          scene.input.activePointer.x = desiredPaddleX;
          scene.input.activePointer.worldX = desiredPaddleX;
          scene.input.activePointer.y = PADDLE_Y;
        }
      } catch (e) {}
    }

    // Kanal 3: DOM Mouse / PointerMove
    _dispatchPointerMove(desiredPaddleX, PADDLE_Y);

    // Kanal 4: Klavye Tuşları
    if (diff > 4) {
      _setKey('ArrowLeft', false);
      _setKey('ArrowRight', true);
    } else if (diff < -4) {
      _setKey('ArrowRight', false);
      _setKey('ArrowLeft', true);
    } else {
      _setKey('ArrowLeft', false);
      _setKey('ArrowRight', false);
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

    _log('✅ Game sahnesi 60 FPS update motoru yamalandı.');
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
    _lastBallX = 0;
    _lastBallY = 0;
    _lastBallVX = 0;
    _lastBallVY = 0;
    _lastLaunchTime = 0;
    _debugFrameCounter = 0;
    _activeKeys = {};

    try { document.body.setAttribute('data-rc-bot-cryptonoid-active', 'true'); } catch (e) {}
    _log('🚀 Cryptonoid Altın Standart Bot BAŞLADI');
    if (window.updateRCStatus) window.updateRCStatus('[RC] 🧱 Cryptonoid Bot aktif');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();

    _monitorId = setInterval(_monitor, 300);
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

    try { document.body.removeAttribute('data-rc-bot-cryptonoid-active'); } catch (e) {}
    _log('🛑 Cryptonoid Bot DURDURULDU');
    if (window.updateRCStatus) window.updateRCStatus('[RC] 🧱 Cryptonoid Bot durdu');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();
  }

  /* Otomatik Başlatma Döngüsü */
  setInterval(function () {
    var enabled = !(window._rcBotEnabled && window._rcBotEnabled['botCryptonoidEnabled'] === false);
    var active  = _isGame() && !!_getCanvas() && enabled;
    if (active && !_botActive) _start();
    if (!active && _botActive) _stop();
  }, 400);

  window._rcCryptonoid = {
    start: _start,
    stop: _stop,
    isActive: function () { return _botActive; }
  };
})();
