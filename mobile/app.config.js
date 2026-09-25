const releaseVersionCode = process.env.LUXCARE_ANDROID_VERSION_CODE;
if (releaseVersionCode && (!/^[1-9]\d*$/.test(releaseVersionCode) || Number(releaseVersionCode) > 2100000000)) throw new Error("Invalid Android versionCode");

const iosBuildNumber = process.env.IOS_BUILD_NUMBER || process.env.LUXCARE_IOS_BUILD_NUMBER;
if (iosBuildNumber && (!/^[1-9]\d*$/.test(iosBuildNumber) || Number(iosBuildNumber) > 2100000000)) throw new Error("Invalid iOS buildNumber");

// Supply the actual registered application IDs and EAS project ID at build time.
module.exports = ({ config }) => ({
  ...config,
  ...(process.env.APP_VERSION ? { version: process.env.APP_VERSION } : {}),
  extra: { ...config.extra, ...(process.env.EXPO_PUBLIC_EAS_PROJECT_ID ? {
    eas: { ...config.extra?.eas, projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID },
  } : {}) },
  android: { ...config.android,
    ...(releaseVersionCode ? { versionCode: Number(releaseVersionCode) } : {}),
    ...(process.env.LUXCARE_ANDROID_PACKAGE ? { package: process.env.LUXCARE_ANDROID_PACKAGE } : {}),
    ...(process.env.GOOGLE_SERVICES_JSON ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON } : {}),
  },
  ios: { ...config.ios,
    ...(iosBuildNumber ? { buildNumber: String(iosBuildNumber) } : {}),
    ...(process.env.LUXCARE_IOS_BUNDLE_IDENTIFIER ? { bundleIdentifier: process.env.LUXCARE_IOS_BUNDLE_IDENTIFIER } : {}),
  },
});
