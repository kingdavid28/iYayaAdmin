const axios = require('axios');

async function testLoginAPI() {
  const baseURL = 'http://192.168.1.7:5001';
  
  const testCredentials = [
    { email: 'kensite24@gmail.com', password: 'password123' },
    { email: 'giver@gmail.com', password: 'password123' },
    { email: 'rere.centno.swu@phinmaed.com', password: 'password123' }
  ];

  console.log('🧪 Testing login API endpoints...\n');

  // First check if server is running
  try {
    const healthCheck = await axios.get(`${baseURL}/api/health`);
    console.log('✅ Server is running');
  } catch (error) {
    console.log('❌ Server is not running or not accessible');
    console.log('   Make sure to start the backend server with: node server.js');
    return;
  }

  // Test each login
  for (const creds of testCredentials) {
    try {
      console.log(`Testing API login for: ${creds.email}`);
      
      const response = await axios.post(`${baseURL}/api/auth/login`, {
        email: creds.email,
        password: creds.password
      });
      
      console.log(`✅ Login successful for ${creds.email}`);
      console.log(`   Token received: ${response.data.token ? 'Yes' : 'No'}`);
      console.log('');
      
    } catch (error) {
      console.log(`❌ Login failed for ${creds.email}`);
      console.log(`   Status: ${error.response?.status}`);
      console.log(`   Error: ${error.response?.data?.error || error.message}`);
      console.log('');
    }
  }
}

testLoginAPI();