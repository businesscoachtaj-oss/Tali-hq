// Tali HQ app config.
// Stack pinned to Totality's exact Expo 54 / React Native 0.81.5 set (the pair
// that passes App Review for Totality and Totality Nutrition). Do not bump the
// SDK here without bumping Totality first.
module.exports = {
  expo: {
    owner: 'livewellpt',
    name: 'Tali HQ',
    slug: 'tali-hq',
    version: '1.0.2',
    scheme: 'talihq',
    orientation: 'portrait',
    // Tali's own icon art (Tali_icon_1024). Swap for a dedicated Tali HQ icon if Taj wants one.
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#272626',
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'au.com.totality360.talihq',
      // Sleep keeps playing with the screen locked. expo-audio 1.1 only adds this for background
      // recording, so it is set here by hand (3 Nov 2026).
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
    plugins: ['expo-router', 'expo-notifications', ['expo-audio', { microphonePermission: 'Tali uses the microphone when you tap the mic in Talk to send her a voice note.', recordAudioAndroid: true }], ['expo-image-picker', { photosPermission: 'Tali uses your photos when you choose one to send her in a chat.', cameraPermission: 'Tali uses the camera when you choose to take a photo to send her.', microphonePermission: 'Tali uses the microphone when you tap the mic in Talk to send her a voice note.' }]],
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
