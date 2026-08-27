/// <reference types="node" />
const TRUECALLER_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_TRUECALLER_ANDROID_CLIENT_ID || 'e98dcupeqtmcocbxr7qb4g7b4sub8blazhxrt-1ikmw';

export default {
  expo: {
    name: "upcheck",
    slug: "upcheck",
    version: "1.0.0",
    scheme: "upcheckapp",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.upcheck.app"
    },
    android: {
      package: "com.upcheck.app",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      // No intentFilters entry here: `scheme: "upcheckapp"` above already gets Expo
      // to generate the plain custom-scheme intent-filter on prebuild. autoVerify
      // only applies to http/https App Links with a verified domain, so an entry
      // for this custom scheme was a manifest-warning no-op duplicating that filter.
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false
    },
    extra: {
      // These fallbacks are the PUBLIC Supabase project ref + publishable anon key
      // (client-safe by design, not a secret — RLS is the real access control).
      // They're committed so builds from a fresh checkout work without a .env.
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || "https://mcslntwchfucavjrrhnu.supabase.co",
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_Gc9IN6iWX-a-K7UpEqz9PQ_n1KcQncF",
      apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || "https://api.upcheck.in/api",
      googleClientIdWeb: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB || "39325535525-aviskbmsicrapi6akc28qa8ed7mqhuki.apps.googleusercontent.com",
      googleClientIdIos: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS || "557249592391-smcje08fcv71hh1vjhmshhvnklpmd7lo.apps.googleusercontent.com",
      googleClientIdAndroid: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID || "557249592391-omumak2q0qnor86nj47m93ln4fsn8uv3.apps.googleusercontent.com",
      truecallerAndroidClientId: TRUECALLER_ANDROID_CLIENT_ID,
      truecallerIosAppKey: process.env.EXPO_PUBLIC_TRUECALLER_IOS_APP_KEY || '',
      truecallerIosAppLink: process.env.EXPO_PUBLIC_TRUECALLER_IOS_APP_LINK || '',
      eas: {
        projectId: "f3274022-ae8a-4be6-9085-23f935542a4c"
      },
    },
    owner: "utpl-in",
    plugins: [
      "expo-font",
      [
        "expo-notifications",
        {
          // Android small icon MUST be a white-on-transparent silhouette (Android
          // masks by alpha + tints with `color`); a full-colour icon collapses to
          // a solid square. `notification-icon.png` is the white shrimp mark.
          icon: "./assets/notification-icon.png",
          color: "#0D84D6"
        }
      ],
      [
        "expo-camera",
        {
          cameraPermission: "Allow UpCheck to use the camera to scan a worker's QR code."
        }
      ],
      [
        // Attaching a photo to a problem report (ReportIssueScreen).
        //
        // Android needs nothing here — expo-image-picker's own manifest already
        // merges the media permissions, which is why the report screen ships as
        // an OTA update against the current binary. This entry exists for iOS:
        // without NSPhotoLibraryUsageDescription, requesting photo access is a
        // native crash, and Info.plist is not something an OTA update can fix.
        // Harmless to add now, and one less way for the first iOS build to be
        // broken on arrival.
        "expo-image-picker",
        {
          photosPermission: "Allow UpCheck to attach a photo to a problem report you send to the team."
        }
      ],
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "Allow UpCheck to use your location to set your farm position for weather, tide and regional pricing features."
        }
      ],
      "@react-native-google-signin/google-signin",
      // Local Truecaller OAuth SDK plugin: injects the ClientId manifest
      // meta-data, the missed-call permissions, and the SDK Gradle dependency.
      // The native module itself lives in the committed android/ tree (see
      // android/app/src/main/java/com/upcheck/app/truecaller/).
      [
        "./plugins/withTruecaller",
        { clientId: TRUECALLER_ANDROID_CLIENT_ID, sdkVersion: "3.3.0" }
      ]
    ],
    runtimeVersion: "1.0.0",
    updates: {
      url: "https://u.expo.dev/f3274022-ae8a-4be6-9085-23f935542a4c"
    }
  }
};
