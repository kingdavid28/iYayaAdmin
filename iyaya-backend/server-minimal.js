// Minimal server startup with graceful dependency handling
require('dotenv').config({ path: './.env' });

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 5001;

// Basic middleware
app.use(cors({
  origin: ['http://localhost:8081', 'http://localhost:19006', 'http://127.0.0.1:19006'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'success',
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Basic error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({
    status: 'error',
    message: err.message
  });
});

// Connect to MongoDB
const connectDB = async () => {
  try {
    console.log('Connecting to MongoDB...');
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ MongoDB connected successfully');
    return conn;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

// Start server
const startServer = async () => {
  await connectDB();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`
============================================
🚀 Minimal Server running
🔗 http://localhost:${PORT}
📅 ${new Date().toLocaleString()}
============================================
    `);
  });
};

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⛔ MongoDB connection closed through app termination');
  await mongoose.connection.close();
  process.exit(0);
});

startServer().catch(console.error);