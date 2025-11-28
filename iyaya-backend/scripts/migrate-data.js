#!/usr/bin/env node

/**
 * MongoDB to Supabase Data Migration Script
 *
 * This script migrates data from MongoDB collections to Supabase tables.
 * Run this after setting up your Supabase database and storage buckets.
 *
 * Usage: node migrate-data.js
 */

const mongoose = require("mongoose");
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Load environment variables
require("dotenv").config();

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI not found in environment variables");
  process.exit(1);
}

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Supabase configuration not found in environment variables");
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Migration statistics
const stats = {
  users: { processed: 0, migrated: 0, errors: 0 },
  conversations: { processed: 0, migrated: 0, errors: 0 },
  messages: { processed: 0, migrated: 0, errors: 0 },
  bookings: { processed: 0, migrated: 0, errors: 0 },
  jobs: { processed: 0, migrated: 0, errors: 0 },
  ratings: { processed: 0, migrated: 0, errors: 0 },
  applications: { processed: 0, migrated: 0, errors: 0 },
  notifications: { processed: 0, migrated: 0, errors: 0 },
};

/**
 * Connect to MongoDB
 */
async function connectMongoDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ Failed to connect to MongoDB:", error.message);
    process.exit(1);
  }
}

/**
 * Transform MongoDB user to Supabase user format
 */
function transformUser(mongoUser) {
  return {
    id: mongoUser.firebaseUid || mongoUser._id.toString(),
    email: mongoUser.email,
    name: mongoUser.name,
    first_name: mongoUser.firstName,
    last_name: mongoUser.lastName,
    middle_initial: mongoUser.middleInitial,
    phone: mongoUser.phone,
    address: mongoUser.address?.street || mongoUser.address,
    location: mongoUser.location || mongoUser.address?.city,
    role: mongoUser.role,
    status: mongoUser.status === "banned" ? "suspended" : mongoUser.status,
    profile_image: mongoUser.profileImage,
    email_verified: mongoUser.verification?.emailVerified || false,
    created_at: mongoUser.createdAt,
    updated_at: mongoUser.updatedAt,
    // Additional fields for caregivers
    bio: mongoUser.bio,
    experience: mongoUser.experience,
    skills: mongoUser.skills,
    certifications: mongoUser.certifications,
    hourly_rate: mongoUser.hourly_rate,
    rating: mongoUser.rating,
    review_count: mongoUser.review_count,
    // Legacy fields for compatibility
    firebase_uid: mongoUser.firebaseUid,
    auth_provider: mongoUser.authProvider,
    verification_token: mongoUser.verification?.token,
    verification_expires: mongoUser.verification?.expires,
    background_check_verified: mongoUser.verification?.backgroundCheckVerified,
    login_attempts: mongoUser.loginAttempts,
    lock_until: mongoUser.lockUntil,
    last_login: mongoUser.lastLogin,
    two_factor_enabled: mongoUser.twoFactorEnabled,
  };
}

/**
 * Transform MongoDB conversation to Supabase format
 */
function transformConversation(mongoConversation) {
  return {
    id: mongoConversation._id.toString(),
    participant_1: mongoConversation.participants
      ? Object.keys(mongoConversation.participants)[0]
      : mongoConversation.participant1,
    participant_2: mongoConversation.participants
      ? Object.keys(mongoConversation.participants)[1]
      : mongoConversation.participant2,
    last_message_at:
      mongoConversation.lastMessage?.timestamp || mongoConversation.updatedAt,
    created_at: mongoConversation.createdAt,
    updated_at: mongoConversation.updatedAt,
    type: mongoConversation.type || "admin_user",
  };
}

/**
 * Transform MongoDB message to Supabase format
 */
function transformMessage(mongoMessage) {
  return {
    id: mongoMessage._id.toString(),
    conversation_id:
      mongoMessage.conversationId || mongoMessage.conversation_id,
    sender_id: mongoMessage.senderId,
    recipient_id: mongoMessage.recipientId || mongoMessage.recipient_id,
    content: mongoMessage.content,
    message_type: mongoMessage.type || "text",
    read_at: mongoMessage.readAt || mongoMessage.read_at,
    created_at: mongoMessage.timestamp || mongoMessage.created_at,
    updated_at: mongoMessage.updatedAt,
  };
}

/**
 * Migrate Users
 */
async function migrateUsers() {
  console.log("\n🚀 Starting users migration...");

  try {
    const User = mongoose.model("User");
    const users = await User.find({}).lean();

    stats.users.processed = users.length;

    for (const user of users) {
      try {
        const transformedUser = transformUser(user);

        // Check if user already exists in Supabase
        const { data: existingUser } = await supabase
          .from("users")
          .select("id")
          .eq("id", transformedUser.id)
          .single();

        if (existingUser) {
          console.log(
            `⏭️  User ${transformedUser.email} already exists, skipping`,
          );
          continue;
        }

        const { data, error } = await supabase
          .from("users")
          .insert(transformedUser)
          .select();

        if (error) {
          console.error(
            `❌ Failed to migrate user ${user.email}:`,
            error.message,
          );
          stats.users.errors++;
        } else {
          console.log(`✅ Migrated user: ${transformedUser.email}`);
          stats.users.migrated++;
        }
      } catch (error) {
        console.error(`❌ Error migrating user ${user.email}:`, error.message);
        stats.users.errors++;
      }
    }

    console.log(
      `📊 Users migration complete: ${stats.users.migrated}/${stats.users.processed} migrated, ${stats.users.errors} errors`,
    );
  } catch (error) {
    console.error("❌ Users migration failed:", error.message);
  }
}

/**
 * Migrate Conversations
 */
async function migrateConversations() {
  console.log("\n🚀 Starting conversations migration...");

  try {
    const Conversation = mongoose.model("Conversation");
    const conversations = await Conversation.find({}).lean();

    stats.conversations.processed = conversations.length;

    for (const conversation of conversations) {
      try {
        const transformedConversation = transformConversation(conversation);

        const { data, error } = await supabase
          .from("conversations")
          .insert(transformedConversation)
          .select();

        if (error) {
          console.error(
            `❌ Failed to migrate conversation ${conversation._id}:`,
            error.message,
          );
          stats.conversations.errors++;
        } else {
          console.log(
            `✅ Migrated conversation: ${transformedConversation.id}`,
          );
          stats.conversations.migrated++;
        }
      } catch (error) {
        console.error(
          `❌ Error migrating conversation ${conversation._id}:`,
          error.message,
        );
        stats.conversations.errors++;
      }
    }

    console.log(
      `📊 Conversations migration complete: ${stats.conversations.migrated}/${stats.conversations.processed} migrated, ${stats.conversations.errors} errors`,
    );
  } catch (error) {
    console.error("❌ Conversations migration failed:", error.message);
  }
}

/**
 * Migrate Messages
 */
async function migrateMessages() {
  console.log("\n🚀 Starting messages migration...");

  try {
    const Message = mongoose.model("Message");
    const messages = await Message.find({}).lean();

    stats.messages.processed = messages.length;

    for (const message of messages) {
      try {
        const transformedMessage = transformMessage(message);

        const { data, error } = await supabase
          .from("messages")
          .insert(transformedMessage)
          .select();

        if (error) {
          console.error(
            `❌ Failed to migrate message ${message._id}:`,
            error.message,
          );
          stats.messages.errors++;
        } else {
          console.log(`✅ Migrated message: ${transformedMessage.id}`);
          stats.messages.migrated++;
        }
      } catch (error) {
        console.error(
          `❌ Error migrating message ${message._id}:`,
          error.message,
        );
        stats.messages.errors++;
      }
    }

    console.log(
      `📊 Messages migration complete: ${stats.messages.migrated}/${stats.messages.processed} migrated, ${stats.messages.errors} errors`,
    );
  } catch (error) {
    console.error("❌ Messages migration failed:", error.message);
  }
}

/**
 * Print migration summary
 */
function printSummary() {
  console.log("\n" + "=".repeat(60));
  console.log("📊 MIGRATION SUMMARY");
  console.log("=".repeat(60));

  const totalProcessed = Object.values(stats).reduce(
    (sum, stat) => sum + stat.processed,
    0,
  );
  const totalMigrated = Object.values(stats).reduce(
    (sum, stat) => sum + stat.migrated,
    0,
  );
  const totalErrors = Object.values(stats).reduce(
    (sum, stat) => sum + stat.errors,
    0,
  );

  console.log(`Total Records Processed: ${totalProcessed}`);
  console.log(`Total Records Migrated: ${totalMigrated}`);
  console.log(`Total Errors: ${totalErrors}`);
  console.log(
    `Success Rate: ${((totalMigrated / totalProcessed) * 100).toFixed(1)}%`,
  );

  console.log("\n📋 Detailed Statistics:");
  Object.entries(stats).forEach(([table, stat]) => {
    if (stat.processed > 0) {
      console.log(
        `  ${table}: ${stat.migrated}/${stat.processed} migrated (${stat.errors} errors)`,
      );
    }
  });

  console.log("=".repeat(60));
}

/**
 * Main migration function
 */
async function runMigration() {
  console.log("🚀 Starting MongoDB to Supabase migration...");

  try {
    // Connect to MongoDB
    await connectMongoDB();

    // Run migrations in order
    await migrateUsers();
    await migrateConversations();
    await migrateMessages();

    // Print summary
    printSummary();

    console.log("\n✅ Migration completed!");
    console.log("📝 Note: Review the migrated data in your Supabase dashboard");
    console.log(
      "🔧 Next: Update your application to use Supabase instead of MongoDB",
    );
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log("\n🔌 MongoDB connection closed");
  }
}

// Handle script execution
if (require.main === module) {
  runMigration().catch(console.error);
}

module.exports = { runMigration, stats };
