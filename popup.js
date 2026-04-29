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
  var chkCollect = document.getElementById('chk-collect');
  var txtExclude = document.getElementById('exclude-games');
  var statusEl = document.getElementById('status');

  chkChoose.checked = localStorage.getItem('autoChoose') === 'true';
  chkCollect.checked = localStorage.getItem('autoCollect') !== 'false';
  txtExclude.value = localStorage.getItem('excludeGames') || '';
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
      var excludeList = txtExclude.value.split(',').map(function(s){ return s.trim(); }).filter(Boolean);
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

  if(txtExclude) {
    txtExclude.onchange = function() {
      localStorage.setItem('excludeGames', txtExclude.value);
    };
  }
});
