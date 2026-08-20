/* ══════════════════════════════════════════════════════════════════
   RC Helper — Cryptonoid Tam Fonksiyon ve Dinleyici Dökümü
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function _getCanvas() {
    return document.querySelector('#phaserGame canvas') || document.querySelector('canvas');
  }

  function _findGame() {
    var canvas = _getCanvas();
    if (!canvas) return null;
    var targets = [canvas, document.getElementById('phaserGame')].filter(Boolean);
    for (var i = 0; i < targets.length; i++) {
      var keys = Object.keys(targets[i]);
      for (var j = 0; j < keys.length; j++) {
        if (keys[j].indexOf('__reactFiber$') === 0) {
          var node = targets[i][keys[j]];
          while (node) {
            if (node.stateNode && node.stateNode.game) return node.stateNode.game;
            node = node.return;
          }
        }
      }
    }
    if (window.Phaser && Array.isArray(window.Phaser.GAMES)) {
      for (var k = 0; k < window.Phaser.GAMES.length; k++) {
        if (window.Phaser.GAMES[k] && window.Phaser.GAMES[k].scene) return window.Phaser.GAMES[k];
      }
    }
    return null;
  }

  function _inspectScene() {
    var game = _findGame();
    if (!game || !game.scene) return;
    var scenes = game.scene.scenes;
    for (var i = 0; i < scenes.length; i++) {
      var s = scenes[i];
      if (s.sys && s.sys.settings && s.sys.settings.active && s.sys.settings.key === 'Game') {
        console.clear();
        console.log('%c🔍 === CRYPTONOID DETAYLI OYUN KODU DÖKÜMÜ ===', 'background: #004400; color: #00ff00; font-size: 14px; font-weight: bold; padding: 4px;');
        
        console.log('📌 Sahne Update Fonksiyonu:', s.update ? s.update.toString() : 'YOK');
        
        // Sahne prototype fonksiyonları
        var proto = Object.getPrototypeOf(s);
        var protoKeys = Object.getOwnPropertyNames(proto);
        console.log('📌 Sahne Proto Metotları:', protoKeys);
        for (var p = 0; p < protoKeys.length; p++) {
          var mName = protoKeys[p];
          if (typeof proto[mName] === 'function' && mName !== 'constructor') {
            console.log('--- Metot [' + mName + '] ---:\n' + proto[mName].toString().substring(0, 300));
          }
        }

        // Input event listeners
        if (s.input) {
          console.log('📌 Input Event Listeners:', s.input._events || s.input.events || 'yok');
        }
        if (s.events) {
          console.log('📌 Scene Event Listeners:', s.events._events || 'yok');
        }
        
        console.log('📌 Platform Nesnesi:', s.platform);
        console.log('📌 Ball Nesnesi:', s.ball);
        console.log('📌 Blocks Nesnesi:', s.Blocks);
        return;
      }
    }
  }

  window._inspectCrypto = _inspectScene;

  setInterval(function () {
    var cur = (document.body.getAttribute('data-rc-current-game') || '').toLowerCase();
    if ((cur.indexOf('cryptonoid') !== -1 || cur.indexOf('crypto-noid') !== -1) && _getCanvas()) {
      if (!window._hasInspectedCrypto) {
        window._hasInspectedCrypto = true;
        setTimeout(_inspectScene, 1500);
      }
    }
  }, 1000);

  console.log('[RC-Cryptonoid] 🔍 Kod Döküm Ajanı Yüklendi.');
})();
