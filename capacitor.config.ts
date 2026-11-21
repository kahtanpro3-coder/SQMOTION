import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sqmotion.app',
  appName: 'SQMOTION',
  webDir: 'dist',
  server: {
    url: 'https://sqmotion-api.onrender.com',
    cleartext: false
  }
};

export default config;
