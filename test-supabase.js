#!/usr/bin/env node

/**
 * Simple Supabase Connection Test
 */

require('dotenv').config({ path: './.env' });
const { supabase } = require('./iyaya-backend/config/supabase');

async function testSupabaseConnection() {
  console.log('🔍 Testing Supabase Connection...\n');

  try {
    // Test basic connection
    console.log('📡 Testing basic connection...');
    const { data, error } = await supabase.from('users').select('count').single();

    if (error && error.code === 'PGRST116') {
      console.log('⚠️  Users table does not exist yet');
      console.log('📋 You need to run the database migrations first');
      return;
    }

    if (error) {
      console.log('❌ Connection failed:', error.message);
      return;
    }

    console.log('✅ Supabase connected successfully!');

    // Check if we have any data
    console.log('\n📊 Checking data...');
    const { count, error: countError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.log('❌ Error checking data:', countError.message);
    } else {
      console.log(`👥 Users in database: ${count || 0}`);
    }

    // Test other tables
    const tables = ['conversations', 'messages', 'jobs', 'bookings'];
    console.log('\n📋 Checking table existence...');

    for (const table of tables) {
      try {
        const { error } = await supabase.from(table).select('count').single();
        if (error && error.code === 'PGRST116') {
          console.log(`❌ ${table}: Does not exist`);
        } else if (error) {
          console.log(`❌ ${table}: Error - ${error.message}`);
        } else {
          console.log(`✅ ${table}: Exists`);
        }
      } catch (err) {
        console.log(`❌ ${table}: Error - ${err.message}`);
      }
    }

  } catch (err) {
    console.log('❌ Unexpected error:', err.message);
  }
}

testSupabaseConnection();
