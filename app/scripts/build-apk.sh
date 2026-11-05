#!/usr/bin/env bash
# Builds an installable release APK for Android, without EAS.
#
#   API_URL=http://192.168.1.10:4000 ./scripts/build-apk.sh
#
# API_URL must be an address your phone can reach (your computer's Wi-Fi IP
# while testing, or a deployed backend). Output: ../builds/Solace.apk
#
# The Android toolchain (Gradle/CMake/NDK) breaks on paths with spaces, so the
# app is copied to a space-free folder and built there.
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
API_URL="${API_URL:?Set API_URL, e.g. API_URL=http://192.168.1.10:4000}"
BUILD_DIR="${BUILD_DIR:-$HOME/.cache/solace-apk-build}"
ARCHS="${ARCHS:-arm64-v8a}"   # add armeabi-v7a,x86_64 for older phones/emulators
OUT_DIR="$APP_DIR/../builds"

echo "→ Copying app to $BUILD_DIR/app"
mkdir -p "$BUILD_DIR" "$OUT_DIR"
rsync -a --delete --exclude /android --exclude /ios --exclude /.expo --exclude /dist "$APP_DIR/" "$BUILD_DIR/app/"

cd "$BUILD_DIR/app"
export EXPO_PUBLIC_API_URL="$API_URL"
export NODE_ENV=production

echo "→ Generating the native Android project"
npx expo prebuild -p android --clean --no-install

echo "→ Building release APK ($ARCHS) against $API_URL"
cd android
./gradlew assembleRelease -PreactNativeArchitectures="$ARCHS" --no-daemon

cp app/build/outputs/apk/release/app-release.apk "$OUT_DIR/Solace.apk"
echo "✓ APK ready: $OUT_DIR/Solace.apk"
