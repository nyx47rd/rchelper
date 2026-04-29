console.log('RollerCoin Helper yüklendi!');

window.playedCount = 0;
window.totalReward = 0;
window.autoPlayActive = false;
window.autoChoose = false;
window.autoCollect = true;
window.failedGames = [];
window.excludeGames = [];
var autoPlayTimer = null;
var chooseTimer = null;
var waitTimer = null;
var collectTimer = null;

function getAllGames() {
  var items = document.querySelectorAll('.choose-game-item-container');
  var games = [];
  items.forEach(function(item) {
    var title = item.querySelector('.game-title');
    var rewardEl = item.querySelector('.game-reward p:last-child');
    var diffEl = item.querySelector('.game-information-block p:last-child');
    var btn = item.querySelector('.game-start-button button, .btn-cyan');
    if (title && btn) {
      var reward = parseInt((rewardEl ? rewardEl.innerText : '').replace(' pts','')) || 0;
      var difficulty = parseInt((diffEl ? diffEl.innerText : '').match(/\d+/)) || 1;
      games.push({ name: title.innerText.trim(), reward: reward, difficulty: difficulty, button: btn });
    }
  });
  return games;
}

function playGameSmart(exclude) {
  if (location.href.indexOf('/game/play_game') !== -1) return;
  var games = getAllGames();
  if (!games.length) return;
  var filtered = games;
  var allExcluded = (exclude || []).concat(window.excludeGames || []);
  if (allExcluded.length) filtered = filtered.filter(function(g){ return allExcluded.indexOf(g.name)===-1; });
  if (!filtered.length) filtered = games;
  if (!filtered.length) return;
  var selected = filtered.reduce(function(best, g) {
    var score = (g.reward / Math.max(g.difficulty, 1)) * (g.reward > 2000 ? 1.2 : 1);
    var bestScore = (best.reward / Math.max(best.difficulty, 1)) * (best.reward > 2000 ? 1.2 : 1);
    return score > bestScore ? g : best;
  });
  selected.button.click();
  window.playedCount++;
  window.totalReward += selected.reward;
  window.currentGameName = selected.name;
  if(waitTimer) clearInterval(waitTimer);
  waitTimer = setInterval(function() {
    var spans = document.querySelectorAll('span.btn-text');
    var isWait = false;
    spans.forEach(function(s){ if(s.innerText.trim()==='WAIT...') isWait=true; });
    if(isWait) {
      clearInterval(waitTimer);
      window.playedCount = Math.max(0, window.playedCount-1);
      window.totalReward = Math.max(0, window.totalReward-selected.reward);
      window.failedGames.push(selected.name);
      setTimeout(function(){ playGameSmart(exclude); }, 1000);
    }
    if(location.href.indexOf('/game/play_game')===-1) clearInterval(waitTimer);
  }, 500);
}

function playGame(minR, maxT, strat, exclude) {
  if (location.href.indexOf('/game/play_game') !== -1) return;
  var games = getAllGames();
  if (!games.length) return;
  var minReward = parseInt(minR)||0, maxDiff = parseInt(maxT)||999;
  var filtered = games.filter(function(g){ return g.reward>=minReward && g.difficulty<=maxDiff; });
  if (exclude && exclude.length) filtered = filtered.filter(function(g){ return exclude.indexOf(g.name)===-1; });
  if (!filtered.length) filtered = games;
  if (!filtered.length) return;
  var selected = filtered[0];
  if(strat==='random') selected = filtered[Math.floor(Math.random()*filtered.length)];
  else if(strat==='best-ratio') selected = filtered.reduce(function(b,g){ return (g.reward/g.difficulty)>(b.reward/b.difficulty)?g:b; });
  else if(strat==='highest-reward') selected = filtered.reduce(function(b,g){ return g.reward>b.reward?g:b; });
  else if(strat==='quickest') selected = filtered.reduce(function(b,g){ return g.difficulty<b.difficulty?g:b; });  
  selected.button.click();
  window.playedCount++;
  window.totalReward += selected.reward;
  window.currentGameName = selected.name;
  if(waitTimer) clearInterval(waitTimer);
  waitTimer = setInterval(function() {
    var spans = document.querySelectorAll('span.btn-text');
    var isWait = false;
    spans.forEach(function(s){ if(s.innerText.trim()==='WAIT...') isWait=true; });
    if(isWait) {
      clearInterval(waitTimer);
      window.playedCount = Math.max(0, window.playedCount-1);
      window.totalReward = Math.max(0, window.totalReward-selected.reward);
      window.failedGames.push(selected.name);
      setTimeout(function(){ playGame(minR,maxT,strat,window.failedGames); }, 1000);
    }
    if(location.href.indexOf('/game/play_game')===-1) clearInterval(waitTimer);
  }, 500);
}

function startAutoPlay() {
  window.autoPlayActive = true;
  window.failedGames = [];
  if(autoPlayTimer) clearInterval(autoPlayTimer);
  autoPlayTimer = setInterval(function() {
    if(!window.autoPlayActive) { clearInterval(autoPlayTimer); return; }
    if(location.href.indexOf('/game/play_game')===-1) playGameSmart(window.failedGames);
  }, 3000);
}

function stopAutoPlay() {
  window.autoPlayActive = false;
  if(autoPlayTimer) { clearInterval(autoPlayTimer); autoPlayTimer=null; }
}

function startAutoChoose() {
  window.autoChoose = true;
  if(chooseTimer) clearInterval(chooseTimer);
  chooseTimer = setInterval(function() {
    if(!window.autoChoose) { clearInterval(chooseTimer); return; }
    var btn = document.querySelector('a.btn-cyan[href="/game/choose_game"]');
    if(btn && btn.offsetParent!==null) btn.click();
  }, 2000);
}

function stopAutoChoose() {
  window.autoChoose = false;
  if(chooseTimer) { clearInterval(chooseTimer); chooseTimer=null; }
}

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  try {
    if(msg.action==='playSmart') {
      if(msg.exclude) window.excludeGames = msg.exclude;
      playGameSmart(window.failedGames);
      sendResponse({ok:true});
    } else if(msg.action==='play') {
      playGame(msg.minR, msg.maxT, msg.strat);
      sendResponse({ok:true});
    } else if(msg.action==='toggleAuto') {
      if(msg.on !== undefined) {
        if(msg.on) { window.excludeGames = msg.exclude || []; startAutoPlay(); } else stopAutoPlay();
      } else {
        if(window.autoPlayActive) stopAutoPlay(); else startAutoPlay();
      }
      sendResponse({on: window.autoPlayActive});
    } else if(msg.action==='toggleChoose') {
      if(msg.on !== undefined) {
        if(msg.on) startAutoChoose(); else stopAutoChoose();
      } else {
        if(window.autoChoose) stopAutoChoose(); else startAutoChoose();
      }
      sendResponse({on: window.autoChoose});
    } else if(msg.action==='toggleCollect') {
      if(msg.on !== undefined) window.autoCollect = msg.on;
      else window.autoCollect = !window.autoCollect;
      sendResponse({on: window.autoCollect});
    } else if(msg.action==='getGames') {
      var games = getAllGames();
      sendResponse({games: games.map(function(g){ return g.name; })});
    } else if(msg.action==='stats') {
      sendResponse({c:window.playedCount||0, r:window.totalReward||0, a:window.autoPlayActive});
    }
  } catch(e) { sendResponse({error:e.message}); }
  return true;
});

setInterval(function() {
  if(!window.autoCollect) return;
  var c = document.querySelector('.complete-game-button-wrapper button.accept-button');
  var l = document.querySelector('.collect-button button.tree-dimensional-button');
  if(c && c.offsetParent!==null && !c.dataset.c) { c.dataset.c='1'; setTimeout(function(){c.click();},100); }
  if(l && l.offsetParent!==null && !l.dataset.c) { l.dataset.c='1'; setTimeout(function(){l.click();},100); }
}, 1000);
