// ============================================
// Supabase Server Configuration
// ============================================
require('dotenv').config({ path: './.env' });
const config = require('./config/env');
const { createServer } = require('http');
const { app, server } = require('./appSupabase');
const realtime = require('./services/realtime');

// ============================================
// Server Startup
// ============================================
const startServer = async () => {
  // No MongoDB connection needed for Supabase
  console.log('🚀 Starting Supabase-powered server...');

  // Initialize optional realtime layer
  try {
    realtime.init(server);
    console.log('[Realtime] Socket.IO initialized');
  } catch (err) {
    console.warn('[Realtime] Initialization skipped:', err?.message || err);
  }

  server.listen(config.port, '0.0.0.0', () => {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    let networkIP = 'localhost';

    // Find the first non-internal IPv4 address
    Object.keys(interfaces).forEach(name => {
      interfaces[name].forEach(iface => {
        if (iface.family === 'IPv4' && !iface.internal) {
          networkIP = iface.address;
        }
      });
    });

    console.log(`
============================================
🚀 Supabase Server running in ${config.env} mode
🔗 Local: http://localhost:${config.port}
🌐 Network: http://${networkIP}:${config.port}
📱 Expo Go: Use http://${networkIP}:${config.port}
📅 ${new Date().toLocaleString()}
🗄️ Database: Supabase
============================================
    `);

    console.log('📋 Expo Go Setup:');
    console.log(`1. Make sure your phone is on the same WiFi network`);
    console.log(`2. Update frontend API config to use: ${networkIP}`);
    console.log(`3. Run: npm run setup-network (in frontend)`);
    console.log(`4. Restart Expo: npx expo start --clear`);
    console.log('============================================\n');
  });
};

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('⛔ Server closed successfully');
    process.exit(0);
  });
});

process.on('unhandledRejection', (err) => {
  console.error('⚠️ Unhandled Rejection:', err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('⚠️ Uncaught Exception:', err);
  process.exit(1);
});

startServer();
