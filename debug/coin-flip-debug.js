/* ══════════════════════════════════════════════════════════════════
   RC Helper — Coin Flip TANI & ANALİZ (Debug)
   Console'a yapıştır ve Enter'a bas.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  console.log('\n=== 🪙 COIN FLIP TEŞHİSİ VE ANALİZİ ===');
  console.log('📌 Başlık:', document.title);
  console.log('📌 URL:', window.location.href);

  // Aktif oyun adı
  var curGame = document.body.getAttribute('data-rc-current-game') || '(bulunamadı)';
  console.log('📌 data-rc-current-game:', curGame);

  // Canvas tespiti
  var canvas = document.querySelector('#phaserGame canvas') || document.querySelector('canvas');
  if (canvas) {
    console.log('✅ Canvas bulundu: ' + canvas.width + 'x' + canvas.height);
  } else {
    console.warn('❌ Canvas bulunamadı!');
  }

  // Phaser game tespiti
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

  // window.__PHASER_GAME__ fallback
  if (!game && window.__PHASER_GAME__) game = window.__PHASER_GAME__;
  if (!game && window.game && window.game.scene) game = window.game;

  if (!game) {
    console.warn('❌ Phaser Game bulunamadı!');
    console.log('📦 window keys (game ile ilgili):', Object.keys(window).filter(k => k.toLowerCase().includes('game') || k.toLowerCase().includes('phaser') || k.toLowerCase().includes('coin') || k.toLowerCase().includes('flip')));
    return;
  }

  console.log('✅ Phaser Game bulundu!');

  // Sahneleri tara
  var activeScene = null;
  if (game.scene && game.scene.scenes) {
    game.scene.scenes.forEach(function (s) {
      var key = s.sys && s.sys.settings ? s.sys.settings.key : '?';
      var active = s.sys && s.sys.settings ? s.sys.settings.active : false;
      console.log('🎬 Sahne: [' + key + '] | Aktif: ' + active);
      if (active) {
        activeScene = s;
        // Sahne özelliklerini listele
        var sceneKeys = Object.keys(s).filter(k => !['sys','anims','cache','plugins','registry','scale','sound','textures','events','cameras','make','add','scene','children','time','data','input','load','tweens','lights','physics','matter'].includes(k));
        console.log('   📦 Sahne Custom Keys:', sceneKeys);

        // children.list
        if (s.children && s.children.list) {
          var names = s.children.list.map(function (c) {
            var key = c.texture ? c.texture.key : '(no-texture)';
            var name = c.name || '';
            var type = c.type || '';
            return key + (name ? '[' + name + ']' : '') + '<' + type + '>';
          });
          console.log('   🧩 Children (' + s.children.list.length + '):', names);

          // İnteraktif nesneler
          var interactive = s.children.list.filter(c => c.input);
          console.log('   🖱️ İnteraktif nesneler (' + interactive.length + '):', interactive.map(c => (c.texture ? c.texture.key : '?') + (c.name ? '[' + c.name + ']' : '')));

          // Text/label nesneler
          var texts = s.children.list.filter(c => c.type === 'Text' || c.type === 'BitmapText');
          console.log('   📝 Text nesneler:', texts.map(c => '"' + (c.text || '') + '"'));

          // Gruplar
          var groups = s.children.list.filter(c => c.type === 'Group' || (c.getChildren && typeof c.getChildren === 'function'));
          groups.forEach(function(g) {
            console.log('   📂 Grup [' + (g.name||g.type) + '] içeriği:', (g.getChildren ? g.getChildren() : []).map(c => c.texture ? c.texture.key : '?'));
          });
        }

        // Oyun durumu: skor, can, tur vb.
        ['score', 'lives', 'round', 'count', 'result', 'state', 'phase', 'status',
         'coinResult', 'playerChoice', 'isFlipping', 'flipping', 'isAnimating',
         'heads', 'tails', 'wins', 'losses', 'streak', 'multiplier'].forEach(function(k) {
          if (s[k] !== undefined) console.log('   🎯 scene.' + k + ' =', s[k]);
        });

        // Fonksiyonlar
        var fns = Object.keys(s).filter(k => typeof s[k] === 'function' && !['emit','on','off','once','removeListener','removeAllListeners','listenerCount','eventNames','shutdown','destroy'].includes(k));
        console.log('   🔧 Sahne fonksiyonları:', fns);
      }
    });
  }

  // Coin Flip spesifik: HTML üzerinden de ara
  console.log('\n--- 🔍 DOM İncelemesi ---');
  var btns = Array.from(document.querySelectorAll('button, [class*="btn"], [class*="button"], [class*="coin"], [class*="flip"], [class*="choice"]'));
  console.log('🖱️ DOM Butonları (' + btns.length + '):', btns.slice(0,10).map(b => b.className + ' | ' + (b.textContent||'').trim().slice(0,30)));

  var imgs = Array.from(document.querySelectorAll('img[src*="coin"], img[src*="flip"], img[class*="coin"]'));
  console.log('🖼️ Coin img etiketleri:', imgs.map(i => i.src.split('/').pop() + ' | class:' + i.className));

  console.log('\n--- 📡 window global değişkenler (oyunla ilgili) ---');
  var winKeys = Object.keys(window).filter(k => /coin|flip|game|scene|phaser|result|choice|heads|tails|bet|win|lose/i.test(k));
  winKeys.forEach(k => console.log('  window.' + k + ' =', typeof window[k] === 'object' ? '[object]' : window[k]));

  console.log('\n=== ✅ Teşhis Tamamlandı ===');
})();
