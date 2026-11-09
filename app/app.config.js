// Builds on app.json. Plain-HTTP (cleartext) traffic is allowed on Android only
// when the API address needs it: local Wi-Fi testing (http://<wifi-ip>:4000) or
// a dev build with no API_URL. A build pointed at an https:// API refuses
// cleartext, so tokens and conversations can't travel unencrypted.
// Set ALLOW_CLEARTEXT=1 to force it on anyway.
module.exports = ({ config }) => {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? '';
  const allowCleartext = process.env.ALLOW_CLEARTEXT === '1' || !apiUrl.startsWith('https://');
  return {
    ...config,
    plugins: (config.plugins ?? []).map((plugin) =>
      Array.isArray(plugin) && plugin[0] === 'expo-build-properties'
        ? [plugin[0], { ...plugin[1], android: { ...plugin[1]?.android, usesCleartextTraffic: allowCleartext } }]
        : plugin,
    ),
  };
};
