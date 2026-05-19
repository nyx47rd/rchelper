---
description: Push changes and create GitHub release with ZIP automatically
---

1. Get the latest tag and compute next version:
```bash
cd /home/ysr/rollercoinclaimer && LAST=$(git tag --sort=-version:refname | grep '^v' | head -1) && if [ -z "$LAST" ]; then NEXT="v1.0.0"; else MAJOR=$(echo $LAST | cut -d. -f1 | tr -d 'v'); MINOR=$(echo $LAST | cut -d. -f2); PATCH=$(echo $LAST | cut -d. -f3); NEXT="v${MAJOR}.${MINOR}.$((PATCH + 1))"; fi && echo "Next version: $NEXT"
```

2. Ask the user for a commit message, then commit and push:
```bash
git -C /home/ysr/rollercoinclaimer add -A && git -C /home/ysr/rollercoinclaimer commit -m "$MSG" && git -C /home/ysr/rollercoinclaimer push https://nyx47rd:${RC_PAT}@github.com/nyx47rd/rchelper.git master
```

3. Build the changelog from commits since last tag:
```bash
cd /home/ysr/rollercoinclaimer && LAST=$(git tag --sort=-version:refname | grep '^v' | head -1) && if [ -z "$LAST" ]; then git log --pretty=format:"- %s" HEAD; else git log --pretty=format:"- %s" "$LAST"..HEAD; fi
```

4. Create ZIP with rchelper/ subfolder:
```bash
cd /home/ysr/rollercoinclaimer && rm -f rchelper.zip && mkdir -p _ziptmp/rchelper && cp manifest.json content.js popup.html popup.js background.js icon16.png icon48.png icon128.png favicon.ico README.md LICENSE _ziptmp/rchelper/ && cd _ziptmp && zip -r ../rchelper.zip rchelper/ && cd .. && rm -rf _ziptmp
```

5. Create GitHub release and upload ZIP:
```bash
cd /home/ysr/rollercoinclaimer && LAST=$(git tag --sort=-version:refname | grep '^v' | head -1) && MAJOR=$(echo $LAST | cut -d. -f1 | tr -d 'v') && MINOR=$(echo $LAST | cut -d. -f2) && PATCH=$(echo $LAST | cut -d. -f3) && NEXT="v${MAJOR}.${MINOR}.$((PATCH + 1))" && CHANGELOG=$(if [ -z "$LAST" ]; then git log --pretty=format:"- %s" HEAD; else git log --pretty=format:"- %s" "$LAST"..HEAD; fi) && BODY="## RC Helper ${NEXT}\n\n### Değişiklikler\n${CHANGELOG}\n\n---\n> Chrome'a yüklemek için rchelper.zip dosyasını indirip chrome://extensions → Paketlenmemiş öğe yükle ile kurun." && RELEASE_ID=$(curl -s -X POST -H "Authorization: token ${RC_PAT}" -H "Content-Type: application/json" -d "{\"tag_name\":\"${NEXT}\",\"name\":\"RC Helper ${NEXT}\",\"body\":\"${BODY}\",\"draft\":false}" https://api.github.com/repos/nyx47rd/rchelper/releases | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])") && curl -s -o /dev/null -w "%{http_code}" -X POST -H "Authorization: token ${RC_PAT}" -H "Content-Type: application/zip" --data-binary @rchelper.zip "https://uploads.github.com/repos/nyx47rd/rchelper/releases/${RELEASE_ID}/assets?name=rchelper.zip"
```
