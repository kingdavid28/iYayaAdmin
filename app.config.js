import 'dotenv/config';
import { config } from 'dotenv';

// Load environment-specific variables
const env = process.env.NODE_ENV || 'development';

if (env === 'production') {
  config({ path: '.env.production' });
} else if (env === 'development') {
  config({ path: '.env.development' });
}

// Fallback to default .env
config();

export default ({ config }) => {
  // Validate required environment variables
  const requiredEnvVars = [
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    'EXPO_PUBLIC_API_URL'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    console.warn(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  const isProduction = process.env.NODE_ENV === 'production';

  return {
    ...config,
    // Android package name
    android: {
      package: 'com.kingdavid28.iyayaadmin'
    },
    // Production optimizations
    ...(isProduction && {
      // Disable source maps in production for performance
      sourceMaps: false,
      // Enable bundle optimization
      optimization: {
        enabled: true,
        config: {
          minifier: 'terser',
        },
      },
    }),
    extra: {
      // App Configuration
      EXPO_PUBLIC_APP_NAME: process.env.EXPO_PUBLIC_APP_NAME || 'Iyaya',
      EXPO_PUBLIC_EAS_PROJECT_ID: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
      EXPO_PUBLIC_ENVIRONMENT: process.env.EXPO_PUBLIC_ENVIRONMENT || env,
      EXPO_PUBLIC_VERSION: process.env.EXPO_PUBLIC_VERSION || '1.0.0',

      // API Configuration
      EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
      EXPO_PUBLIC_API_HOST: process.env.EXPO_PUBLIC_API_HOST,
      EXPO_PUBLIC_API_PORT: process.env.EXPO_PUBLIC_API_PORT,
      EXPO_PUBLIC_API_TIMEOUT: process.env.EXPO_PUBLIC_API_TIMEOUT || '30000',
      EXPO_PUBLIC_API_EXTENDED_TIMEOUT: process.env.EXPO_PUBLIC_API_EXTENDED_TIMEOUT || '60000',
      EXPO_PUBLIC_API_MAX_RETRIES: process.env.EXPO_PUBLIC_API_MAX_RETRIES || '3',

      // Supabase Configuration
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      // Note: Service role key should NOT be exposed to frontend
      // EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY,

      // Feature Flags
      EXPO_PUBLIC_MESSAGES_SOURCE: process.env.EXPO_PUBLIC_MESSAGES_SOURCE || 'api',
      EXPO_PUBLIC_ALLOW_UNVERIFIED: process.env.EXPO_PUBLIC_ALLOW_UNVERIFIED || 'false',
      EXPO_PUBLIC_DEV_BYPASS: process.env.EXPO_PUBLIC_DEV_BYPASS || 'false',

      // Authentication
      EXPO_PUBLIC_FACEBOOK_APP_ID: process.env.EXPO_PUBLIC_FACEBOOK_APP_ID,
      // Note: Facebook app secret should NOT be exposed to frontend
      // EXPO_PUBLIC_FACEBOOK_APP_SECRET: process.env.EXPO_PUBLIC_FACEBOOK_APP_SECRET,

      // Other Services
      REACT_APP_GOOGLE_MAPS_API_KEY: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
      EXPO_PUBLIC_ANALYTICS_KEY: process.env.EXPO_PUBLIC_ANALYTICS_KEY,

      // Environment
      ENV: process.env.ENV || env,
      NODE_ENV: env,
      
      // EAS Configuration
      eas: {
        projectId: '4c499015-5b66-4095-8bd0-da8eba7808ba'
      },
    },
  };
};