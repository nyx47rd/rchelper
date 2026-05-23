#!/bin/bash
# RC Helper — i18n uygulama scripti
# auto_translate.py çalıştırıldıktan sonra bu scripti çalıştır.
# popup.html, popup.js ve tutorial.js'e i18n hook'larını ekler.

set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "→ popup.html: data-i18n attribute'ları ekleniyor..."

# ── Update banner ──
sed -i 's|Yeni Sürüm Mevcut!|<span data-i18n="update_title">Yeni Sürüm Mevcut!</span>|g' popup.html
sed -i 's|id="update-banner-sub">Yeni bir sürüm|id="update-banner-sub" data-i18n="update_sub">Yeni bir sürüm|g' popup.html
sed -i 's|Güncellemeyi İndir|<span data-i18n="update_btn">Güncellemeyi İndir</span>|g' popup.html

# ── Header ──
sed -i 's|title="Nasıl Kullanılır?"|title="Nasıl Kullanılır?" data-i18n="tut_help_title" data-i18n-attr="title"|g' popup.html

# ── Settings card ──
# card-label içindeki düz metin node'ları — SVG'den sonraki text
python3 - << 'PYEOF'
import re

with open('popup.html', encoding='utf-8') as f:
    html = f.read()

replacements = [
    # Settings card label
    (r'(<!-- Settings -->.*?card-label[^>]*>)(.*?)(</svg>)\s*\n(\s*)(Ayarlar)',
     lambda m: m.group(1) + m.group(2) + m.group(3) + '\n' + m.group(4) +
               '<span data-i18n="card_settings">Ayarlar</span>'),
    # toggle labels
    (r'(id="row-choose".*?toggle-row-left[^>]*>.*?</svg>)\s*\n(\s*)(Otomatik Seç)',
     lambda m: m.group(1) + '\n' + m.group(2) + '<span data-i18n="toggle_choose_lbl">Otomatik Seç</span>'),
    (r'(id="row-collect".*?toggle-row-left[^>]*>.*?</svg>)\s*\n(\s*)(Otomatik Topla)',
     lambda m: m.group(1) + '\n' + m.group(2) + '<span data-i18n="toggle_collect_lbl">Otomatik Topla</span>'),
    (r'(id="row-break".*?toggle-row-left[^>]*>.*?</svg>)\s*\n(\s*)(Mola Hatırlatıcısı)',
     lambda m: m.group(1) + '\n' + m.group(2) + '<span data-i18n="toggle_break_lbl">Mola Hatırlatıcısı</span>'),
    # Break settings card label
    (r'(id="break-settings-card".*?card-label[^>]*>.*?</svg>)\s*\n(\s*)(Mola Ayarları)',
     lambda m: m.group(1) + '\n' + m.group(2) + '<span data-i18n="card_break_settings">Mola Ayarları</span>'),
    # Break setting labels
    (r'(id="inp-session-min".*?break-setting-label[^>]*>.*?</svg>)\s*\n(\s*)(Oyun süresi)',
     lambda m: m.group(1) + '\n' + m.group(2) + '<span data-i18n="break_session_lbl">Oyun süresi</span>'),
    (r'(id="inp-break-min".*?break-setting-label[^>]*>.*?</svg>)\s*\n(\s*)(Mola süresi)',
     lambda m: m.group(1) + '\n' + m.group(2) + '<span data-i18n="break_duration_lbl">Mola süresi</span>'),
    # Break unit
    (r'(class="break-input-unit">)(dk)(</span>)',
     lambda m: m.group(1) + '<span data-i18n="break_unit">dk</span>' + m.group(3)),
    # Game picker title
    (r'(class="game-picker-title">)(Listeden Oyun Seç)(</span>)',
     lambda m: m.group(1) + '<span data-i18n="picker_title">Listeden Oyun Seç</span>' + m.group(3)),
    # Skip button
    (r'(id="btn-skip"[^>]*>.*?</svg>)\s*\n(\s*)(Pas Geç)',
     lambda m: m.group(1) + '\n' + m.group(2) + '<span data-i18n="btn_skip_lbl">Pas Geç</span>'),
    # Perm button label
    (r'(id="btn-skip-perm"[^>]*>.*?</svg>)\s*\n(\s*)(Daima)',
     lambda m: m.group(1) + '\n' + m.group(2) + '<span data-i18n="btn_skip_perm_lbl">Daima</span>'),
    # Skipped temp card label
    (r'(skipped-games-list.*?card-label[^>]*>.*?</svg>)\s*\n(\s*)(Pas Geçilen · 10dk)',
     lambda m: m.group(1) + '\n' + m.group(2) + '<span data-i18n="card_skipped_temp">Pas Geçilen · 10dk</span>'),
    # Skipped perm card label
    (r'(permanent-skipped-list.*?card-label[^>]*>.*?</svg>)\s*\n(\s*)(Daima Atlanan)',
     lambda m: m.group(1) + '\n' + m.group(2) + '<span data-i18n="card_skipped_perm">Daima Atlanan</span>'),
    # Stats card label
    (r'(id="stats-card".*?card-label[^>]*>.*?</svg>)\s*\n(\s*)(İstatistikler)',
     lambda m: m.group(1) + '\n' + m.group(2) + '<span data-i18n="card_stats_lbl">İstatistikler</span>'),
    # Stat labels
    (r'(<div class="stat-label">)(Toplam Oyun)(</div>)',
     lambda m: m.group(1) + '<span data-i18n="stat_total_games">Toplam Oyun</span>' + m.group(3)),
    (r'(<div class="stat-label">)(Bugün)(</div>)',
     lambda m: m.group(1) + '<span data-i18n="stat_today">Bugün</span>' + m.group(3)),
    (r'(<div class="stat-label">)(Bu Hafta)(</div>)',
     lambda m: m.group(1) + '<span data-i18n="stat_week">Bu Hafta</span>' + m.group(3)),
    (r'(<div class="stat-label">)(Toplam Süre)(</div>)',
     lambda m: m.group(1) + '<span data-i18n="stat_total_time">Toplam Süre</span>' + m.group(3)),
    (r'(<div class="stat-label">)(Ort\. Süre)(</div>)',
     lambda m: m.group(1) + '<span data-i18n="stat_avg_time">Ort. Süre</span>' + m.group(3)),
    (r'(<div class="stat-label">)(En Uzun)(</div>)',
     lambda m: m.group(1) + '<span data-i18n="stat_longest">En Uzun</span>' + m.group(3)),
    # Stat detail labels
    (r'(<span class="stat-detail-label">)(En çok oynanan:)(</span>)',
     lambda m: m.group(1) + '<span data-i18n="stat_fav_label">En çok oynanan:</span>' + m.group(3)),
    (r'(<span class="stat-detail-label">)(Son oyun:)(</span>)',
     lambda m: m.group(1) + '<span data-i18n="stat_last_label">Son oyun:</span>' + m.group(3)),
    (r'(<span class="stat-detail-label">)(Aktif gün:)(</span>)',
     lambda m: m.group(1) + '<span data-i18n="stat_active_label">Aktif gün:</span>' + m.group(3)),
    (r'(<span class="stat-detail-label">)(Şu an oynanan:)(</span>)',
     lambda m: m.group(1) + '<span data-i18n="stat_current_label">Şu an oynanan:</span>' + m.group(3)),
    # Clear button
    (r'(id="btn-clear"[^>]*>.*?</svg>)\s*\n(\s*)(🗑️ Hafızayı Temizle)',
     lambda m: m.group(1) + '\n' + m.group(2) + '<span data-i18n="btn_clear_lbl">🗑️ Hafızayı Temizle</span>'),
    # Auto-Play button
    (r'(id="btn-auto"[^>]*>.*?</svg>)\s*\n(\s*)(Auto-Play: KAPALI)',
     lambda m: m.group(1) + '\n' + m.group(2) + '<span id="auto-play-lbl" data-i18n="auto_off">Auto-Play: KAPALI</span>'),
]

changed = 0
for pattern, repl in replacements:
    new_html, n = re.subn(pattern, repl, html, flags=re.DOTALL)
    if n:
        html = new_html
        changed += n

# Dil butonu header'a ekle (eğer yoksa)
if 'btn-lang' not in html:
    html = html.replace(
        '<button class="tut-help-btn" id="btn-tutorial"',
        '<button class="lang-btn" id="btn-lang" title="Switch language">🇬🇧 EN</button>\n    <button class="tut-help-btn" id="btn-tutorial"'
    )
    changed += 1

with open('popup.html', 'w', encoding='utf-8') as f:
    f.write(html)

print(f'  {changed} değişiklik yapıldı (popup.html)')
PYEOF

echo "→ popup.js: dinamik string'ler t() ile değiştiriliyor..."
python3 - << 'PYEOF'
import re

with open('popup.js', encoding='utf-8') as f:
    js = f.read()

replacements = [
    # update sub text
    (r"sub\.textContent = 'v' \+ latest \+ ' mevcut[^']*'",
     "sub.textContent = 'v' + latest + ' — ' + t('update_sub')"),
    # auto btn text
    (r"btnAuto\.textContent = state \? 'Auto-Play: AÇIK' : 'Auto-Play: KAPALI'",
     "btnAuto.querySelector('#auto-play-lbl,span') ? (btnAuto.querySelector('[data-i18n]').setAttribute('data-i18n', state ? 'auto_on' : 'auto_off'), btnAuto.querySelector('[data-i18n]').textContent = t(state ? 'auto_on' : 'auto_off')) : (btnAuto.textContent = t(state ? 'auto_on' : 'auto_off'))"),
    # skip empty
    (r"listEl\.innerHTML = '<span class=\"skip-empty\">Henüz yok</span>'",
     "listEl.innerHTML = '<span class=\"skip-empty\">' + t('skip_empty') + '</span>'"),
    # picker loading
    (r"'<div class=\"game-picker-empty\">Yükleniyor\.\.\.</div>'",
     "'<div class=\"game-picker-empty\">' + t('picker_loading') + '</div>'"),
    # picker empty
    (r"empty\.textContent = 'Oyun listesi bulunamadı[^']*'",
     "empty.textContent = t('picker_empty_msg')"),
    # picker skip / perm buttons
    (r"btnSkipG\.textContent = isSkipped \? '✓ Pas' : 'Pas'",
     "btnSkipG.textContent = isSkipped ? t('picker_skip_done') : t('picker_skip')"),
    (r"btnPermG\.textContent = isPerm \? '✓ Daima' : 'Daima'",
     "btnPermG.textContent = isPerm ? t('picker_perm_done') : t('picker_perm')"),
    # skip anim
    (r"btnSkip\.textContent = 'Geçiliyor\.\.\.'",
     "btnSkip.querySelector('[data-i18n]') ? (btnSkip.querySelector('[data-i18n]').textContent = t('btn_skipping')) : (btnSkip.textContent = t('btn_skipping'))"),
    # confirm stats reset
    (r"confirm\('Tüm oyun istatistiklerini[^']*'\)",
     "confirm(t('confirm_stats'))"),
    # confirm clear
    (r"'Emin misin\? Tüm ayarlar silinecek\.'",
     "t('confirm_clear_body')"),
    (r"yes\.textContent = 'Evet, Temizle'",
     "yes.textContent = t('confirm_yes')"),
    (r"no\.textContent = 'İptal'",
     "no.textContent = t('confirm_no')"),
    (r"btnClear\.textContent = '✓ Temizlendi!'",
     "btnClear.querySelector('[data-i18n]') ? (btnClear.querySelector('[data-i18n]').textContent = t('btn_clear_done')) : (btnClear.textContent = t('btn_clear_done'))"),
    (r"btnClear\.textContent = '🗑️ Hafızayı Temizle'",
     "btnClear.querySelector('[data-i18n]') ? (btnClear.querySelector('[data-i18n]').textContent = t('btn_clear_lbl')) : (btnClear.textContent = t('btn_clear_lbl'))"),
    # skip meta dk suffix
    (r"metaSpan\.textContent = g\.remaining \+ 'dk'",
     "metaSpan.textContent = g.remaining + t('skip_min_suffix')"),
]

changed = 0
for pattern, repl in replacements:
    new_js, n = re.subn(pattern, repl, js)
    if n:
        js = new_js
        changed += n

# refreshDynamicTexts fonksiyonu ekle (yoksa)
if 'function refreshDynamicTexts' not in js:
    inject = """
/* ── i18n: dinamik metin yenileme ── */
function refreshDynamicTexts() {
  var state = typeof autoPlayState !== 'undefined' ? autoPlayState : false;
  var lbl = document.getElementById('auto-play-lbl') || document.getElementById('btn-auto');
  if (lbl) lbl.textContent = t(state ? 'auto_on' : 'auto_off');
  loadSkippedGames();
}
"""
    # DOMContentLoaded'dan önce ekle
    js = js.replace("document.addEventListener('DOMContentLoaded'", inject + "\ndocument.addEventListener('DOMContentLoaded'", 1)
    changed += 1

# initLang + dil butonu DOMContentLoaded içine ekle (ilk satırdan sonra)
if 'initLang()' not in js:
    js = js.replace(
        "document.addEventListener('DOMContentLoaded', function() {\n  checkForUpdates();",
        "document.addEventListener('DOMContentLoaded', function() {\n  checkForUpdates();\n  initLang();\n  var btnLang = document.getElementById('btn-lang');\n  if (btnLang) btnLang.onclick = function() { setLang(RC_LANG === 'tr' ? 'en' : 'tr'); };"
    )
    changed += 1

with open('popup.js', 'w', encoding='utf-8') as f:
    f.write(js)

print(f'  {changed} değişiklik yapıldı (popup.js)')
PYEOF

echo "→ tutorial.js: TUT_STEPS t() ile değiştiriliyor..."
python3 - << 'PYEOF'
import re

with open('tutorial.js', encoding='utf-8') as f:
    js = f.read()

# TUT_STEPS'i dinamik hale getir
if 'function getTutSteps' not in js:
    # Mevcut statik TUT_STEPS bloğunu bul ve fonksiyon haline getir
    m = re.search(r'var TUT_STEPS = \[.*?\];', js, re.DOTALL)
    if m:
        old_block = m.group(0)
        # step sayısını say
        steps = re.findall(r'targetId:', old_block)
        n = len(steps)

        # Dinamik getter fonksiyonu yaz
        lines = ['function getTutSteps() {\n  return [']
        for i in range(n):
            lines.append(
                f"    {{ targetId: (RC_STRINGS && RC_STRINGS[RC_LANG] && RC_STRINGS[RC_LANG]['tut_step_{i}_targetId']) || "
                + f"(RC_STRINGS && RC_STRINGS['tr']['tut_step_{i}_targetId']) || null,"
                + f"\n      title: t('tut_step_{i}_title'),"
                + f"\n      desc: t('tut_step_{i}_desc') }},"
            )
        lines.append('  ];\n}')

        # targetId'leri string dict'e ekle
        target_ids = re.findall(r"targetId:\s*(?:'([^']*)'|null)", old_block)
        lines.append('\n/* targetId\'ler i18n dict\'e ekleniyor */')
        for i, tid in enumerate(target_ids):
            lines.append(f"// tut_step_{i}_targetId = '{tid}'")

        new_block = old_block + '\n' + '\n'.join(lines)
        js = js.replace(old_block, new_block)

        # TUT_STEPS kullanılan yerleri getTutSteps() ile değiştir
        js = re.sub(r'\bTUT_STEPS\b', 'getTutSteps()', js)

        print(f'  getTutSteps() fonksiyonu eklendi ({n} adım)')
    else:
        print('  UYARI: TUT_STEPS bloğu bulunamadı!')
else:
    print('  getTutSteps() zaten mevcut, atlandı.')

# tut-badge metni t() ile
js = re.sub(
    r"document\.getElementById\('tut-badge'\)\.textContent = 'Adım ' \+ \(step \+ 1\) \+ ' / ' \+ total",
    "document.getElementById('tut-badge').textContent = t('tut_step_label') + ' ' + (step + 1) + ' ' + t('tut_step_of') + ' ' + total",
    js
)

# next/prev/skip buton metinleri
js = re.sub(r"nextBtn\.textContent\s*=\s*'✓ Tamamla'",
            "nextBtn.textContent = t('tut_done')", js)
js = re.sub(r"nextBtn\.textContent\s*=\s*'İleri ›'",
            "nextBtn.textContent = t('tut_next')", js)
js = re.sub(r"skipBtn\.textContent\s*=\s*'Atla'",
            "skipBtn.textContent = t('tut_skip_btn')", js)

# renderTutStep globale aç (dil değişiminde yeniden render için)
js = js.replace('  function render() {', '  function render() {\n  renderTutStep = render;')
if 'var renderTutStep' not in js:
    js = 'var renderTutStep = null;\n' + js

with open('tutorial.js', 'w', encoding='utf-8') as f:
    f.write(js)

print('  tutorial.js güncellendi')
PYEOF

echo "→ popup.html: i18n.js script tag'i ekleniyor..."
python3 - << 'PYEOF'
with open('popup.html', encoding='utf-8') as f:
    html = f.read()

if 'i18n.js' not in html:
    html = html.replace(
        '<script src="tutorial.js"></script>',
        '<script src="i18n.js"></script>\n  <script src="tutorial.js"></script>'
    )
    with open('popup.html', 'w', encoding='utf-8') as f:
        f.write(html)
    print('  i18n.js script tag eklendi')
else:
    print('  i18n.js zaten mevcut, atlandı')
PYEOF

echo "→ lang-btn için CSS ekleniyor..."
python3 - << 'PYEOF'
with open('popup.html', encoding='utf-8') as f:
    html = f.read()

lang_css = """
    .lang-btn {
      background: rgba(255,61,107,0.08);
      border: 1px solid rgba(255,61,107,0.2);
      color: #aaa;
      border-radius: 6px;
      padding: 3px 7px;
      font-size: 10px;
      cursor: pointer;
      transition: all 0.15s;
      margin-right: 4px;
    }
    .lang-btn:hover { background: rgba(255,61,107,0.18); color: #fff; }"""

if '.lang-btn' not in html:
    html = html.replace('    .tut-help-btn {', lang_css + '\n    .tut-help-btn {')
    with open('popup.html', 'w', encoding='utf-8') as f:
        f.write(html)
    print('  .lang-btn CSS eklendi')
else:
    print('  .lang-btn CSS zaten mevcut')
PYEOF

echo ""
echo "✓ apply_i18n.sh tamamlandı!"
echo ""
echo "Şimdi auto_translate.py ile i18n.js'i üret:"
echo "  python3 auto_translate.py \$DEEPL_API_KEY"
