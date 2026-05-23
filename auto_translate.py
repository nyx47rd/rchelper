#!/usr/bin/env python3
"""
RC Helper — Otomatik çeviri scripti
Kullanım: python3 auto_translate.py <DEEPL_API_KEY>

Kaynak dosyalardaki Türkçe stringleri DeepL ile İngilizceye çevirir
ve i18n.js dosyasını günceller. Her yeni özellik eklendiğinde
bu scripti çalıştırmak yeterlidir.
"""

import sys, re, json, os

def get_api_key():
    key = os.environ.get('DEEPL_API_KEY') or (sys.argv[1] if len(sys.argv) > 1 else None)
    if not key:
        print('Hata: DEEPL_API_KEY ortam değişkeni veya argüman gerekli.')
        print('  export DEEPL_API_KEY=your_key')
        print('  python3 auto_translate.py your_key')
        sys.exit(1)
    return key

DIR = os.path.dirname(os.path.abspath(__file__))

# ── Çevrilecek string'lerin tanımı ──────────────────────────────────────────
# (key, source_file, regex veya literal) şeklinde — regex'siz olanlar literal
# Kaynak dosyalardan OTOMATIK çekilen string'ler aşağıda toplanır.

def extract_strings():
    """
    Kaynak dosyalardan Türkçe string'leri otomatik çıkar.
    apply_i18n.sh çalıştırıldıktan sonra popup.html'deki
    data-i18n attribute'larını + JS/tutorial literal'lerini okur.
    Döndürür: { key: turkish_string }
    """
    strings = {}

    # ── popup.html: data-i18n attribute'lu elementlerin text içeriği ──
    html_path = os.path.join(DIR, 'popup.html')
    with open(html_path, encoding='utf-8') as f:
        html = f.read()

    # <* data-i18n="KEY">METIN</…>  veya  <* data-i18n="KEY" …>METIN</…>
    # İç metin içinde nested tag varsa ham text al
    for m in re.finditer(r'data-i18n="([^"]+)"[^>]*>([^<]+)<', html):
        key, val = m.group(1), m.group(2).strip()
        if val and 'data-i18n-attr' not in m.group(0):
            strings[key] = val

    # data-i18n-attr olan elementler (title vb.) — attribute değeri kaynak HTML'de yok,
    # bunları manuel olarak aşağıda tanımlıyoruz.

    # ── popup.js: t() çağrısına dönüştürülmemiş literal'ler ──
    js_path = os.path.join(DIR, 'popup.js')
    with open(js_path, encoding='utf-8') as f:
        js = f.read()

    js_manual = {
        'skip_min_suffix':   'dk',
        'picker_loading':    'Yükleniyor...',
        'picker_empty_msg':  'Oyun listesi bulunamadı. Önce oyun seçim sayfasına git.',
        'picker_skip':       'Pas',
        'picker_skip_done':  '✓ Pas',
        'picker_perm':       'Daima',
        'picker_perm_done':  '✓ Daima',
        'btn_skipping':      'Geçiliyor...',
        'confirm_clear_body':'Emin misin? Tüm ayarlar silinecek.',
        'confirm_yes':       'Evet, Temizle',
        'confirm_no':        'İptal',
        'btn_clear_done':    '✓ Temizlendi!',
        'confirm_stats':     'Tüm oyun istatistiklerini sıfırlamak istediğinden emin misin?',
    }
    for k, v in js_manual.items():
        strings.setdefault(k, v)

    # ── tutorial.js: TUT_STEPS başlık ve açıklamaları ──
    tut_path = os.path.join(DIR, 'tutorial.js')
    with open(tut_path, encoding='utf-8') as f:
        tut = f.read()

    # Statik TUT_STEPS bloğundan çek (apply öncesi veya sonrası)
    step_blocks = re.findall(
        r"targetId:[^\n]+\n\s+title:\s*'((?:[^'\\]|\\.)*)',\s*\n\s+desc:\s*'((?:[^'\\]|\\.)*)',",
        tut
    )
    for i, (title, desc) in enumerate(step_blocks):
        clean_desc = re.sub(r'<[^>]+>', '', desc.replace("\\'", "'")).strip()
        strings[f'tut_step_{i}_title'] = title.replace("\\'", "'")
        strings[f'tut_step_{i}_desc']  = clean_desc

    # ── Manuel / sabit değerler ──
    manual = {
        'update_title':      'Yeni Sürüm Mevcut!',
        'update_sub':        'Yeni bir sürüm yayınlandı. Auto-Play kullanmak için güncellemeniz gerekiyor.',
        'update_btn':        'Güncellemeyi İndir',
        'tut_help_title':    'Nasıl Kullanılır?',
        'break_unit':        'dk',
        'auto_on':           'Auto-Play: AÇIK',
        'auto_off':          'Auto-Play: KAPALI',
        'skip_empty':        'Henüz yok',
        'btn_skip_perm_lbl': 'Daima',
        'tut_next':          'İleri ›',
        'tut_done':          '✓ Tamamla',
        'tut_skip_btn':      'Atla',
        'tut_step_label':    'Adım',
        'tut_step_of':       '/',
        'footer_by':         'by',
        'btn_github':        'GitHub',
    }
    for k, v in manual.items():
        strings.setdefault(k, v)

    return strings


def translate_all(strings_tr, api_key):
    import deepl
    translator = deepl.Translator(api_key)
    strings_en = {}
    batch = list(strings_tr.items())
    texts = [v for _, v in batch]

    print(f'  DeepL ile {len(texts)} string çevriliyor...')
    # DeepL toplu çeviri (max 50 per request)
    chunk_size = 50
    results = []
    for i in range(0, len(texts), chunk_size):
        chunk = texts[i:i+chunk_size]
        translated = translator.translate_text(chunk, source_lang='TR', target_lang='EN-US')
        results.extend([r.text for r in translated])
        print(f'  {min(i+chunk_size, len(texts))}/{len(texts)} tamamlandı')

    for (key, _), en_val in zip(batch, results):
        strings_en[key] = en_val

    return strings_en


def write_i18n_js(strings_tr, strings_en):
    out_path = os.path.join(DIR, 'i18n.js')

    def js_obj(d, indent=2):
        lines = []
        pad = ' ' * indent
        for k, v in d.items():
            # HTML içeren string'leri koruyarak yaz
            escaped = v.replace('\\', '\\\\').replace("'", "\\'").replace('\n', '\\n')
            lines.append(f"{pad}{k}: '{escaped}',")
        return '{\n' + '\n'.join(lines) + '\n  }'

    tr_obj  = js_obj(strings_tr)
    en_obj  = js_obj(strings_en)

    content = f"""/* ── RC Helper i18n — AUTO-GENERATED by auto_translate.py ──
   Bu dosyayı elle düzenleme. Değişiklik için:
   python3 auto_translate.py $DEEPL_API_KEY
*/

var RC_LANG = 'tr';

var RC_STRINGS = {{
  tr: {tr_obj},
  en: {en_obj},
}};

/** Aktif dildeki string'i döndürür */
function t(key) {{
  var lang = RC_LANG;
  var d = RC_STRINGS[lang] || RC_STRINGS['tr'];
  return d[key] !== undefined ? d[key] : (RC_STRINGS['tr'][key] || key);
}}

/** data-i18n attribute'u olan tüm elementleri günceller */
function applyTranslations() {{
  document.querySelectorAll('[data-i18n]').forEach(function(el) {{
    var key = el.getAttribute('data-i18n');
    var attr = el.getAttribute('data-i18n-attr');
    var val = t(key);
    if (attr) {{
      el.setAttribute(attr, val);
    }} else {{
      el.textContent = val;
    }}
  }});
}}

/** Dili değiştirir, kaydeder ve UI'ı yeniler */
function setLang(lang) {{
  RC_LANG = lang;
  chrome.storage.local.set({{ rcLang: lang }});
  applyTranslations();
  // Popup.js'teki dinamik elementleri yenile
  if (typeof refreshDynamicTexts === 'function') refreshDynamicTexts();
  // Tutorial adımlarını yenile (açıksa)
  var overlay = document.getElementById('tut-overlay');
  if (overlay && overlay.classList.contains('active')) {{
    if (typeof renderTutStep === 'function') renderTutStep();
  }}
  // Dil butonunu güncelle
  var btn = document.getElementById('btn-lang');
  if (btn) btn.textContent = lang === 'tr' ? '🇬🇧 EN' : '🇹🇷 TR';
}}

/** Sayfa yüklenince kaydedilmiş dili uygula */
function initLang() {{
  chrome.storage.local.get(['rcLang'], function(data) {{
    RC_LANG = data.rcLang || 'tr';
    applyTranslations();
    var btn = document.getElementById('btn-lang');
    if (btn) btn.textContent = RC_LANG === 'tr' ? '🇬🇧 EN' : '🇹🇷 TR';
  }});
}}
"""
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'  ✓ i18n.js yazıldı ({len(strings_tr)} string, TR+EN)')


def main():
    api_key = get_api_key()
    print('1. String\'ler çıkarılıyor...')
    strings_tr = extract_strings()
    print(f'   {len(strings_tr)} Türkçe string bulundu.')

    print('2. DeepL ile çevriliyor...')
    strings_en = translate_all(strings_tr, api_key)

    print('3. i18n.js yazılıyor...')
    write_i18n_js(strings_tr, strings_en)

    print('\n✓ Tamamlandı! Şimdi popup.html ve JS dosyalarını güncelle:')
    print('  bash apply_i18n.sh')


if __name__ == '__main__':
    main()
