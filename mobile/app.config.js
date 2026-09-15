const releaseVersionCode = process.env.LUXCARE_ANDROID_VERSION_CODE;
if (releaseVersionCode && (!/^[1-9]\d*$/.test(releaseVersionCode) || Number(releaseVersionCode) > 2100000000)) throw new Error("Invalid Android versionCode");
// Supply the actual registered application IDs and EAS project ID at build time.
module.exports = ({ config }) => ({
  ...config,
  extra: { ...config.extra, ...(process.env.EXPO_PUBLIC_EAS_PROJECT_ID ? {
    eas: { ...config.extra?.eas, projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID },
  } : {}) },
  android: { ...config.android,
    ...(releaseVersionCode ? { versionCode: Number(releaseVersionCode) } : {}),
    ...(process.env.LUXCARE_ANDROID_PACKAGE ? { package: process.env.LUXCARE_ANDROID_PACKAGE } : {}),
    ...(process.env.GOOGLE_SERVICES_JSON ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON } : {}),
  },
  ios: { ...config.ios,
    ...(process.env.LUXCARE_IOS_BUNDLE_IDENTIFIER ? { bundleIdentifier: process.env.LUXCARE_IOS_BUNDLE_IDENTIFIER } : {}),
  },
});
