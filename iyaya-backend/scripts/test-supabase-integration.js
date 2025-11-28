#!/usr/bin/env node

/**
 * Supabase Integration Testing Script
 *
 * Tests the Supabase integration to ensure authentication, database operations,
 * and file uploads are working correctly.
 *
 * Usage: node test-supabase-integration.js
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Load environment variables
require("dotenv").config();

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Supabase configuration not found in environment variables");
  process.exit(1);
}

// Initialize Supabase clients
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Test results
const results = {
  connection: { success: false, message: "" },
  auth: { success: false, message: "" },
  users: { success: false, message: "" },
  conversations: { success: false, message: "" },
  messages: { success: false, message: "" },
  storage: { success: false, message: "" },
  realtime: { success: false, message: "" },
};

/**
 * Test Supabase connection
 */
async function testConnection() {
  try {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("count", { count: "exact", head: true });

    if (error) {
      results.connection = {
        success: false,
        message: `Connection failed: ${error.message}`,
      };
    } else {
      results.connection = {
        success: true,
        message: "Successfully connected to Supabase",
      };
    }
  } catch (error) {
    results.connection = {
      success: false,
      message: `Connection error: ${error.message}`,
    };
  }
}

/**
 * Test authentication functionality
 */
async function testAuth() {
  try {
    // Test signup
    const testEmail = `test-user-${Date.now()}@example.com`;
    const testPassword = "testpassword123";

    const { data: signupData, error: signupError } =
      await supabaseAdmin.auth.signUp({
        email: testEmail,
        password: testPassword,
        options: {
          data: {
            name: "Test User",
            role: "parent",
          },
        },
      });

    if (signupError) {
      results.auth = {
        success: false,
        message: `Signup failed: ${signupError.message}`,
      };
      return;
    }

    // Test signin
    const { data: signinData, error: signinError } =
      await supabaseAdmin.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      });

    if (signinError) {
      results.auth = {
        success: false,
        message: `Signin failed: ${signinError.message}`,
      };
      return;
    }

    // Test token validation
    if (signinData.user && signinData.session) {
      results.auth = {
        success: true,
        message: "Authentication working correctly",
      };

      // Clean up test user
      await supabaseAdmin.auth.admin.deleteUser(signupData.user.id);
    } else {
      results.auth = { success: false, message: "Token validation failed" };
    }
  } catch (error) {
    results.auth = {
      success: false,
      message: `Auth test error: ${error.message}`,
    };
  }
}

/**
 * Test users table operations
 */
async function testUsers() {
  try {
    // Test user creation
    const testUser = {
      email: `test-user-${Date.now()}@example.com`,
      name: "Test User",
      role: "parent",
      status: "active",
    };

    const { data: createdUser, error: createError } = await supabaseAdmin
      .from("users")
      .insert(testUser)
      .select()
      .single();

    if (createError) {
      results.users = {
        success: false,
        message: `User creation failed: ${createError.message}`,
      };
      return;
    }

    // Test user retrieval
    const { data: retrievedUser, error: retrieveError } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", createdUser.id)
      .single();

    if (retrieveError) {
      results.users = {
        success: false,
        message: `User retrieval failed: ${retrieveError.message}`,
      };
      return;
    }

    // Test user update
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from("users")
      .update({ name: "Updated Test User" })
      .eq("id", createdUser.id)
      .select()
      .single();

    if (updateError) {
      results.users = {
        success: false,
        message: `User update failed: ${updateError.message}`,
      };
      return;
    }

    // Clean up
    await supabaseAdmin.from("users").delete().eq("id", createdUser.id);

    results.users = {
      success: true,
      message: "Users table operations working correctly",
    };
  } catch (error) {
    results.users = {
      success: false,
      message: `Users test error: ${error.message}`,
    };
  }
}

/**
 * Test conversations table operations
 */
async function testConversations() {
  try {
    // Create test users first
    const testUser1 = {
      email: `test-user1-${Date.now()}@example.com`,
      name: "Test User 1",
      role: "parent",
    };

    const testUser2 = {
      email: `test-user2-${Date.now()}@example.com`,
      name: "Test User 2",
      role: "caregiver",
    };

    const { data: user1 } = await supabaseAdmin
      .from("users")
      .insert(testUser1)
      .select()
      .single();
    const { data: user2 } = await supabaseAdmin
      .from("users")
      .insert(testUser2)
      .select()
      .single();

    // Test conversation creation
    const testConversation = {
      participant_1: user1.id,
      participant_2: user2.id,
      type: "admin_user",
    };

    const { data: conversation, error: createError } = await supabaseAdmin
      .from("conversations")
      .insert(testConversation)
      .select()
      .single();

    if (createError) {
      results.conversations = {
        success: false,
        message: `Conversation creation failed: ${createError.message}`,
      };
      return;
    }

    // Test conversation retrieval
    const { data: conversations, error: retrieveError } = await supabaseAdmin
      .from("conversations")
      .select("*")
      .eq("id", conversation.id);

    if (retrieveError) {
      results.conversations = {
        success: false,
        message: `Conversation retrieval failed: ${retrieveError.message}`,
      };
      return;
    }

    // Clean up
    await supabaseAdmin
      .from("conversations")
      .delete()
      .eq("id", conversation.id);
    await supabaseAdmin.from("users").delete().eq("id", user1.id);
    await supabaseAdmin.from("users").delete().eq("id", user2.id);

    results.conversations = {
      success: true,
      message: "Conversations table operations working correctly",
    };
  } catch (error) {
    results.conversations = {
      success: false,
      message: `Conversations test error: ${error.message}`,
    };
  }
}

/**
 * Test messages table operations
 */
async function testMessages() {
  try {
    // Create test users and conversation first
    const testUser1 = {
      email: `test-user1-${Date.now()}@example.com`,
      name: "Test User 1",
      role: "parent",
    };
    const testUser2 = {
      email: `test-user2-${Date.now()}@example.com`,
      name: "Test User 2",
      role: "caregiver",
    };

    const { data: user1 } = await supabaseAdmin
      .from("users")
      .insert(testUser1)
      .select()
      .single();
    const { data: user2 } = await supabaseAdmin
      .from("users")
      .insert(testUser2)
      .select()
      .single();

    const testConversation = {
      participant_1: user1.id,
      participant_2: user2.id,
      type: "admin_user",
    };

    const { data: conversation } = await supabaseAdmin
      .from("conversations")
      .insert(testConversation)
      .select()
      .single();

    // Test message creation
    const testMessage = {
      conversation_id: conversation.id,
      sender_id: user1.id,
      recipient_id: user2.id,
      content: "Test message",
      message_type: "text",
    };

    const { data: message, error: createError } = await supabaseAdmin
      .from("messages")
      .insert(testMessage)
      .select()
      .single();

    if (createError) {
      results.messages = {
        success: false,
        message: `Message creation failed: ${createError.message}`,
      };
      return;
    }

    // Test message retrieval
    const { data: messages, error: retrieveError } = await supabaseAdmin
      .from("messages")
      .select("*")
      .eq("conversation_id", conversation.id);

    if (retrieveError) {
      results.messages = {
        success: false,
        message: `Message retrieval failed: ${retrieveError.message}`,
      };
      return;
    }

    // Clean up
    await supabaseAdmin.from("messages").delete().eq("id", message.id);
    await supabaseAdmin
      .from("conversations")
      .delete()
      .eq("id", conversation.id);
    await supabaseAdmin.from("users").delete().eq("id", user1.id);
    await supabaseAdmin.from("users").delete().eq("id", user2.id);

    results.messages = {
      success: true,
      message: "Messages table operations working correctly",
    };
  } catch (error) {
    results.messages = {
      success: false,
      message: `Messages test error: ${error.message}`,
    };
  }
}

/**
 * Test storage functionality
 */
async function testStorage() {
  try {
    // Test file upload to uploads bucket
    const testFileName = `test-file-${Date.now()}.txt`;
    const testFileContent = "This is a test file for Supabase storage";

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from("uploads")
      .upload(testFileName, testFileContent, {
        contentType: "text/plain",
      });

    if (uploadError) {
      results.storage = {
        success: false,
        message: `File upload failed: ${uploadError.message}`,
      };
      return;
    }

    // Test public URL generation
    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from("uploads").getPublicUrl(uploadData.path);

    if (!publicUrl) {
      results.storage = {
        success: false,
        message: "Public URL generation failed",
      };
      return;
    }

    // Test file deletion
    const { error: deleteError } = await supabaseAdmin.storage
      .from("uploads")
      .remove([uploadData.path]);

    if (deleteError) {
      results.storage = {
        success: false,
        message: `File deletion failed: ${deleteError.message}`,
      };
      return;
    }

    results.storage = {
      success: true,
      message: "Storage operations working correctly",
    };
  } catch (error) {
    results.storage = {
      success: false,
      message: `Storage test error: ${error.message}`,
    };
  }
}

/**
 * Test realtime functionality (basic subscription test)
 */
async function testRealtime() {
  try {
    // Test basic realtime subscription
    const channel = supabaseAdmin
      .channel("test-channel")
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          results.realtime = {
            success: true,
            message: "Realtime subscription working correctly",
          };

          // Clean up subscription
          supabaseAdmin.removeChannel(channel);
        }
      });

    // Wait a moment for subscription to complete
    await new Promise((resolve) => setTimeout(resolve, 1000));
  } catch (error) {
    results.realtime = {
      success: false,
      message: `Realtime test error: ${error.message}`,
    };
  }
}

/**
 * Print test results
 */
function printResults() {
  console.log("\n" + "=".repeat(60));
  console.log("🧪 SUPABASE INTEGRATION TEST RESULTS");
  console.log("=".repeat(60));

  Object.entries(results).forEach(([test, result]) => {
    const status = result.success ? "✅" : "❌";
    console.log(`${status} ${test.toUpperCase()}: ${result.message}`);
  });

  const passed = Object.values(results).filter((r) => r.success).length;
  const total = Object.keys(results).length;
  const successRate = ((passed / total) * 100).toFixed(1);

  console.log("\n📊 SUMMARY:");
  console.log(`Passed: ${passed}/${total} tests (${successRate}%)`);

  if (passed === total) {
    console.log(
      "🎉 All tests passed! Supabase integration is working correctly.",
    );
  } else {
    console.log("⚠️  Some tests failed. Please review the errors above.");
  }

  console.log("=".repeat(60));
}

/**
 * Run all tests
 */
async function runTests() {
  console.log("🧪 Starting Supabase integration tests...");

  try {
    await testConnection();
    await testAuth();
    await testUsers();
    await testConversations();
    await testMessages();
    await testStorage();
    await testRealtime();

    printResults();
  } catch (error) {
    console.error("❌ Test suite failed:", error.message);
    process.exit(1);
  }
}

// Handle script execution
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests, results };
