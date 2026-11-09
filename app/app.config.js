// Builds on app.json.
//
// Plain-HTTP (cleartext) traffic is allowed on Android only when the API address
// needs it: local Wi-Fi testing (http://<wifi-ip>:4000) or a dev build with no
// API_URL. A build pointed at an https:// API refuses cleartext, so tokens and
// conversations can't travel unencrypted. Set ALLOW_CLEARTEXT=1 to force it on.
//
// Google sign-in: Android needs no plugin (only the Web client id, read at run
// time from EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID). iOS needs the iOS client's URL
// scheme, so the plugin is added once EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID is set.
module.exports = ({ config }) => {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? '';
  const allowCleartext = process.env.ALLOW_CLEARTEXT === '1' || !apiUrl.startsWith('https://');
  const plugins = (config.plugins ?? []).map((plugin) =>
    Array.isArray(plugin) && plugin[0] === 'expo-build-properties'
      ? [plugin[0], { ...plugin[1], android: { ...plugin[1]?.android, usesCleartextTraffic: allowCleartext } }]
      : plugin,
  );

  // 1234-abc.apps.googleusercontent.com → com.googleusercontent.apps.1234-abc
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  if (iosClientId) {
    const iosUrlScheme = `com.googleusercontent.apps.${iosClientId.replace(/\.apps\.googleusercontent\.com$/, '')}`;
    plugins.push(['@react-native-google-signin/google-signin', { iosUrlScheme }]);
  }

  return { ...config, plugins };
};
