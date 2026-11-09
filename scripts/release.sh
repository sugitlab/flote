#!/bin/bash
set -e

VERSION="${1#v}"  # strip leading 'v' if given

if [[ -z "$VERSION" ]]; then
  echo "Usage: $0 <version>  (e.g. 0.1.3 or v0.1.3)"
  exit 1
fi

if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: version must be semver format (e.g. 0.1.3)"
  exit 1
fi

echo "→ Bumping version to $VERSION"

# apps/desktop/package.json
node -e "
const fs = require('fs');
const path = 'apps/desktop/package.json';
const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
pkg.version = '$VERSION';
fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
"

# apps/mobile/package.json and Expo app config
node -e "
const fs = require('fs');
const pkgPath = 'apps/mobile/package.json';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = '$VERSION';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
const appPath = 'apps/mobile/app.json';
const app = JSON.parse(fs.readFileSync(appPath, 'utf8'));
if (app.expo.version !== '$VERSION') {
  app.expo.version = '$VERSION';
  app.expo.android.versionCode += 1;
}
fs.writeFileSync(appPath, JSON.stringify(app, null, 2) + '\n');
"

# apps/desktop/src-tauri/tauri.conf.json
node -e "
const fs = require('fs');
const path = 'apps/desktop/src-tauri/tauri.conf.json';
const cfg = JSON.parse(fs.readFileSync(path, 'utf8'));
cfg.version = '$VERSION';
fs.writeFileSync(path, JSON.stringify(cfg, null, 2) + '\n');
"

# apps/desktop/src-tauri/Cargo.toml  (package version のみ書き換え)
node -e "
const fs = require('fs');
const path = 'apps/desktop/src-tauri/Cargo.toml';
let src = fs.readFileSync(path, 'utf8');
// [package] セクションの version = \"...\" だけ置換
src = src.replace(/^(version\s*=\s*\")([^\"]+)(\")$/m, '\$1$VERSION\$3');
fs.writeFileSync(path, src);
"

# apps/desktop/src-tauri/Cargo.lock (local package version)
node -e "
const fs = require('fs');
const path = 'apps/desktop/src-tauri/Cargo.lock';
let src = fs.readFileSync(path, 'utf8');
src = src.replace(/(name = \"flote\"\nversion = \")[^\"]+(\")/, (_m, a, b) => a + '$VERSION' + b);
fs.writeFileSync(path, src);
"

echo "→ Verifying..."
node -e "console.log('  package.json :', JSON.parse(require('fs').readFileSync('apps/desktop/package.json','utf8')).version)"
node -e "console.log('  tauri.conf   :', JSON.parse(require('fs').readFileSync('apps/desktop/src-tauri/tauri.conf.json','utf8')).version)"
grep '^version' apps/desktop/src-tauri/Cargo.toml | awk '{print "  Cargo.toml   :", $3}'
node -e "const fs = require('fs'); const app = JSON.parse(fs.readFileSync('apps/mobile/app.json','utf8')); console.log('  mobile       :', app.expo.version, '(Android code', app.expo.android.versionCode + ')')"

echo "→ Committing..."
# Stage all tracked changes first, then add version files
git add -u
git add \
  apps/desktop/package.json \
  apps/desktop/src-tauri/tauri.conf.json \
  apps/desktop/src-tauri/Cargo.toml \
  apps/desktop/src-tauri/Cargo.lock \
  apps/mobile/package.json \
  apps/mobile/app.json

git commit -m "chore: bump version to $VERSION"

echo "→ Tagging v$VERSION..."
git tag "v$VERSION"

echo "→ Pushing..."
git push origin main
git push origin "v$VERSION"

echo ""
echo "✓ Released v$VERSION — CI build started"
echo "  https://github.com/sugitlab/flote/actions"
