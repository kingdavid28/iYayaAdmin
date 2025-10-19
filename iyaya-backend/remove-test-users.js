require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function removeTestUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('📊 Connected to MongoDB');

    const result = await User.deleteMany({
      email: { $in: ['test@test.com', 'caregiver@test.com'] }
    });

    console.log('🗑️ Removed test users:', result.deletedCount);

    const remainingUsers = await User.find({}).select('name email role');
    console.log('\n📋 Remaining users:');
    remainingUsers.forEach(user => {
      console.log(`- ${user.name} (${user.email}) - ${user.role}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📊 Disconnected from MongoDB');
  }
}

removeTestUsers();