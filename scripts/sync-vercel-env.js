#!/usr/bin/env node
/**
 * Sync safe .env values into Vercel.
 * Usage: npm run sync:vercel-env -- --project <project-name> --env production
 *
 * Requires Vercel CLI (`npm i -g vercel`) and a prior `vercel login`.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const SAFE_PREFIXES = ['EXPO_PUBLIC_', 'REACT_APP_', 'ENV', 'NODE_ENV', 'EAS_'];
const EXCLUDED_KEYS = ['SUPABASE_SERVICE_ROLE_KEY'];

const argv = process.argv.slice(2);
const projectFlagIndex = argv.indexOf('--project');
const envFlagIndex = argv.indexOf('--env');

if (projectFlagIndex === -1 || !argv[projectFlagIndex + 1]) {
  console.error('Missing --project <vercel-project-name>');
  process.exit(1);
}
const projectName = argv[projectFlagIndex + 1];
const targetEnv = envFlagIndex !== -1 && argv[envFlagIndex + 1] ? argv[envFlagIndex + 1] : 'production';

const envVars = Object.entries(process.env)
  .filter(([key]) => SAFE_PREFIXES.some(prefix => key.startsWith(prefix)) && !EXCLUDED_KEYS.includes(key));

if (!envVars.length) {
  console.warn('No safe environment variables found to sync.');
  process.exit(0);
}

console.log(`Syncing ${envVars.length} env vars to Vercel project "${projectName}" (${targetEnv})`);

envVars.forEach(([key, value]) => {
  try {
    execSync(
       `npx vercel env add ${key} ${targetEnv}`,
      { input: `${value}\n`, stdio: ['pipe', 'inherit', 'inherit'] }
    );
  } catch (err) {
    console.error(`Failed to sync ${key}: ${err.message}`);
  }
});

console.log('✅ Env sync complete.');