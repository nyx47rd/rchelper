/* ══════════════════════════════════════════════════════════════════
   RC Helper — Cryptonoid Canlı Teşhis ve Analiz Modülü (Diagnostic)
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function _getCanvas() {
    return document.querySelector('#phaserGame canvas') || document.querySelector('canvas');
  }

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

  function _diagnose() {
    console.clear();
    console.log('%c🔍 === CRYPTONOID DERİN TEŞHİS VE ANALİZİ ===', 'background: #222; color: #bada55; font-size: 14px; font-weight: bold; padding: 4px;');

    var canvas = _getCanvas();
    console.log('📌 Canvas:', canvas ? ('Boyut: ' + canvas.width + 'x' + canvas.height) : 'YOK ❌');

    var game = _findGame();
    if (!game) {
      console.warn('❌ Phaser Game Instance bulunamadı!');
      return;
    }
    console.log('✅ Phaser Game bulundu:', game);

    var scenes = game.scene.scenes;
    console.log('🎬 Toplam Sahne Sayısı:', scenes.length);

    for (var i = 0; i < scenes.length; i++) {
      var s = scenes[i];
      var key = s.sys && s.sys.settings && s.sys.settings.key;
      var active = s.sys && s.sys.settings && s.sys.settings.active;
      console.log(`\n--- 🎬 Sahne [${key}] | Aktif: ${active} ---`);
      
      if (!active) continue;

      var customKeys = Object.keys(s).filter(function (k) {
        return !['sys','anims','cache','plugins','registry','scale','sound','textures','events','cameras','make','add','scene','children','time','data','input','load','tweens','lights','physics'].includes(k);
      });
      console.log('  📦 Custom Değişkenler:', customKeys);

      if (s.platform) {
        console.log('  🏓 Platform/Paddle:', {
          x: s.platform.x,
          y: s.platform.y,
          visible: s.platform.visible,
          active: s.platform.active,
          type: s.platform.type,
          body: s.platform.body ? 'Fizik Body VAR' : 'YOK'
        });
      } else {
        console.warn('  ⚠️ s.platform YOK!');
      }

      if (s.ball) {
        console.log('  🎾 Ball/Top:', {
          x: s.ball.x,
          y: s.ball.y,
          visible: s.ball.visible,
          active: s.ball.active,
          type: s.ball.type,
          body: s.ball.body ? {
            vx: s.ball.body.velocity ? s.ball.body.velocity.x : 0,
            vy: s.ball.body.velocity ? s.ball.body.velocity.y : 0
          } : 'YOK'
        });
      } else {
        console.warn('  ⚠️ s.ball YOK!');
      }

      if (typeof s.ballOnPlatform !== 'undefined') {
        console.log('  🔒 ballOnPlatform Değeri:', s.ballOnPlatform);
      }

      if (s.input) {
        console.log('  🖱️ Sahne Input Durumu:', {
          pointerX: s.input.activePointer ? s.input.activePointer.x : null,
          pointerY: s.input.activePointer ? s.input.activePointer.y : null,
          isDown: s.input.activePointer ? s.input.activePointer.isDown : null
        });
      }

      if (s.children && s.children.list) {
        var textures = s.children.list.map(function(c) { return c.texture ? c.texture.key : (c.type || 'unknown'); });
        console.log('  🎨 Sahnedeki Tüm Görsel Elemanlar (' + textures.length + ' adet):', textures);
      }

      // Test amaçlı fırlatma ve palet hareket denemesi
      window._testPaddleMove = function (targetX) {
        console.log('🧪 Palet ' + targetX + ' koordinatına taşınıyor...');
        if (s.platform) s.platform.x = targetX;
        if (s.input && s.input.activePointer) s.input.activePointer.x = targetX;
        var cv = _getCanvas();
        if (cv) {
          cv.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: targetX, clientY: s.platform ? s.platform.y : 500 }));
        }
      };

      window._testLaunch = function () {
        console.log('🧪 Top fırlatma tetikleniyor...');
        if (s.input) {
          s.input.emit('pointerdown', s.input.activePointer);
          s.input.emit('pointerup', s.input.activePointer);
        }
        var cv = _getCanvas();
        if (cv) {
          cv.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
      };

      console.log('\n💡 Manuel Test Fonksiyonları Hazır:');
      console.log('   - window._testPaddleMove(500) -> Paleti taşır');
      console.log('   - window._testLaunch() -> Topu fırlatmayı dener');
    }
  }

  window._debugCryptonoid = _diagnose;

  // Oyun açıldığında 3 saniye sonra otomatik teşhis çalıştır
  setInterval(function () {
    var cur = (document.body.getAttribute('data-rc-current-game') || '').toLowerCase();
    if ((cur.indexOf('cryptonoid') !== -1 || cur.indexOf('crypto-noid') !== -1) && _getCanvas()) {
      if (!window._hasDiagnosedCrypto) {
        window._hasDiagnosedCrypto = true;
        setTimeout(_diagnose, 2000);
      }
    }
  }, 1000);

  console.log('[RC-Cryptonoid] 🩺 Teşhis modülü yüklendi. İstediğin an konsola _debugCryptonoid() yazabilirsin.');
})();
