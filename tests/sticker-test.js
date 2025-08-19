/**
 * Sticker Service Test Script
 * Tests the Telegram Sticker API integration
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const stickerService = require('../src/services/stickerService');
const logger = require('../src/utils/logger');

// Test user ID (you can use any valid Telegram user ID for testing)
const TEST_USER_ID = 123456789; // Replace with actual test user ID

// Mock WebP image buffer (minimal WebP file)
const createMockWebPBuffer = () => {
  // This is a minimal WebP file header + simple image data
  // In reality, you'd use properly formatted WebP files
  const mockWebP = Buffer.from([
    0x52, 0x49, 0x46, 0x46, // "RIFF"
    0x26, 0x00, 0x00, 0x00, // File size (38 bytes)
    0x57, 0x45, 0x42, 0x50, // "WEBP"
    0x56, 0x50, 0x38, 0x20, // "VP8 "
    0x1A, 0x00, 0x00, 0x00, // VP8 chunk size
    0x30, 0x01, 0x00, 0x9d, 0x01, 0x2a, // VP8 bitstream
    0x01, 0x00, 0x01, 0x00, 0x3e, 0x00, 0x00, 0x3c,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00
  ]);
  return mockWebP;
};

async function testStickerService() {
  console.log('🎭 Testing Sticker Service Integration');
  console.log('====================================\n');

  try {
    // Test 1: Configuration check
    console.log('1. Testing service configuration...');
    const isConfigured = stickerService.isServiceConfigured();
    console.log(`   Service configured: ${isConfigured ? '✅' : '❌'}`);
    
    if (!isConfigured) {
      console.log('   ℹ️  To test Sticker service:');
      console.log('   - Add TELEGRAM_BOT_TOKEN to your .env file');
      console.log('   - Make sure the bot is properly configured');
      console.log('\n❌ Cannot proceed with API tests without configuration.');
      return;
    }
    
    console.log('   ✅ Service is properly configured\n');

    // Test 2: Pack name generation
    console.log('2. Testing pack name generation...');
    try {
      const packName1 = stickerService.generatePackName(TEST_USER_ID);
      const packName2 = stickerService.generatePackName(TEST_USER_ID);
      
      console.log(`   ✅ Pack name 1: ${packName1}`);
      console.log(`   ✅ Pack name 2: ${packName2}`);
      
      if (packName1 !== packName2) {
        console.log('   ✅ Pack names are unique');
      } else {
        console.log('   ⚠️  Pack names should be unique');
      }
      
      // Validate pack name format
      const expectedPattern = /^newpeople_\d+_\d+_[a-z0-9]+_by_NewPeopleStickersBot$/;
      if (expectedPattern.test(packName1)) {
        console.log('   ✅ Pack name format is correct');
      } else {
        console.log('   ❌ Pack name format is incorrect');
      }
      
    } catch (error) {
      console.log(`   ❌ Pack name generation failed: ${error.message}`);
    }
    
    console.log();

    // Test 3: Sticker pack URL generation
    console.log('3. Testing sticker pack URL generation...');
    try {
      const testPackName = 'test_pack_name_by_TestBot';
      const packUrl = stickerService.generateStickerPackUrl(testPackName);
      const expectedUrl = `https://t.me/addstickers/${testPackName}`;
      
      console.log(`   Generated URL: ${packUrl}`);
      
      if (packUrl === expectedUrl) {
        console.log('   ✅ URL format is correct');
      } else {
        console.log('   ❌ URL format is incorrect');
      }
      
    } catch (error) {
      console.log(`   ❌ URL generation failed: ${error.message}`);
    }
    
    console.log();

    // Test 4: File upload (requires real bot token and will make API call)
    console.log('4. Testing sticker file upload...');
    console.log('   ⚠️  This test will make actual API calls to Telegram');
    console.log('   ℹ️  Skipping file upload test to avoid API usage');
    console.log('   ℹ️  To test file upload, uncomment the code below and provide a valid test user ID');
    
    /*
    try {
      const mockBuffer = createMockWebPBuffer();
      console.log(`   Mock WebP buffer size: ${mockBuffer.length} bytes`);
      
      // Uncomment to test actual upload:
      // const fileId = await stickerService.uploadStickerFile(TEST_USER_ID, mockBuffer);
      // console.log(`   ✅ File uploaded with ID: ${fileId}`);
      
    } catch (error) {
      console.log(`   ❌ File upload failed: ${error.message}`);
      if (error.message.includes('user not found') || error.message.includes('Bad Request')) {
        console.log('   ℹ️  This is expected if TEST_USER_ID is not a real user');
      }
    }
    */
    
    console.log();

    // Test 5: Complete workflow simulation
    console.log('5. Testing complete workflow (simulation)...');
    try {
      const mockBuffers = [
        createMockWebPBuffer(),
        createMockWebPBuffer(),
        createMockWebPBuffer()
      ];
      
      const mockEmojis = ['😀', '😂', '🤔'];
      const title = 'Test Sticker Pack';
      
      console.log(`   Mock stickers: ${mockBuffers.length}`);
      console.log(`   Emojis: ${mockEmojis.join(' ')}`);
      console.log(`   Title: ${title}`);
      
      // This would normally create a complete pack:
      // const result = await stickerService.createCompleteStickerPack(
      //   TEST_USER_ID, mockBuffers, mockEmojis, title
      // );
      
      console.log('   ✅ Workflow simulation completed');
      console.log('   ℹ️  Actual API calls commented out to avoid usage');
      
    } catch (error) {
      console.log(`   ❌ Workflow simulation failed: ${error.message}`);
    }

  } catch (error) {
    console.error('❌ Test execution failed:', error);
    logger.error('Sticker service test failed:', error);
  }
  
  console.log('\n====================================');
  console.log('🏁 Sticker Service Test Complete');
  console.log('====================================');
}

// Test parameter validation
async function testValidation() {
  console.log('\n6. Testing parameter validation...');
  
  try {
    stickerService.generatePackName();
    console.log('   ❌ Should have failed with missing user ID');
  } catch (error) {
    console.log('   ✅ Validation working: Missing user ID caught');
  }
  
  try {
    stickerService.generateStickerPackUrl('');
    console.log('   ❌ Should have failed with empty pack name');
  } catch (error) {
    if (error.name === 'ValidationError') {
      console.log('   ✅ Validation working: Empty pack name rejected');
    } else {
      console.log(`   ⚠️  Unexpected error: ${error.message}`);
    }
  }
  
  try {
    await stickerService.uploadStickerFile(123);
    console.log('   ❌ Should have failed with missing buffer');
  } catch (error) {
    if (error.name === 'ValidationError' || error.name === 'ConfigurationError') {
      console.log('   ✅ Validation working: Missing buffer rejected');
    } else {
      console.log(`   ⚠️  Unexpected error: ${error.message}`);
    }
  }
}

// Integration test with real Telegram API (requires careful setup)
async function testIntegration() {
  console.log('\n7. Integration test notes...');
  console.log('   ℹ️  For real integration testing:');
  console.log('   1. Set up a test bot with BotFather');
  console.log('   2. Get a valid user ID (you can get this from any message to the bot)');
  console.log('   3. Create proper WebP images (512x512 max)');
  console.log('   4. Test with small batches first');
  console.log('   5. Monitor rate limits and API quotas');
  console.log('   ⚠️  Note: Creating sticker packs requires the user to interact with the bot first');
}

// Run tests
async function runTests() {
  await testStickerService();
  await testValidation();
  await testIntegration();
}

// Handle script execution
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests, testStickerService };