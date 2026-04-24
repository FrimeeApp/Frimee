import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.frimee.app',
  appName: 'Frimee',
  webDir: "out",
  plugins: {
    Keyboard: {
      resize: "none",
      scrollOnFocus: false,
    },
  },
};

export default config;
