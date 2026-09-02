import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'eg.edu.kfs.nursing.attendance',
  appName: 'Attendance System',
  webDir: 'dist',
  plugins: {
    Geolocation: {},
  },
};

export default config;
