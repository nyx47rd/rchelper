#!/usr/bin/env python3
"""Commit logunu okuyan release body üretici. Argümanlar: ZIPNAME NEXT"""
import json, sys, re

raw     = sys.stdin.read().strip()
ZIPNAME = sys.argv[1] if len(sys.argv) > 1 else 'rchelper.zip'
NEXT    = sys.argv[2] if len(sys.argv) > 2 else ''

commits = [c.strip() for c in raw.split('---COMMIT---') if c.strip()]

ICONS = {
    'feat':     '✨',
    'fix':      '🐛',
    'refactor': '♻️',
    'style':    '🎨',
    'docs':     '📝',
    'chore':    '🔧',
    'perf':     '⚡',
    'test':     '🧪',
}

def icon(line):
    for k, v in ICONS.items():
        if line.lower().startswith(k):
            return v
    return '•'

lines_out = []
for commit in commits:
    clines = [l.rstrip() for l in commit.splitlines() if l.strip()]
    if not clines:
        continue
    subject = clines[0]
    lines_out.append(f'{icon(subject)} **{subject}**')
    for bl in clines[1:]:
        bl = bl.lstrip()
        if bl.startswith('-') or re.match(r'^[a-z]+[\w]*:', bl):
            lines_out.append(f'  - {bl.lstrip("-").strip()}')

changelog_text = '\n'.join(lines_out) if lines_out else '• Genel iyileştirmeler'

body = (
    f'## 🚀 RC Helper {NEXT}\n\n'
    f'### 📋 Değişiklikler\n\n'
    f'{changelog_text}\n\n'
    f'---\n\n'
    f'### 📦 Kurulum\n\n'
    f'1. Aşağıdaki **{ZIPNAME}** dosyasını indir\n'
    f'2. ZIP\'i bir klasöre çıkart\n'
    f'3. Chrome\'da `chrome://extensions` sayfasını aç\n'
    f'4. Sağ üstten **Geliştirici modunu** aç\n'
    f'5. **Paketlenmemiş öğe yükle** butonuna tıkla\n'
    f'6. Çıkardığın `rchelper` klasörünü seç\n'
    f'7. RollerCoin\'e git ve eklentiyi etkinleştir'
)
print(json.dumps(body))
