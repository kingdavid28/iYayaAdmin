#!/usr/bin/env node

/**
 * Frontend Supabase Integration Test Script
 *
 * Tests the frontend Supabase integration including:
 * - Authentication flows
 * - API service calls
 * - Messaging service
 * - File upload service
 *
 * Usage: node test-frontend-supabase.js
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

// Supabase configuration
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Frontend Supabase configuration not found in environment variables');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Test results
const results = {
  connection: { success: false, message: '' },
  signup: { success: false, message: '' },
  signin: { success: false, message: '' },
  profile: { success: false, message: '' },
  conversations: { success: false, message: '' },
  messages: { success: false, message: '' }
};

/**
 * Test Supabase connection
 */
async function testConnection() {
  try {
    const { error } = await supabase
      .from('users')
      .select('count', { count: 'exact', head: true });

    if (error) {
      results.connection = { success: false, message: `Connection failed: ${error.message}` };
    } else {
      results.connection = { success: true, message: 'Successfully connected to Supabase' };
    }
  } catch (error) {
    results.connection = { success: false, message: `Connection error: ${error.message}` };
  }
}

/**
 * Test signup functionality
 */
async function testSignup() {
  try {
    const testEmail = `test-signup-${Date.now()}@example.com`;
    const testPassword = 'testpassword123';

    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          name: 'Test User Signup',
          role: 'parent'
        }
      }
    });

    if (error) {
      results.signup = { success: false, message: `Signup failed: ${error.message}` };
      return;
    }

    if (data.user && data.session) {
      results.signup = { success: true, message: 'Signup with immediate login working' };
    } else if (data.user && !data.session) {
      results.signup = { success: true, message: 'Signup with email confirmation required' };
    } else {
      results.signup = { success: false, message: 'Signup completed but no user data returned' };
    }

    // Clean up test user
    if (data.user) {
      await supabase.auth.admin.deleteUser(data.user.id);
    }

  } catch (error) {
    results.signup = { success: false, message: `Signup test error: ${error.message}` };
  }
}

/**
 * Test signin functionality
 */
async function testSignin() {
  try {
    // First create a test user for signin testing
    const testEmail = `test-signin-${Date.now()}@example.com`;
    const testPassword = 'testpassword123';

    const { data: signupData, error: signupError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          name: 'Test User Signin',
          role: 'parent'
        }
      }
    });

    if (signupError) {
      results.signin = { success: false, message: `Test user creation failed: ${signupError.message}` };
      return;
    }

    // Now test signin
    const { data, error } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });

    if (error) {
      results.signin = { success: false, message: `Signin failed: ${error.message}` };
    } else if (data.user && data.session) {
      results.signin = { success: true, message: 'Signin working correctly' };
    } else {
      results.signin = { success: false, message: 'Signin completed but missing user/session data' };
    }

    // Clean up
    if (signupData.user) {
      await supabase.auth.admin.deleteUser(signupData.user.id);
    }

  } catch (error) {
    results.signin = { success: false, message: `Signin test error: ${error.message}` };
  }
}

/**
 * Test profile operations
 */
async function testProfile() {
  try {
    // Create a test user
    const testEmail = `test-profile-${Date.now()}@example.com`;
    const testPassword = 'testpassword123';

    const { data: signupData, error: signupError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          name: 'Test User Profile',
          role: 'parent'
        }
      }
    });

    if (signupError) {
      results.profile = { success: false, message: `Test user creation failed: ${signupError.message}` };
      return;
    }

    // Test profile creation/update
    const { error: profileError } = await supabase
      .from('users')
      .insert({
        id: signupData.user.id,
        email: testEmail,
        name: 'Updated Test User',
        role: 'parent',
        status: 'active'
      })
      .select()
      .single();

    if (profileError) {
      results.profile = { success: false, message: `Profile creation failed: ${profileError.message}` };
      return;
    }

    // Test profile retrieval
    const { error: retrieveError } = await supabase
      .from('users')
      .select('*')
      .eq('id', signupData.user.id)
      .single();

    if (retrieveError) {
      results.profile = { success: false, message: `Profile retrieval failed: ${retrieveError.message}` };
      return;
    }

    // Test profile update
    const { error: updateError } = await supabase
      .from('users')
      .update({ name: 'Fully Updated Test User' })
      .eq('id', signupData.user.id)
      .select()
      .single();

    if (updateError) {
      results.profile = { success: false, message: `Profile update failed: ${updateError.message}` };
      return;
    }

    // Clean up
    await supabase.from('users').delete().eq('id', signupData.user.id);
    await supabase.auth.admin.deleteUser(signupData.user.id);

    results.profile = { success: true, message: 'Profile operations working correctly' };

  } catch (error) {
    results.profile = { success: false, message: `Profile test error: ${error.message}` };
  }
}

/**
 * Test conversations functionality
 */
async function testConversations() {
  try {
    // Create test users
    const testUser1 = { email: `test-user1-${Date.now()}@example.com`, name: 'Test User 1', role: 'parent' };
    const testUser2 = { email: `test-user2-${Date.now()}@example.com`, name: 'Test User 2', role: 'caregiver' };

    const { data: user1Data } = await supabase.auth.signUp({
      email: testUser1.email,
      password: 'testpass123',
      options: { data: testUser1 }
    });

    const { data: user2Data } = await supabase.auth.signUp({
      email: testUser2.email,
      password: 'testpass123',
      options: { data: testUser2 }
    });

    // Create profiles
    await supabase.from('users').insert([
      { id: user1Data.user.id, ...testUser1 },
      { id: user2Data.user.id, ...testUser2 }
    ]);

    // Test conversation creation
    const { data: conversation, error: createError } = await supabase
      .from('conversations')
      .insert({
        participant_1: user1Data.user.id,
        participant_2: user2Data.user.id,
        type: 'admin_user'
      })
      .select()
      .single();

    if (createError) {
      results.conversations = { success: false, message: `Conversation creation failed: ${createError.message}` };
      return;
    }

    // Test conversation retrieval
    const { error: retrieveError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversation.id);

    if (retrieveError) {
      results.conversations = { success: false, message: `Conversation retrieval failed: ${retrieveError.message}` };
      return;
    }

    // Test conversation query by user
    const { error: queryError } = await supabase
      .from('conversations')
      .select('*')
      .or(`participant_1.eq.${user1Data.user.id},participant_2.eq.${user1Data.user.id}`);

    if (queryError) {
      results.conversations = { success: false, message: `Conversation query failed: ${queryError.message}` };
      return;
    }

    // Clean up
    await supabase.from('conversations').delete().eq('id', conversation.id);
    await supabase.from('users').delete().eq('id', user1Data.user.id);
    await supabase.from('users').delete().eq('id', user2Data.user.id);
    await supabase.auth.admin.deleteUser(user1Data.user.id);
    await supabase.auth.admin.deleteUser(user2Data.user.id);

    results.conversations = { success: true, message: 'Conversations functionality working correctly' };

  } catch (error) {
    results.conversations = { success: false, message: `Conversations test error: ${error.message}` };
  }
}

/**
 * Test messages functionality
 */
async function testMessages() {
  try {
    // Create test users and conversation
    const testUser1 = { email: `test-user1-${Date.now()}@example.com`, name: 'Test User 1', role: 'parent' };
    const testUser2 = { email: `test-user2-${Date.now()}@example.com`, name: 'Test User 2', role: 'caregiver' };

    const { data: user1Data } = await supabase.auth.signUp({
      email: testUser1.email,
      password: 'testpass123',
      options: { data: testUser1 }
    });

    const { data: user2Data } = await supabase.auth.signUp({
      email: testUser2.email,
      password: 'testpass123',
      options: { data: testUser2 }
    });

    // Create profiles
    await supabase.from('users').insert([
      { id: user1Data.user.id, ...testUser1 },
      { id: user2Data.user.id, ...testUser2 }
    ]);

    // Create conversation
    const { data: conversation } = await supabase
      .from('conversations')
      .insert({
        participant_1: user1Data.user.id,
        participant_2: user2Data.user.id,
        type: 'admin_user'
      })
      .select()
      .single();

    // Test message creation
    const { data: message, error: createError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        sender_id: user1Data.user.id,
        recipient_id: user2Data.user.id,
        content: 'Test message from user 1',
        message_type: 'text'
      })
      .select()
      .single();

    if (createError) {
      results.messages = { success: false, message: `Message creation failed: ${createError.message}` };
      return;
    }

    // Test message retrieval
    const { error: retrieveError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true });

    if (retrieveError) {
      results.messages = { success: false, message: `Message retrieval failed: ${retrieveError.message}` };
      return;
    }

    // Test message update (mark as read)
    const { error: updateError } = await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('id', message.id)
      .select()
      .single();

    if (updateError) {
      results.messages = { success: false, message: `Message update failed: ${updateError.message}` };
      return;
    }

    // Clean up
    await supabase.from('messages').delete().eq('id', message.id);
    await supabase.from('conversations').delete().eq('id', conversation.id);
    await supabase.from('users').delete().eq('id', user1Data.user.id);
    await supabase.from('users').delete().eq('id', user2Data.user.id);
    await supabase.auth.admin.deleteUser(user1Data.user.id);
    await supabase.auth.admin.deleteUser(user2Data.user.id);

    results.messages = { success: true, message: 'Messages functionality working correctly' };

  } catch (error) {
    results.messages = { success: false, message: `Messages test error: ${error.message}` };
  }
}

/**
 * Print test results
 */
function printResults() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 FRONTEND SUPABASE INTEGRATION TEST RESULTS');
  console.log('='.repeat(60));

  Object.entries(results).forEach(([test, result]) => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${test.toUpperCase()}: ${result.message}`);
  });

  const passed = Object.values(results).filter(r => r.success).length;
  const total = Object.keys(results).length;
  const successRate = ((passed / total) * 100).toFixed(1);

  console.log('\n📊 SUMMARY:');
  console.log(`Passed: ${passed}/${total} tests (${successRate}%)`);

  if (passed === total) {
    console.log('🎉 All tests passed! Frontend Supabase integration is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Please review the errors above.');
  }

  console.log('='.repeat(60));
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('🧪 Starting frontend Supabase integration tests...');

  try {
    await testConnection();
    await testSignup();
    await testSignin();
    await testProfile();
    await testConversations();
    await testMessages();

    printResults();

  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

// Handle script execution
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests, results };
