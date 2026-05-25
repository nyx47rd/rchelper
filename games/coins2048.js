/* ══════════════════════════════════════════════════════════════════
   RC Helper — 2048 Coins Auto-Bot
   Ok tuşlarına rastgele basarak oyunu oynar
   ══════════════════════════════════════════════════════════════════ */
(function () {
  var _botActive = false;
  var _loopId    = null;
  var _INTERVAL  = 300; /* her kaç ms'de bir tuşa bassın */

  var KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];

  function _isGame() {
    var sources = [
      (window._activeGame && window._activeGame.name) || '',
      window.currentPlayingGame || '',
      window.lastSelectedGame   || '',
      document.title            || ''
    ];
    return sources.some(function (s) {
      var n = s.toLowerCase();
      return n.includes('2048') || n.includes('coins2048') || n.includes('coin2048');
    });
  }

  function _isBigCanvas() {
    var c = document.querySelector('#phaserGame canvas') || document.querySelector('canvas');
    if (!c) return false;
    return c.getBoundingClientRect().width > window.innerWidth * 0.6;
  }

  function _pressKey(key) {
    var opts = { key: key, code: key, bubbles: true, cancelable: true };
    document.dispatchEvent(new KeyboardEvent('keydown', opts));
    document.dispatchEvent(new KeyboardEvent('keyup',   opts));
  }

  function _tick() {
    if (!_botActive) return;
    var key = KEYS[Math.floor(Math.random() * KEYS.length)];
    _pressKey(key);
  }

  function _start() {
    if (_botActive) return;
    _botActive = true;
    console.log('[RC-2048] ✅ 2048 bot BAŞLADI');
    if (window.updateRCStatus) window.updateRCStatus('[RC] 🔢 2048 Bot aktif');
    _loopId = setInterval(_tick, _INTERVAL);
  }

  function _stop() {
    if (!_botActive) return;
    _botActive = false;
    if (_loopId) { clearInterval(_loopId); _loopId = null; }
    console.log('[RC-2048] ⏹ 2048 bot DURDU');
    if (window.updateRCStatus) window.updateRCStatus('[RC] 🔢 2048 Bot durdu');
  }

  setInterval(function () {
    var big = _isBigCanvas() && _isGame();
    if (big && !_botActive)  _start();
    if (!big && _botActive)  _stop();
  }, 500);

  window._rc2048 = { start: _start, stop: _stop, isActive: function () { return _botActive; } };
})();
