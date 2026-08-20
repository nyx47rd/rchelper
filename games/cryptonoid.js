/* ══════════════════════════════════════════════════════════════════
   RC Helper — Cryptonoid Altın Standart Bot (Phaser 3 Engine)
   - Canlı ve ayrıntılı debug logları (Console'da her adımı gösterir)
   - Çok kanallı kontrol: Pointer + Fizik + DOM Mouse/Keyboard + Phaser Cursors
   - Duvar yansıma ve tuğla hedefleme matematiği
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
  var _stationaryFrames    = 0;
  var _lastLaunchTime      = 0;
  var _consecutiveBounces  = 0;
  var _lastVYSign          = 1;
  var _activeKeys          = {};
  var _debugFrameCounter   = 0;

  /* Dinamik Oyun Alanı Sınırları */
  var GAME_WIDTH           = 960;
  var GAME_HEIGHT          = 900;
  var PADDLE_Y             = 820;
  var WALL_LEFT            = 15;
  var WALL_RIGHT           = 945;

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

  /* ── Aktif Sahneyi Bulma ── */
  function _getActiveScene(game) {
    if (!game || !game.scene || !game.scene.scenes) return null;
    var scenes = game.scene.scenes;

    for (var i = 0; i < scenes.length; i++) {
      var s = scenes[i];
      if (!s || !s.sys || !s.sys.settings) continue;
      if (s.sys.settings.active && s.sys.settings.key === 'Game') return s;
    }
    for (var j = 0; j < scenes.length; j++) {
      var sc = scenes[j];
      if (sc && sc.sys && sc.sys.settings && sc.sys.settings.active) return sc;
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
    try { window.dispatchEvent(new MouseEvent('mousemove', opts)); } catch (e) {}
  }

  function _launchBall() {
    var now = Date.now();
    if (now - _lastLaunchTime < 500) return;
    _lastLaunchTime = now;
    _log('🚀 Top fırlatılıyor (Space + Click)...');

    _setKey('Space', true);
    setTimeout(function () { _setKey('Space', false); }, 80);

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

  /* ── Kalan Tuğlaların Ağırlık Merkezini Bulma (Stratejik Açı) ── */
  function _getTargetBrickBias(scene) {
    var bricks = [];
    if (scene.bricksGroup) {
      if (typeof scene.bricksGroup.getChildren === 'function') bricks = scene.bricksGroup.getChildren();
      else if (scene.bricksGroup.children && scene.bricksGroup.children.entries) bricks = scene.bricksGroup.children.entries;
    }
    if (!bricks.length && scene.children && scene.children.list) {
      bricks = scene.children.list.filter(function (c) {
        if (!c || !c.texture) return false;
        var k = String(c.texture.key).toLowerCase();
        return k.indexOf('brick') !== -1 || k.indexOf('tile') !== -1 || k.indexOf('block') !== -1;
      });
    }

    var activeBricks = bricks.filter(function (b) { return b.active && b.visible; });
    if (!activeBricks.length) return 0;

    var sumX = 0;
    for (var i = 0; i < activeBricks.length; i++) {
      sumX += activeBricks[i].x;
    }
    var avgX = sumX / activeBricks.length;
    var centerDist = avgX - (GAME_WIDTH / 2);

    var bias = (centerDist / (GAME_WIDTH / 2)) * 24;
    return Math.max(-28, Math.min(28, bias));
  }

  /* ── Top ve Palet Nesnesi Bulucu ── */
  function _findEntities(scene) {
    var paddle = scene.platform || scene.paddle || scene.player || null;
    var ball   = scene.ball || null;

    if (scene.ballsGroup) {
      var bList = typeof scene.ballsGroup.getChildren === 'function' ? scene.ballsGroup.getChildren() : (scene.ballsGroup.children && scene.ballsGroup.children.entries);
      if (bList && bList.length > 0) {
        ball = bList.find(function (b) { return b.active && b.visible; }) || bList[0];
      }
    }

    if ((!paddle || !ball) && scene.children && scene.children.list) {
      var list = scene.children.list;
      for (var i = 0; i < list.length; i++) {
        var obj = list[i];
        if (!obj || !obj.texture) continue;
        var k = String(obj.texture.key).toLowerCase();
        if (!paddle && (k.indexOf('platform') !== -1 || k.indexOf('paddle') !== -1 || k.indexOf('player') !== -1)) {
          paddle = obj;
        }
        if (!ball && (k.indexOf('ball') !== -1 || k.indexOf('orb') !== -1)) {
          ball = obj;
        }
      }
    }
    return { paddle: paddle, ball: ball };
  }

  /* ── 60 FPS Sahne Çerçeve Motoru ── */
  function _tickFrame(scene, time, delta) {
    if (!_botActive || !scene) return;
    _debugFrameCounter++;

    var entities = _findEntities(scene);
    var paddle = entities.paddle;
    var ball   = entities.ball;

    // Periyodik Debug Bilgisi (Her 60 karede ~1 saniye)
    if (_debugFrameCounter % 60 === 0) {
      if (!paddle || !ball) {
        _log('⚠️ Nesne Arama Uyarısı:', {
          paddle: paddle ? 'BULUNDU (' + Math.round(paddle.x) + ',' + Math.round(paddle.y) + ')' : 'YOK!',
          ball: ball ? 'BULUNDU (' + Math.round(ball.x) + ',' + Math.round(ball.y) + ')' : 'YOK!',
          childCount: scene.children ? scene.children.list.length : 0
        });
      } else {
        _log('🎾 Canlı Durum:', {
          top: '(' + Math.round(ball.x) + ', ' + Math.round(ball.y) + ')',
          hız: '(' + Math.round(_lastBallVX) + ', ' + Math.round(_lastBallVY) + ')',
          palet: Math.round(paddle.x)
        });
      }
    }

    if (!paddle) return;

    // Alan boyutlarını dinamik güncelle
    if (paddle.y) PADDLE_Y = paddle.y;
    if (scene.scale && scene.scale.width)  GAME_WIDTH  = scene.scale.width;
    if (scene.scale && scene.scale.height) GAME_HEIGHT = scene.scale.height;
    WALL_RIGHT = GAME_WIDTH - 15;

    // Top yoksa veya hazır değilse paleti ortala
    if (!ball || !ball.active) {
      _launchBall();
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

    // 1. Top fırlatma kontrolü
    var speedSq = vx * vx + vy * vy;
    if (speedSq < 4 || Math.abs(ball.y - paddle.y) < 55) {
      _stationaryFrames++;
      if (_stationaryFrames > 15) {
        _launchBall();
      }
    } else {
      _stationaryFrames = 0;
    }

    // 2. Hedef X Hesaplama (Raycasting)
    var targetLandingX = _predictLandingX(ball.x, ball.y, vx, vy, PADDLE_Y - 15);
    var desiredPaddleX = targetLandingX;

    if (vy > 10) {
      var brickBias = _getTargetBrickBias(scene);
      desiredPaddleX -= brickBias;
    } else {
      desiredPaddleX = (targetLandingX + (GAME_WIDTH / 2)) / 2;
    }

    var halfPaddle = (paddle.displayWidth || paddle.width || 100) / 2;
    desiredPaddleX = Math.max(WALL_LEFT + halfPaddle, Math.min(WALL_RIGHT - halfPaddle, desiredPaddleX));

    // 3. Çok Kanallı Palet Yönlendirme (Pointer + Klavye + Fizik Body + Cursors)
    var diff = desiredPaddleX - paddle.x;

    // Kanal 1: DOM Klavye
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

    // Kanal 2: Phaser Cursors
    if (scene.cursors) {
      try {
        if (scene.cursors.left)  scene.cursors.left.isDown  = diff < -4;
        if (scene.cursors.right) scene.cursors.right.isDown = diff > 4;
      } catch (e) {}
    }

    // Kanal 3: Phaser Input Pointer
    if (scene.input) {
      try {
        if (scene.input.activePointer) {
          scene.input.activePointer.x = desiredPaddleX;
          scene.input.activePointer.worldX = desiredPaddleX;
          scene.input.activePointer.y = PADDLE_Y;
        }
        if (scene.input.mousePointer) {
          scene.input.mousePointer.x = desiredPaddleX;
          scene.input.mousePointer.worldX = desiredPaddleX;
        }
      } catch (e) {}
    }

    // Kanal 4: DOM Mouse / PointerMove Event
    _dispatchPointerMove(desiredPaddleX, PADDLE_Y);

    // Kanal 5: Doğrudan Sprite & Body Koordinatı
    if (Math.abs(diff) > 2) {
      var maxStep = (1500 * (delta || 16.6)) / 1000;
      var step = Math.max(-maxStep, Math.min(maxStep, diff * 0.8));
      paddle.x += step;
      if (paddle.body) {
        paddle.body.x = paddle.x - (paddle.body.halfWidth || halfPaddle);
        if (typeof paddle.body.setVelocityX === 'function') {
          paddle.body.setVelocityX(diff * 10);
        }
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

    _log('✅ Sahne 60 FPS update motoru yamalandı.');
    _log('📦 Sahne custom keys:', Object.keys(scene).filter(function (k) {
      return !['sys','anims','cache','plugins','registry','scale','sound','textures','events','cameras','make','add','scene','children','time','data','input','load','tweens','lights','physics'].includes(k);
    }));
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
    _stationaryFrames = 0;
    _consecutiveBounces = 0;
    _debugFrameCounter = 0;
    _activeKeys = {};

    try { document.body.setAttribute('data-rc-bot-cryptonoid-active', 'true'); } catch (e) {}
    _log('🚀 Cryptonoid Altın Standart Bot BAŞLADI (Canlı Debug Modu Aktif)');
    if (window.updateRCStatus) window.updateRCStatus('[RC] 🧱 Cryptonoid Bot aktif');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();

    _monitorId = setInterval(_monitor, 500);
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
  }, 500);

  window._rcCryptonoid = {
    start: _start,
    stop: _stop,
    isActive: function () { return _botActive; }
  };
})();
