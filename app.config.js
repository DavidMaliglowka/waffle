module.exports = {
  expo: {
    name: "waffle",
    slug: "waffle",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "waffle",
    userInterfaceStyle: "automatic",
    newArchEnabled: false,
    splash: {
      image: "./assets/images/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#FAF7F2",
      imageWidth: 80
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.letswaffle.app",
      buildNumber: "7", // Manual versioning since autoIncrement doesn't work with app.config.js
      // Use environment variable for EAS builds, fallback to local file for development
      googleServicesFile: process.env.GOOGLE_SERVICES_PLIST || "./GoogleService-Info.local.plist",
      entitlements: {
        "com.apple.developer.applesignin": ["Default"]
      },
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSLocationWhenInUseUsageDescription: "Waffle does not access your location. This permission is required by system libraries.",
        NSCameraUsageDescription: "Waffle needs access to your camera to record and share video messages with your friends.",
        NSMicrophoneUsageDescription: "Waffle needs access to your microphone to record audio for your video messages.",
        NSPhotoLibraryAddUsageDescription: "Waffle needs permission to save videos to your photo library so you can keep your favorite moments."
      },
      appleTeamId: "GN9HKU8VQ5",
      associatedDomains: [
        "applinks:letswaffle.app",
        "applinks:www.letswaffle.app"
      ]
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      "expo-router",
      "expo-dev-client",
      [
        "react-native-vision-camera",
        {
          cameraPermissionText: "Allow Waffle to access your camera to record video messages",
          microphonePermissionText: "Allow Waffle to record audio for your video messages",
          enableFrameProcessors: false
        }
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/images/icon.png",
          color: "#ffffff",
          sounds: []
        }
      ],
      [
        "expo-build-properties",
        {
          ios: {
            useFrameworks: "static",
            modular_headers: true
          }
        }
      ],
      "@react-native-firebase/app",
      "react-native-compressor"
    ],
    experiments: {
      typedRoutes: true
    },
    extra: {
      router: {},
      eas: {
        projectId: "e57af568-7777-4b6a-925b-53e0ec4afc33"
      }
    }
  }
}; 