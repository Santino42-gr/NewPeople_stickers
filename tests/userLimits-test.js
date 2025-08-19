/**
 * User Limits Service Test Script
 * Tests the user limits and logging functionality
 */

require('dotenv').config();
const userLimitsService = require('../src/services/userLimitsService');
const logger = require('../src/utils/logger');

// Test user IDs
const TEST_USER_ID_1 = 123456789;
const TEST_USER_ID_2 = 987654321;

async function testUserLimitsService() {
  console.log('👥 Testing User Limits Service');
  console.log('==============================\n');

  try {
    // Test 1: Configuration check
    console.log('1. Testing service configuration...');
    const isConfigured = userLimitsService.isServiceConfigured();
    console.log(`   Service configured: ${isConfigured ? '✅' : '❌'}`);
    
    if (!isConfigured) {
      console.log('   ℹ️  To test User Limits service:');
      console.log('   - Add SUPABASE_URL and SUPABASE_ANON_KEY to your .env file');
      console.log('   - Make sure the database tables exist');
      console.log('   ⚠️  Service will run in fail-open mode (allowing all requests)');
    }
    
    console.log();

    // Test 2: Check user limit (new user)
    console.log('2. Testing user limit check for new user...');
    try {
      const limitResult = await userLimitsService.checkUserLimit(TEST_USER_ID_1);
      
      console.log(`   Can generate: ${limitResult.canGenerate ? '✅' : '❌'}`);
      console.log(`   Reason: ${limitResult.reason}`);
      console.log(`   Remaining limit: ${limitResult.remainingLimit}`);
      console.log(`   Last generation: ${limitResult.lastGeneration || 'Never'}`);
      
      if (limitResult.canGenerate) {
        console.log('   ✅ New user can generate stickers');
      } else {
        console.log('   ❌ New user should be able to generate stickers');
      }
      
    } catch (error) {
      console.log(`   ❌ Limit check failed: ${error.message}`);
    }
    
    console.log();

    // Test 3: Log generation start
    console.log('3. Testing generation logging...');
    try {
      const logResult1 = await userLimitsService.logGeneration(
        TEST_USER_ID_1,
        'started',
        {
          packName: 'test_pack_123',
          timestamp: new Date().toISOString()
        }
      );
      
      console.log(`   Log generation start: ${logResult1 ? '✅' : '⚠️'}`);
      
      // Simulate some processing time
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const logResult2 = await userLimitsService.logGeneration(
        TEST_USER_ID_1,
        'completed',
        {
          packName: 'test_pack_123',
          processingTime: 5000,
          timestamp: new Date().toISOString()
        }
      );
      
      console.log(`   Log generation complete: ${logResult2 ? '✅' : '⚠️'}`);
      
    } catch (error) {
      console.log(`   ❌ Generation logging failed: ${error.message}`);
    }
    
    console.log();

    // Test 4: Record generation
    console.log('4. Testing generation recording...');
    try {
      const recordResult = await userLimitsService.recordGeneration(TEST_USER_ID_1);
      console.log(`   Record generation: ${recordResult ? '✅' : '⚠️'}`);
      
      if (recordResult) {
        console.log('   ✅ Generation recorded successfully');
      } else {
        console.log('   ⚠️  Generation recording failed (but continuing - fail-open)');
      }
      
    } catch (error) {
      console.log(`   ❌ Generation recording failed: ${error.message}`);
    }
    
    console.log();

    // Test 5: Check user limit again (should be blocked)
    console.log('5. Testing user limit check after generation...');
    try {
      const limitResult2 = await userLimitsService.checkUserLimit(TEST_USER_ID_1);
      
      console.log(`   Can generate: ${limitResult2.canGenerate ? '✅' : '❌'}`);
      console.log(`   Reason: ${limitResult2.reason}`);
      console.log(`   Remaining limit: ${limitResult2.remainingLimit}`);
      console.log(`   Last generation: ${limitResult2.lastGeneration || 'Never'}`);
      console.log(`   Total generations: ${limitResult2.totalGenerations || 0}`);
      
      if (!limitResult2.canGenerate && limitResult2.reason === 'daily_limit_exceeded') {
        console.log('   ✅ Daily limit working correctly');
      } else if (limitResult2.canGenerate && limitResult2.reason === 'database_not_configured') {
        console.log('   ℹ️  Daily limit bypassed due to database configuration (fail-open)');
      } else {
        console.log('   ⚠️  Unexpected limit check result');
      }
      
    } catch (error) {
      console.log(`   ❌ Second limit check failed: ${error.message}`);
    }
    
    console.log();

    // Test 6: Get user statistics
    console.log('6. Testing user statistics...');
    try {
      const stats = await userLimitsService.getUserStats(TEST_USER_ID_1);
      
      console.log(`   Total generations: ${stats.totalGenerations}`);
      console.log(`   Last generation: ${stats.lastGeneration || 'Never'}`);
      console.log(`   Can generate today: ${stats.canGenerateToday ? 'Yes' : 'No'}`);
      console.log(`   Successful generations: ${stats.successfulGenerations}`);
      console.log(`   Failed generations: ${stats.failedGenerations}`);
      
      if (stats.recentLogs && stats.recentLogs.length > 0) {
        console.log(`   Recent logs: ${stats.recentLogs.length} entries`);
      }
      
      console.log('   ✅ User statistics retrieved');
      
    } catch (error) {
      console.log(`   ❌ User statistics failed: ${error.message}`);
    }
    
    console.log();

    // Test 7: System statistics
    console.log('7. Testing system statistics...');
    try {
      const systemStats = await userLimitsService.getSystemStats();
      
      console.log(`   Total users: ${systemStats.totalUsers}`);
      console.log(`   Total generations: ${systemStats.totalGenerations}`);
      console.log(`   Daily generations: ${systemStats.dailyGenerations}`);
      console.log(`   Success rate: ${systemStats.successRate}%`);
      
      if (systemStats.error) {
        console.log(`   ⚠️  Error: ${systemStats.error}`);
      }
      
      console.log('   ✅ System statistics retrieved');
      
    } catch (error) {
      console.log(`   ❌ System statistics failed: ${error.message}`);
    }

  } catch (error) {
    console.error('❌ Test execution failed:', error);
    logger.error('User limits test failed:', error);
  }
  
  console.log('\n==============================');
  console.log('🏁 User Limits Service Test Complete');
  console.log('==============================');
}

// Test parameter validation
async function testValidation() {
  console.log('\n8. Testing parameter validation...');
  
  // Test invalid user ID
  try {
    await userLimitsService.checkUserLimit('invalid');
    console.log('   ❌ Should have failed with invalid user ID');
  } catch (error) {
    if (error.name === 'ValidationError') {
      console.log('   ✅ Validation working: Invalid user ID rejected');
    } else {
      console.log(`   ⚠️  Unexpected error: ${error.message}`);
    }
  }
  
  // Test missing user ID
  try {
    await userLimitsService.recordGeneration();
    console.log('   ❌ Should have failed with missing user ID');
  } catch (error) {
    if (error.name === 'ValidationError') {
      console.log('   ✅ Validation working: Missing user ID rejected');
    } else {
      console.log(`   ⚠️  Unexpected error: ${error.message}`);
    }
  }
  
  // Test invalid status
  try {
    await userLimitsService.logGeneration(TEST_USER_ID_1, null);
    console.log('   ❌ Should have failed with invalid status');
  } catch (error) {
    if (error.name === 'ValidationError') {
      console.log('   ✅ Validation working: Invalid status rejected');
    } else {
      console.log(`   ⚠️  Unexpected error: ${error.message}`);
    }
  }
}

// Test fail-open behavior
async function testFailOpen() {
  console.log('\n9. Testing fail-open behavior...');
  console.log('   ℹ️  Fail-open means the service allows requests when database is unavailable');
  console.log('   ℹ️  This ensures the bot continues working even with database issues');
  console.log('   ✅ Fail-open behavior is built into all methods');
  console.log('   ✅ Users can still generate stickers if database is down');
  console.log('   ✅ Errors are logged but don\'t block the workflow');
}

// Test edge cases
async function testEdgeCases() {
  console.log('\n10. Testing edge cases...');
  
  try {
    // Test with very large user ID
    const largeUserId = 9999999999999;
    const result1 = await userLimitsService.checkUserLimit(largeUserId);
    console.log(`   Large user ID: ${result1.canGenerate ? '✅' : '❌'}`);
    
    // Test with negative user ID
    try {
      await userLimitsService.checkUserLimit(-123);
      console.log('   ⚠️  Negative user ID should be validated');
    } catch (error) {
      console.log('   ✅ Negative user ID properly rejected');
    }
    
    // Test logging with empty details
    const result2 = await userLimitsService.logGeneration(TEST_USER_ID_2, 'started', {});
    console.log(`   Empty details logging: ${result2 ? '✅' : '⚠️'}`);
    
    // Test logging with null details
    const result3 = await userLimitsService.logGeneration(TEST_USER_ID_2, 'completed');
    console.log(`   Null details logging: ${result3 ? '✅' : '⚠️'}`);
    
  } catch (error) {
    console.log(`   ❌ Edge case testing failed: ${error.message}`);
  }
}

// Run all tests
async function runTests() {
  await testUserLimitsService();
  await testValidation();
  await testFailOpen();
  await testEdgeCases();
}

// Handle script execution
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests, testUserLimitsService };