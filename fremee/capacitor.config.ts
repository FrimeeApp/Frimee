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
      resize: "none",
      resizeOnFullScreen: true,
      scrollOnFocus: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#5B4EFF",
    },
  },
};

export default config;
