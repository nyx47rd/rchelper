/* ══════════════════════════════════════════════════════════════════
   RC Helper — Cryptonoid (Breakout) Zeki Hafıza Botu (v2.2.89)
   Yalnızca /game/play_game sayfasında inject edilir (manifest.json)
   Tetikleyici: Oyun ekranı algılanınca otomatik başlar
   Mekanik: Topu ve düşen bonusları takip eder, Phaser scene.update
   metodunu yamalayarak (monkey-patch) 60 FPS pürüzsüz takip sağlar.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  var _botActive          = false;
  var _lastLaunch         = 0;
  var _activeKeys         = {};    /* Basılı tutulan tuşlar */
  var _paddleOffset       = 0;     /* Topun rakete açı vermesi için kullanılan sapma payı */
  var _offsetPrepared     = false; /* Açı hazırlığı kilidi */
  var _lastBallY          = 0;     /* Son frame'deki top Y koordinatı */
  var _ballStationaryCount= 0;     /* Topun hareketsiz kaldığı frame sayısı */
  var _originalUpdate     = null;  /* Orijinal scene.update referansı */

  function _isGame() {
    var curGame = (document.body.getAttribute('data-rc-current-game') || '').toLowerCase();
    if (curGame.includes('cryptonoid')) {
      return true;
    }
    var sources = [
      document.title || '',
      window.location.href || ''
    ];
    return sources.some(function(s) {
      var n = s.toLowerCase();
      return n.includes('cryptonoid');
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

  function _clickCanvas(canvas) {
    var rect = canvas.getBoundingClientRect();
    var clientX = rect.left + rect.width / 2;
    var clientY = rect.top + rect.height / 2;
    var opts = { bubbles: true, cancelable: true, clientX: clientX, clientY: clientY };
    canvas.dispatchEvent(new MouseEvent('mousedown', opts));
    canvas.dispatchEvent(new MouseEvent('mouseup', opts));
    canvas.dispatchEvent(new MouseEvent('click', opts));
  }

  // Phaser Sahnesine sızıp update() metodunu yamalama
  function _patchScene(scene) {
    if (!scene || scene._rcPatched) return;
    scene._rcPatched = true;
    _originalUpdate = scene.update;
    
    scene.update = function (time, delta) {
      if (_originalUpdate) {
        try { _originalUpdate.call(scene, time, delta); } catch(e) {}
      }
      if (_botActive) {
        _tickFrame(scene);
      }
    };
    console.log('[RC-Cryptonoid] ✅ Sahne update fonksiyonu başarıyla yamandı!');
  }

  // 60 FPS hızında çalışan ana kare döngüsü
  function _tickFrame(scene) {
    var canvas = _getCanvas();
    if (!canvas) return;

    var paddle = scene.platform;
    var ball = scene.ball;
    if (!paddle || !ball) return;

    // 1. Hareket Takibi ve Hız Hesaplama (Fizik motorundan bağımsız)
    var vy = ball.y - _lastBallY; // Negatifse yükseliyor, pozitifse düşüyor, 0 ise duruyor
    
    var isStationary = false;
    if (Math.abs(vy) < 0.05) {
      _ballStationaryCount++;
    } else {
      _ballStationaryCount = 0;
    }
    _lastBallY = ball.y;

    if (_ballStationaryCount > 15) { // ~250ms boyunca kıpırdamadıysa duruyor kabul et
      isStationary = true;
    }

    // 2. Topu Başlatma Kontrolü (Hareketsizken fırlat)
    if (isStationary && ball.y >= 755) {
      var now = Date.now();
      if (now - _lastLaunch > 1500) {
        _lastLaunch = now;
        console.log('[RC-Cryptonoid] 🚀 Topu başlatmak için fırlatma komutu tetiklendi.');
        _pressSpace();
        _clickCanvas(canvas);
      }
    }

    // 3. Hedef Konum Belirleme (Top veya Düşen Bonuslar)
    var targetX = ball.x;

    // Top yukarı doğru giderken (vy < -0.1) bir sonraki düşüş için açı sekecek yeni offset hazırla
    if (vy < -0.1) {
      if (!_offsetPrepared) {
        // Raket genişliğine göre: -24px ile +24px arası sapma (ortaya çarpmayı engellemek için min 8px)
        var direction = Math.random() > 0.5 ? 1 : -1;
        var amount = Math.floor(Math.random() * 16) + 8;
        _paddleOffset = direction * amount;
        _offsetPrepared = true;
      }
    } else if (vy > 0.1) {
      _offsetPrepared = false; // Top düşerken hazırlığı sıfırla
    }

    // 🌟 EĞER TOP YUKARI GİDİYORSA (vy < 0) ve düşen bonus varsa, bonusu yakalamaya çalış!
    if (vy <= 0 && scene.BonusGroup) {
      var bonuses = [];
      try {
        if (typeof scene.BonusGroup.getChildren === 'function') {
          bonuses = scene.BonusGroup.getChildren();
        } else if (scene.BonusGroup.children && scene.BonusGroup.children.entries) {
          bonuses = scene.BonusGroup.children.entries;
        }
      } catch (e) {}

      // Aktif ve aşağı süzülen bonusları filtrele (raket seviyesinden yukarıda olanlar)
      var activeBonuses = bonuses.filter(function (b) {
        return b && b.active && b.visible && b.y < paddle.y;
      });

      if (activeBonuses.length > 0) {
        // Rakete en yakın olan (en aşağıda süzülen) bonusu bul
        activeBonuses.sort(function (a, b) { return b.y - a.y; });
        var targetBonus = activeBonuses[0];
        
        // Bonusu yakalamak için raketi oraya yönlendir
        targetX = targetBonus.x;
        _paddleOffset = 0; // Bonusu tam ortalayarak yakala
      }
    }

    // Platform (raket) X koordinatını sapmalı/hedef koordinatla eşitle
    var finalX = targetX + _paddleOffset;

    // Raketin ekrandan dışarı taşmasını engelle (RollerCoin oyun genişliği ~960px)
    var halfW = paddle.width ? (paddle.width / 2) : 40;
    finalX = Math.max(halfW + 10, Math.min(960 - halfW - 10, finalX));

    // Raket konumunu anında güncelle (sıfır gecikme)
    paddle.x = finalX;
    if (paddle.body) {
      paddle.body.x = finalX - halfW;
    }

    // Phaser fare girdilerini de sapmalı koordinata eşitle (girişlerin ezip raket kaydırmasını önler)
    if (scene.input) {
      scene.input.x = finalX;
      if (scene.input.activePointer) {
        scene.input.activePointer.x = finalX;
      }
      if (scene.input.mousePointer) {
        scene.input.mousePointer.x = finalX;
      }
    }
  }

  // 500ms'lik döngü sadece aktif Phaser sahnesini arayıp yama yapmak içindir
  function _monitor() {
    var canvas = _getCanvas();
    if (!canvas) return;

    // React Fiber ağacından Phaser game nesnesine eriş
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
    
    // Sahneyi yamala
    _patchScene(scene);
  }

  var _monitorId = null;

  function _start() {
    if (_botActive) return;
    _botActive = true;
    try { document.body.setAttribute('data-rc-bot-cryptonoid-active', 'true'); } catch(e) {}
    console.log('[RC-Cryptonoid] ✅ Cryptonoid bot BAŞLADI (60 FPS Pürüzsüz Takip Modu)');
    if (window.updateRCStatus) window.updateRCStatus('[RC] 🧱 Cryptonoid Bot aktif');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();
    
    // Her 500ms'de bir sahneyi izle ve gerekirse yamala
    _monitorId = setInterval(_monitor, 500);
    _monitor(); // Hemen bir kere çalıştır
  }

  function _stop() {
    if (!_botActive) return;
    _botActive = false;
    try { document.body.setAttribute('data-rc-bot-cryptonoid-active', 'false'); } catch(e) {}
    if (_monitorId) { clearInterval(_monitorId); _monitorId = null; }
    console.log('[RC-Cryptonoid] ⏹ Cryptonoid bot DURDU');
    if (window.updateRCStatus) window.updateRCStatus('[RC] 🧱 Cryptonoid Bot durdu');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();
  }

  document.addEventListener('fullscreenchange', function () {
    if (!!document.fullscreenElement && _isGame()) _start();
    else if (!document.fullscreenElement) _stop();
  });

  setInterval(function () {
    var enabled = document.body.getAttribute('data-rc-bot-cryptonoid-enabled') !== 'false';
    var active = _isOnPlayPage() && _isGame() && !!_getCanvas() && enabled;
    if (active && !_botActive)  _start();
    if (!active && _botActive)  _stop();
  }, 500);

  window._rcCryptonoid = { start: _start, stop: _stop, isActive: function () { return _botActive; } };
})();
