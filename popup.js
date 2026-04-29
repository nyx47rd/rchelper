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

document.addEventListener('DOMContentLoaded', function() {
  var btnOnce = document.getElementById('btn-once');
  var btnAuto = document.getElementById('btn-auto');
  var chkChoose = document.getElementById('chk-choose');
  var statusEl = document.getElementById('status');

  chkChoose.checked = localStorage.getItem('autoChoose') === 'true';
  var autoPlayState = localStorage.getItem('autoPlay') === 'true';
  if(btnAuto) {
    btnAuto.innerText = autoPlayState ? 'Auto-Play: AÇIK' : 'Auto-Play: KAPALI';
    btnAuto.className = autoPlayState ? 'btn btn-red' : 'btn btn-blue';
  }

  if(btnOnce) {
    btnOnce.onclick = function() {
      statusEl.innerText = 'Akıllı oyun seçiliyor...';
      sendMessage({action: 'playSmart'}, function(r) {
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
      sendMessage({action: 'toggleAuto', on: newState}, function(r) {
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

  setInterval(function() {
    sendMessage({action: 'stats'}, function(r) {
      if(!r) return;
      var el1 = document.getElementById('stat-played');
      var el2 = document.getElementById('stat-reward');
      if(el1) el1.innerText = r.c || 0;
      if(el2) el2.innerText = r.r || 0;
      if(r.a !== undefined) {
        autoPlayState = r.a;
        localStorage.setItem('autoPlay', r.a);
        if(btnAuto) btnAuto.innerText = r.a ? 'Auto-Play: AÇIK' : 'Auto-Play: KAPALI';
        if(btnAuto) btnAuto.className = r.a ? 'btn btn-red' : 'btn btn-blue';
      }
    });
  }, 2000);
});
