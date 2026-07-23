/* ── RC Helper i18n ──
   Yeni string eklemek için TR ve EN bloklarına key: 'değer' satırı ekle.
*/

var RC_LANG = 'tr';

var RC_STRINGS = {
  tr: {
    auto_off: 'Auto-Play: KAPALI',
    auto_on: 'Auto-Play: AÇIK',
    break_unit: 'dk',
    btn_clear_done: '✓ Temizlendi!',
    btn_github: 'GitHub',
    btn_skip_lbl: 'Pas Geç',
    btn_skip_perm_lbl: 'Daima',
    btn_skipping: 'Geçiliyor...',
    card_break_settings: 'Mola Ayarları',
    card_settings: 'Ayarlar',
    card_skipped_perm: 'Daima Atlanan',
    card_skipped_temp: 'Pas Geçilen · 10dk',
    card_stats_lbl: 'İstatistikler',
    confirm_clear_body: 'Emin misin? Tüm ayarlar silinecek.',
    confirm_no: 'İptal',
    confirm_stats: 'Tüm oyun istatistiklerini sıfırlamak istediğinden emin misin?',
    confirm_yes: 'Evet, Temizle',
    footer_by: 'by',
    picker_empty_msg: 'Oyun listesi bulunamadı. Önce oyun seçim sayfasına git.',
    picker_loading: 'Yükleniyor...',
    picker_perm: 'Daima',
    picker_perm_done: '✓ Daima',
    picker_skip: 'Pas',
    picker_skip_done: '✓ Pas',
    picker_title: 'Listeden Oyun Seç',
    popout_title: 'Ayrı pencerede aç',
    lb_title: 'En Çok Oynananlar',
    lb_empty: 'Henüz veri yok',
    skip_empty: 'Henüz yok',
    skip_min_suffix: 'dk',
    stat_active_label: 'Aktif gün:',
    stat_reset_lbl: 'Sıfırla',
    stat_avg_time: 'Ort. Süre',
    stat_current_label: 'Şu an oynanan:',
    stat_fav_label: 'En çok oynanan:',
    stat_last_label: 'Son oyun:',
    stat_longest: 'En Uzun',
    stat_today: 'Bugün',
    stat_total_games: 'Toplam Oyun',
    stat_total_time: 'Toplam Süre',
    stat_week: 'Bu Hafta',
    toggle_break_lbl: 'Mola Hatırlatıcısı',
    toggle_choose_lbl: 'Otomatik Seç',
    toggle_collect_lbl: 'Otomatik Topla',
    tut_done: '✓ Tamamla',
    tut_help_title: 'Nasıl Kullanılır?',
    tut_next: 'İleri ›',
    tut_skip_btn: 'Atla',
    tut_step_0_desc: 'Bu kısa tur seni <strong>2 dakikada</strong> tüm özelliklerle tanıştıracak. RollerCoin\'de oyun seçimini otomatikleştirmek için tasarlandı.',
    tut_step_0_title: 'RC Helper\'e Hoş Geldin! 👋',
    tut_step_1_desc: '<strong>Oyun seçim ekranında</strong> rastgele bir oyun seçip butona basar. Sen sadece oyunu oynarsın — seçimi o yapar.',
    tut_step_1_title: 'Otomatik Seç',
    tut_step_2_desc: 'Oyun bitince çıkan <strong>"Gain Power"</strong> ve <strong>"Collect"</strong> butonlarına otomatik basar. Power\'ı kaçırmazsın.',
    tut_step_2_title: 'Otomatik Topla',
    tut_step_3_desc: 'Belirlediğin süre oynayınca tam ekran mola ekranı açılır. <strong>Oyun ve mola süresini</strong> aşağıdaki Mola Ayarları kartından dilediğin gibi ayarlayabilirsin.',
    tut_step_3_title: 'Mola Hatırlatıcısı',
    tut_step_4_desc: '<strong>Oyun süresi:</strong> kaç dakika oynadıktan sonra mola verilsin. <strong>Mola süresi:</strong> molanın kaç dakika süreceği. Her ikisini de buradan ayarlayabilirsin.',
    tut_step_4_title: 'Mola Ayarları',
    tut_step_5_desc: 'Şu anki oyunu <strong>10 dakika</strong> boyunca atlar. Sıkıcı bir oyunla karşılaştında kullan. Klavyeden de <strong>S</strong> tuşuna basabilirsin.',
    tut_step_5_title: 'Pas Geç (S tuşu)',
    tut_step_6_desc: 'Bu oyunu <strong>kalıcı olarak</strong> engeller — bir daha asla seçilmez. Hiç sevmediğin oyunlar için. <strong>P</strong> tuşuyla da çalışır.',
    tut_step_6_title: 'Daima Atla (P tuşu)',
    tut_step_7_desc: 'Oyun seçim sayfasına gitmeden <strong>popup\'tan</strong> hangi oyunların pas geçileceğini veya kalıcı atlanacağını ayarlayabilirsin.',
    tut_step_7_title: 'Listeden Seç',
    tut_step_8_desc: '<strong>Ana buton.</strong> Açıkken her 1 saniyede kontrol eder, oyun seçim ekranındaysan otomatik seçer. Kapatınca her şey durur.',
    tut_step_8_title: 'Auto-Play',
    tut_step_9_desc: 'Coin Fisher, Hamster Climber, 2048 Coins ve Token Blaster oyunlarını <strong>otomatik oyna</strong>. Her birini ayrı ayrı açıp kapatabilirsin. Büyük ekranda oynarken bot devreye girer.',
    tut_step_9_title: 'Oyun Botları',
    tut_step_10_desc: 'Oynadığın <strong>toplam oyun</strong>, bugün, bu hafta, toplam süre, ortalama süre, en çok oynadığın oyun ve şu an oynadığın oyunu burada görürsün.',
    tut_step_10_title: 'İstatistikler',
    tut_step_label: 'Adım',
    tut_step_of: '/',
    update_btn: 'Güncellemeyi İndir',
    update_sub: 'Yeni bir sürüm yayınlandı. Auto-Play kullanmak için güncellemeniz gerekiyor.',
    update_title: 'Yeni Sürüm Mevcut!',
    /* ── content.js widget ── */
    w_game: 'Oyun',
    w_time: 'Süre',
    w_now_playing: 'Şu An Oynanıyor',
    w_per_hour: '1 saatte',
    w_break: 'Mola',
    w_skip_btn: 'Pas Geç',
    w_perm_btn: 'Daima',
    w_skip_title: 'Pas Geç (S)',
    w_perm_title: 'Daima Atla (P)',
    w_sound_title: 'Ses Aç/Kapat',
    w_hide_title: 'Gizle',
    w_shortcut_skip: 'pas geç',
    w_shortcut_perm: 'daima atla',
    /* ── break banner ── */
    break_title: 'Mola Zamanı',
    break_worked: 'dakika çalıştın —',
    break_rest: 'dakika dinlen.',
    break_end_btn: 'Molayı Bitir',
    /* ── break status row ── */
    break_status_label: 'Mola',
    break_next_suffix: 'sonra mola',
    break_session_lbl: 'Oyun süresi',
    break_duration_lbl: 'Mola süresi',
    btn_clear_lbl: 'Hafızayı Temizle',
    w_skipped_prefix: '⏸ Pas',
    /* ── bot panel ── */
    card_bots: 'Oyun Botları',
    bot_fisher: 'Coin Fisher',
    bot_hamster: 'Hamster Climber',
    bot_2048: '2048 Coins',
    bot_blaster: 'Token Blaster',
    bot_cryptonoid: 'Cryptonoid',
    bot_rocket: 'Flappy Rocket',
    bot_active_badge: 'OYNUYOR',
  },
  en: {
    auto_off: 'Auto-Play: OFF',
    auto_on: 'Auto-Play: ON',
    break_unit: 'min',
    btn_clear_done: '✓ Cleared!',
    btn_github: 'GitHub',
    btn_skip_lbl: 'Skip',
    btn_skip_perm_lbl: 'Always',
    btn_skipping: 'Skipping...',
    card_break_settings: 'Break Settings',
    card_settings: 'Settings',
    card_skipped_perm: 'Always Skipped',
    card_skipped_temp: 'Skipped · 10min',
    card_stats_lbl: 'Statistics',
    confirm_clear_body: 'Are you sure? All settings will be deleted.',
    confirm_no: 'Cancel',
    confirm_stats: 'Are you sure you want to reset all game statistics?',
    confirm_yes: 'Yes, Clear',
    footer_by: 'by',
    picker_empty_msg: 'No games found. Go to the game selection page first.',
    picker_loading: 'Loading...',
    picker_perm: 'Always',
    picker_perm_done: '✓ Always',
    picker_skip: 'Skip',
    picker_skip_done: '✓ Skip',
    picker_title: 'Select from List',
    popout_title: 'Open in separate window',
    lb_title: 'Most Played Games',
    lb_empty: 'No data yet',
    skip_empty: 'None yet',
    skip_min_suffix: 'min',
    stat_active_label: 'Active days:',
    stat_reset_lbl: 'Reset',
    stat_avg_time: 'Avg. Time',
    stat_current_label: 'Now playing:',
    stat_fav_label: 'Most played:',
    stat_last_label: 'Last game:',
    stat_longest: 'Longest',
    stat_today: 'Today',
    stat_total_games: 'Total Games',
    stat_total_time: 'Total Time',
    stat_week: 'This Week',
    toggle_break_lbl: 'Break Reminder',
    toggle_choose_lbl: 'Auto Select',
    toggle_collect_lbl: 'Auto Collect',
    tut_done: '✓ Finish',
    tut_help_title: 'How to Use?',
    tut_next: 'Next ›',
    tut_skip_btn: 'Skip',
    tut_step_0_desc: 'This short tour will introduce you to all features in <strong>2 minutes</strong>. Designed to automate game selection on RollerCoin.',
    tut_step_0_title: 'Welcome to RC Helper! 👋',
    tut_step_1_desc: 'On the <strong>game selection screen</strong>, picks a random game and clicks the button. You just play — it handles the selection.',
    tut_step_1_title: 'Auto Select',
    tut_step_2_desc: 'Automatically clicks the <strong>"Gain Power"</strong> and <strong>"Collect"</strong> buttons when a game ends. Never miss your power.',
    tut_step_2_title: 'Auto Collect',
    tut_step_3_desc: 'After playing for your set time, a fullscreen break screen opens. Adjust <strong>game and break duration</strong> in the Break Settings card below.',
    tut_step_3_title: 'Break Reminder',
    tut_step_4_desc: '<strong>Game duration:</strong> minutes until a break. <strong>Break duration:</strong> how long the break lasts. Adjust both here.',
    tut_step_4_title: 'Break Settings',
    tut_step_5_desc: 'Skips the current game for <strong>10 minutes</strong>. Use it when you encounter a boring game. You can also press <strong>S</strong> on keyboard.',
    tut_step_5_title: 'Skip (S key)',
    tut_step_6_desc: '<strong>Permanently blocks</strong> this game — it will never be selected again. For games you never want. Also works with <strong>P</strong> key.',
    tut_step_6_title: 'Always Skip (P key)',
    tut_step_7_desc: 'Manage which games to skip or permanently block <strong>from the popup</strong>, without going to the game selection page.',
    tut_step_7_title: 'Select from List',
    tut_step_8_desc: '<strong>Main button.</strong> When on, checks every second and auto-selects on the game screen. Turning it off stops everything.',
    tut_step_8_title: 'Auto-Play',
    tut_step_9_desc: 'Auto-play Coin Fisher, Hamster Climber, 2048 Coins and Token Blaster. Toggle each bot individually. The bot activates when you go fullscreen.',
    tut_step_9_title: 'Game Bots',
    tut_step_10_desc: 'See your <strong>total games</strong>, today, this week, total time, average time, most played game and currently playing game here.',
    tut_step_10_title: 'Statistics',
    tut_step_label: 'Step',
    tut_step_of: '/',
    update_btn: 'Download Update',
    update_sub: 'A new version has been released. Please update to use Auto-Play.',
    update_title: 'New Version Available!',
    /* ── content.js widget ── */
    w_game: 'Game',
    w_time: 'Time',
    w_now_playing: 'Now Playing',
    w_per_hour: 'per hour',
    w_break: 'Break',
    w_skip_btn: 'Skip',
    w_perm_btn: 'Always',
    w_skip_title: 'Skip (S)',
    w_perm_title: 'Always Skip (P)',
    w_sound_title: 'Sound On/Off',
    w_hide_title: 'Hide',
    w_shortcut_skip: 'skip',
    w_shortcut_perm: 'always skip',
    /* ── break banner ── */
    break_title: 'Break Time',
    break_worked: 'minutes worked —',
    break_rest: 'minutes rest.',
    break_end_btn: 'End Break',
    /* ── break status row ── */
    break_status_label: 'Break',
    break_next_suffix: 'until break',
    break_session_lbl: 'Game duration',
    break_duration_lbl: 'Break duration',
    btn_clear_lbl: 'Clear Memory',
    w_skipped_prefix: '⏸ Skipped',
    /* ── bot panel ── */
    card_bots: 'Game Bots',
    bot_fisher: 'Coin Fisher',
    bot_hamster: 'Hamster Climber',
    bot_2048: '2048 Coins',
    bot_blaster: 'Token Blaster',
    bot_cryptonoid: 'Cryptonoid',
    bot_rocket: 'Flappy Rocket',
    bot_active_badge: 'PLAYING',
  },
};

/** Aktif dildeki string'i döndürür */
function t(key) {
  var lang = RC_LANG;
  var d = RC_STRINGS[lang] || RC_STRINGS['tr'];
  return d[key] !== undefined ? d[key] : (RC_STRINGS['tr'][key] || key);
}

/** data-i18n attribute'u olan tüm elementleri günceller */
function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(function(el) {
    var key = el.getAttribute('data-i18n');
    var attr = el.getAttribute('data-i18n-attr');
    var val = t(key);
    if (attr) {
      el.setAttribute(attr, val);
    } else {
      el.innerHTML = val;
    }
  });
}

/** Dili değiştirir, kaydeder, content script'e bildirir ve popup'ı yeniler */
function setLang(lang) {
  chrome.storage.local.set({ rcLang: lang }, function() {
    /* content script'e bildir */
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (chrome.runtime.lastError) return;
        if (tabs && tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'setLang', lang: lang }, function() {
            void chrome.runtime.lastError;
          });
        }
      });
    } catch(e) {}
    /* popup'ı yeniden yükle — her şey sıfırdan güncellenir */
    location.reload();
  });
}

function _updateLangBtn(lang) {
  var btn = document.getElementById('btn-lang');
  if (!btn) return;
  btn.setAttribute('data-lang', lang);
  btn.innerHTML = lang === 'tr'
    ? '<svg width="13" height="10" viewBox="0 0 20 14" fill="none"><rect width="20" height="14" rx="2" fill="#012169"/><path d="M0 0l20 14M20 0L0 14" stroke="#fff" stroke-width="3"/><path d="M0 0l20 14M20 0L0 14" stroke="#C8102E" stroke-width="1.8"/><rect x="8" width="4" height="14" fill="#fff"/><rect y="5" width="20" height="4" fill="#fff"/><rect x="9" width="2" height="14" fill="#C8102E"/><rect y="6" width="20" height="2" fill="#C8102E"/></svg><span>EN</span>'
    : '<svg width="13" height="10" viewBox="0 0 30 20" fill="none"><rect width="30" height="20" rx="2" fill="#E30A17"/><circle cx="11" cy="10" r="5.5" fill="#fff"/><circle cx="12.5" cy="10" r="4.4" fill="#E30A17"/><path d="M16.5 7.5l.8 2.5-2.2-1.5h2.8l-2.2 1.5z" fill="#fff"/></svg><span>TR</span>';
}

/** Sayfa yüklenince kaydedilmiş dili uygula */
function initLang() {
  /* Önce mevcut data-lang attribute'undan sync render et */
  var btn = document.getElementById('btn-lang');
  var cachedLang = (btn && btn.getAttribute('data-lang')) || 'tr';
  _updateLangBtn(cachedLang);

  /* Storage'dan gerçek dili oku ve uygula */
  chrome.storage.local.get(['rcLang'], function(data) {
    RC_LANG = data.rcLang || 'tr';
    _updateLangBtn(RC_LANG);
    applyTranslations();
    if (typeof refreshDynamicTexts === 'function') refreshDynamicTexts();
  });
}
