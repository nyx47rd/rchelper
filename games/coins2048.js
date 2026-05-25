/* ══════════════════════════════════════════════════════════════════
   RC Helper — 2048 Coins Auto-Bot
   Ok tuşlarına rastgele basarak oyunu oynar
   ══════════════════════════════════════════════════════════════════ */
(function () {
  var _botActive = false;
  var _loopId    = null;
  var _INTERVAL  = 150; /* her kaç ms'de bir tuşa bassın */

  var KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];

  function _isGame() {
    var sources = [
      (window._activeGame && window._activeGame.name) || '',
      window.currentPlayingGame || '',
      window.lastSelectedGame   || '',
      document.title            || '',
      window.location.href      || ''
    ];
    return sources.some(function (s) {
      var n = s.toLowerCase();
      return n.includes('2048');
    });
  }

  function _isOnPlayPage() {
    return window.location.href.includes('/play_game');
  }

  function _getCanvas() {
    return document.querySelector('#phaserGame canvas') || document.querySelector('canvas');
  }

  function _pressKey(key) {
    var opts = { key: key, code: key, keyCode: 0, which: 0,
                 bubbles: true, cancelable: true };
    /* keyCode değerlerini de set et */
    var codes = { ArrowLeft: 37, ArrowRight: 39, ArrowUp: 38, ArrowDown: 40 };
    opts.keyCode = codes[key]; opts.which = codes[key];
    var canvas = _getCanvas();
    /* window, document ve canvas'a gönder */
    [window, document, canvas].forEach(function(t) {
      if (!t) return;
      t.dispatchEvent(new KeyboardEvent('keydown', opts));
      t.dispatchEvent(new KeyboardEvent('keyup',   opts));
    });
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
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();
    _loopId = setInterval(_tick, _INTERVAL);
  }

  function _stop() {
    if (!_botActive) return;
    _botActive = false;
    if (_loopId) { clearInterval(_loopId); _loopId = null; }
    console.log('[RC-2048] ⏹ 2048 bot DURDU');
    if (window.updateRCStatus) window.updateRCStatus('[RC] 🔢 2048 Bot durdu');
    if (window._updateBotPlayingWidget) window._updateBotPlayingWidget();
  }

  setInterval(function () {
    var enabled = !(window._rcBotEnabled && window._rcBotEnabled['bot2048Enabled'] === false);
    var active = _isOnPlayPage() && _isGame() && !!_getCanvas() && enabled;
    if (active && !_botActive)  _start();
    if (!active && _botActive)  _stop();
  }, 500);

  window._rc2048 = { start: _start, stop: _stop, isActive: function () { return _botActive; } };
})();
