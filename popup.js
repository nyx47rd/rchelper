function sendMessage(msg, cb) {
  chrome.tabs.query({active:true, currentWindow:true}, function(tabs) {
    if (!tabs || !tabs[0]) { 
      document.getElementById('status').innerText = 'RollerCoin sekmesi bulunamadı!';
      if(cb)cb(null); 
      return; 
    }
    chrome.tabs.sendMessage(tabs[0].id, msg, function(response) {
      if (chrome.runtime.lastError) {
        document.getElementById('status').innerText = 'Sayfa yenilenmeli!';
        if(cb)cb(null);
        return;
      }
      if(cb)cb(response);
    });
  });
}

function getExcludedGames() {
  return JSON.parse(localStorage.getItem('excludeGames') || '[]');
}

function saveExcludedGames(list) {
  localStorage.setItem('excludeGames', JSON.stringify(list));
}

function renderGameList(games) {
  var container = document.getElementById('game-list');
  if (!container) return;
  var excluded = getExcludedGames();
  container.innerHTML = '';
  if (!games || !games.length) {
    container.innerHTML = '<div style="color:#aaa; font-size:10px;">Oyun bulunamadı</div>';
    return;
  }
  games.forEach(function(name) {
    var div = document.createElement('div');
    div.className = 'game-item';
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = 'game-' + name;
    cb.checked = excluded.indexOf(name) !== -1;
    cb.onchange = function() {
      var excluded = getExcludedGames();
      if (cb.checked) {
        if (excluded.indexOf(name) === -1) excluded.push(name);
      } else {
        var idx = excluded.indexOf(name);
        if (idx !== -1) excluded.splice(idx, 1);
      }
      saveExcludedGames(excluded);
    };
    var label = document.createElement('label');
    label.htmlFor = cb.id;
    label.innerText = name;
    div.appendChild(cb);
    div.appendChild(label);
    container.appendChild(div);
  });
}

document.addEventListener('DOMContentLoaded', function() {
  var btnOnce = document.getElementById('btn-once');
  var btnAuto = document.getElementById('btn-auto');
  var chkChoose = document.getElementById('chk-choose');
  var chkCollect = document.getElementById('chk-collect');
  var statusEl = document.getElementById('status');

  chkChoose.checked = localStorage.getItem('autoChoose') === 'true';
  chkCollect.checked = localStorage.getItem('autoCollect') !== 'false';
  var autoPlayState = localStorage.getItem('autoPlay') === 'true';
  if(btnAuto) {
    btnAuto.innerText = autoPlayState ? 'Auto-Play: AÇIK' : 'Auto-Play: KAPALI';
    btnAuto.className = autoPlayState ? 'btn btn-red' : 'btn btn-blue';
  }

  sendMessage({action: 'getGames'}, function(r) {
    if (r && r.games) renderGameList(r.games);
  });

  if(btnOnce) {
    btnOnce.onclick = function() {
      statusEl.innerText = 'Akıllı oyun seçiliyor...';
      var excludeList = getExcludedGames();
      sendMessage({action: 'playSmart', exclude: excludeList}, function(r) {
        statusEl.innerText = r ? 'Oyun başlatıldı!' : 'Hata! Sayfayı yenileyin.';
        setTimeout(function(){ statusEl.innerText = ''; }, 2000);
      });
    };
  }

  if(btnAuto) {
    btnAuto.onclick = function() {
      var newState = !autoPlayState;
      autoPlayState = newState;
      localStorage.setItem('autoPlay', newState);
      var excludeList = getExcludedGames();
      sendMessage({action: 'toggleAuto', on: newState, exclude: excludeList}, function(r) {
        if(r) {
          btnAuto.innerText = r.on ? 'Auto-Play: AÇIK' : 'Auto-Play: KAPALI';
          btnAuto.className = r.on ? 'btn btn-red' : 'btn btn-blue';
          statusEl.innerText = r.on ? 'Oto-oynatma AÇIK' : 'Oto-oynatma KAPALI';
        } else {
          statusEl.innerText = 'Hata! Sayfayı yenileyin.';
        }
        setTimeout(function(){ statusEl.innerText = ''; }, 2000);
      });
    };
  }

  if(chkChoose) {
    chkChoose.onchange = function() {
      var isChecked = chkChoose.checked;
      localStorage.setItem('autoChoose', isChecked);
      sendMessage({action: 'toggleChoose', on: isChecked}, function(r) {
        statusEl.innerText = r && r.on ? 'CHOOSE GAME: AÇIK' : 'CHOOSE GAME: KAPALI';
        setTimeout(function(){ statusEl.innerText = ''; }, 2000);
      });
    };
  }

  if(chkCollect) {
    chkCollect.onchange = function() {
      var isChecked = chkCollect.checked;
      localStorage.setItem('autoCollect', isChecked);
      sendMessage({action: 'toggleCollect', on: isChecked});
    };
  }
});
