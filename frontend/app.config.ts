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
      // Telemetry. Both fallbacks are PUBLIC client-side keys, the same class as
      // supabaseAnonKey above: a Sentry DSN and a PostHog project key are
      // embedded in every installed copy of the app by design, so they are not
      // secrets. They are committed so an EAS build from a clean checkout is
      // not silently telemetry-blind — .env is gitignored, and a build that
      // quietly reports nothing is the failure you notice six weeks late.
      //
      // Both remain absent-safe: no DSN means crash reporting is a total no-op
      // (src/utils/sentry.ts), and no PostHog key means analytics never starts
      // even after consent is granted (src/features/analytics.ts).
      //
      // Neither grants read access. Someone with these can send events in, not
      // read anything out — which is why they can live here but the Supabase
      // SERVICE ROLE key never could.
      // Sentry project `upcheck-app` (org upcheck-technologies-private-l).
      // The backend has its OWN project, `upcheck-backend`, whose DSN is set as
      // SENTRY_DSN in the Render environment — deliberately separate, so an
      // app crash loop cannot bury a server incident in the same issue stream.
      // This org is on Sentry's EU region (de.sentry.io).
      sentryDsn:
        process.env.EXPO_PUBLIC_SENTRY_DSN ||
        'https://22e456d3d466a11ef1145d89df1831c4@o4511772335865856.ingest.de.sentry.io/4512033193066576',
      posthogApiKey:
        process.env.EXPO_PUBLIC_POSTHOG_API_KEY ||
        'phc_wPSLqk9uyzyC4GzDuczDC73ncqC3jbygPQ7ZxYGmau5R',
      // PostHog routed this account to its US region.
      posthogHost: process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
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
    // Derived from a hash of the actual native project, NOT a hardcoded
    // literal. With a literal, an OTA published after adding native modules is
    // still labelled "1.0.0" and Expo serves it to existing 1.0.0 installs that
    // do not contain those modules — the bundle imports native code that isn't
    // there and every one of those users crashes on launch, with no way to push
    // them a fix. Under the fingerprint policy a native change produces a new
    // runtime automatically, so old binaries simply stop receiving updates
    // instead of receiving poisoned ones.
    //
    // Consequence, deliberate: every install still on 1.0.0 stops receiving
    // OTAs the moment this ships. They must install the new build. That is why
    // the OTA-solvable work landed first, and why the in-app update prompt
    // (sp-react-native-in-app-updates) is in this binary.
    runtimeVersion: { policy: "fingerprint" },
    updates: {
      url: "https://u.expo.dev/f3274022-ae8a-4be6-9085-23f935542a4c"
    }
  }
};
