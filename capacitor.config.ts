import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.9fd8ecbe7abd4199b5bc1d188442b194',
  appName: 'vencon-unity',
  webDir: 'dist',
  server: {
    url: 'https://9fd8ecbe-7abd-4199-b5bc-1d188442b194.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
