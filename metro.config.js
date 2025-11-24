// Use Expo's Metro config helper for Expo-managed projects
const { getDefaultConfig } = require('expo/metro-config');

// Check if we're in a Vercel build environment
const isVercel = process.env.VERCEL === '1';

let config;
if (isVercel) {
  // Simple config for Vercel builds
  config = {
    resolver: {
      assetExts: ['db', 'mp4', 'jpg', 'png', 'svg', 'ttf', 'otf'],
    },
  };
} else {
  // Full config for local development
  config = getDefaultConfig(__dirname);
  config.resolver.assetExts = [
    ...config.resolver.assetExts,
    'db', 'mp4', 'jpg', 'png', 'svg', 'ttf', 'otf',
  ];
}

module.exports = config;
