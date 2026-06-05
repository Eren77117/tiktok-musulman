#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")/mobile" && pwd)"
IOS_DIR="$PROJECT_DIR/ios"
ARCHIVE_PATH="$IOS_DIR/build/Nour.xcarchive"
EXPORT_PATH="$IOS_DIR/build/ipa"
EXPORT_OPTIONS="$IOS_DIR/ExportOptions.plist"
SCHEME="TiktokMusulman"
WORKSPACE="$IOS_DIR/TiktokMusulman.xcworkspace"

echo "========================================"
echo "  Nour — Build IPA pour AltStore"
echo "========================================"

# 1. Bundle JS (release)
echo ""
echo "[1/3] Bundle JavaScript..."
cd "$PROJECT_DIR"
npx react-native bundle \
  --platform ios \
  --dev false \
  --entry-file index.js \
  --bundle-output ios/main.jsbundle \
  --assets-dest ios/assets

# 2. Archive
echo ""
echo "[2/3] Archive Xcode..."
rm -rf "$ARCHIVE_PATH"
xcodebuild archive \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -archivePath "$ARCHIVE_PATH" \
  -destination "generic/platform=iOS" \
  CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM=AS5F7VP9X9 \
  | xcpretty 2>/dev/null || true

# fallback si xcpretty absent
if [ ! -d "$ARCHIVE_PATH" ]; then
  xcodebuild archive \
    -workspace "$WORKSPACE" \
    -scheme "$SCHEME" \
    -configuration Release \
    -archivePath "$ARCHIVE_PATH" \
    -destination "generic/platform=iOS" \
    CODE_SIGN_STYLE=Automatic \
    DEVELOPMENT_TEAM=AS5F7VP9X9
fi

# 3. Export IPA
echo ""
echo "[3/3] Export IPA..."
rm -rf "$EXPORT_PATH"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportOptionsPlist "$EXPORT_OPTIONS" \
  -exportPath "$EXPORT_PATH"

IPA_FILE=$(find "$EXPORT_PATH" -name "*.ipa" | head -1)
echo ""
echo "========================================"
echo "  IPA prête : $IPA_FILE"
echo ""
echo "  → Ouvre AltStore sur ton Mac"
echo "  → Glisse l'IPA dans AltStore"
echo "    (ou My Apps → + → choisir l'IPA)"
echo "========================================"

# Ouvre le dossier Finder automatiquement
open "$EXPORT_PATH"
