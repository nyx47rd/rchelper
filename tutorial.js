var renderTutStep = null;
/* ── RC Helper Interactive Tutorial ── */
var TUT_STEPS = [
  {
    targetId: null,
    title: 'RC Helper\'e Hoş Geldin! 👋',
    desc: 'Bu kısa tur seni <strong>2 dakikada</strong> tüm özelliklerle tanıştıracak. RollerCoin\'de oyun seçimini otomatikleştirmek için tasarlandı.',
  },
  {
    targetId: 'row-choose',
    title: 'Otomatik Seç',
    desc: '<strong>Oyun seçim ekranında</strong> rastgele bir oyun seçip butona basar. Sen sadece oyunu oynarsın — seçimi o yapar.',
  },
  {
    targetId: 'row-collect',
    title: 'Otomatik Topla',
    desc: 'Oyun bitince çıkan <strong>"Gain Power"</strong> ve <strong>"Collect"</strong> butonlarına otomatik basar. Power\'ı kaçırmazsın.',
  },
  {
    targetId: 'row-break',
    title: 'Mola Hatırlatıcısı',
    desc: 'Belirlediğin süre oynayınca tam ekran mola ekranı açılır. <strong>Oyun ve mola süresini</strong> aşağıdaki Mola Ayarları kartından dilediğin gibi ayarlayabilirsin.',
  },
  {
    targetId: 'break-settings-card',
    title: 'Mola Ayarları',
    desc: '<strong>Oyun süresi:</strong> kaç dakika oynadıktan sonra mola verilsin. <strong>Mola süresi:</strong> molanın kaç dakika süreceği. Her ikisini de buradan ayarlayabilirsin.',
  },
  {
    targetId: 'btn-skip',
    title: 'Pas Geç (S tuşu)',
    desc: 'Şu anki oyunu <strong>10 dakika</strong> boyunca atlar. Sıkıcı bir oyunla karşılaştında kullan. Klavyeden de <strong>S</strong> tuşuna basabilirsin.',
  },
  {
    targetId: 'btn-skip-perm',
    title: 'Daima Atla (P tuşu)',
    desc: 'Bu oyunu <strong>kalıcı olarak</strong> engeller — bir daha asla seçilmez. Hiç sevmediğin oyunlar için. <strong>P</strong> tuşuyla da çalışır.',
  },
  {
    targetId: 'btn-list',
    title: 'Listeden Seç',
    desc: 'Oyun seçim sayfasına gitmeden <strong>popup\'tan</strong> hangi oyunların pas geçileceğini veya kalıcı atlanacağını ayarlayabilirsin.',
  },
  {
    targetId: 'btn-auto',
    title: 'Auto-Play',
    desc: '<strong>Ana buton.</strong> Açıkken her 1 saniyede kontrol eder, oyun seçim ekranındaysan otomatik seçer. Kapatınca her şey durur.',
  },
  {
    targetId: 'stats-card',
    title: 'İstatistikler',
    desc: 'Oynadığın <strong>toplam oyun</strong>, bugün, bu hafta, toplam süre, ortalama süre, en çok oynadığın oyun ve şu an oynadığın oyunu burada görürsün.',
  },
];
var TUT_TARGET_IDS = [null,'row-choose','row-collect','row-break','break-settings-card','btn-skip','btn-skip-perm','btn-list','btn-auto','bots-card','stats-card'];
function getTutSteps() {
  return TUT_TARGET_IDS.map(function(id, i) {
    return { targetId: id, title: t('tut_step_'+i+'_title'), desc: t('tut_step_'+i+'_desc') };
  });
}

function startTutorial() {
  var overlay = document.getElementById('tut-overlay');
  if (!overlay) return;
  var step = 0;

  var dotsEl = document.getElementById('tut-dots');
  dotsEl.innerHTML = '';
  getTutSteps().forEach(function() {
    var d = document.createElement('span');
    d.className = 'tut-dot';
    dotsEl.appendChild(d);
  });

  function getDocRect(id) {
    if (!id) return null;
    var el = document.getElementById(id);
    if (!el) return null;
    var br = el.getBoundingClientRect();
    var scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
    var scrollX = window.pageXOffset || document.documentElement.scrollLeft || 0;
    return {
      top:    br.top    + scrollY,
      left:   br.left   + scrollX,
      width:  br.width,
      height: br.height,
      bottom: br.top    + scrollY + br.height,
    };
  }

  function getDocH() {
    return Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight
    );
  }

  function getDocW() {
    return document.body.offsetWidth || document.documentElement.offsetWidth || 256;
  }

  function setMasks(r) {
    var W    = getDocW();
    var H    = getDocH();
    var pad  = 5;
    var mTop = document.getElementById('tut-m-top');
    var mBot = document.getElementById('tut-m-bottom');
    var mLft = document.getElementById('tut-m-left');
    var mRgt = document.getElementById('tut-m-right');
    var sp   = document.getElementById('tut-spotlight');

    overlay.style.height = H + 'px';

    if (!r) {
      mTop.style.cssText = 'position:absolute;left:0;top:0;width:' + W + 'px;height:' + H + 'px;background:rgba(5,7,18,0.85);';
      mBot.style.display = 'none';
      mLft.style.display = 'none';
      mRgt.style.display = 'none';
      sp.style.display   = 'none';
      return;
    }

    var rx = Math.max(0, r.left - pad);
    var ry = Math.max(0, r.top  - pad);
    var rw = r.width  + pad * 2;
    var rh = r.height + pad * 2;
    var bg = 'rgba(5,7,18,0.85)';

    mTop.style.cssText = 'position:absolute;left:0;top:0;width:' + W + 'px;height:' + ry + 'px;background:' + bg + ';';
    mBot.style.cssText = 'position:absolute;left:0;top:' + (ry+rh) + 'px;width:' + W + 'px;height:' + (H-ry-rh) + 'px;background:' + bg + ';display:block;';
    mLft.style.cssText = 'position:absolute;left:0;top:' + ry + 'px;width:' + rx + 'px;height:' + rh + 'px;background:' + bg + ';display:block;';
    mRgt.style.cssText = 'position:absolute;left:' + (rx+rw) + 'px;top:' + ry + 'px;width:' + (W-rx-rw) + 'px;height:' + rh + 'px;background:' + bg + ';display:block;';
    sp.style.cssText   = 'position:absolute;left:' + rx + 'px;top:' + ry + 'px;width:' + rw + 'px;height:' + rh + 'px;' +
                         'border:2px solid #FF3D6B;border-radius:9px;' +
                         'box-shadow:0 0 0 3px rgba(255,61,107,0.2),0 0 16px rgba(255,61,107,0.25);display:block;pointer-events:none;';
  }

  function positionBox(r) {
    var box  = document.getElementById('tut-box');
    var H    = getDocH();
    var GAP  = 10;
    var boxH = 170;

    if (!r) { box.style.top = '60px'; return; }

    var belowTop = r.bottom + GAP;
    if (belowTop + boxH <= H) { box.style.top = belowTop + 'px'; return; }

    var aboveTop = r.top - GAP - boxH;
    if (aboveTop >= 0) { box.style.top = aboveTop + 'px'; return; }

    box.style.top = Math.max(8, (H - boxH) / 2) + 'px';
  }

  function scrollToStep(r) {
    if (!r) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    var viewH    = window.innerHeight;
    var elCenter = r.top + r.height / 2;
    window.scrollTo({ top: Math.max(0, elCenter - viewH / 2), behavior: 'smooth' });
  }

  function render() {
  renderTutStep = render;
    var s     = getTutSteps()[step];
    var total = getTutSteps().length;

    document.getElementById('tut-badge').textContent = t('tut_step_label') + ' ' + (step + 1) + ' ' + t('tut_step_of') + ' ' + total;
    document.getElementById('tut-title').textContent = s.title;
    document.getElementById('tut-desc').innerHTML    = s.desc;

    var r = getDocRect(s.targetId);
    scrollToStep(r);

    setTimeout(function() {
      var r2 = getDocRect(s.targetId);
      setMasks(r2);
      positionBox(r2);
    }, 180);

    document.querySelectorAll('.tut-dot').forEach(function(d, i) {
      d.className = 'tut-dot' + (i === step ? ' active' : '');
    });

    var nextBtn = document.getElementById('tut-next');
    var prevBtn = document.getElementById('tut-prev');
    var skipBtn = document.getElementById('tut-skip');

    prevBtn.style.display = step === 0 ? 'none' : '';
    if (step === total - 1) {
      nextBtn.textContent = t('tut_done');
      nextBtn.className     = 'tut-btn tut-btn-done';
      skipBtn.style.display = 'none';
    } else {
      nextBtn.textContent = t('tut_next');
      nextBtn.className     = 'tut-btn tut-btn-next';
      skipBtn.style.display = '';
    }
  }

  function closeTutorial(done) {
    overlay.classList.remove('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (done) chrome.storage.local.set({ tutorialDone: true });
  }

  document.getElementById('tut-next').onclick = function() {
    if (step < getTutSteps().length - 1) { step++; render(); }
    else { closeTutorial(true); }
  };
  document.getElementById('tut-prev').onclick = function() {
    if (step > 0) { step--; render(); }
  };
  document.getElementById('tut-skip').onclick = function() { closeTutorial(true); };

  overlay.classList.add('active');
  render();
}
