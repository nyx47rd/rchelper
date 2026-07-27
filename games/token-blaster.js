/* ══════════════════════════════════════════════════════════════════
 R C* Helper — Token Blaster Gelişmiş Hafıza ve Öngörü Botu v3
 Yalnızca /game/play_game sayfasına inject edilir (manifest.json)
 Tetikleyici: Oyun ekranı algılanınca otomatik başlar
 ══════════════════════════════════════════════════════════════════ */
(function () {
  var _botActive   = false;
  var _loopId      = null;
  var _lastSpace   = 0;
  var _spaceInterval = 60;  /* Ateş etme aralığı (ms) - Hızlı ateş için düşürüldü */
  var _activeKeys  = {};    /* Basılı tutulan tuşlar */

  /* Hafıza: Düşman ve mermilerin hız vektörlerini hesaplamak için */
  var _velocities = new Map();
  var _scanCount = 0;

  function _isGame() {
    var curGame = (document.body.getAttribute('data-rc-current-game') || '').toLowerCase();
    if (curGame.includes('token blaster') || curGame.includes('tokenblaster')) {
      return true;
    }
    var sources = [
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
    _scanCount++;

    /* --- 1. HIZ HAFIZASI GÜNCELLEMESİ --- */
    var currentIds = new Set();
    children.forEach(function(c) {
      if (!c.active || !c.visible) return;
      if (!c.__id) c.__id = Math.random().toString(36).substr(2, 9);
      currentIds.add(c.__id);

      var prev = _velocities.get(c.__id);
      if (prev) {
        var vx = c.x - prev.lastX;
        var vy = c.y - prev.lastY;
        // Hızı yumuşatarak anlık sıçramaları engelle
        prev.vx = prev.vx * 0.7 + vx * 0.3;
        prev.vy = prev.vy * 0.7 + vy * 0.3;
        prev.lastX = c.x;
        prev.lastY = c.y;
      } else {
        _velocities.set(c.__id, { lastX: c.x, lastY: c.y, vx: 0, vy: 0 });
      }
    });

    // Silinen nesneleri hafızadan temizle (Her 2 saniyede bir)
    if (_scanCount % 60 === 0) {
      for (var key of _velocities.keys()) {
        if (!currentIds.has(key)) _velocities.delete(key);
      }
    }

    /* --- 2. TEHDİT VE HEDEF FİLTRELEME --- */
    var threats = [];
    var targetEnemies = [];

    children.forEach(function(c) {
      if (c === ship || !c.texture || !c.texture.key || c.active === false || c.visible === false) return;

      var key = c.texture.key.toLowerCase();
      var isPlayerBullet = key.indexOf('bullet') >= 0 && key.indexOf('alien') < 0;
      var isBackground = key.indexOf('star') >= 0 || key.indexOf('bg') >= 0 || key.indexOf('particle') >= 0;
      if (isPlayerBullet || isBackground) return;

      var vel = _velocities.get(c.__id) || {vx: 0, vy: 0};
      var pVy = vel.vy;

      var isEnemyBullet = key === 'alienbullet';

      // Düşman mermileri VEYA aşağı doğru dalış yapan (vy > 0) herhangi bir düşman tehdit sayılır
      var isApproaching = pVy > 0.1 || (c.y > ship.y - 200 && c.y < ship.y + 50);

      if (isEnemyBullet || isApproaching) {
        threats.push(c);
      }

      // Hedef olarak seçilecek düşmanlar (sadece yukarıdakiler)
      if (key.indexOf('bullet') < 0 && c.y < ship.y - 100 && c.y > 30) {
        targetEnemies.push(c);
      }
    });

    var enemyTargetX = 480;
    if (targetEnemies.length > 0) {
      targetEnemies.sort(function(a, b) { return b.y - a.y; });
      enemyTargetX = targetEnemies[0].x;
    }

    /* --- 3. ŞERİT ANALİZİ VE YAPAY ZEKÂ KARARI --- */
    var candidates = [];
    // Kaçış alanını geniş tut, köşelere kadar tarayabilmek için aralığı 30px yap
    for (var i = -10; i <= 10; i++) {
      candidates.push(ship.x + (i * 30));
    }

    var bestX = ship.x;
    var minDanger = Infinity;
    var closestToTargetDist = Infinity;

    candidates.forEach(function(cx) {
      // Ekran sınırı kontrolleri (köşelerde biraz daha esnek)
      if (cx < 40 || cx > 920) return;

      var danger = 0;

      threats.forEach(function(t) {
        var vel = _velocities.get(t.__id) || {vx: 0, vy: 0};
        var pVy = vel.vy;
        var pVx = vel.vx;
        var isBullet = t.texture.key.toLowerCase() === 'alienbullet';

        // Kesişim Tahmini: Bu tehdit gemin Y seviyesine ulaştığında X neresinde olacak?
        var timeToShip = -1;
        if (pVy > 0.5) {
          timeToShip = (ship.y - t.y) / pVy;
        } else if (t.y > ship.y - 40 && t.y < ship.y) {
          // Neredeyse tam üstünde ve yavaş iniyor
          timeToShip = 0;
        }

        var intersectX = t.x;
        var willHit = false;

        // Eğer 1.5 saniye (45 frame) içinde gemi seviyesine gelecekse öngörü yapıyoruz
        if (timeToShip >= 0 && timeToShip < 45) {
          willHit = true;
          intersectX = t.x + (pVx * timeToShip);
        } else if (t.y > ship.y - 250 && t.y < ship.y + 30) {
          // Çok yakınından geçen ama hızı belirsiz olanlar için şu anki X'ini tehlike say
          willHit = true;
          intersectX = t.x;
        }

        if (willHit) {
          var dangerRadius = isBullet ? 50 : 70; // Mermi ve düşman için güvenlik yarıçapı

          // Gelecekteki kesişim noktasına aday şeridin uzaklığı
          var dxFuture = Math.abs(intersectX - cx);
          if (dxFuture < dangerRadius) {
            var dangerLevel = 1 - (dxFuture / dangerRadius);
            var timeFactor = 1;
            if (timeToShip > 0) {
              // Ne kadar çabuk gelirse o kadar tehlikeli
              timeFactor = 1 - (timeToShip / 45);
            }
            // Mermiler için 15, düşmanlar için 20 taban puan (çarpışma ağırlığı)
            var threatDanger = dangerLevel * (isBullet ? 15 : 20) * (0.4 + timeFactor * 0.6);
            danger += threatDanger;
          }

          // Şu anki pozisyonunun üzerinden de geçiyorsa ekstra ceza (önlem)
          var dxCurrent = Math.abs(t.x - cx);
          if (dxCurrent < dangerRadius && t.y > ship.y - 300 && t.y < ship.y + 20) {
            danger += isBullet ? 8 : 12;
          }
        }
      });

      var distToEnemy = Math.abs(cx - enemyTargetX);

      // En az tehlikeli şeridi seç, tehlike eşitse düşmana en yakın olanı seç
      if (danger < minDanger - 0.5) {
        minDanger = danger;
        closestToTargetDist = distToEnemy;
        bestX = cx;
      } else if (Math.abs(danger - minDanger) <= 0.5) {
        if (distToEnemy < closestToTargetDist) {
          closestToTargetDist = distToEnemy;
          bestX = cx;
        }
      }
    });

    /* --- 4. GEMİYİ SÜRÜŞ --- */
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

    // Sürekli ve hızlı ateş
    if (Date.now() - _lastSpace > _spaceInterval) {
      _lastSpace = Date.now();
      _pressSpace();
    }
  }

  function _start() {
    if (_botActive) return;
    _botActive = true;
    _scanCount = 0;
    _velocities.clear();
    try { document.body.setAttribute('data-rc-bot-blaster-active', 'true'); } catch(e) {}
    console.log('[RC-TB] ✅ Token Blaster bot BAŞLADI (Öngörülü Kaçış Modu)');
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


  setInterval(function () {
      var enabled = document.body.getAttribute('data-rc-bot-blaster-enabled') !== 'false';
      var active = _isOnPlayPage() && _isGame() && !!_getCanvas() && enabled;
      if (active && !_botActive)  _start();
      if (!active && _botActive)  _stop();
    }, 500);

      window._rcTokenBlaster = { start: _start, stop: _stop, isActive: function () { return _botActive; } };
})();
