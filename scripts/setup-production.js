#!/usr/bin/env node

/**
 * Production Configuration Setup Script
 *
 * This script helps configure your application for production deployment
 * with Supabase. It validates environment variables and creates necessary
 * configuration files.
 *
 * Usage: node setup-production.js
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuration checklist
const checklist = {
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    anonKey: process.env.SUPABASE_ANON_KEY
  },
  frontend: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  },
  backend: {
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    mongodbUri: process.env.MONGODB_URI,
    jwtSecret: process.env.JWT_SECRET
  },
  storage: {
    buckets: ['uploads', 'profiles']
  }
};

/**
 * Validate Supabase configuration
 */
function validateSupabaseConfig() {
  console.log('🔍 Validating Supabase configuration...');

  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ Missing required Supabase environment variables:', missing.join(', '));
    console.log('📝 Please set these in your production environment');
    return false;
  }

  console.log('✅ Supabase configuration is valid');
  return true;
}

/**
 * Validate frontend configuration
 */
function validateFrontendConfig() {
  console.log('🔍 Validating frontend configuration...');

  const required = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ Missing required frontend environment variables:', missing.join(', '));
    console.log('📝 Please set these in your .env file');
    return false;
  }

  console.log('✅ Frontend configuration is valid');
  return true;
}

/**
 * Validate backend configuration
 */
function validateBackendConfig() {
  console.log('🔍 Validating backend configuration...');

  const required = ['NODE_ENV', 'PORT', 'JWT_SECRET'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ Missing required backend environment variables:', missing.join(', '));
    console.log('📝 Please set these in your production environment');
    return false;
  }

  if (process.env.NODE_ENV !== 'production') {
    console.warn('⚠️  NODE_ENV is not set to production');
  }

  console.log('✅ Backend configuration is valid');
  return true;
}

/**
 * Generate production .env file for frontend
 */
function generateFrontendEnv() {
  console.log('📝 Generating frontend .env file...');

  const frontendEnvPath = path.join(__dirname, 'iyaya-admin', '.env');
  const envContent = `# Frontend Environment Variables for Production
# Generated on: ${new Date().toISOString()}

# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=${process.env.SUPABASE_URL}
EXPO_PUBLIC_SUPABASE_ANON_KEY=${process.env.SUPABASE_ANON_KEY}

# API Configuration
EXPO_PUBLIC_API_URL=${process.env.EXPO_PUBLIC_API_URL || 'https://your-backend-domain.com'}

# Development Settings
EXPO_PUBLIC_DEV_BYPASS=false
`;

  try {
    fs.writeFileSync(frontendEnvPath, envContent);
    console.log('✅ Frontend .env file generated successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to generate frontend .env file:', error.message);
    return false;
  }
}

/**
 * Generate production environment file for backend
 */
function generateBackendEnv() {
  console.log('📝 Generating backend environment configuration...');

  const backendEnvPath = path.join(__dirname, 'iyaya-backend', '.env.production');
  const envContent = `# Backend Environment Variables for Production
# Generated on: ${new Date().toISOString()}

# Server Configuration
NODE_ENV=production
PORT=${process.env.PORT || 5000}

# Database Configuration
MONGODB_URI=${process.env.MONGODB_URI}

# Supabase Configuration
SUPABASE_URL=${process.env.SUPABASE_URL}
SUPABASE_SERVICE_ROLE_KEY=${process.env.SUPABASE_SERVICE_ROLE_KEY}
SUPABASE_ANON_KEY=${process.env.SUPABASE_ANON_KEY}

# JWT Configuration
JWT_SECRET=${process.env.JWT_SECRET}
JWT_EXPIRE=30m
JWT_REFRESH_EXPIRE=7d
JWT_COOKIE_EXPIRE=7

# Email Configuration (if using)
EMAIL_HOST=${process.env.EMAIL_HOST}
EMAIL_PORT=${process.env.EMAIL_PORT}
EMAIL_SECURE=true
EMAIL_USERNAME=${process.env.EMAIL_USERNAME}
EMAIL_PASSWORD=${process.env.EMAIL_PASSWORD}
EMAIL_FROM=${process.env.EMAIL_FROM}

# CORS Configuration
CORS_ORIGIN=${process.env.CORS_ORIGIN || 'https://your-frontend-domain.com'}

# Security
RATE_LIMIT_MAX=100
ALLOW_DEV_BYPASS=false

# SSL (if using)
SSL_CERT_PATH=${process.env.SSL_CERT_PATH}
SSL_KEY_PATH=${process.env.SSL_KEY_PATH}
`;

  try {
    fs.writeFileSync(backendEnvPath, envContent);
    console.log('✅ Backend .env.production file generated successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to generate backend .env.production file:', error.message);
    return false;
  }
}

/**
 * Create deployment script
 */
function createDeploymentScript() {
  console.log('📝 Creating deployment script...');

  const deployScript = `#!/bin/bash

# iYaya Production Deployment Script
# Generated on: ${new Date().toISOString()}

echo "🚀 Starting iYaya production deployment..."

# 1. Database Migration
echo "📊 Running database migrations..."
cd iyaya-backend
npm install
cd scripts
node migrate-data.js
cd ../..

# 2. Backend Deployment
echo "🔧 Deploying backend..."
cd iyaya-backend
npm run build
npm start &
BACKEND_PID=$!
cd ..

# 3. Frontend Build
echo "📱 Building frontend..."
cd iyaya-admin
npm install
npx expo build:android
npx expo build:ios
cd ..

# 4. Health Check
echo "🏥 Running health checks..."
curl -f http://localhost:${process.env.PORT || 5000}/api/health || exit 1

echo "✅ Deployment completed successfully!"
echo "🔗 Backend running on PID: $BACKEND_PID"
echo "📊 Monitor logs: tail -f iyaya-backend/server.log"
`;

  try {
    fs.writeFileSync('deploy.sh', deployScript);
    // Make executable
    fs.chmodSync('deploy.sh', '755');
    console.log('✅ Deployment script created successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to create deployment script:', error.message);
    return false;
  }
}

/**
 * Print configuration summary
 */
function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('📋 PRODUCTION CONFIGURATION SUMMARY');
  console.log('='.repeat(60));

  console.log('\n🔧 Environment Variables:');
  Object.entries(checklist).forEach(([category, config]) => {
    console.log(`\n📂 ${category.toUpperCase()}:`);
    Object.entries(config).forEach(([key, value]) => {
      const status = value ? '✅' : '❌';
      console.log(`  ${status} ${key}: ${value ? 'configured' : 'missing'}`);
    });
  });

  console.log('\n📁 Generated Files:');
  console.log('  ✅ iyaya-admin/.env');
  console.log('  ✅ iyaya-backend/.env.production');
  console.log('  ✅ deploy.sh');

  console.log('\n🚀 Next Steps:');
  console.log('  1. Review and update generated configuration files');
  console.log('  2. Run database migration: cd iyaya-backend && npm install && node scripts/migrate-data.js');
  console.log('  3. Test deployment: ./deploy.sh');
  console.log('  4. Update DNS settings to point to your backend domain');
  console.log('  5. Configure SSL certificates for production');

  console.log('='.repeat(60));
}

/**
 * Main setup function
 */
async function setupProduction() {
  console.log('🚀 Setting up production configuration...');

  // Validate configurations
  const supabaseValid = validateSupabaseConfig();
  const frontendValid = validateFrontendConfig();
  const backendValid = validateBackendConfig();

  if (!supabaseValid || !frontendValid || !backendValid) {
    console.error('\n❌ Configuration validation failed. Please fix the issues above.');
    process.exit(1);
  }

  // Generate configuration files
  const frontendEnv = generateFrontendEnv();
  const backendEnv = generateBackendEnv();
  const deployScript = createDeploymentScript();

  if (!frontendEnv || !backendEnv || !deployScript) {
    console.error('\n❌ Failed to generate configuration files.');
    process.exit(1);
  }

  // Print summary
  printSummary();

  console.log('\n✅ Production setup completed successfully!');
  console.log('🎉 Your application is ready for production deployment.');
}

// Handle script execution
if (require.main === module) {
  setupProduction().catch(console.error);
}

module.exports = { setupProduction, checklist };
