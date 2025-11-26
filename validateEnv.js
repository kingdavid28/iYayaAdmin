/**
 * Environment Variable Validation Utility
 * Validates required environment variables and provides helpful error messages
 */

// Load environment-specific variables like app.config.js does
const { config } = require('dotenv');
const env = process.env.NODE_ENV || 'development';

if (env === 'production') {
  config({ path: '.env.production' });
} else if (env === 'development') {
  config({ path: '.env.development' });
}

// Fallback to default .env
config();

const validateEnvironment = () => {
  const requiredVars = {
    // API Configuration
    EXPO_PUBLIC_API_URL: {
      required: true,
      description: 'API base URL',
      pattern: /^https?:\/\/.+/
    },
    
    // Supabase Configuration
    EXPO_PUBLIC_SUPABASE_URL: {
      required: true,
      description: 'Supabase project URL',
      pattern: /^https:\/\/.+\.supabase\.co$/
    },
    EXPO_PUBLIC_SUPABASE_ANON_KEY: {
      required: true,
      description: 'Supabase anonymous key',
      pattern: /^[A-Za-z0-9._-]+$/
    },
    
    // Authentication
    EXPO_PUBLIC_FACEBOOK_APP_ID: {
      required: false,
      description: 'Facebook App ID',
      pattern: /^\d+$/
    },
    
    // Services
    REACT_APP_GOOGLE_MAPS_API_KEY: {
      required: false,
      description: 'Google Maps API Key',
      pattern: /^[A-Za-z0-9_-]+$/
    }
  };

  const errors = [];
  const warnings = [];
  const environment = process.env.NODE_ENV || 'development';

  Object.entries(requiredVars).forEach(([varName, config]) => {
    const value = process.env[varName];
    
    if (!value) {
      if (config.required) {
        errors.push(`❌ Missing required: ${varName} (${config.description})`);
      } else {
        warnings.push(`⚠️  Optional: ${varName} (${config.description})`);
      }
    } else if (config.pattern && !config.pattern.test(value)) {
      errors.push(`❌ Invalid format: ${varName} (expected format: ${config.pattern})`);
    }
  });

  // Environment-specific validations
  if (environment === 'production') {
    // Production-specific checks
    if (process.env.EXPO_PUBLIC_API_URL?.includes('localhost') || 
        process.env.EXPO_PUBLIC_API_URL?.includes('192.168')) {
      errors.push('❌ Production cannot use localhost or local IP addresses');
    }
    
    if (process.env.EXPO_PUBLIC_DEV_BYPASS === 'true') {
      warnings.push('⚠️  DEV_BYPASS should be false in production');
    }
  }

  // Report results
  if (errors.length > 0) {
    console.error('\n🚨 Environment Variable Validation Failed:');
    errors.forEach(error => console.error(`  ${error}`));
    console.error('\nPlease check your .env file and try again.');
    return false;
  }

  if (warnings.length > 0) {
    console.warn('\n⚠️  Environment Variable Warnings:');
    warnings.forEach(warning => console.warn(`  ${warning}`));
  }

  console.log(`✅ Environment validation passed for ${environment}`);
  return true;
};

// Export for use in other files
module.exports = { validateEnvironment };

// Also run validation if this file is executed directly
if (require.main === module) {
  console.log('🔍 Testing Environment Configuration...\n');
  
  // Test current environment
  const isValid = validateEnvironment();
  
  if (isValid) {
    console.log('\n📋 Environment Summary:');
    console.log(`  Environment: ${process.env.NODE_ENV}`);
    console.log(`  API URL: ${process.env.EXPO_PUBLIC_API_URL}`);
    console.log(`  Supabase URL: ${process.env.EXPO_PUBLIC_SUPABASE_URL}`);
    console.log(`  App Name: ${process.env.EXPO_PUBLIC_APP_NAME}`);
    console.log(`  Facebook App ID: ${process.env.EXPO_PUBLIC_FACEBOOK_APP_ID || 'Not configured'}`);
    console.log(`  Google Maps Key: ${process.env.REACT_APP_GOOGLE_MAPS_API_KEY ? '✓ Configured' : 'Not configured'}`);
  }
}