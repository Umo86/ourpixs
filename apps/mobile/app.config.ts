import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Our Pixs — Expo app config.
 * Env:
 *   EXPO_PUBLIC_API_URL   API base (default https://ourpixs.com)
 *   EXPO_PUBLIC_DEMO=1    demo data on every screen (store screenshots)
 *   EAS_PROJECT_ID        EAS project id (set after `eas init`; needed for push tokens)
 *   APP_VARIANT           development | preview | production (set per EAS profile)
 */
const VARIANT = process.env.APP_VARIANT ?? "production";
const IS_DEV = VARIANT === "development";
const IS_PREVIEW = VARIANT === "preview";

const bundleId = IS_DEV ? "com.ourpixs.app.dev" : IS_PREVIEW ? "com.ourpixs.app.preview" : "com.ourpixs.app";
const name = IS_DEV ? "Our Pixs (Dev)" : IS_PREVIEW ? "Our Pixs (Preview)" : "Our Pixs";

const GUEST_DOMAINS = ["ourpixs.com", "www.ourpixs.com", "bizimresimler.com", "www.bizimresimler.com"];

const IOS_STRINGS = {
  NSCameraUsageDescription: "Our Pixs uses the camera to scan event QR codes and take photos for the shared album.",
  NSPhotoLibraryUsageDescription: "Our Pixs lets you choose photos and videos to add to an event album.",
  NSPhotoLibraryAddUsageDescription: "Our Pixs saves event photos and videos you download to your photo library.",
  NSMicrophoneUsageDescription: "Our Pixs uses the microphone to record sound with videos for the event album.",
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name,
  slug: "ourpixs",
  scheme: "ourpixs",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  userInterfaceStyle: "light",
  backgroundColor: "#0A0A0A",
  primaryColor: "#2347E0",
  description: "Collect every guest's photos and videos in one private album. Guests scan a QR code; no app or sign-up for them.",
  githubUrl: undefined,
  ios: {
    bundleIdentifier: bundleId,
    supportsTablet: false,
    associatedDomains: GUEST_DOMAINS.map((d) => `applinks:${d}`),
    config: { usesNonExemptEncryption: false },
    infoPlist: {
      ...IOS_STRINGS,
      CFBundleAllowMixedLocalizations: true,
      ITSAppUsesNonExemptEncryption: false,
    },
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyCollectedDataTypes: [],
      NSPrivacyAccessedAPITypes: [
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults", NSPrivacyAccessedAPITypeReasons: ["CA92.1"] },
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp", NSPrivacyAccessedAPITypeReasons: ["C617.1"] },
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategorySystemBootTime", NSPrivacyAccessedAPITypeReasons: ["35F9.1"] },
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryDiskSpace", NSPrivacyAccessedAPITypeReasons: ["E174.1"] },
      ],
    },
  },
  android: {
    package: bundleId,
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      monochromeImage: "./assets/images/adaptive-icon-monochrome.png",
      backgroundColor: "#0A0A0A",
    },
    predictiveBackGestureEnabled: false,
    // Minimal: camera + notifications. Photo picking uses the system Photo Picker (no storage permission).
    permissions: ["android.permission.CAMERA", "android.permission.POST_NOTIFICATIONS"],
    // READ_MEDIA_* are not needed: picking uses the system Photo Picker and saving uses writeOnly MediaStore
    // inserts (no runtime permission on Android 13+). WRITE_EXTERNAL_STORAGE stays for saving on Android ≤ 12.
    blockedPermissions: [
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.READ_MEDIA_IMAGES",
      "android.permission.READ_MEDIA_VIDEO",
      "android.permission.READ_MEDIA_AUDIO",
      "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
      "android.permission.ACCESS_MEDIA_LOCATION",
      "android.permission.SYSTEM_ALERT_WINDOW",
      "android.permission.RECORD_AUDIO",
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
    ],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: GUEST_DOMAINS.map((host) => ({ scheme: "https", host, pathPrefix: "/g/" })),
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  web: {
    output: "single",
    favicon: "./assets/images/favicon.png",
    bundler: "metro",
  },
  locales: {
    en: "./locales/en.json",
    tr: "./locales/tr.json",
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      { backgroundColor: "#0A0A0A", image: "./assets/images/splash-icon.png", imageWidth: 180, resizeMode: "contain" },
    ],
    "expo-font",
    "expo-asset",
    "expo-secure-store",
    "expo-sharing",
    "expo-web-browser",
    [
      "expo-camera",
      {
        cameraPermission: IOS_STRINGS.NSCameraUsageDescription,
        microphonePermission: IOS_STRINGS.NSMicrophoneUsageDescription,
        recordAudioAndroid: false,
        barcodeScannerEnabled: true,
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission: IOS_STRINGS.NSPhotoLibraryUsageDescription,
        cameraPermission: IOS_STRINGS.NSCameraUsageDescription,
        microphonePermission: IOS_STRINGS.NSMicrophoneUsageDescription,
      },
    ],
    [
      "expo-media-library",
      {
        photosPermission: IOS_STRINGS.NSPhotoLibraryUsageDescription,
        savePhotosPermission: IOS_STRINGS.NSPhotoLibraryAddUsageDescription,
        isAccessMediaLocationEnabled: false,
        granularPermissions: ["photo", "video"],
      },
    ],
    [
      "expo-notifications",
      { icon: "./assets/images/notification-icon.png", color: "#2347E0", defaultChannel: "uploads", mode: IS_DEV ? "development" : "production" },
    ],
    ["expo-audio", { microphonePermission: false, recordAudioAndroid: false }],
    ["expo-video", { supportsBackgroundPlayback: false, supportsPictureInPicture: false }],
    ["expo-localization", { supportedLocales: { ios: ["en", "tr"], android: ["en", "tr"] } }],
    "expo-build-properties",
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "https://ourpixs.com",
    demo: process.env.EXPO_PUBLIC_DEMO === "1",
    eas: process.env.EAS_PROJECT_ID ? { projectId: process.env.EAS_PROJECT_ID } : undefined,
    router: { origin: false },
  },
  owner: process.env.EAS_OWNER || undefined,
  runtimeVersion: { policy: "appVersion" },
});
