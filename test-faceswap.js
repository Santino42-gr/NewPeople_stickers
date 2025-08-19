/**
 * Test complete face-swap pipeline
 */

require('dotenv').config();
const sharp = require('sharp');
const axios = require('axios');
const piapiService = require('./src/services/piapiService');

async function testFaceSwapPipeline() {
  console.log('🧪 Testing Complete Face-Swap Pipeline');
  console.log('======================================\n');

  try {
    // 1. Use a real photo URL instead of creating a test image
    console.log('1. Using real photo URL instead of creating test image...');
    
    // Use a stock photo with a face for testing
    const realPhotoUrl = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face';
    console.log(`✅ Using real photo: ${realPhotoUrl}`);
    
    // 2. Test with URL directly (no base64 needed)
    console.log('\n2. Using photo URL directly for testing...');
    const userPhotoUrl = realPhotoUrl;
    console.log(`✅ Photo URL ready: ${userPhotoUrl.length} chars`);

    // 3. Test with template 1
    console.log('\n3. Testing face-swap with template 1...');
    const template1Url = 'https://raw.githubusercontent.com/Santino42-gr/NewPeople_stickers/main/assets/memes/meme-1.png';
    
    console.log(`Target image: ${template1Url}`);
    console.log(`Source image: ${userPhotoUrl}`);
    
    const faceSwapResult = await piapiService.processFaceSwap(
      template1Url,     // target (template)
      userPhotoUrl,     // source (user's face)
      {
        taskOptions: {
          quality: 'high'
        },
        waitOptions: {
          maxWaitTime: 60000, // 1 minute for testing
          pollInterval: 3000
        }
      }
    );
    
    if (faceSwapResult.resultUrl) {
      console.log('✅ Face-swap completed successfully!');
      console.log(`📄 Task ID: ${faceSwapResult.taskId}`);
      console.log(`🔗 Result URL: ${faceSwapResult.resultUrl}`);
      
      // 4. Download and verify result
      console.log('\n4. Downloading result...');
      const resultResponse = await axios.get(faceSwapResult.resultUrl, {
        responseType: 'arraybuffer'
      });
      
      const resultBuffer = Buffer.from(resultResponse.data);
      console.log(`✅ Result downloaded: ${resultBuffer.length} bytes`);
      
      // Save for inspection
      const fs = require('fs');
      fs.writeFileSync('./test-faceswap-result.jpg', resultBuffer);
      console.log('💾 Result saved as test-faceswap-result.jpg');
      
    } else {
      console.log('❌ No result URL returned');
      console.log('Result:', JSON.stringify(faceSwapResult, null, 2));
    }

  } catch (error) {
    console.log('❌ Test failed:', error.message);
    console.log('Stack:', error.stack);
  }
}

// Run the test
if (require.main === module) {
  testFaceSwapPipeline().catch(console.error);
}