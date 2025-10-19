require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function quickCreateCaregiver() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Create caregiver with the exact ID that frontend is trying to use
    const testCaregiver = await User.create({
      _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
      name: 'Ana Dela Cruz',
      email: 'ana.delacruz@example.com',
      role: 'caregiver',
      password: '$2a$10$hashedpasswordexample123456789',
      phone: '+639123456789',
      isVerified: true,
      hourlyRate: 25
    });
    
    console.log('✅ Test caregiver created with ID:', testCaregiver._id);
    
  } catch (error) {
    if (error.code === 11000) {
      console.log('✅ Caregiver already exists with that ID');
    } else {
      console.error('❌ Error:', error.message);
    }
  } finally {
    await mongoose.disconnect();
  }
}

quickCreateCaregiver();
