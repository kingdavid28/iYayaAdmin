require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Caregiver = require('./models/Caregiver');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/iyaya');
    console.log('✅ MongoDB connected');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
};

const seedCaregivers = async () => {
  try {
    console.log('🌱 Starting caregiver seeding...');
    
    // Sample caregiver data
    const caregiverData = [
      {
        email: 'maria.santos@example.com',
        password: process.env.TEST_PASSWORD || 'password123',
        name: 'Maria Santos',
        userType: 'caregiver',
        caregiver: {
          bio: 'Experienced childcare provider with 5 years of experience caring for children of all ages.',
          skills: ['Childcare', 'Cooking', 'Cleaning', 'Homework Help'],
          hourlyRate: 350,
          experience: {
            years: 5,
            months: 0,
            description: 'Worked with families caring for infants to teenagers. Specialized in educational activities and meal preparation.'
          },
          ageCareRanges: ['INFANT', 'TODDLER', 'PRESCHOOL'],
          availability: {
            days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            hours: { start: '08:00', end: '18:00' },
            flexible: true
          },
          location: 'Quezon City, Metro Manila',
          rating: 4.8,
          certifications: [
            { name: 'First Aid Certification', verified: true },
            { name: 'CPR Certification', verified: true }
          ]
        }
      },
      {
        email: 'ana.cruz@example.com',
        password: process.env.TEST_PASSWORD || 'password123',
        name: 'Ana Cruz',
        userType: 'caregiver',
        caregiver: {
          bio: 'Loving and patient nanny with expertise in early childhood development.',
          skills: ['Childcare', 'Educational Activities', 'Arts and Crafts', 'Music'],
          hourlyRate: 400,
          experience: {
            years: 3,
            months: 6,
            description: 'Former preschool teacher turned private nanny. Loves creating fun learning experiences for children.'
          },
          ageCareRanges: ['TODDLER', 'PRESCHOOL', 'SCHOOL_AGE'],
          availability: {
            days: ['Monday', 'Wednesday', 'Friday', 'Saturday'],
            hours: { start: '09:00', end: '17:00' },
            flexible: false
          },
          location: 'Makati City, Metro Manila',
          rating: 4.9,
          certifications: [
            { name: 'Early Childhood Education Certificate', verified: true }
          ]
        }
      },
      {
        email: 'jenny.reyes@example.com',
        password: process.env.TEST_PASSWORD || 'password123',
        name: 'Jenny Reyes',
        userType: 'caregiver',
        caregiver: {
          bio: 'Reliable caregiver specializing in infant care and newborn support.',
          skills: ['Infant Care', 'Breastfeeding Support', 'Sleep Training', 'Baby Massage'],
          hourlyRate: 450,
          experience: {
            years: 7,
            months: 0,
            description: 'Certified newborn care specialist with extensive experience in infant development and care.'
          },
          ageCareRanges: ['INFANT', 'TODDLER'],
          availability: {
            days: ['Tuesday', 'Thursday', 'Saturday', 'Sunday'],
            hours: { start: '06:00', end: '20:00' },
            flexible: true
          },
          location: 'Pasig City, Metro Manila',
          rating: 4.7,
          certifications: [
            { name: 'Newborn Care Specialist', verified: true },
            { name: 'Lactation Support Certificate', verified: true }
          ]
        }
      }
    ];

    for (const data of caregiverData) {
      // Check if user already exists
      const existingUser = await User.findOne({ email: data.email });
      if (existingUser) {
        console.log(`⚠️ User ${data.email} already exists, skipping...`);
        continue;
      }

      // Create user
      const user = new User({
        email: data.email,
        password: data.password,
        name: data.name,
        userType: data.userType,
        emailVerified: true
      });
      await user.save();
      console.log(`✅ Created user: ${data.name}`);

      // Create caregiver profile
      const caregiver = new Caregiver({
        userId: user._id,
        name: data.name,
        ...data.caregiver
      });
      await caregiver.save();
      console.log(`✅ Created caregiver profile: ${data.name}`);
    }

    console.log('🎉 Caregiver seeding completed!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Database connection closed');
  }
};

const main = async () => {
  await connectDB();
  await seedCaregivers();
};

main();