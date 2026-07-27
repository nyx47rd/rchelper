/* ══════════════════════════════════════════════════════════════════
   RC Helper — Lambo Rider TANI & ANALİZ (Debug Script)
   Console'a yapıştırıp Enter'a bas.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  console.log('\n=== 🏎️ LAMBO RIDER TEŞHİSİ VE ANALİZİ ===');
  console.log('📌 Başlık:', document.title);
  console.log('📌 URL:', window.location.href);

  var curGame = document.body.getAttribute('data-rc-current-game') || '(bulunamadı)';
  console.log('📌 data-rc-current-game:', curGame);

  var canvas = document.querySelector('#phaserGame canvas') || document.querySelector('canvas');
  if (canvas) {
    console.log('✅ Canvas bulundu: ' + canvas.width + 'x' + canvas.height);
  } else {
    console.warn('❌ Canvas bulunamadı!');
  }

  var game = null;
  var targets = canvas ? [canvas] : [];
  var ph = document.getElementById('phaserGame');
  if (ph) targets.push(ph);

  for (var i = 0; i < targets.length; i++) {
    var el = targets[i];
    var keys = Object.keys(el);
    for (var j = 0; j < keys.length; j++) {
      if (keys[j].indexOf('__reactFiber$') === 0) {
        var node = el[keys[j]];
        while (node) {
          if (node.stateNode && node.stateNode.game) { game = node.stateNode.game; break; }
          node = node.return;
        }
      }
    }
    if (game) break;
  }

  if (!game && window.__PHASER_GAME__) game = window.__PHASER_GAME__;
  if (!game && window.game && window.game.scene) game = window.game;

  if (!game) {
    console.warn('❌ Phaser Game bulunamadı!');
    return;
  }

  console.log('✅ Phaser Game bulundu!');

  if (game.scene && game.scene.scenes) {
    game.scene.scenes.forEach(function (s) {
      var key = s.sys && s.sys.settings ? s.sys.settings.key : '?';
      var active = s.sys && s.sys.settings ? s.sys.settings.active : false;
      console.log('🎬 Sahne: [' + key + '] | Aktif: ' + active);
      if (active) {
        var customKeys = Object.keys(s).filter(k => !['sys','anims','cache','plugins','registry','scale','sound','textures','events','cameras','make','add','scene','children','time','data','input','load','tweens','lights','physics','matter'].includes(k));
        console.log('   📦 Sahne Custom Keys:', customKeys);

        if (s.children && s.children.list) {
          console.log('   🧩 Toplam Nesne Sayısı:', s.children.list.length);

          var objectsInfo = s.children.list.map(function(c, idx) {
            var texKey = c.texture ? c.texture.key : '(no-tex)';
            return {
              idx: idx,
              key: texKey,
              name: c.name || '',
              x: Math.round(c.x),
              y: Math.round(c.y),
              w: c.width || c.displayWidth || 0,
              h: c.height || c.displayHeight || 0,
              visible: c.visible,
              active: c.active
            };
          });

          // Unique texture keys
          var uniqueKeys = Array.from(new Set(objectsInfo.map(o => o.key)));
          console.log('   🎨 Benzersiz Texture Keyleri:', uniqueKeys);
          console.log('   📋 Nesne Detayları (İlk 25):', objectsInfo.slice(0, 25));
        }

        // Sahnedeki kontrol methodları veya özellikleri
        var fns = Object.keys(s).filter(k => typeof s[k] === 'function' && !['emit','on','off','once','removeListener','removeAllListeners','listenerCount','eventNames','shutdown','destroy'].includes(k));
        console.log('   🔧 Sahne Fonksiyonları:', fns);
      }
    });
  }

  console.log('\n=== ✅ Teşhis Kodu Çalıştı ===');
})();
