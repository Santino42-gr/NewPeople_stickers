#!/usr/bin/env node

/**
 * Test script for healthcheck endpoints
 * Run this to verify healthcheck works before deployment
 */

const http = require('http');

const PORT = process.env.PORT || 3000;
const HOST = 'localhost';

function testEndpoint(path, description) {
  return new Promise((resolve) => {
    const options = {
      hostname: HOST,
      port: PORT,
      path: path,
      method: 'GET',
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          console.log(`✅ ${description}:`);
          console.log(`   Status: ${res.statusCode}`);
          console.log(`   Response: ${JSON.stringify(jsonData, null, 2)}`);
          resolve({ success: true, status: res.statusCode, data: jsonData });
        } catch (error) {
          console.log(`❌ ${description}:`);
          console.log(`   Status: ${res.statusCode}`);
          console.log(`   Error parsing JSON: ${error.message}`);
          console.log(`   Raw response: ${data}`);
          resolve({ success: false, status: res.statusCode, error: error.message });
        }
      });
    });

    req.on('error', (error) => {
      console.log(`❌ ${description}:`);
      console.log(`   Error: ${error.message}`);
      resolve({ success: false, error: error.message });
    });

    req.on('timeout', () => {
      console.log(`❌ ${description}:`);
      console.log(`   Timeout after 5 seconds`);
      req.destroy();
      resolve({ success: false, error: 'timeout' });
    });

    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing healthcheck endpoints...\n');
  
  const tests = [
    { path: '/ping', description: 'Ping Check (Railway)' },
    { path: '/ready', description: 'Ready Check' },
    { path: '/health', description: 'Health Check' },
    { path: '/metrics', description: 'Metrics Check' },
    { path: '/', description: 'Root Endpoint' }
  ];

  const results = [];
  
  for (const test of tests) {
    const result = await testEndpoint(test.path, test.description);
    results.push({ ...test, ...result });
    console.log(''); // Empty line for readability
  }

  // Summary
  console.log('📊 Test Summary:');
  const successful = results.filter(r => r.success && r.status === 200).length;
  const total = results.length;
  
  console.log(`   Successful: ${successful}/${total}`);
  
  if (successful === total) {
    console.log('🎉 All tests passed! Healthcheck should work in deployment.');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Check the output above.');
    process.exit(1);
  }
}

// Check if server is running
console.log(`🔍 Testing healthcheck endpoints on ${HOST}:${PORT}`);
console.log('   Make sure the server is running with: npm start\n');

runTests().catch(error => {
  console.error('❌ Test runner error:', error);
  process.exit(1);
});
