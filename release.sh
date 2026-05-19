#!/bin/bash
set -e

REPO="nyx47rd/rchelper"
DIR="/home/ysr/rollercoinclaimer"
PAT="${RC_PAT}"

cd "$DIR"

# Versiyon hesapla
LAST=$(git tag --sort=-version:refname | grep '^v' | head -1)
if [ -z "$LAST" ]; then
  NEXT="v1.0.0"
else
  MAJOR=$(echo $LAST | cut -d. -f1 | tr -d 'v')
  MINOR=$(echo $LAST | cut -d. -f2)
  PATCH=$(echo $LAST | cut -d. -f3)
  NEXT="v${MAJOR}.${MINOR}.$((PATCH + 1))"
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
cp manifest.json content.js popup.html popup.js background.js \
   icon16.png icon48.png icon128.png favicon.ico LICENSE \
   _ziptmp/rchelper/
cd _ziptmp && zip -r "../$ZIPNAME" rchelper/ -x "*.DS_Store"
cd "$DIR" && rm -rf _ziptmp
echo "→ ZIP hazır: $ZIPNAME"

# Release oluştur
RELEASE_ID=$(python3 -c "
import json, urllib.request, os
body = '''## RC Helper $NEXT

### Değişiklikler
$CHANGELOG

---
> Chrome'a yüklemek için \`rchelper.zip\` dosyasını indirip \`chrome://extensions\` → **Paketlenmemiş öğe yükle** ile kurun.'''

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
