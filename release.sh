#!/bin/bash
set -e

REPO="nyx47rd/rchelper"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PAT="${RC_PAT}"

cd "$DIR"

# Uzak etiketleri yerelle eşitle (Changelog'un doğru hesaplanması için)
echo "→ Uzak etiketler güncelleniyor..."
git fetch --tags origin 2>/dev/null || true

# Versiyon hesapla
LAST=$(git tag --sort=-version:refname | grep '^v' | head -1)
if [ -z "$LAST" ]; then
  NEXT="v1.0.0"
else
  MAJOR=$(echo $LAST | cut -d. -f1 | tr -d 'v')
  MINOR=$(echo $LAST | cut -d. -f2)
  PATCH=$(echo $LAST | cut -d. -f3)
  
  NEW_PATCH=$((PATCH + 1))
  NEW_MINOR=$MINOR
  NEW_MAJOR=$MAJOR
  
  if [ "$NEW_PATCH" -ge 100 ]; then
    NEW_MINOR=$((MINOR + 1))
    NEW_PATCH=0
  fi
  
  if [ "$NEW_MINOR" -ge 100 ]; then
    NEW_MAJOR=$((MAJOR + 1))
    NEW_MINOR=0
  fi
  
  NEXT="v${NEW_MAJOR}.${NEW_MINOR}.${NEW_PATCH}"
fi

echo "→ Versiyon: $NEXT"

# Mevcut tag kontrolü — aynıysa patch'i bir daha artır
while git ls-remote --tags origin | grep -q "refs/tags/$NEXT$"; do
  PATCH=$((PATCH + 1))
  NEXT="v${MAJOR}.${MINOR}.${PATCH}"
done
echo "→ Versiyon (final): $NEXT"

# Changelog
CHANGELOG=$(git log --pretty=format:"- %s" "${LAST}..HEAD" 2>/dev/null | grep -v '\[skip release\]' | grep -v '^- test:' | grep -v '^- ci:' || true)
if [ -z "$CHANGELOG" ]; then
  CHANGELOG="- Genel iyileştirmeler"
fi

echo "→ Changelog:"
echo "$CHANGELOG"

# ZIP oluştur
ZIPNAME="rchelper-${NEXT}.zip"
rm -f rchelper.zip "$ZIPNAME"
mkdir -p _ziptmp/rchelper

# Eklenti dosyalarını kopyala
cp manifest.json content.js popup.html popup.js background.js \
   i18n.js tutorial.js tutorial.css \
   icon16.png icon48.png icon128.png favicon.ico \
   _ziptmp/rchelper/

# Eklenti klasörlerini kopyala
cp -r games _ziptmp/rchelper/

# Eğer LICENSE varsa kopyala
if [ -f LICENSE ]; then
  cp LICENSE _ziptmp/rchelper/
fi

cd _ziptmp && zip -r "../$ZIPNAME" rchelper/ -x "*.DS_Store"
cd "$DIR" && rm -rf _ziptmp
echo "→ ZIP hazır: $ZIPNAME"

# Release oluştur
RELEASE_ID=$(python3 -c "
import json, urllib.request, os
body = '''## RC Helper $NEXT

### 📦 Kurulum / Installation

#### 🇹🇷 Türkçe Kurulum Adımları:
1. \`rchelper-$NEXT.zip\` dosyasını indirin ve bir klasöre çıkartın.
2. Google Chrome tarayıcınızda \`chrome://extensions\` adresine gidin.
3. Sağ üst köşeden **Geliştirici modu**'nu aktif edin.
4. Sol üst köşedeki **Paketlenmemiş öğe yükle** butonuna tıklayarak ayıkladığınız \`rchelper\` klasörünü seçin.

---

#### 🇬🇧 English Installation Steps:
1. Download the \`rchelper-$NEXT.zip\` file and extract it to a folder.
2. Go to \`chrome://extensions\` in your Google Chrome browser.
3. Enable **Developer mode** in the top-right corner.
4. Click the **Load unpacked** button in the top-left corner and select the extracted \`rchelper\` folder.'''

data = json.dumps({'tag_name': '$NEXT', 'name': 'RC Helper $NEXT', 'body': body, 'draft': False}).encode()
req = urllib.request.Request('https://api.github.com/repos/$REPO/releases', data=data)
req.add_header('Authorization', 'token $PAT')
req.add_header('Content-Type', 'application/json')
r = urllib.request.urlopen(req)
print(json.loads(r.read())['id'])
")

echo "→ Release ID: $RELEASE_ID"

# ZIP yükle
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST \
  -H "Authorization: token $PAT" \
  -H "Content-Type: application/zip" \
  --data-binary @"$ZIPNAME" \
  "https://uploads.github.com/repos/$REPO/releases/${RELEASE_ID}/assets?name=${ZIPNAME}")

echo "→ ZIP yükleme: HTTP $STATUS"

if [ "$STATUS" = "201" ]; then
  echo "✓ Release yayınlandı: https://github.com/$REPO/releases/tag/$NEXT"
else
  echo "✗ ZIP yükleme başarısız!"
  exit 1
fi
