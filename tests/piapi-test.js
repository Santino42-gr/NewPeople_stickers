/**
 * Piapi Service Test Script
 * Tests the Piapi AI integration for face-swap functionality
 */

require('dotenv').config();
const piapiService = require('../src/services/piapiService');
const logger = require('../src/utils/logger');

// Test image URLs (public test images)
const TEST_TARGET_IMAGE = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face';
const TEST_SOURCE_IMAGE = 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400&h=400&fit=crop&crop=face';

async function testPiapiService() {
  console.log('🧪 Testing Piapi Service Integration');
  console.log('=====================================\n');

  try {
    // Test 1: Configuration check
    console.log('1. Testing service configuration...');
    const isConfigured = piapiService.isServiceConfigured();
    console.log(`   Service configured: ${isConfigured ? '✅' : '❌'}`);
    
    if (!isConfigured) {
      console.log('   ℹ️  To test Piapi integration:');
      console.log('   - Add PIAPI_API_KEY to your .env file');
      console.log('   - Optionally set PIAPI_BASE_URL (defaults to https://api.piapi.ai/api/v1)');
      console.log('\n❌ Cannot proceed with API tests without configuration.');
      return;
    }
    
    console.log('   ✅ Service is properly configured\n');

    // Test 2: Create face-swap task
    console.log('2. Testing face-swap task creation...');
    console.log(`   Target image: ${TEST_TARGET_IMAGE}`);
    console.log(`   Source image: ${TEST_SOURCE_IMAGE}`);
    
    let taskResponse;
    try {
      taskResponse = await piapiService.createFaceSwapTask(
        TEST_TARGET_IMAGE,
        TEST_SOURCE_IMAGE,
        {
          maxRetries: 2,
          retryDelay: 1000
        }
      );
      console.log(`   ✅ Task created successfully: ${taskResponse.taskId}`);
      console.log(`   Status: ${taskResponse.status}`);
    } catch (error) {
      console.log(`   ❌ Task creation failed: ${error.message}`);
      if (error.name === 'PiapiApiError') {
        console.log('   This might be due to:');
        console.log('   - Invalid API key');
        console.log('   - Insufficient credits');
        console.log('   - Network connectivity issues');
        console.log('   - Image URL accessibility');
      }
      return;
    }
    
    console.log();

    // Test 3: Check task status
    console.log('3. Testing task status check...');
    try {
      const statusResponse = await piapiService.getTaskStatus(taskResponse.taskId);
      console.log(`   ✅ Status check successful`);
      console.log(`   Task ID: ${statusResponse.taskId}`);
      console.log(`   Status: ${statusResponse.status}`);
      console.log(`   Progress: ${statusResponse.progress}%`);
    } catch (error) {
      console.log(`   ❌ Status check failed: ${error.message}`);
    }
    
    console.log();

    // Test 4: Wait for completion (with short timeout for testing)
    console.log('4. Testing task completion waiting...');
    console.log('   ⏱️  Waiting for task completion (max 60 seconds for test)...');
    
    try {
      const completionResponse = await piapiService.waitForTaskCompletion(
        taskResponse.taskId,
        {
          maxWaitTime: 60000,  // 1 minute for testing
          pollInterval: 5000,  // Check every 5 seconds
          maxRetries: 2,
          onProgress: (progress) => {
            console.log(`   📊 Progress: ${progress.status} (${progress.progress}%)`);
          }
        }
      );
      
      console.log(`   ✅ Task completed successfully!`);
      console.log(`   Final status: ${completionResponse.status}`);
      if (completionResponse.result?.output_url) {
        console.log(`   Result URL: ${completionResponse.result.output_url}`);
      }
      
    } catch (error) {
      console.log(`   ⏱️  Task completion test: ${error.message}`);
      if (error.name === 'TaskTimeoutError') {
        console.log('   ℹ️  This is expected for the test - tasks may take longer than 1 minute');
      } else if (error.name === 'TaskFailedError') {
        console.log('   ❌ Task failed during processing');
      }
    }
    
    console.log();

    // Test 5: Complete process test
    console.log('5. Testing complete face-swap process...');
    console.log('   ℹ️  This test creates a new task and waits briefly...');
    
    try {
      const processResponse = await piapiService.processFaceSwap(
        TEST_TARGET_IMAGE,
        TEST_SOURCE_IMAGE,
        {
          taskOptions: {
            maxRetries: 2
          },
          waitOptions: {
            maxWaitTime: 30000,  // 30 seconds for testing
            pollInterval: 5000
          }
        }
      );
      
      console.log(`   ✅ Complete process successful!`);
      console.log(`   Task ID: ${processResponse.taskId}`);
      if (processResponse.resultUrl) {
        console.log(`   Result URL: ${processResponse.resultUrl}`);
      }
      
    } catch (error) {
      console.log(`   ⏱️  Complete process test: ${error.message}`);
      if (error.name === 'TaskTimeoutError') {
        console.log('   ℹ️  This is expected for the test - full processing may take several minutes');
      }
    }

  } catch (error) {
    console.error('❌ Test execution failed:', error);
    logger.error('Piapi test failed:', error);
  }
  
  console.log('\n=====================================');
  console.log('🏁 Piapi Service Test Complete');
  console.log('=====================================');
}

// Test parameter validation
async function testValidation() {
  console.log('\n6. Testing parameter validation...');
  
  try {
    await piapiService.createFaceSwapTask('', TEST_SOURCE_IMAGE);
    console.log('   ❌ Should have failed with empty target URL');
  } catch (error) {
    if (error.name === 'ValidationError') {
      console.log('   ✅ Validation working: Empty target URL rejected');
    } else {
      console.log(`   ⚠️  Unexpected error: ${error.message}`);
    }
  }
  
  try {
    await piapiService.createFaceSwapTask(TEST_TARGET_IMAGE, '');
    console.log('   ❌ Should have failed with empty source URL');
  } catch (error) {
    if (error.name === 'ValidationError') {
      console.log('   ✅ Validation working: Empty source URL rejected');
    } else {
      console.log(`   ⚠️  Unexpected error: ${error.message}`);
    }
  }
  
  try {
    await piapiService.getTaskStatus('');
    console.log('   ❌ Should have failed with empty task ID');
  } catch (error) {
    if (error.name === 'ValidationError') {
      console.log('   ✅ Validation working: Empty task ID rejected');
    } else {
      console.log(`   ⚠️  Unexpected error: ${error.message}`);
    }
  }
}

// Run tests
async function runTests() {
  await testPiapiService();
  await testValidation();
}

// Handle script execution
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests, testPiapiService };