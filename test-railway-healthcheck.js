/**
 * Test Railway healthcheck endpoints
 * Simple test to verify health endpoints work correctly
 */

const http = require('http');

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;

async function testEndpoint(path, expectedStatus = 200) {
  return new Promise((resolve, reject) => {
    const req = http.get(`${BASE_URL}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          console.log(`✅ ${path}: ${res.statusCode} - ${jsonData.status || 'OK'}`);
          resolve({
            status: res.statusCode,
            data: jsonData,
            success: res.statusCode === expectedStatus
          });
        } catch (error) {
          console.log(`❌ ${path}: ${res.statusCode} - Invalid JSON`);
          resolve({
            status: res.statusCode,
            data: data,
            success: false
          });
        }
      });
    });
    
    req.on('error', (error) => {
      console.log(`❌ ${path}: Connection failed - ${error.message}`);
      resolve({
        status: 0,
        error: error.message,
        success: false
      });
    });
    
    req.setTimeout(5000, () => {
      console.log(`❌ ${path}: Timeout`);
      req.destroy();
      resolve({
        status: 0,
        error: 'Timeout',
        success: false
      });
    });
  });
}

async function runTests() {
  console.log('🧪 Testing Railway healthcheck endpoints...\n');
  
  const tests = [
    { path: '/ping', expectedStatus: 200 },
    { path: '/health', expectedStatus: 200 },
    { path: '/ready', expectedStatus: 200 },
    { path: '/', expectedStatus: 200 }
  ];
  
  const results = [];
  
  for (const test of tests) {
    const result = await testEndpoint(test.path, test.expectedStatus);
    results.push({ ...test, ...result });
  }
  
  console.log('\n📊 Test Results:');
  console.log('================');
  
  const successful = results.filter(r => r.success).length;
  const total = results.length;
  
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.path}: ${result.status} ${result.success ? 'PASS' : 'FAIL'}`);
  });
  
  console.log(`\n🎯 Summary: ${successful}/${total} tests passed`);
  
  if (successful === total) {
    console.log('🎉 All healthcheck endpoints are working correctly!');
    process.exit(0);
  } else {
    console.log('⚠️  Some healthcheck endpoints failed. Check the logs above.');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('❌ Test runner failed:', error);
  process.exit(1);
});
