(function () {
  'use strict';

  var _botActive           = false;
  var _lastLaunch          = 0;
  var _lastBallX           = 0;
  var _lastBallY           = 0;
  var _lastBallVX          = 0;
  var _lastBallVY          = 0;
  var _ballStationaryCount = 0;
  var _monitorId           = null;
  var _patchedScene        = null;
  var _originalUpdate      = null;

  // Sıkışma (Stalemate) tespiti için yeni değişkenler
  var _stuckBounceCount    = 0;
  var _lastBallVYSign      = 1;

  // Dinamik olarak güncellenecek oyun sınırları
  var GAME_WIDTH       = 960;
  var GAME_HEIGHT      = 900;
  var PADDLE_Y         = 820;
  var WALL_LEFT        = 10;
  var WALL_RIGHT       = 950;
  var CEILING          = 40;
  var MAX_PADDLE_SPEED = 1400; // px/s

  function _isGame() {
    var attr = (document.body.getAttribute('data-rc-current-game') || '').toLowerCase();
    if (attr.indexOf('cryptonoid') !== -1) return true;
    return (document.title + window.location.href).toLowerCase().indexOf('cryptonoid') !== -1;
  }

  function _isOnPlayPage() {
    return window.location.href.indexOf('/play_game') !== -1;
  }

  function _getCanvas() {
    return document.querySelector('#phaserGame canvas') || document.querySelector('canvas');
  }

  function _findGame() {
    var canvas = _getCanvas();
    if (!canvas) return null;

    var searchTargets = [canvas];
    var ph = document.getElementById('phaserGame');
    if (ph) searchTargets.push(ph);

    for (var i = 0; i < searchTargets.length; i++) {
      var el = searchTargets[i];
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
    if (!game || !game.scene) return null;

    try {
      if (typeof game.scene.getScenes === 'function') {
        var all = game.scene.getScenes(true);
        if (all && all.length > 0) {
          for (var i = 0; i < all.length; i++) {
            var s = all[i];
            if (s && s.platform && s.ball) {
              var key = s.sys && s.sys.settings && s.sys.settings.key;
              if (key === 'Game') return s;
            }
          }
          for (var i2 = 0; i2 < all.length; i2++) {
            if (all[i2] && all[i2].platform && all[i2].ball) return all[i2];
          }
          return all[0];
        }
      }
    } catch (e) {}

    if (game.scene.scenes) {
      for (var k = 0; k < game.scene.scenes.length; k++) {
        var sc = game.scene.scenes[k];
        if (sc && sc.sys && sc.sys.settings && sc.sys.settings.active && sc.platform && sc.ball) {
          return sc;
        }
      }
    }
    return null;
  }

  function _setKeyState(key, pressed) {
    var codes = { ArrowLeft: 37, ArrowRight: 39, Space: 32 };
    var kc = codes[key] || 0;
    var opts = {
      key: key === 'Space' ? ' ' : key,
      code: key,
      keyCode: kc,
      which: kc,
      bubbles: true,
      cancelable: true
    };
    var type = pressed ? 'keydown' : 'keyup';
    var cv = _getCanvas();
    var targets = [window, document];
    if (cv) targets.push(cv);
    if (document.body) targets.push(document.body);
    for (var i = 0; i < targets.length; i++) {
      try { targets[i].dispatchEvent(new KeyboardEvent(type, opts)); } catch (e) {}
    }
  }

  function _pressSpace() {
    _setKeyState('Space', true);
    setTimeout(function () { _setKeyState('Space', false); }, 60);
  }

  function _clickAt(canvas, x, y) {
    var r = canvas.getBoundingClientRect();
    var sx = r.width  / (canvas.width  || GAME_WIDTH);
    var sy = r.height / (canvas.height || GAME_HEIGHT);
    var cx = r.left + x * sx;
    var cy = r.top  + y * sy;
    var opts = { bubbles: true, cancelable: true, clientX: cx, clientY: cy };
    var types = ['mousedown', 'mouseup', 'click', 'pointerdown', 'pointerup'];
    for (var i = 0; i < types.length; i++) {
      try { canvas.dispatchEvent(new MouseEvent(types[i], opts)); } catch (e) {}
    }
  }

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
  }

  function _getGroupChildren(group) {
    if (!group) return [];
    try {
      if (typeof group.getChildren === 'function') return group.getChildren();
      if (group.children && group.children.entries) return group.children.entries;
    } catch (e) {}
    return [];
  }

  function _predictBallXAtY(ball, targetY, vx, vy) {
    if (vy <= 0.01) return ball.x;
    var playWidth = WALL_RIGHT - WALL_LEFT;
    if (playWidth <= 0) return ball.x;
    var dy = targetY - ball.y;
    if (dy <= 0) return ball.x;

    var t  = dy / vy;
    var dx = vx * t;
    var rel = (ball.x + dx) - WALL_LEFT;

    var period = 2 * playWidth;
    rel = ((rel % period) + period) % period;
    if (rel > playWidth) rel = period - rel;

    return WALL_LEFT + rel;
  }

  function _tickFrame(scene, time, delta) {
    var sceneKey = scene && scene.sys && scene.sys.settings && scene.sys.settings.key;
    if (sceneKey !== 'Game') return;

    var paddle = scene.platform;
    var ball   = scene.ball;
    if (!paddle || !ball || !ball.active || !ball.visible) return;

    if (paddle.y) PADDLE_Y = paddle.y;
    if (scene.scale && scene.scale.width)  GAME_WIDTH  = scene.scale.width;
    if (scene.scale && scene.scale.height) GAME_HEIGHT = scene.scale.height;
    WALL_RIGHT = GAME_WIDTH - 10;

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
      var secs = delta / 1000;
      var fvx = dpx / secs;
      var fvy = dpy / secs;
      if (Math.abs(vx) < 0.5) vx = fvx;
      if (Math.abs(vy) < 0.5) vy = fvy;
    }
    _lastBallVX = vx;
    _lastBallVY = vy;

    var moving = (Math.abs(dpx) > 0.05 || Math.abs(dpy) > 0.05 ||
    Math.abs(vx) > 0.5 || Math.abs(vy) > 0.5);
    if (moving) _ballStationaryCount = 0;
    else _ballStationaryCount++;

    var isStationary = _ballStationaryCount > 12;
    if (isStationary && ball.y > PADDLE_Y - 60 && vy >= 0) {
      var now = Date.now();
      if (now - _lastLaunch > 1500) {
        _lastLaunch = now;
        _pressSpace();
        var canvas = _getCanvas();
        if (canvas) _clickAt(canvas, ball.x, ball.y);
        try {
          if (typeof scene.launchBall === 'function') scene.launchBall();
        } catch (e) {}
      }
    }

    // Sıkışma Tespiti (Stalemate Detection)
    var currentVYSign = vy > 0 ? 1 : -1;
    if (currentVYSign !== _lastBallVYSign) {
      _lastBallVYSign = currentVYSign;
      // Top paddle'dan sekip yukarı gidiyorsa ve yatay hızı çok azsa sıkışıyor olabilir
      if (currentVYSign < 0 && ball.y > PADDLE_Y - 50 && Math.abs(vx) < 150) {
        _stuckBounceCount++;
      } else if (currentVYSign < 0 && ball.y < PADDLE_Y - 100) {
        // Yukarıda bir yere çarpıp geldiyse temizdir, sayacı sıfırla
        _stuckBounceCount = 0;
      }
    }

    // Tuğla hedefleme
    var brickCenterX = GAME_WIDTH / 2;
    var bricks = _getGroupChildren(scene.Blocks);
    var brickCount = 0;
    if (bricks.length > 0) {
      var sum = 0;
      for (var i = 0; i < bricks.length; i++) {
        var bk = bricks[i];
        if (bk && bk.active && bk.visible) {
          sum += bk.x;
          brickCount++;
        }
      }
      if (brickCount > 0) brickCenterX = sum / brickCount;
    }

    var targetBrickX = brickCenterX;

    // GEÇ OYUN (LATE-GAME): Tuğla azaldığında merkeze değil, en yakın tuğlaya nişan al
    if (brickCount > 0 && brickCount <= 4) {
      var minDist = Infinity;
      var bestBrick = null;
      for (var bi = 0; bi < bricks.length; bi++) {
        var tb = bricks[bi];
        if (tb && tb.active && tb.visible) {
          var dist = Math.abs(tb.x - ball.x);
          if (dist < minDist) {
            minDist = dist;
            bestBrick = tb;
          }
        }
      }
      if (bestBrick) targetBrickX = bestBrick.x;
    }

    var halfW = (paddle.width / 2) || 40;
    var targetX;

    if (vy > 0.5) {
      var predictedX = _predictBallXAtY(ball, PADDLE_Y, vx, vy);
      var aimDir = targetBrickX - predictedX;
      var maxShift = halfW * 0.85;
      var shift;

      // SIKIŞMA KIRICI: 2 kez üst üste boşa sektiyse radical açı ver
      if (_stuckBounceCount >= 2) {
        // Hedefe gitmek için maksimum kenar vuruşu yap
        shift = aimDir < 0 ? maxShift : -maxShift;

        // Eğer hedef zaten çok yakınsa ama yine de sıkışıldıysa, rastgele kenara çarp
        if (Math.abs(aimDir) < 50) {
          shift = (Math.floor(Date.now() / 1000) % 2 === 0) ? maxShift : -maxShift;
        }
      } else {
        // Normal Açılandırma: tanh sayesinde uzak hedeflere çok daha sert açı verilir
        shift = Math.tanh(aimDir / 80) * -maxShift;
      }

      targetX = predictedX - shift; // Shift + ise paddle sağa kayar, top sola gider
    } else {
      targetX = ball.x;

      if (scene.BonusGroup) {
        var bonuses = _getGroupChildren(scene.BonusGroup);
        var candidates = [];
        for (var bi2 = 0; bi2 < bonuses.length; bi2++) {
          var b = bonuses[bi2];
          if (b && b.active && b.visible && b.y < PADDLE_Y && b.y > CEILING) {
            candidates.push(b);
          }
        }
        if (candidates.length > 0) {
          candidates.sort(function (a, b2) { return b2.y - a.y; });
          var bonus = candidates[0];
          var timeToReturn = vy < -0.5
          ? (PADDLE_Y - ball.y) / Math.abs(vy)
          : 999;
          var distToBonus = Math.abs(bonus.x - paddle.x);
          var timeToBonus = distToBonus / MAX_PADDLE_SPEED;
          if (timeToBonus < timeToReturn - 0.25) {
            targetX = bonus.x;
          }
        }
      }
    }

    var finalX = Math.max(WALL_LEFT + halfW, Math.min(WALL_RIGHT - halfW, targetX));

    var maxStep = MAX_PADDLE_SPEED * (delta && delta > 0 ? delta / 1000 : 0.016);
    var diff = finalX - paddle.x;
    if (Math.abs(diff) > maxStep) {
      finalX = paddle.x + Math.sign(diff) * maxStep;
    }

    paddle.x = finalX;
    if (paddle.body) {
      paddle.body.x = finalX - halfW;
      if (typeof paddle.body.updateCenter === 'function') paddle.body.updateCenter();
    }
    if (scene.input) {
      try { if (scene.input.activePointer) scene.input.activePointer.x = finalX; } catch (e) {}
      try { if (scene.input.mousePointer)  scene.input.mousePointer.x  = finalX; } catch (e) {}
    }
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
    _lastBallY = 0;
    _lastBallX = 0;
    _lastBallVX = 0;
    _lastBallVY = 0;
    _ballStationaryCount = 0;
    _lastLaunch = 0;
    _stuckBounceCount = 0; // Sıkışma sayacını sıfırla
    _lastBallVYSign = 1;

    try {
      var game0 = _findGame();
      var scene0 = game0 && _getActiveScene(game0);
      if (scene0 && scene0.ball) {
        _lastBallX = scene0.ball.x;
        _lastBallY = scene0.ball.y;
      }
    } catch (e) {}

    try { document.body.setAttribute('data-rc-bot-cryptonoid-active', 'true'); } catch (e) {}
    if (window.updateRCStatus)         window.updateRCStatus('[RC] 🧱 Cryptonoid Bot aktif');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();

    _monitorId = setInterval(_monitor, 500);
    _monitor();
  }

  function _stop() {
    if (!_botActive) return;
    _botActive = false;
    if (_monitorId) { clearInterval(_monitorId); _monitorId = null; }
    _unpatchScene();
    try { document.body.setAttribute('data-rc-bot-cryptonoid-active', 'false'); } catch (e) {}
    if (window.updateRCStatus)         window.updateRCStatus('[RC] 🧱 Cryptonoid Bot durdu');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();
  }


  setInterval(function () {
      var enabled = document.body.getAttribute('data-rc-bot-cryptonoid-enabled') !== 'false';
      var shouldRun = _isOnPlayPage() && _isGame() && !!_getCanvas() && enabled;
      if (shouldRun && !_botActive) _start();
      if (!shouldRun && _botActive) _stop();
    }, 500);

      window._rcCryptonoid = { start: _start, stop: _stop, isActive: function () { return _botActive; } };
})();
