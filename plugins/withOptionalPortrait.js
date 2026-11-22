// plugins/withOptionalPortrait.js
// ADDED (22 Nov 2026, Taj: fix the Google Play upload warning properly).
// The app is locked to portrait (orientation: 'portrait' in app.config.js). Android reads that as
// "this app needs a portrait screen" and Google Play then hides the app from devices that do not
// report one (some tablets, Chromebooks, foldables, TVs), which is the "required feature
// android.hardware.screen.portrait restricts availability" warning on every upload.
// This marks the feature as wanted but not required: the app still runs in portrait, and Google
// Play stops filtering devices because of it.
// The camera is treated the same way. Asking for the camera permission makes Android assume the
// app cannot work without a camera, and Google Play hides it from devices with none. The camera is
// only used for barcodes and photos, so it is marked optional too.
const { withAndroidManifest } = require('expo/config-plugins')

const OPTIONAL_FEATURES = ['android.hardware.screen.portrait', 'android.hardware.camera']

module.exports = function withOptionalPortrait(config) {
  return withAndroidManifest(config, cfg => {
    const manifest = cfg.modResults.manifest
    const features = (manifest['uses-feature'] || []).filter(f => f.$ && !OPTIONAL_FEATURES.includes(f.$['android:name']))
    for (const name of OPTIONAL_FEATURES) features.push({ $: { 'android:name': name, 'android:required': 'false' } })
    manifest['uses-feature'] = features
    return cfg
  })
}
