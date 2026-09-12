#!/usr/bin/env bash
set -euo pipefail

# Invoke from mobile/ after Expo prebuild and pod install.
: "${RUNNER_TEMP:?RUNNER_TEMP must point to the CI temporary directory}"
shopt -s nullglob
workspaces=(ios/*.xcworkspace)
if [[ ${#workspaces[@]} -ne 1 ]]; then
  echo "Expected exactly one app workspace in mobile/ios" >&2
  exit 1
fi
workspace="${workspaces[0]}"
scheme="$(basename "$workspace" .xcworkspace)"
derived="$RUNNER_TEMP/luxcare-unsigned-derived"

xcodebuild \
  -workspace "$workspace" \
  -scheme "$scheme" \
  -configuration Release \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -derivedDataPath "$derived" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY="" \
  DEVELOPMENT_TEAM="" \
  build 2>&1 | tee "$RUNNER_TEMP/luxcare-xcodebuild.log"

apps=("$derived"/Build/Products/Release-iphoneos/*.app)
if [[ ${#apps[@]} -ne 1 ]]; then
  echo "Expected exactly one compiled device app" >&2
  exit 1
fi
app="${apps[0]}"
plist="$app/Info.plist"
platform="$(/usr/libexec/PlistBuddy -c 'Print :DTPlatformName' "$plist")"
[[ "$platform" == "iphoneos" ]]
executable="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$plist")"
xcrun lipo "$app/$executable" -verify_arch arm64
# A standalone Release IPA must contain its JS/Hermes bundle.
test -s "$app/main.jsbundle"

staging="$(mktemp -d "$RUNNER_TEMP/luxcare-ipa.XXXXXX")"
mkdir -p "$staging/Payload" "$RUNNER_TEMP/luxcare-unsigned-artifacts"
ditto "$app" "$staging/Payload/$(basename "$app")"
(
  cd "$staging"
  /usr/bin/zip -qry "$RUNNER_TEMP/luxcare-unsigned-artifacts/LuxCare-unsigned.ipa" Payload
)
/usr/bin/unzip -tq "$RUNNER_TEMP/luxcare-unsigned-artifacts/LuxCare-unsigned.ipa"
