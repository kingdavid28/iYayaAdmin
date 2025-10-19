#!/usr/bin/env node

/**
 * Test API Data Fetch
 */

const http = require('http');

async function testApiEndpoint() {
  console.log('🔍 Testing API Data Fetch...\n');

  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/health',
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    console.log('📡 Status:', res.statusCode);
    console.log('📋 Headers:', res.headers['content-type']);

    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        console.log('✅ API Response:');
        console.log(JSON.stringify(json, null, 2));
      } catch (e) {
        console.log('❌ Failed to parse JSON response');
        console.log('Raw response:', data);
      }
    });
  });

  req.on('error', (e) => {
    console.log('❌ Request failed:', e.message);
  });

  req.end();
}

testApiEndpoint();
