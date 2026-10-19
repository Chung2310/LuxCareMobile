#!/usr/bin/env bash
set -euo pipefail
: "${RUNNER_TEMP:?}"
: "${IOS_PROFILE_UUID:?}"
: "${IOS_BUILD_NUMBER:?}"
shopt -s nullglob
workspaces=(ios/*.xcworkspace)
[[ ${#workspaces[@]} -eq 1 ]] || { echo "Expected one iOS workspace" >&2; exit 1; }
workspace="${workspaces[0]}"
scheme="$(basename "$workspace" .xcworkspace)"
archive="$RUNNER_TEMP/luxcare-ios.xcarchive"
export_dir="$RUNNER_TEMP/luxcare-ios-export"
artifacts="$RUNNER_TEMP/luxcare-ios-artifacts"

# Signing is set on the application target, leaving CocoaPods targets untouched.
xcodebuild -workspace "$workspace" -scheme "$scheme" -configuration Release \
  -sdk iphoneos -destination 'generic/platform=iOS' \
  -derivedDataPath "$RUNNER_TEMP/luxcare-ios-derived" -archivePath "$archive" \
  archive 2>&1 | tee "$RUNNER_TEMP/luxcare-ios-archive.log"
xcodebuild -exportArchive -archivePath "$archive" -exportPath "$export_dir" \
  -exportOptionsPlist "$RUNNER_TEMP/luxcare-ios-signing/ExportOptions.plist" \
  2>&1 | tee "$RUNNER_TEMP/luxcare-ios-export.log"

ipas=("$export_dir"/*.ipa)
[[ ${#ipas[@]} -eq 1 ]] || { echo "Expected one exported IPA" >&2; exit 1; }
mkdir -p "$artifacts"
cp "${ipas[0]}" "$artifacts/LuxCare.ipa"
unzip -tq "$artifacts/LuxCare.ipa"
validation="$(mktemp -d "$RUNNER_TEMP/luxcare-ios-validate.XXXXXX")"
ditto -x -k "$artifacts/LuxCare.ipa" "$validation"
apps=("$validation"/Payload/*.app)
[[ ${#apps[@]} -eq 1 ]]
app="${apps[0]}"
plist="$app/Info.plist"
[[ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$plist")" == "$LUXCARE_IOS_BUNDLE_IDENTIFIER" ]]
[[ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$plist")" == "$IOS_BUILD_NUMBER" ]]
[[ "$(/usr/libexec/PlistBuddy -c 'Print :DTPlatformName' "$plist")" == iphoneos ]]
executable="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$plist")"
xcrun lipo "$app/$executable" -verify_arch arm64
test -s "$app/main.jsbundle"
test -s "$app/embedded.mobileprovision"
codesign --verify --deep --strict "$app"
codesign -d --entitlements :- "$app" > "$RUNNER_TEMP/luxcare-ios-signing/signed-entitlements.plist" 2>/dev/null
python3 scripts/ios-signing.py verify-app
if [[ -d "$archive/dSYMs" ]]; then
  ditto -c -k --keepParent "$archive/dSYMs" "$artifacts/LuxCare-dSYMs.zip"
fi
