// Use Expo's Metro config helper for Expo-managed projects
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Preserve defaults and extend asset extensions (instead of replacing them)
config.resolver.assetExts = [
  ...config.resolver.assetExts,
  'db', 'mp4', 'jpg', 'png', 'svg', 'ttf', 'otf',
];

module.exports = config;
