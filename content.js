const RC_VERSION = '2.2.4';

let _rcAudioCtx = null;
function _getRCAudioCtx() {
  if (!_rcAudioCtx || _rcAudioCtx.state === 'closed') {
    _rcAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return _rcAudioCtx;
}
['click', 'keydown', 'mousedown', 'touchstart'].forEach(evt => {
  document.addEventListener(evt, () => {
    const ctx = _getRCAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
  }, { once: false, passive: true, capture: true });
});

function playSound(type) {
  if (window._rcSoundEnabled === false) return;
  try {
    const ctx = _getRCAudioCtx();
    const resume = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();
    resume.then(() => {
      const sounds = {
        select:   { type: 'sine',     freq: [520, 660],      dur: [0, 0.06, 0.12],      vol: 0.2  },
        skip:     { type: 'triangle', freq: [400, 300],      dur: [0, 0.08, 0.18],      vol: 0.18 },
        permSkip: { type: 'sawtooth', freq: [350, 200],      dur: [0, 0.1, 0.25],       vol: 0.15 },
        breakOn:  { type: 'sine',     freq: [440, 550, 440], dur: [0, 0.15, 0.3, 0.45], vol: 0.22 },
        breakOff: { type: 'sine',     freq: [550, 660, 770], dur: [0, 0.12, 0.24, 0.36],vol: 0.22 },
        autoOn:   { type: 'sine',     freq: [440, 554, 659], dur: [0, 0.1, 0.2, 0.3],   vol: 0.18 },
        autoOff:  { type: 'sine',     freq: [659, 554, 440], dur: [0, 0.1, 0.2, 0.3],   vol: 0.18 },
        click:    { type: 'sine',     freq: [600, 500],      dur: [0, 0.03, 0.07],      vol: 0.12 },
        toggle:   { type: 'sine',     freq: [480, 560],      dur: [0, 0.04, 0.09],      vol: 0.12 },
      };
      const s = sounds[type];
      if (!s) return;

      const g = ctx.createGain();
      g.connect(ctx.destination);
      const o = ctx.createOscillator();
      o.connect(g);
      o.type = s.type;

      const t = ctx.currentTime;
      g.gain.setValueAtTime(s.vol, t);
      s.freq.forEach((f, i) => o.frequency.setValueAtTime(f, t + s.dur[i]));

      const end = s.dur[s.dur.length - 1];
      g.gain.setValueAtTime(s.vol, t + end - 0.04);
      g.gain.linearRampToValueAtTime(0, t + end + 0.06);
      o.start(t);
      o.stop(t + end + 0.1);
      o.onended = () => { try { g.disconnect(); } catch(e) {} };
    });
  } catch(e) {}
}

const originalLog = console.log;
const importantKeywords = ['SEÇİLEN OYUN', 'Pas geçildi', 'Butona tıklanıyor', 'Oyun seçimi', 'OYNANAN', 'START', 'Oyun beklemede', 'Tüm oyunlar atlandı', 'OYNANIYOR'];
console.log = function(...args) {
  originalLog.apply(console, args);
  const msg = args.map(a => {
    if (typeof a === 'object') {
      try { return JSON.stringify(a); } catch { return String(a); }
    }
    return String(a);
  }).join(' ');
  if (window.updateRCStatus && msg.includes('[RC]') && importantKeywords.some(k => msg.includes(k))) {
    window.updateRCStatus(msg);
  }
};

chrome.storage.local.get(['skippedGames', 'permanentSkippedGames'], (data) => {
  const now = Date.now();
  const skipDuration = 10 * 60 * 1000;
  let cleaned = false;
  
  if (data.skippedGames) {
    const newSkipped = {};
    Object.keys(data.skippedGames).forEach(key => {
      if (now - data.skippedGames[key] <= skipDuration) {
        newSkipped[key] = data.skippedGames[key];
      }
    });
    if (Object.keys(newSkipped).length !== Object.keys(data.skippedGames).length) {
      chrome.storage.local.set({ skippedGames: newSkipped });
      cleaned = true;
    }
    window.skippedGames = newSkipped;
  } else {
    window.skippedGames = {};
  }
  
  if (data.permanentSkippedGames) {
    window.permanentSkippedGames = data.permanentSkippedGames;
  } else {
    window.permanentSkippedGames = {};
  }
  
  if (cleaned) {
    console.log('[RC] Eski pas geçilenler temizlendi');
  }
});

window.autoPlayActive = false;
window.autoChoose = true;
window.autoCollect = true;
window.recentlyPlayed = [];
window.skippedGames = {};
window.permanentSkippedGames = {};
window.lastSelectedGame = null;
window.gameSelectionInProgress = false;
window.lastPlayedGameName = null;
window.pickAndPlayRunning = false;
window.gamesPlayedThisSession = 0;
window.sessionStartTime = null;
window.breakCycleStartTime = null;
window.gameTimes = [];
window.emaGameTime = null;
window.emaAlpha = 0.3;
window.minGameTime = Infinity;
window.maxGameTime = 0;
window.totalGameTime = 0;
window.gamesPlayedTotal = 0;
window.breakReminderEnabled = true;
window.breakSessionMinutes = 10;
window.breakDurationMinutes = 2.5;
window.isOnBreak = false;
window.nextBreakTime = null;
var mainTimer = null;
var breakCheckTimer = null;

chrome.storage.local.get(['autoPlay', 'autoChoose', 'autoCollect', 'skippedGames', 'permanentSkippedGames', 'breakReminder', 'sessionGamesPlayed', 'sessionStartTime', 'sessionGameTimes', 'sessionBreakCycle', 'sessionIsOnBreak', 'sessionNextBreak'], (data) => {
  window.autoCollect = data.autoCollect !== false;
  window.autoChoose  = data.autoChoose  !== false;
  window.breakReminderEnabled = data.breakReminder !== false;
  if (data.skippedGames) {
    window.skippedGames = data.skippedGames;
    console.log('[RC] Yüklenen skippedGames:', window.skippedGames);
  }
  if (data.permanentSkippedGames) {
    window.permanentSkippedGames = data.permanentSkippedGames;
    console.log('[RC] Yüklenen permanentSkippedGames:', window.permanentSkippedGames);
  }
  if (data.autoPlay) {
    fetch('https://api.github.com/repos/nyx47rd/rchelper/releases/latest', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        const latest = (d.tag_name || '').replace('v', '');
        if (!latest) { window.autoPlayActive = true; startAutoPlay(); return; }
        const cur = RC_VERSION.split('.').map(Number);
        const lat = latest.split('.').map(Number);
        let isOld = false;
        for (let i = 0; i < Math.max(cur.length, lat.length); i++) {
          if ((lat[i]||0) > (cur[i]||0)) { isOld = true; break; }
          if ((cur[i]||0) > (lat[i]||0)) break;
        }
        if (isOld) {
          console.warn('[RC] Eski sürüm! Auto-Play engellendi. Güncel sürüm: v' + latest);
          if (window.updateRCStatus) window.updateRCStatus('\u26a0\ufe0f Güncelleme gerekli! v' + latest + ' müevcut');
          chrome.storage.local.set({ autoPlay: false });
        } else {
          window.autoPlayActive = true;
          startAutoPlay();
        }
      })
      .catch(() => { window.autoPlayActive = true; startAutoPlay(); });
  }
  
  setTimeout(() => {
    updateBreakStatusDisplay();
  }, 2000);
});

function saveState() {
  chrome.storage.local.set({
    autoPlay:    window.autoPlayActive,
    autoChoose:  window.autoChoose,
    autoCollect: window.autoCollect,
    breakReminder: window.breakReminderEnabled,
  });
}

function saveSessionState() {}

function startGameTimer() {
  if (!window.sessionStartTime) {
    window.sessionStartTime = Date.now();
    saveSessionState();
  }
  if (window.timerInterval) clearInterval(window.timerInterval);
  updateGameTimer();
  window.timerInterval = setInterval(updateGameTimer, 1000);
}

function stopGameTimer() {
  if (window.timerInterval) {
    clearInterval(window.timerInterval);
    window.timerInterval = null;
  }
}

function updateGameTimer() {
  if (!window.sessionStartTime) return;
  const elapsed = Math.floor((Date.now() - window.sessionStartTime) / 1000);
  const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const secs = String(elapsed % 60).padStart(2, '0');
  const timerEl = document.getElementById('rc-game-timer');
  if (timerEl) timerEl.textContent = mins + ':' + secs;
  
  const predictEl = document.getElementById('rc-predicted-games');
  if (predictEl && window.gamesPlayedThisSession > 2 && elapsed > 10) {
    const prediction = calculateAdvancedPrediction();
    if (prediction) {
      predictEl.textContent = prediction;
    }
  } else if (predictEl) {
    predictEl.textContent = '-';
  }
}

function incrementGamesPlayed() {
  const now = Date.now();
  if (window.lastGameStartTime) {
    const gameDuration = now - window.lastGameStartTime;
    window.gameTimes.push(gameDuration);
    if (window.gameTimes.length > 20) window.gameTimes.shift();
    
    window.totalGameTime += gameDuration;
    window.gamesPlayedTotal++;
    if (gameDuration < window.minGameTime) window.minGameTime = gameDuration;
    if (gameDuration > window.maxGameTime) window.maxGameTime = gameDuration;
    
    if (window.emaGameTime === null) {
      window.emaGameTime = gameDuration;
    } else {
      window.emaGameTime = window.emaAlpha * gameDuration + (1 - window.emaAlpha) * window.emaGameTime;
    }
  }
  window.lastGameStartTime = now;
  window.gamesPlayedThisSession++;
  const countEl = document.getElementById('rc-games-count');
  if (countEl) countEl.textContent = window.gamesPlayedThisSession;
  saveSessionState();
}

function calculateAdvancedPrediction() {
  if (window.gameTimes.length < 2) return null;
  
  const n = window.gameTimes.length;
  const sum = window.gameTimes.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const squaredDiffs = window.gameTimes.map(t => Math.pow(t - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / n;
  const stdDev = Math.sqrt(variance);
  
  const useEMA = window.emaGameTime !== null;
  const avgTimeMs = useEMA ? window.emaGameTime : mean;
  const avgTimeSec = avgTimeMs / 1000;
  
  const oneHourSec = 3600;
  const basePrediction = Math.floor(oneHourSec / avgTimeSec);
  
  if (window.breakReminderEnabled && !window.isOnBreak) {
    const cycleTimeMin = window.breakSessionMinutes + window.breakDurationMinutes;
    const cyclesPerHour = 60 / cycleTimeMin;
    const breakTimePerHour = cyclesPerHour * window.breakDurationMinutes;
    const effectiveTime = oneHourSec - (breakTimePerHour * 60);
    const adjustedPrediction = Math.floor(effectiveTime / avgTimeSec);
    return `~${adjustedPrediction}-${basePrediction} oyun`;
  }
  
  const cv = stdDev / mean;
  if (cv > 0.5 && n >= 5) {
    const minPredSec = (mean + stdDev) / 1000;
    const maxPredSec = Math.max(mean - stdDev, 100) / 1000;
    const minPred = Math.floor(oneHourSec / minPredSec);
    const maxPred = Math.floor(oneHourSec / maxPredSec);
    return `~${minPred}-${maxPred} oyun`;
  }
  
  return `~${basePrediction} oyun`;
}

function updateBreakStatusDisplay() {
  const statusEl = document.getElementById('rc-break-status-text');
  const statusRow = document.getElementById('rc-break-status');
  if (!statusEl || !statusRow) return;
  
  if (!window.breakReminderEnabled) {
    statusRow.style.display = 'none';
    return;
  }
  
  statusRow.style.display = 'flex';
  
  if (window.isOnBreak) {
    const remaining = Math.max(0, window.nextBreakTime - Date.now());
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    statusEl.textContent = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
  } else if (window.autoPlayActive && window.breakCycleStartTime) {
    const elapsedMs = Date.now() - window.breakCycleStartTime;
    const elapsedMinutes = elapsedMs / 60000;
    const remaining = Math.max(0, window.breakSessionMinutes - elapsedMinutes);
    const mins = Math.floor(remaining);
    const secs = Math.floor((remaining % 1) * 60);
    if (mins > 0) {
      statusEl.textContent = mins + 'd ' + secs + 'sn';
    } else {
      statusEl.textContent = secs + 'sn';
    }
  } else {
    statusEl.textContent = '-';
  }
}

function startBreakChecker() {
  if (breakCheckTimer) clearInterval(breakCheckTimer);
  if (!window.breakCycleStartTime) {
    window.breakCycleStartTime = Date.now();
    saveSessionState();
  }
  breakCheckTimer = setInterval(() => {
    if (!window.breakReminderEnabled || !window.breakCycleStartTime) return;
    if (!window.autoPlayActive) return;
    updateBreakStatusDisplay();
    
    if (window.isOnBreak && window.nextBreakTime && Date.now() >= window.nextBreakTime) {
      endBreak();
      return;
    }
    
    if (window.isOnBreak) return;
    
    const elapsedMinutes = (Date.now() - window.breakCycleStartTime) / 60000;
    const breakDuration = window.breakDurationMinutes * 60 * 1000;
    
    if (!window.nextBreakTime && elapsedMinutes >= window.breakSessionMinutes) {
      window.isOnBreak = true;
      window.nextBreakTime = Date.now() + breakDuration;
      saveSessionState();
      showBreakBanner();
    }
  }, 1000);
}

function showBreakBanner() {
  playSound('breakOn');
  updateBreakStatusDisplay();
  
  const banner = document.createElement('div');
  banner.id = 'rc-break-banner';
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(13,15,26,0.97);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 2147483647;
    font-family: 'Inter', system-ui, sans-serif;
    color: #fff;
  `;
  banner.innerHTML = `
    <div style="text-align:center; max-width:360px;">
      <div style="width:56px; height:56px; background:rgba(255,61,107,0.12); border:1px solid rgba(255,61,107,0.3); border-radius:16px; display:flex; align-items:center; justify-content:center; margin:0 auto 20px;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF3D6B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 0 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>
      </div>
      <div style="font-size:22px; font-weight:700; color:#fff; letter-spacing:-0.3px; margin-bottom:8px;">Mola Zamanı</div>
      <div style="font-size:13px; color:#4A5568; margin-bottom:32px;">10 dakika çalıştın — 2.5 dakika dinlen.</div>
      <div style="font-size:52px; font-weight:700; color:#FF3D6B; font-variant-numeric:tabular-nums; letter-spacing:-1px; margin-bottom:36px;" id="rc-break-timer">02:30</div>
      <button id="rc-end-break-btn" style="
        background: #FF3D6B;
        color: #fff;
        border: none;
        border-radius: 10px;
        padding: 12px 28px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        font-family: 'Inter', system-ui, sans-serif;
        letter-spacing: 0.2px;
        transition: filter 0.15s;
      " onmouseover="this.style.filter='brightness(1.1)'" onmouseout="this.style.filter='none'">Molayı Bitir</button>
    </div>
  `;
  document.body.appendChild(banner);
  
  let breakTimerInterval = null;
  breakTimerInterval = setInterval(() => {
    const remaining = window.nextBreakTime - Date.now();
    const timerEl = document.getElementById('rc-break-timer');
    if (remaining <= 0) {
      if (timerEl) timerEl.textContent = '00:00';
      clearInterval(breakTimerInterval);
      endBreak();
      return;
    }
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    if (timerEl) {
      timerEl.textContent = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
    }
  }, 1000);
  
  const endBtn = document.getElementById('rc-end-break-btn');
  if (endBtn) {
    endBtn.onclick = () => {
      if (breakTimerInterval) clearInterval(breakTimerInterval);
      endBreak();
    };
  }
}

function endBreak() {
  playSound('breakOff');
  window.isOnBreak = false;
  const banner = document.getElementById('rc-break-banner');
  if (banner) banner.remove();
  const breakStatusRow = document.getElementById('rc-break-status');
  if (breakStatusRow) breakStatusRow.style.display = 'none';
  window.nextBreakTime = null;
  if (breakCheckTimer) clearInterval(breakCheckTimer);
  breakCheckTimer = null;
  window.breakCycleStartTime = Date.now();
  saveSessionState();
  if (window.autoPlayActive) {
    startBreakChecker();
  }
}

function createFloatButton() {
  if (document.getElementById('rc-float-widget')) return;

  const fontLink = document.createElement('link');
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
  fontLink.rel = 'stylesheet';
  document.head.appendChild(fontLink);

  const style = document.createElement('style');
  style.textContent = `
    #rc-float-widget, #rc-float-widget * { box-sizing: border-box; font-family: 'Inter', system-ui, sans-serif !important; }
    #rc-float-widget { --rc-accent: #FF3D6B; --rc-bg: #0D0F1A; --rc-card: #141728; --rc-border: #1E2545; --rc-muted: #4A5568; }
    .rc-btn { transition: filter 0.15s, transform 0.1s; cursor: pointer; border: none; }
    .rc-btn:hover { filter: brightness(1.12); }
    .rc-btn:active { transform: scale(0.97); }
    #rc-float-show { transition: opacity 0.2s, transform 0.2s; }
    #rc-float-show:hover { opacity: 1 !important; transform: scale(1.05); }
    #rc-skipped-info::-webkit-scrollbar { width: 3px; }
    #rc-skipped-info::-webkit-scrollbar-thumb { background: #1E2545; border-radius: 2px; }
  `;
  document.head.appendChild(style);

  const ICON = {
    vol:    `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`,
    mute:   `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`,
    bolt:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
    skip:   `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>`,
    ban:    `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`,
    hide:   `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    clock:  `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    play:   `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
    coffee: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 0 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>`,
    trend:  `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>`,
  };

  const wrapper = document.createElement('div');
  wrapper.id = 'rc-float-widget';
  wrapper.style.cssText = `
    position: fixed;
    top: 16px;
    left: 16px;
    z-index: 2147483647;
    display: flex;
    flex-direction: column;
    gap: 6px;
    background: #0D0F1A;
    border: 1px solid #1E2545;
    border-radius: 14px;
    padding: 12px 14px;
    width: 200px;
    box-shadow: 0 12px 40px rgba(0,0,0,0.5);
  `;

  /* ── Header ── */
  const header = document.createElement('div');
  header.style.cssText = 'display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;';

  const headerLeft = document.createElement('div');
  headerLeft.style.cssText = 'display:flex; align-items:center; gap:7px;';

  const logoBox = document.createElement('div');
  logoBox.style.cssText = 'width:26px; height:26px; background:linear-gradient(135deg,#FF3D6B,#C42B52); border-radius:7px; display:flex; align-items:center; justify-content:center; color:#fff; flex-shrink:0;';
  logoBox.innerHTML = ICON.bolt;

  const titleBox = document.createElement('div');
  const titleEl = document.createElement('div');
  titleEl.style.cssText = 'font-size:12px; font-weight:700; color:#fff; line-height:1.2;';
  titleEl.textContent = 'RC Helper';
  const subEl = document.createElement('div');
  subEl.style.cssText = 'font-size:9px; color:#4A5568; line-height:1.2; letter-spacing:0.3px;';
  subEl.textContent = 'rollercoin.com';
  titleBox.appendChild(titleEl);
  titleBox.appendChild(subEl);

  headerLeft.appendChild(logoBox);
  headerLeft.appendChild(titleBox);
  header.appendChild(headerLeft);

  const headerBtns = document.createElement('div');
  headerBtns.style.cssText = 'display:flex; align-items:center; gap:4px; flex-shrink:0;';

  let soundEnabled = true;

  const soundBtn = document.createElement('button');
  soundBtn.className = 'rc-btn';
  soundBtn.title = 'Ses Aç/Kapat';
  soundBtn.innerHTML = ICON.vol;
  soundBtn.style.cssText = 'background:#141728; border:1px solid #1E2545; color:#34D399; border-radius:6px; padding:5px; display:flex; align-items:center; justify-content:center; flex-shrink:0;';
  soundBtn.onclick = () => {
    const ctx = _getRCAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    soundEnabled = !soundEnabled;
    window._rcSoundEnabled = soundEnabled;
    chrome.storage.local.set({ rcSoundEnabled: soundEnabled });
    soundBtn.innerHTML = soundEnabled ? ICON.vol : ICON.mute;
    soundBtn.style.color = soundEnabled ? '#34D399' : '#4A5568';
    if (soundEnabled) playSound('autoOn');
  };

  chrome.storage.local.get(['rcSoundEnabled'], (d) => {
    soundEnabled = d.rcSoundEnabled !== false;
    window._rcSoundEnabled = soundEnabled;
    soundBtn.innerHTML = soundEnabled ? ICON.vol : ICON.mute;
    soundBtn.style.color = soundEnabled ? '#34D399' : '#4A5568';
  });

  const hideBtn = document.createElement('button');
  hideBtn.className = 'rc-btn';
  hideBtn.title = 'Gizle';
  hideBtn.innerHTML = ICON.hide;
  hideBtn.style.cssText = 'background:#141728; border:1px solid #1E2545; color:#4A5568; border-radius:6px; padding:5px; display:flex; align-items:center; justify-content:center; flex-shrink:0;';
  hideBtn.onclick = () => { playSound('toggle'); wrapper.style.display = 'none'; showBtn.style.display = 'flex'; };

  headerBtns.appendChild(soundBtn);
  headerBtns.appendChild(hideBtn);
  header.appendChild(headerBtns);
  wrapper.appendChild(header);

  /* ── Divider ── */
  const div1 = document.createElement('div');
  div1.style.cssText = 'height:1px; background:#1E2545; margin: 2px 0;';
  wrapper.appendChild(div1);

  /* ── Stats card ── */
  const statsCard = document.createElement('div');
  statsCard.style.cssText = 'background:#141728; border-radius:9px; padding:8px 10px; display:flex; justify-content:space-between;';
  statsCard.innerHTML = `
    <div>
      <div style="display:flex; align-items:center; gap:4px; color:#4A5568; font-size:9px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:3px;">${ICON.play} Oyun</div>
      <div id="rc-games-count" style="font-size:18px; font-weight:700; color:#FF3D6B; line-height:1;">0</div>
    </div>
    <div style="text-align:right;">
      <div style="display:flex; align-items:center; justify-content:flex-end; gap:4px; color:#4A5568; font-size:9px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:3px;">${ICON.clock} Süre</div>
      <div id="rc-game-timer" style="font-size:18px; font-weight:700; color:#60A5FA; line-height:1; font-variant-numeric:tabular-nums;">00:00</div>
    </div>
  `;
  wrapper.appendChild(statsCard);

  /* ── Şu an oynanıyor kartı (gizli başlar) ── */
  const nowPlayingCard = document.createElement('div');
  nowPlayingCard.id = 'rc-now-playing';
  nowPlayingCard.style.cssText = 'display:none; background:rgba(255,61,107,0.08); border:1px solid rgba(255,61,107,0.22); border-radius:9px; padding:7px 10px;';
  nowPlayingCard.innerHTML = `
    <div style="display:flex; align-items:center; gap:4px; color:#FF3D6B; font-size:9px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:3px;">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      Şu An Oynanıyor
    </div>
    <div id="rc-now-playing-name" style="font-size:11px; font-weight:600; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">—</div>
  `;
  wrapper.appendChild(nowPlayingCard);

  /* ── Prediction ── */
  const predictCard = document.createElement('div');
  predictCard.style.cssText = 'background:#141728; border-radius:9px; padding:7px 10px; display:flex; align-items:center; justify-content:space-between;';
  predictCard.innerHTML = `
    <div style="display:flex; align-items:center; gap:4px; color:#4A5568; font-size:9px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">${ICON.trend} 1 saatte</div>
    <div id="rc-predicted-games" style="font-size:12px; font-weight:600; color:#34D399;">—</div>
  `;
  wrapper.appendChild(predictCard);

  /* ── Break status (gizli) ── */
  const breakStatusRow = document.createElement('div');
  breakStatusRow.id = 'rc-break-status';
  breakStatusRow.style.cssText = 'display:none; background:rgba(255,61,107,0.1); border:1px solid rgba(255,61,107,0.25); border-radius:9px; padding:7px 10px; align-items:center; justify-content:space-between;';
  breakStatusRow.innerHTML = `
    <div style="display:flex; align-items:center; gap:4px; color:#FF3D6B; font-size:9px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">${ICON.coffee} Mola</div>
    <div id="rc-break-status-text" style="font-size:12px; font-weight:600; color:#FF3D6B; font-variant-numeric:tabular-nums;">—</div>
  `;
  wrapper.appendChild(breakStatusRow);

  /* ── Kısayol ipucu ── */
  const shortcuts = document.createElement('div');
  shortcuts.style.cssText = 'display:flex; gap:8px; padding:0 2px;';
  shortcuts.innerHTML = `
    <span style="font-size:9px; color:#4A5568;"><span style="color:#FF3D6B; font-weight:600;">S</span> pas geç</span>
    <span style="font-size:9px; color:#4A5568;"><span style="color:#FF3D6B; font-weight:600;">P</span> daima atla</span>
  `;
  wrapper.appendChild(shortcuts);

  /* ── Action buttons ── */
  const btnGroup = document.createElement('div');
  btnGroup.style.cssText = 'display:flex; gap:6px; margin-top:2px;';

  const skipBtn = document.createElement('button');
  skipBtn.className = 'rc-btn';
  skipBtn.title = 'Pas Geç (S)';
  skipBtn.innerHTML = `<span style="display:flex; align-items:center; gap:5px;">${ICON.skip} Pas Geç</span>`;
  skipBtn.style.cssText = 'flex:1; background:#FF3D6B; color:#fff; border-radius:8px; padding:8px 10px; font-size:11px; font-weight:600; display:flex; align-items:center; justify-content:center;';
  skipBtn.onclick = () => skipToChooseGame();

  const permBtn = document.createElement('button');
  permBtn.className = 'rc-btn';
  permBtn.title = 'Daima Atla (P)';
  permBtn.innerHTML = `<span style="display:flex; align-items:center; gap:4px;">${ICON.ban} Daima</span>`;
  permBtn.style.cssText = 'background:#141728; border:1px solid #1E2545; color:#60A5FA; border-radius:8px; padding:8px 10px; font-size:11px; font-weight:600; display:flex; align-items:center; justify-content:center;';
  permBtn.onclick = () => skipGamePermanent();

  btnGroup.appendChild(skipBtn);
  btnGroup.appendChild(permBtn);
  wrapper.appendChild(btnGroup);

  /* ── Skipped list ── */
  const skippedInfo = document.createElement('div');
  skippedInfo.id = 'rc-skipped-info';
  skippedInfo.style.cssText = 'display:none; font-size:10px; color:#4A5568; background:#141728; border-radius:8px; padding:7px 10px; max-height:72px; overflow-y:auto;';
  wrapper.appendChild(skippedInfo);

  /* ── Global rc-btn click sound via delegation ── */
  wrapper.addEventListener('click', (e) => {
    const btn = e.target.closest('.rc-btn');
    if (!btn) return;
    const t = btn.title || '';
    if (t === 'Pas Geç (S)' || t === 'Daima Atla (P)') return; // handled separately
    if (t === 'Ses Aç/Kapat') return; // handled in soundBtn.onclick
    playSound('click');
  }, true);

  document.body.appendChild(wrapper);

  /* ── Collapsed button ── */
  const showBtn = document.createElement('button');
  showBtn.id = 'rc-float-show';
  showBtn.title = 'RC Helper';
  showBtn.innerHTML = ICON.bolt;
  showBtn.style.cssText = `
    position: fixed; top: 16px; left: 16px; z-index: 2147483647;
    width: 36px; height: 36px;
    background: #0D0F1A; border: 1px solid #1E2545;
    color: #FF3D6B; border-radius: 10px;
    display: none; align-items: center; justify-content: center;
    cursor: pointer; opacity: 0.85;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  `;
  showBtn.onclick = () => { playSound('toggle'); setFloatVisible(true); };
  document.body.appendChild(showBtn);

  chrome.storage.local.get(['skippedGames'], (data) => {
    if (data.skippedGames) window.skippedGames = data.skippedGames;
    updateSkippedDisplay();
  });

  setInterval(updateSkippedDisplay, 10000);
  createStatusWidget();
}

function createStatusWidget() {
  if (document.getElementById('rc-status-widget')) return;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes rcFadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
    #rc-status-widget, #rc-status-widget * { box-sizing:border-box; font-family:'Inter',system-ui,sans-serif !important; }
    #rc-log-container::-webkit-scrollbar { width:3px; }
    #rc-log-container::-webkit-scrollbar-thumb { background:#1E2545; border-radius:2px; }
    #rc-log-show { transition: opacity 0.2s, transform 0.2s; }
    #rc-log-show:hover { opacity:1 !important; transform:scale(1.05); }
  `;
  document.head.appendChild(style);

  const ICON_LIST = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`;
  const ICON_X = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  const ICON_CTRL = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;

  const wrapper = document.createElement('div');
  wrapper.id = 'rc-status-widget';
  wrapper.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 2147483647;
    width: 280px;
  `;

  const logContainer = document.createElement('div');
  logContainer.id = 'rc-log-container';
  logContainer.style.cssText = `
    position: relative;
    background: #0D0F1A;
    border: 1px solid #1E2545;
    border-radius: 12px;
    overflow: hidden;
  `;

  /* top bar */
  const topBar = document.createElement('div');
  topBar.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:8px 12px; border-bottom:1px solid #1E2545;';
  topBar.innerHTML = `
    <div style="display:flex; align-items:center; gap:6px; color:#4A5568; font-size:9px; font-weight:600; letter-spacing:0.5px; text-transform:uppercase;">${ICON_CTRL} Şu an oynanan</div>
  `;

  const closeBtnStatus = document.createElement('button');
  closeBtnStatus.innerHTML = ICON_X;
  closeBtnStatus.style.cssText = 'background:transparent; border:none; color:#4A5568; cursor:pointer; display:flex; align-items:center; padding:2px; border-radius:4px; transition:color 0.15s;';
  closeBtnStatus.onmouseover = () => closeBtnStatus.style.color = '#FF3D6B';
  closeBtnStatus.onmouseout  = () => closeBtnStatus.style.color = '#4A5568';
  closeBtnStatus.onclick = () => {
    wrapper.style.display = 'none';
    showBtnStatus.style.display = 'flex';
  };
  topBar.appendChild(closeBtnStatus);
  logContainer.appendChild(topBar);

  /* current game */
  const currentGameRow = document.createElement('div');
  currentGameRow.style.cssText = 'padding:8px 12px 10px;';
  currentGameRow.innerHTML = `<div id="rc-current-game" style="font-size:12px; font-weight:600; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">—</div>`;
  logContainer.appendChild(currentGameRow);

  wrapper.appendChild(logContainer);
  document.body.appendChild(wrapper);

  /* collapsed pill */
  const showBtnStatus = document.createElement('button');
  showBtnStatus.id = 'rc-log-show';
  showBtnStatus.innerHTML = ICON_LIST;
  showBtnStatus.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 2147483647;
    width: 34px; height: 34px;
    background: #0D0F1A;
    border: 1px solid #1E2545;
    border-radius: 9px;
    color: #FF3D6B;
    display: none;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    opacity: 0.85;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  `;
  showBtnStatus.onclick = () => {
    wrapper.style.display = 'block';
    showBtnStatus.style.display = 'none';
  };
  document.body.appendChild(showBtnStatus);

  window.updateRCStatus = function(logMessage) {
    const gameEl = document.getElementById('rc-current-game');
    if (!gameEl) return;
    const lastGameText = gameEl.textContent || '';

    const match = logMessage.match(/SEÇİLEN OYUN:\s*(.+?)(?:\s*===)?$/);
    if (match) {
      const gameName = match[1].trim();
      if (lastGameText !== gameName) gameEl.textContent = gameName;
      return;
    }

    const oynaniyorMatch = logMessage.match(/OYNANIYOR:\s*(.+?)$/);
    if (oynaniyorMatch) {
      const gameName = oynaniyorMatch[1].trim();
      if (lastGameText !== gameName) gameEl.textContent = gameName;
    }
  };
}

function setFloatVisible(val) {
  const w = document.getElementById('rc-float-widget');
  const s = document.getElementById('rc-float-show');
  if (w) w.style.display = val ? 'flex' : 'none';
  if (s) s.style.display = val ? 'none' : 'block';
}

function updateSkippedDisplay() {
  const infoEl = document.getElementById('rc-skipped-info');
  if (!infoEl) return;

  const now = Date.now();
  const skipDuration = 10 * 60 * 1000;
  const items = [];

  for (const key in window.skippedGames) {
    const remaining = Math.ceil((skipDuration - (now - window.skippedGames[key])) / 60000);
    if (remaining > 0) {
      items.push({ name: key, label: key + ' (' + remaining + 'dk)' });
    } else {
      delete window.skippedGames[key];
    }
  }

  const permanentGames = Object.keys(window.permanentSkippedGames);
  if (permanentGames.length > 0) {
    items.push({ name: null, label: '\u267e\ufe0f ' + permanentGames.join(', ') });
  }

  if (items.length > 0) {
    infoEl.style.display = 'block';
    while (infoEl.firstChild) infoEl.removeChild(infoEl.firstChild);
    const header = document.createTextNode('\u23f8 Pas');
    infoEl.appendChild(header);
    const wrap = document.createElement('div');
    wrap.style.marginTop = '4px';
    items.forEach(item => {
      const d = document.createElement('div');
      d.textContent = item.label;
      wrap.appendChild(d);
    });
    infoEl.appendChild(wrap);
  } else {
    infoEl.style.display = 'none';
  }
}

document.addEventListener('keydown', (e) => {
  if (e.code === 'KeyS' && !e.ctrlKey && !e.altKey && !e.metaKey) {
    skipToChooseGame();
  }
  else if (e.code === 'KeyP' && !e.ctrlKey && !e.altKey && !e.metaKey) {
    skipGamePermanent();
  }
});

function skipToChooseGame() {
  playSound('skip');
  console.log('[RC] === PAS GEÇME BAŞLADI ===');
  console.log('[RC] lastSelectedGame:', window.lastSelectedGame);
  console.log('[RC] skippedGames:', window.skippedGames);
  
  const gameToSkip = window.lastSelectedGame;
  
  if (gameToSkip) {
    window.skippedGames[gameToSkip] = Date.now();
    chrome.storage.local.set({ skippedGames: window.skippedGames });
    console.log('[RC] ✓ Oyun pas geçildi:', gameToSkip, '- 10 dakika boyunca atlanacak');
    if (window.updateRCStatus) window.updateRCStatus('[RC] ✓ Oyun pas geçildi: ' + gameToSkip + ' - 10 dakika boyunca atlanacak');
    console.log('[RC] Güncel skippedGames:', window.skippedGames);
    updateSkippedDisplay();
  } else {
    console.log('[RC] ⚠ lastSelectedGame bulunamadı, pas geçilemedi!');
  }
  
  console.log('[RC] 1.5 saniye bekleniyor...');
  setTimeout(() => {
    window.gameSelectionInProgress = false;
    console.log('[RC] Yönlendiriliyor...');
    window.location.assign('https://rollercoin.com/game/choose_game');
  }, 1500);
}

function skipGamePermanent() {
  playSound('permSkip');
  console.log('[RC] === SONSUZ PAS GEÇME BAŞLADI ===');
  console.log('[RC] lastSelectedGame:', window.lastSelectedGame);
  
  const gameToSkip = window.lastSelectedGame;
  
  if (gameToSkip) {
    window.permanentSkippedGames[gameToSkip] = true;
    chrome.storage.local.set({ permanentSkippedGames: window.permanentSkippedGames });
    console.log('[RC] ✓ Oyun sonsuza kadar pas geçildi:', gameToSkip);
    if (window.updateRCStatus) window.updateRCStatus('[RC] ✓ Oyun sonsuza kadar pas geçildi: ' + gameToSkip);
    console.log('[RC] Güncel permanentSkippedGames:', window.permanentSkippedGames);
    updateSkippedDisplay();
  } else {
    console.log('[RC] ⚠ lastSelectedGame bulunamadı!');
  }
  
  console.log('[RC] 1.5 saniye bekleniyor...');
  setTimeout(() => {
    window.gameSelectionInProgress = false;
    console.log('[RC] Yönlendiriliyor...');
    window.location.assign('https://rollercoin.com/game/choose_game');
  }, 2000);
}

function isOnChooseGamePage() {
  const url = window.location.href;
  const hasChooseInUrl = url.includes('/choose_game');
  const hasChooseGameElement = document.querySelector('.choose-game-page, [class*="choose-game"]');
  const hasChooseInH1 = document.querySelector('h1')?.innerText?.toLowerCase().includes('choose');
  return hasChooseInUrl || (hasChooseGameElement && hasChooseInH1);
}

function isOnPlayGamePage() {
  const url = window.location.href;
  const isPlayGame = url.includes('/play_game') || document.querySelector('.game-page, .game-container, [class*="play-game"]');
  
  if (isPlayGame && window.updateRCStatus) {
    const gameTitle = document.querySelector('h1, [class*="game-title"], [class*="game-name"], .game-name, .game-page h2');
    if (gameTitle && gameTitle.innerText.trim()) {
      const currentGame = gameTitle.innerText.trim().substring(0, 40);
      if (currentGame && currentGame !== window.currentPlayingGame && !window.gameSelectionInProgress) {
        window.currentPlayingGame = currentGame;
        window.updateRCStatus('[RC] 🎮 OYNANIYOR: ' + currentGame);
      }
    }
  }
  
  return isPlayGame;
}

const BADGE_WORDS = new Set(['new', 'hot', 'soon', 'coming soon', 'wait', 'beta', 'free']);

function isValidGameName(text) {
  if (!text) return false;
  const t = text.trim().toLowerCase();
  return t.length > 1 && !BADGE_WORDS.has(t);
}

function getGameName(item) {
  const dataName = item.getAttribute('data-game-name') || item.getAttribute('data-name') || item.getAttribute('data-title');
  if (dataName && isValidGameName(dataName)) {
    return dataName.trim().substring(0, 40);
  }
  
  const nameSelectors = [
    '[class*="game-name"]',
    '[class*="gameName"]',
    '[class*="item-name"]',
    '[class*="itemName"]',
    '.game-card-title',
    '.game-title',
    '[class*="game-title"]',
    'h3',
    'h4',
    '[class*="title"]',
    '[class*="Name"]',
    '.name',
  ];
  
  for (const selector of nameSelectors) {
    const nameEl = item.querySelector(selector);
    const text = nameEl?.innerText?.trim();
    if (isValidGameName(text)) {
      return text.substring(0, 40);
    }
  }
  
  const allText = item.innerText.trim();
  const lines = allText.split(/[\n\r]+/).map(l => l.trim()).filter(isValidGameName);
  if (lines.length > 0) {
    return lines[0].substring(0, 40);
  }
  
  return 'Game-' + Date.now();
}

function pickAndPlay() {
  if (window.gameSelectionInProgress) {
    console.log('[RC] Oyun seçimi yapılıyor, atlanıyor');
    return;
  }
  
  if (window.pickAndPlayRunning) {
    console.log('[RC] pickAndPlay çalışıyor, atlanıyor');
    return;
  }
  
  if (isOnPlayGamePage()) {
    return;
  }
  
  if (!isOnChooseGamePage()) {
    return;
  }
  
  window.pickAndPlayRunning = true;
  
  const now = Date.now();
  const skipDuration = 10 * 60 * 1000;
  let hasChanges = false;
  Object.keys(window.skippedGames).forEach(key => {
    if (now - window.skippedGames[key] > skipDuration) {
      delete window.skippedGames[key];
      hasChanges = true;
    }
  });
  if (hasChanges) {
    chrome.storage.local.set({ skippedGames: window.skippedGames });
  }
  
  const items = Array.from(document.querySelectorAll('.choose-game-item-container, .choose-game-item, .game-item:not(.winning-game-item), div[class*="choose-game-item"]:not(.winning-game-item)'));
  if (items.length === 0) {
    window.pickAndPlayRunning = false;
    setTimeout(() => {
      if (!window.gameSelectionInProgress && window.autoPlayActive) pickAndPlay();
    }, 1500);
    return;
  }
  
  const validItems = items.filter(item => {
    const gameName = getGameName(item);
    const isSkipped = window.skippedGames[gameName] || window.permanentSkippedGames[gameName];
    const isComingSoon = gameName.toLowerCase().includes('coming soon');
    
    const btn = item.querySelector('button, a, [class*="btn"], [role="button"]');
    const btnText = btn?.innerText || btn?.textContent || '';
    const isWait = btn && (btn.disabled || btnText.toUpperCase().includes('WAIT'));
    
    return !isSkipped && !isComingSoon && !isWait;
  });
  
  console.log('[RC] Bulunan:', items.length, '| Pas geçilen:', Object.keys(window.skippedGames), '| Permanent:', Object.keys(window.permanentSkippedGames), '| Geçerli:', validItems.length);
  
  if (validItems.length === 0) {
    console.log('[RC] ⚠ Tüm oyunlar wait veya pas geçilmiş, oyun seçilmiyor');
    window.pickAndPlayRunning = false;
    setTimeout(() => {
      if (!window.gameSelectionInProgress && window.autoPlayActive) {
        pickAndPlay();
      }
    }, 5000);
    return;
  }
  
  if (!window.recentGames) window.recentGames = [];
  const historySize = Math.max(1, Math.floor(validItems.length / 2));
  const filteredValidItems = validItems.filter(item => {
    const name = getGameName(item);
    return !window.recentGames.includes(name);
  });
  const finalItems = filteredValidItems.length > 0 ? filteredValidItems : validItems;
  
  console.log('[RC] Son oynanlar:', window.recentGames, '| Filtrelenmiş:', filteredValidItems.length, '| Son:', finalItems.length);
  
  if (finalItems.length === 0) {
    console.log('[RC] ⚠ Tüm oyunlar wait veya pas geçilmiş, bekleniyor...');
    window.pickAndPlayRunning = false;
    setTimeout(() => {
      if (!window.gameSelectionInProgress && window.autoPlayActive) {
        pickAndPlay();
      }
    }, 5000);
    return;
  }
  
  const selected = finalItems[Math.floor(Math.random() * finalItems.length)];
  const selectedGameName = getGameName(selected);
  window.lastPlayedGameName = selectedGameName;
  window.recentGames.push(selectedGameName);
  if (window.recentGames.length > historySize) window.recentGames.shift();
  
  const btn = selected.querySelector('button, a, [class*="btn"], [role="button"]');
  const btnText = btn?.innerText || btn?.textContent || '';
  
  window.lastSelectedGame = selectedGameName;
  playSound('select');
  console.log('[RC] === SEÇİLEN OYUN:', selectedGameName, '===');
  if (window.updateRCStatus) window.updateRCStatus('[RC] === SEÇİLEN OYUN: ' + selectedGameName + ' ===');
  
  if (btn && !btn.disabled) {
    window.gameSelectionInProgress = true;
    window.currentPlayingGame = selectedGameName;
    window.pendingGameClick = { name: selectedGameName, clickedAt: Date.now() };
    console.log('[RC] Butona tıklanıyor:', btnText);
    btn.click();
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    if (window.updateRCStatus) {
      window.updateRCStatus('[RC] 🎮 OYNANIYOR: ' + selectedGameName);
    }
    const urlAtClick = window.location.href;

    // Fallback: 1.5s sonra URL değişmediyse item'a tıklama dene
    setTimeout(() => {
      if (window.location.href === urlAtClick && window.gameSelectionInProgress) {
        console.log('[RC] İlk tıklama başarısız, item tıklanıyor...');
        try {
          selected.click();
          selected.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
          btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
        } catch(e) {}
      }
    }, 1500);

    window.pickAndPlayRunning = false;
    setTimeout(() => {
      if (window.location.href === urlAtClick && window.gameSelectionInProgress) {
        console.log('[RC] ⚠ Sayfa geçişi olmadı, oyun açılamadı (sayım YAPILMADI):', selectedGameName);
        // Açılamadı: sayma da yapma, kısa süreliğine pas geçilenler listesine ekleme yapmadan reset
        window.pendingGameClick = null;
        window.gameSelectionInProgress = false;
        window.pickAndPlayRunning = false;
      } else {
        // URL değişti → gerçek oyun başladı; transition watcher devreye girecek
        window.gameSelectionInProgress = false;
      }
    }, 4000);
  } else {
    window.pickAndPlayRunning = false;
  }
}

/* ── Oyun başlangıç/bitiş URL geçişi izleyici ── */
function checkGameTransitions() {
  const nowPlaying = isOnPlayGamePage();
  const wasPlaying = window._lastWasPlaying === true;

  if (!wasPlaying && nowPlaying) {
    // /choose_game → /play_game: oyun gerçekten başladı
    const name = (window.pendingGameClick && window.pendingGameClick.name)
      || window.lastSelectedGame
      || window.currentPlayingGame
      || 'Unknown';
    window._activeGame = { name: name, startedAt: Date.now() };
    window.lastGameStartTime = Date.now();
    if (!window.sessionStartTime) window.sessionStartTime = Date.now();
    startGameTimer();
    window.pendingGameClick = null;
    updatePlayingIndicator(name);
    console.log('[RC] ✓ Oyun başladı:', name, '(sayaç oyun bitince artacak)');
  } else if (wasPlaying && !nowPlaying) {
    // /play_game → ayrıldı: oyun BITTI → şimdi say
    if (window._activeGame) {
      const dur = Date.now() - window._activeGame.startedAt;

      // EMA ve gameTimes güncelle (tahmin için)
      window.gameTimes.push(dur);
      if (window.gameTimes.length > 20) window.gameTimes.shift();
      window.totalGameTime += dur;
      window.gamesPlayedTotal++;
      if (dur < window.minGameTime) window.minGameTime = dur;
      if (dur > window.maxGameTime) window.maxGameTime = dur;
      if (window.emaGameTime === null) {
        window.emaGameTime = dur;
      } else {
        window.emaGameTime = window.emaAlpha * dur + (1 - window.emaAlpha) * window.emaGameTime;
      }

      // Oturum sayacını şimdi artır
      window.gamesPlayedThisSession++;
      const countEl = document.getElementById('rc-games-count');
      if (countEl) countEl.textContent = window.gamesPlayedThisSession;

      console.log('[RC] ✓ Oyun bitti, sayaç arttı:', window._activeGame.name, '| Toplam:', window.gamesPlayedThisSession);
      recordGameCompletion(window._activeGame.name, dur);
      window._activeGame = null;
    }
    updatePlayingIndicator(null);
  }

  window._lastWasPlaying = nowPlaying;
}

function updatePlayingIndicator(name) {
  const card = document.getElementById('rc-now-playing');
  const nameEl = document.getElementById('rc-now-playing-name');
  if (!card) return;
  if (name) {
    if (nameEl) nameEl.textContent = name;
    card.style.display = 'block';
  } else {
    card.style.display = 'none';
    if (nameEl) nameEl.textContent = '—';
  }
}

function recordGameCompletion(name, durationMs) {
  // Çok kısa (3sn'den az) veya çok uzun (30dk'dan fazla) süreleri geçersiz say
  if (!name || durationMs < 3000 || durationMs > 30 * 60 * 1000) {
    console.log('[RC] Oyun süresi geçersiz, kaydedilmedi:', name, durationMs);
    return;
  }
  chrome.storage.local.get(['gameStats'], (data) => {
    const stats = data.gameStats || {
      totalGames: 0,
      totalPlayTimeMs: 0,
      perGame: {},
      dailyStats: {},
      lastGame: null,
      lastGameAt: null,
      firstGameAt: null,
      longestGameMs: 0,
    };
    stats.totalGames = (stats.totalGames || 0) + 1;
    stats.totalPlayTimeMs = (stats.totalPlayTimeMs || 0) + durationMs;
    const pg = stats.perGame[name] || { plays: 0, totalTimeMs: 0 };
    pg.plays++;
    pg.totalTimeMs += durationMs;
    stats.perGame[name] = pg;
    const today = new Date().toISOString().slice(0, 10);
    stats.dailyStats = stats.dailyStats || {};
    stats.dailyStats[today] = (stats.dailyStats[today] || 0) + 1;
    stats.lastGame = name;
    stats.lastGameAt = Date.now();
    if (!stats.firstGameAt) stats.firstGameAt = Date.now();
    if (durationMs > (stats.longestGameMs || 0)) stats.longestGameMs = durationMs;

    // 60 günden eski daily kayıtları temizle
    const cutoff = Date.now() - 60 * 24 * 60 * 60 * 1000;
    Object.keys(stats.dailyStats).forEach(d => {
      const t = new Date(d + 'T00:00:00').getTime();
      if (!isNaN(t) && t < cutoff) delete stats.dailyStats[d];
    });

    chrome.storage.local.set({ gameStats: stats });
    console.log('[RC] ✓ Oyun stats kaydedildi:', name, Math.round(durationMs/1000) + 's');
  });
}

// Her saniye URL geçişlerini kontrol et (auto-play olmasa bile, manuel oyun da sayılsın)
setTimeout(() => {
  if (!window._transitionWatcherStarted) {
    window._transitionWatcherStarted = true;
    window._lastWasPlaying = isOnPlayGamePage();
    setInterval(checkGameTransitions, 1000);
  }
}, 2000);

function startAutoPlay() {
  playSound('autoOn');
  console.log('[RC] startAutoPlay çağrıldı!');
  window.autoPlayActive = true;
  window.lastGameStartTime = null;
  if (window.breakReminderEnabled) {
    if (!window.breakCycleStartTime || (window.isOnBreak === false && !window.nextBreakTime)) {
      window.breakCycleStartTime = Date.now();
    }
    startBreakChecker();
  }
  if (mainTimer) clearInterval(mainTimer);
  mainTimer = setInterval(() => {
    if (!window.autoPlayActive) return;
    if (window.isOnBreak) return;
    if (window.gameSelectionInProgress) return;
    if (isOnPlayGamePage()) return;
    if (isOnChooseGamePage()) {
      pickAndPlay();
    }
  }, 1000);
}

function stopAutoPlay() {
  playSound('autoOff');
  window.autoPlayActive = false;
  if (mainTimer) { clearInterval(mainTimer); mainTimer = null; }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return;
  if (msg.action === 'toggleAuto') {
    window.autoPlayActive = msg.on;
    saveState();
    if (msg.on) startAutoPlay(); else stopAutoPlay();
  }
  else if (msg.action === 'skipGame') { skipToChooseGame(); }
  else if (msg.action === 'skipGamePermanent') { skipGamePermanent(); }
  else if (msg.action === 'toggleChoose') { window.autoChoose = msg.on; saveState(); }
  else if (msg.action === 'toggleCollect') { window.autoCollect = msg.on; saveState(); }
  else if (msg.action === 'toggleBreak') {
    window.breakReminderEnabled = msg.on;
    if (!msg.on) {
      window.isOnBreak = false;
      const banner = document.getElementById('rc-break-banner');
      if (banner) banner.remove();
    }
  }
  else if (msg.action === 'getAvailableGames') {
    const items = Array.from(document.querySelectorAll('.choose-game-item-container, .choose-game-item, .game-item:not(.winning-game-item), div[class*="choose-game-item"]:not(.winning-game-item)'));
    const seen = new Set();
    const games = items
      .map(item => ({ name: getGameName(item), el: item }))
      .filter(({ name, el }) => {
        if (!name || name.startsWith('Game-')) return false;
        const lname = name.toLowerCase();
        if (lname.includes('coming soon') || lname.includes('wait')) return false;
        const btn = el.querySelector('button, a, [class*="btn"], [role="button"]');
        const btnText = (btn?.innerText || btn?.textContent || '').toUpperCase();
        if (btn && (btn.disabled || btnText.includes('WAIT') || btnText.includes('SOON'))) return false;
        if (seen.has(name)) return false;
        seen.add(name);
        return true;
      })
      .map(({ name }) => name);
    sendResponse({ games: games.length > 0 ? games : null });
    return true;
  }
  else if (msg.action === 'addSkip') {
    if (msg.gameName) {
      window.skippedGames[msg.gameName] = Date.now();
      chrome.storage.local.set({ skippedGames: window.skippedGames });
      updateSkippedDisplay();
    }
    sendResponse({ ok: true });
    return true;
  }
  else if (msg.action === 'getGameStats') {
    chrome.storage.local.get(['gameStats'], (data) => {
      sendResponse({ stats: data.gameStats || null, currentGame: window._activeGame ? window._activeGame.name : null });
    });
    return true;
  }
  else if (msg.action === 'resetGameStats') {
    chrome.storage.local.set({ gameStats: null }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }
  else if (msg.action === 'addPermSkip') {
    if (msg.gameName) {
      window.permanentSkippedGames[msg.gameName] = true;
      chrome.storage.local.set({ permanentSkippedGames: window.permanentSkippedGames });
      updateSkippedDisplay();
    }
    sendResponse({ ok: true });
    return true;
  }
  sendResponse({ ok: true });
  return true;
});

setInterval(() => {
  let clicksThisRound = 0;
  if (window.autoCollect) {
    const gainPowerBtn = document.querySelector('.complete-game-button-wrapper button');
    const collectBtn = document.querySelector('.collect-button button');
    if (gainPowerBtn && gainPowerBtn.offsetParent !== null) {
      gainPowerBtn.click();
      clicksThisRound++;
    }
    if (collectBtn && collectBtn.offsetParent !== null) {
      collectBtn.click();
      clicksThisRound++;
    }
  }

  if (!clicksThisRound && !window.gameSelectionInProgress) {
    const startBtn = document.querySelector('button[class*="start"], button[class*="play"], button:not([class*="skip"]):not([class*="cancel"]):not([class*="close"])');
    if (startBtn) {
      const text = startBtn.innerText?.toUpperCase() || '';
      const isActionBtn = text.includes('START') || text.includes('PLAY') || text.includes('CLAIM');
      const style = window.getComputedStyle(startBtn);
      if (isActionBtn && startBtn.offsetParent !== null && style.display !== 'none' && style.opacity !== '0') {
        startBtn.click();
        clicksThisRound++;
      }
    }
  }

  if (window.autoChoose) {
    const chooseBtn = document.querySelector('a.btn-cyan[href="/game/choose_game"]');
    if (chooseBtn) {
      const style = window.getComputedStyle(chooseBtn);
      if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && chooseBtn.offsetParent !== null) {
        chooseBtn.click();
        clicksThisRound++;
      }
    }
  }

  if (clicksThisRound > 0) {
    console.log('[RC] Otomatik tıklandı:', clicksThisRound, 'buton');
  }
}, 2000);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      createFloatButton();
      createStatusWidget();
    }, 500);
  });
} else {
  setTimeout(() => {
    createFloatButton();
    createStatusWidget();
  }, 500);
}