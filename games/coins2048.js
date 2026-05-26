/* ══════════════════════════════════════════════════════════════════
   RC Helper — 2048 Coins Auto-Bot v3
   Strateji: Corner-snake döngüsü + takılı kalmayı önle
   Canvas okuma yok (cross-origin taint hatası nedeniyle güvenilmez)
   ══════════════════════════════════════════════════════════════════ */
(function () {
  var _botActive  = false;
  var _loopId     = null;
  var _INTERVAL   = 250;

  /* Corner-snake: sol-alt köşeyi büyük tile için koru
     Sol → Aşağı → Sağ → Aşağı döngüsü.
     Yukarı ASLA öncelikli değil — sadece kurtarma hamlesi. */
  var _MAIN_CYCLE = ['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowDown',
                     'ArrowLeft', 'ArrowDown', 'ArrowLeft', 'ArrowDown'];
  var _cycleIdx   = 0;

  /* Takılma tespiti: son N hamlede herhangi bir etki olmadıysa */
  var _lastKey       = null;
  var _noMoveStreak  = 0;  /* aynı yönde ard arda hareket olmadı sayısı */
  var _rescueSeq     = []; /* kurtarma hamlesi kuyruğu */

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
    var codes = { ArrowLeft: 37, ArrowRight: 39, ArrowUp: 38, ArrowDown: 40 };
    opts.keyCode = codes[key]; opts.which = codes[key];
    var canvas = _getCanvas();
    [window, document, canvas].forEach(function(t) {
      if (!t) return;
      t.dispatchEvent(new KeyboardEvent('keydown', opts));
      t.dispatchEvent(new KeyboardEvent('keyup',   opts));
    });
  }

  function _tick() {
    if (!_botActive) return;

    var key;

    /* Kurtarma kuyruğu doluysa önce onu işle */
    if (_rescueSeq.length > 0) {
      key = _rescueSeq.shift();
      _pressKey(key);
      return;
    }

    /* Normal döngü */
    key = _MAIN_CYCLE[_cycleIdx];
    _cycleIdx = (_cycleIdx + 1) % _MAIN_CYCLE.length;

    /* Aynı yön üst üste 4 kez geldiyse takılı sayılır */
    if (key === _lastKey) {
      _noMoveStreak++;
    } else {
      _noMoveStreak = 0;
    }
    _lastKey = key;

    /* Takılı → kurtarma: yukarı + sağ + aşağı sırası ile açılmayı zorla */
    if (_noMoveStreak >= 4) {
      _noMoveStreak = 0;
      _cycleIdx = 0;
      _rescueSeq = ['ArrowUp', 'ArrowRight', 'ArrowUp', 'ArrowDown',
                    'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowDown'];
      key = _rescueSeq.shift();
    }

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
