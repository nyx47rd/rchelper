/* ══════════════════════════════════════════════════════════════════
   RC Helper — Token Blaster Gelişmiş Hafıza Botu v2
   Yalnızca /game/play_game sayfasına inject edilir (manifest.json)
   Tetikleyici: Oyun ekranı algılanınca otomatik başlar
   ══════════════════════════════════════════════════════════════════ */
(function () {
  var _botActive   = false;
  var _loopId      = null;
  var _lastSpace   = 0;
  var _spaceInterval = 90;  /* Ateş etme aralığı (ms) */
  var _activeKeys  = {};    /* Basılı tutulan tuşlar */

  function _isGame() {
    var sources = [
      (window._activeGame && window._activeGame.name) || '',
      window.currentPlayingGame || '',
      window.lastSelectedGame || '',
      document.title || '',
      window.location.href || ''
    ];
    return sources.some(function(s) {
      var n = s.toLowerCase();
      return n.includes('token blaster') || n.includes('tokenblaster');
    });
  }

  function _isOnPlayPage() {
    return window.location.href.includes('/play_game');
  }

  function _getCanvas() {
    return document.querySelector('#phaserGame canvas') ||
           document.querySelector('canvas');
  }

  /* Klavyeden tuş basma/bırakma simülasyonu */
  function _setKeyState(key, isPressed) {
    if (_activeKeys[key] === isPressed) return;
    _activeKeys[key] = isPressed;

    var type = isPressed ? 'keydown' : 'keyup';
    var codes = { ArrowLeft: 37, ArrowRight: 39, ArrowUp: 38, ArrowDown: 40, Space: 32 };
    var keyCode = codes[key] || 0;
    
    var opts = { 
      key: key === 'Space' ? ' ' : key, 
      code: key, 
      keyCode: keyCode, 
      which: keyCode, 
      bubbles: true, 
      cancelable: true 
    };

    var canvas = _getCanvas();
    var targets = [window, document, canvas, document.body];
    targets.forEach(function(t) {
      if (t) t.dispatchEvent(new KeyboardEvent(type, opts));
    });
  }

  function _pressSpace() {
    _setKeyState('Space', true);
    setTimeout(function() {
      _setKeyState('Space', false);
    }, 30);
  }

  function _scan() {
    if (!_botActive) return;
    var canvas = _getCanvas();
    if (!canvas) return;

    // React Fiber ağacından Phaser game nesnesine derin erişim sağla
    var reactKey = Object.keys(canvas).find(function(k) {
      return k.indexOf('__reactFiber$') === 0;
    });
    if (!reactKey) {
      var parent = document.getElementById('phaserGame');
      if (parent) {
        reactKey = Object.keys(parent).find(function(k) {
          return k.indexOf('__reactFiber$') === 0;
        });
      }
    }
    if (!reactKey) return;

    var node = canvas[reactKey] || (document.getElementById('phaserGame') && document.getElementById('phaserGame')[reactKey]);
    var game = null;
    while (node) {
      if (node.stateNode && node.stateNode.game) {
        game = node.stateNode.game;
        break;
      }
      node = node.return;
    }
    if (!game) return;

    var activeScenes = game.scene.scenes.filter(function(s) {
      return s.sys && s.sys.settings && s.sys.settings.active;
    });
    if (activeScenes.length === 0) return;
    
    var scene = activeScenes[0];
    var ship = scene.spaceship;
    if (!ship) return;

    var children = scene.children.list;

    // 1. Düşman Mermilerini ve Dalış Yapan Canavarları Tehdit Olarak Filtrele
    var threats = children.filter(function(c) {
      if (c === ship || !c.texture || !c.texture.key || c.active === false || c.visible === false) return false;
      
      var key = c.texture.key.toLowerCase();
      
      // Kendi mermilerimiz ve arka plan yıldızlarını yoksay
      var isPlayerBullet = key.indexOf('bullet') >= 0 && key.indexOf('alien') < 0;
      var isBackground = key.indexOf('star') >= 0 || key.indexOf('bg') >= 0 || key.indexOf('background') >= 0 || key.indexOf('particle') >= 0;
      if (isPlayerBullet || isBackground) return false;

      var isEnemyBullet = key === 'alienbullet';
      var isApproachingEnemy = c.y > ship.y - 280 && c.y < ship.y + 30;

      return isEnemyBullet || isApproachingEnemy;
    });

    // 2. Hedef Canavarları Bul (Çok yakındaki canavarlardan kaçış önceliklidir, uzaktakileri hedefler)
    var targetEnemies = children.filter(function(c) {
      if (c === ship || !c.texture || !c.texture.key || c.active === false || c.visible === false) return false;
      var key = c.texture.key.toLowerCase();
      if (key.indexOf('bullet') >= 0) return false;
      return c.y < ship.y - 120 && c.y > 50;
    });

    var enemyTargetX = 480;
    if (targetEnemies.length > 0) {
      targetEnemies.sort(function(a, b) { return b.y - a.y; });
      enemyTargetX = targetEnemies[0].x;
    }

    // 3. Şerit Analizi ve Yapay Zeka Kararı
    var candidates = [];
    for (var i = -5; i <= 5; i++) {
      candidates.push(ship.x + (i * 20));
    }

    var bestX = ship.x;
    var minDanger = Infinity;
    var closestToTargetDist = Infinity;

    candidates.forEach(function(cx) {
      if (cx < 65 || cx > 895) return;

      var danger = 0;

      threats.forEach(function(t) {
        var dx = Math.abs(t.x - cx);
        var dy = ship.y - t.y;
        var isBullet = t.texture.key.toLowerCase() === 'alienbullet';

        // Genişlik ve tolerans ayarları: Canavarlar için daha yüksek yan mesafe (100px) ve kritik alan (55px)
        var maxDx = isBullet ? 75 : 100;
        var critDx = isBullet ? 35 : 55;

        if (dy > -20 && dy < 280) {
          if (dx < maxDx) {
            var collisionWeight = (maxDx - dx) / maxDx;
            var proximityWeight = (280 - dy) / 280;
            var threatDanger = collisionWeight * proximityWeight;

            if (dx < critDx) threatDanger *= 3.5;
            if (!isBullet) threatDanger *= 2.5; // Canavar gemiler için çarpma tehlikesi ağırlığını artırdık

            danger += threatDanger;
          }
        }
      });

      var distToEnemy = Math.abs(cx - enemyTargetX);

      if (danger < minDanger) {
        minDanger = danger;
        closestToTargetDist = distToEnemy;
        bestX = cx;
      } else if (Math.abs(danger - minDanger) < 0.01) {
        if (distToEnemy < closestToTargetDist) {
          closestToTargetDist = distToEnemy;
          bestX = cx;
        }
      }
    });

    // 4. Gemiyi Sürüş Hedefine Yönlendir
    if (ship.x < bestX - 5) {
      _setKeyState('ArrowLeft', false);
      _setKeyState('ArrowRight', true);
    } else if (ship.x > bestX + 5) {
      _setKeyState('ArrowRight', false);
      _setKeyState('ArrowLeft', true);
    } else {
      _setKeyState('ArrowLeft', false);
      _setKeyState('ArrowRight', false);
    }

    // Ateş Etme Döngüsü
    if (Date.now() - _lastSpace > _spaceInterval) {
      _lastSpace = Date.now();
      _pressSpace();
    }
  }

  function _start() {
    if (_botActive) return;
    _botActive = true;
    try { document.body.setAttribute('data-rc-bot-blaster-active', 'true'); } catch(e) {}
    console.log('[RC-TB] ✅ Token Blaster bot BAŞLADI (Hafıza Modu)');
    if (window.updateRCStatus) window.updateRCStatus('[RC] 🚀 Token Blaster Bot aktif');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();
    _loopId = setInterval(_scan, 30);
  }

  function _stop() {
    if (!_botActive) return;
    _botActive = false;
    try { document.body.setAttribute('data-rc-bot-blaster-active', 'false'); } catch(e) {}
    if (_loopId) { clearInterval(_loopId); _loopId = null; }
    _setKeyState('ArrowLeft', false);
    _setKeyState('ArrowRight', false);
    _setKeyState('Space', false);
    console.log('[RC-TB] ⏹ Token Blaster bot DURDU');
    if (window.updateRCStatus) window.updateRCStatus('[RC] 🚀 Token Blaster Bot durdu');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();
  }

  document.addEventListener('fullscreenchange', function () {
    if (!!document.fullscreenElement && _isGame()) _start();
    else if (!document.fullscreenElement) _stop();
  });

  setInterval(function () {
    var enabled = document.body.getAttribute('data-rc-bot-blaster-enabled') !== 'false';
    var active = _isOnPlayPage() && _isGame() && !!_getCanvas() && enabled;
    if (active && !_botActive)  _start();
    if (!active && _botActive)  _stop();
  }, 500);

  window._rcTokenBlaster = { start: _start, stop: _stop, isActive: function () { return _botActive; } };
})();
