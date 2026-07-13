import type { CapacitorConfig } from '@capacitor/cli';

// Native iOS/Android shells wrap the built web app. Build with VITE_API_URL
// pointing at your deployed API (e.g. https://your-app.vercel.app) first:
//   VITE_API_URL=https://your-app.vercel.app npm run build -w @compass/web
//   npm run mobile:sync -w @compass/web
const config: CapacitorConfig = {
  appId: 'demo.compass.childcare',
  appName: 'Child Care Compass',
  webDir: 'dist',
  backgroundColor: '#f7f9fb',
};

export default config;
