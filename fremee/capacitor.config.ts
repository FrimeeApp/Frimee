import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'com.frimee.app',
  appName: 'Frimee',
  webDir: "out",
  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          cleartext: process.env.CAP_CLEAR_TEXT === "true",
        },
      }
    : {}),
  plugins: {
    Keyboard: {
      resize: "native",
      resizeOnFullScreen: true,
      scrollOnFocus: false,
    },
  },
};

export default config;
