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

  // Use config.port which already handles process.env.PORT
  const port = config.port;
  const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '0.0.0.0';

  server.listen(port, host, () => {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    let networkIP = host === '0.0.0.0' ? 'localhost' : host;

    // Only try to detect network IP in development
    if (config.isDevelopment) {
      Object.keys(interfaces).forEach(name => {
        interfaces[name].forEach(iface => {
          if (iface.family === 'IPv4' && !iface.internal) {
            networkIP = iface.address;
          }
        });
      });
    }

    console.log(`
============================================
🚀 Supabase Server running in ${config.env} mode
🔗 Local: http://localhost:${port}
${networkIP !== 'localhost' ? `🌐 Network: http://${networkIP}:${port}` : ''}
📅 ${new Date().toLocaleString()}
🗄️ Database: ${usingSupabase ? 'Supabase' : 'MongoDB'}
============================================
    `);

    if (config.isDevelopment) {
      console.log('📋 Expo Go Setup:');
      console.log(`1. Make sure your phone is on the same WiFi network`);
      console.log(`2. Update frontend API config to use: ${networkIP}`);
      console.log(`3. Run: npm run setup-network (in frontend)`);
      console.log(`4. Restart Expo: npx expo start --clear`);
      console.log('============================================\n');
    }
  });
};