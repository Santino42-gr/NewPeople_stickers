/**
 * Debug script for testing Piapi face detection and swap
 * Use this to diagnose face detection issues
 */

require('dotenv').config();
const piapiService = require('./src/services/piapiService');
const logger = require('./src/utils/logger');

async function debugPiapiProcessing() {
  console.log('🔍 Debugging Piapi face detection and swap\n');
  
  if (!piapiService.isServiceConfigured()) {
    console.log('❌ Piapi service not configured');
    console.log('   Set PIAPI_API_KEY in your .env file');
    return;
  }
  
  console.log('✅ Piapi service configured');
  
  // Test with a simple example
  const testSourceImage = 'https://raw.githubusercontent.com/Santino42-gr/NewPeople_stickers/main/assets/memes/meme-1.png';
  const testTargetImage = 'https://raw.githubusercontent.com/Santino42-gr/NewPeople_stickers/main/assets/memes/meme-2.png';
  
  console.log('\n📋 Test parameters:');
  console.log(`   Source image: ${testSourceImage}`);
  console.log(`   Target image: ${testTargetImage}`);
  
  try {
    console.log('\n🚀 Starting face swap test...');
    
    const result = await piapiService.processFaceSwap(
      testTargetImage,
      testSourceImage,
      {
        taskOptions: {
          quality: 'high',
          confidence_threshold: 0.7
        },
        waitOptions: {
          maxWaitTime: 60000, // 1 minute
          pollInterval: 3000
        }
      }
    );
    
    console.log('\n✅ Face swap completed successfully!');
    console.log(`   Task ID: ${result.taskId}`);
    console.log(`   Result URL: ${result.resultUrl}`);
    console.log(`   Processing time: ${result.processingTime}ms`);
    
    console.log('\n💡 This means Piapi is working correctly.');
    console.log('   If you\'re still seeing user photos instead of memes,');
    console.log('   the issue might be with specific user photos not having');
    console.log('   detectable faces.');
    
  } catch (error) {
    console.log('\n❌ Face swap failed:');
    console.log(`   Error: ${error.message}`);
    
    if (error.message.includes('face') || error.message.includes('Face')) {
      console.log('\n🎯 This is likely a face detection issue.');
      console.log('   Possible causes:');
      console.log('   - User photo doesn\'t have a clear face');
      console.log('   - Face is too small or at wrong angle');
      console.log('   - Multiple faces in the photo');
      console.log('   - Poor lighting or image quality');
    } else if (error.message.includes('timeout') || error.message.includes('Timeout')) {
      console.log('\n⏰ This is a timeout issue.');
      console.log('   Piapi is taking too long to process.');
      console.log('   Try increasing the timeout or check Piapi service status.');
    } else if (error.message.includes('401') || error.message.includes('unauthorized')) {
      console.log('\n🔑 Authentication issue.');
      console.log('   Check your PIAPI_API_KEY.');
    } else if (error.message.includes('429')) {
      console.log('\n🚦 Rate limit exceeded.');
      console.log('   Too many requests to Piapi API.');
    } else {
      console.log('\n🔧 Other Piapi error.');
      console.log('   Check Piapi service status and API documentation.');
    }
    
    console.log('\n📊 Error details:', {
      name: error.name,
      message: error.message,
      response: error.response?.data
    });
  }
}

async function testUserPhotoFaceDetection(userPhotoUrl) {
  console.log(`\n🧪 Testing face detection for user photo: ${userPhotoUrl}`);
  
  // Use a simple meme template for face swap test
  const simpleTemplate = 'https://raw.githubusercontent.com/Santino42-gr/NewPeople_stickers/main/assets/memes/meme-1.png';
  
  try {
    const result = await piapiService.processFaceSwap(
      simpleTemplate,
      userPhotoUrl,
      {
        taskOptions: {
          quality: 'high',
          confidence_threshold: 0.5 // Lower threshold for testing
        },
        waitOptions: {
          maxWaitTime: 60000,
          pollInterval: 3000
        }
      }
    );
    
    console.log('✅ Face detected and swap successful!');
    console.log(`   Result: ${result.resultUrl}`);
    
  } catch (error) {
    console.log('❌ Face detection/swap failed:');
    console.log(`   ${error.message}`);
    
    if (error.message.includes('face') || error.message.includes('Face')) {
      console.log('   🎯 No face detected in this photo');
      console.log('   📝 Recommendations:');
      console.log('   - Use photo with clearly visible face');
      console.log('   - Ensure good lighting');
      console.log('   - Avoid multiple faces');
      console.log('   - Face should be front-facing');
    }
  }
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length > 0 && args[0].startsWith('http')) {
    // Test specific user photo URL
    testUserPhotoFaceDetection(args[0]);
  } else {
    // Run general debug
    debugPiapiProcessing();
  }
}

module.exports = { debugPiapiProcessing, testUserPhotoFaceDetection };
