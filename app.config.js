// Tali HQ app config.
// Stack matches Totality, Totality Training and Totality Nutrition: Expo SDK 58, React Native 0.88.1
// (22 Nov 2026, Taj said yes to the bump). Do not bump the SDK here without bumping those first.
module.exports = {
  expo: {
    owner: 'livewellpt',
    name: 'Learnéd',
    slug: 'tali-hq',
    // 1.0.3 (22 Nov 2026): SDK 58 needs a new store build, and phone updates only reach builds of the
    // same version, so the version moves on with it.
    version: '1.0.3',
    scheme: 'talihq',
    orientation: 'portrait',
    // CHANGED (28 Nov 2026, Taj): Learnéd's icon is the é carved in marble with a gold accent, on old paper.
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    // CHANGED (22 Nov 2026, Expo SDK 58): the splash is set by the expo-splash-screen plugin below.
    // SDK 58 ignores a "splash" block here.
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'au.com.totality360.talihq',
      // Sleep keeps playing with the screen locked (3 Nov 2026). Set by hand as well as by expo-audio's
      // enableBackgroundPlayback below.
      infoPlist: { UIBackgroundModes: ['audio'], ITSAppUsesNonExemptEncryption: false },
    },
    android: {
      package: 'au.com.totality360.talihq',
      adaptiveIcon: {
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
    },
    web: {
      bundler: 'metro',
      output: 'single',
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-router',
      'expo-notifications',
      'expo-font',
      'expo-sharing',
      'expo-web-browser',
      // ADDED (22 Nov 2026, Expo SDK 58): the status bar and the splash, which SDK 58 only takes from
      // these plugins. iPhone keeps the full screen picture (legacy option).
      // CHANGED (28 Nov 2026, Learnéd): dark status bar icons on paper, and the splash is the marble bust with the name.
      ['expo-status-bar', { style: 'dark' }],
      ['expo-splash-screen', { image: './assets/splash-icon.png', backgroundColor: '#F5F0E6', resizeMode: 'contain', imageWidth: 260, enableFullScreenImage_legacy: true }],
      // Voice notes record only while Talk is open, so no background recording service (Google Play
      // flags it). Sleep sounds keep playing with the screen locked.
      ['expo-audio', { microphonePermission: 'Tali uses the microphone when you tap the mic in Talk to send her a voice note.', recordAudioAndroid: true, enableBackgroundRecording: false, enableBackgroundPlayback: true }],
      ['expo-image-picker', { photosPermission: 'Tali uses your photos when you choose one to send her in a chat.', cameraPermission: 'Tali uses the camera when you choose to take a photo to send her.', microphonePermission: 'Tali uses the microphone when you tap the mic in Talk to send her a voice note.' }],
      // ADDED (22 Nov 2026): portrait and camera wanted but not required, so Google Play stops
      // hiding the app from devices without them (the upload warning).
      './plugins/withOptionalPortrait',
      // ADDED (22 Nov 2026): code shrinking (R8) off, same as Totality and Nutrition. With it on, the
      // SDK 58 Android build ran out of memory on EAS twice (Gradle daemon killed during R8).
      ['expo-build-properties', { android: { enableMinifyInReleaseBuilds: false, enableShrinkResourcesInReleaseBuilds: false } }],
    ],
    extra: {
      eas: { projectId: '4fcc84f2-1512-4bdb-a354-80b468efd453' },
    },
    // Over-the-air updates (3 Nov 2026), same setup as Totality and Nutrition. JavaScript-only
    // changes go out with the publish-update workflow (push to ota-publish) and reach installed
    // apps without a store build. runtimeVersion follows the app version, so an update only
    // goes to builds of the same version. The first build after this is the one that turns it on.
    runtimeVersion: { policy: 'appVersion' },
    updates: {
      url: 'https://u.expo.dev/4fcc84f2-1512-4bdb-a354-80b468efd453',
    },
    experiments: {
      typedRoutes: false,
    },
  },
};
