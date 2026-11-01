// Tali HQ app config.
// Stack pinned to Totality's exact Expo 54 / React Native 0.81.5 set (the pair
// that passes App Review for Totality and Totality Nutrition). Do not bump the
// SDK here without bumping Totality first.
module.exports = {
  expo: {
    owner: 'livewellpt',
    name: 'Tali HQ',
    slug: 'tali-hq',
    version: '0.1.0',
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
    plugins: ['expo-router', 'expo-notifications'],
    // After `eas init`, add: extra: { eas: { projectId: '<id>' } } so push notifications work.
    experiments: {
      typedRoutes: false,
    },
  },
};
