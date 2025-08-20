/**
 * Test script for face detection error handling
 * Tests the new error detection logic without making real API calls
 */

require('dotenv').config();
const piapiService = require('./src/services/piapiService');
const logger = require('./src/utils/logger');

// Test cases for face detection error detection
const testCases = [
  {
    name: 'Object with face detection error',
    errorMessage: null,
    errorDetails: {
      code: 'FACE_NOT_DETECTED',
      message: 'No human face detected in the source image'
    },
    expected: true
  },
  {
    name: 'String with face error',
    errorMessage: 'Face detection failed: unable to detect face in image',
    errorDetails: null,
    expected: true
  },
  {
    name: 'Object with general error',
    errorMessage: null,
    errorDetails: {
      code: 'INVALID_IMAGE',
      message: 'Image format not supported'
    },
    expected: false
  },
  {
    name: 'String with general error',
    errorMessage: 'Network timeout error',
    errorDetails: null,
    expected: false
  },
  {
    name: 'Object with nested face error',
    errorMessage: null,
    errorDetails: {
      error: {
        type: 'face_detection_error',
        description: 'Cannot detect human face'
      }
    },
    expected: true
  },
  {
    name: 'Complex object like from real API',
    errorMessage: null,
    errorDetails: {
      task_id: '12345',
      status: 'failed',
      error: {
        code: 400,
        message: 'Face not found in source image'
      }
    },
    expected: true
  },
  {
    name: 'Russian face error',
    errorMessage: 'Лицо не обнаружено на изображении',
    errorDetails: null,
    expected: true
  },
  {
    name: 'Empty error',
    errorMessage: null,
    errorDetails: null,
    expected: false
  }
];

function runTests() {
  logger.info('🧪 Testing face detection error logic');
  
  let passed = 0;
  let failed = 0;
  
  testCases.forEach((testCase, index) => {
    try {
      const result = piapiService.checkIfFaceDetectionError(testCase.errorMessage, testCase.errorDetails);
      
      if (result === testCase.expected) {
        console.log(`✅ Test ${index + 1} (${testCase.name}): PASSED`);
        passed++;
      } else {
        console.log(`❌ Test ${index + 1} (${testCase.name}): FAILED`);
        console.log(`   Expected: ${testCase.expected}, Got: ${result}`);
        console.log(`   Error message: ${testCase.errorMessage}`);
        console.log(`   Error details:`, testCase.errorDetails);
        failed++;
      }
    } catch (error) {
      console.log(`💥 Test ${index + 1} (${testCase.name}): ERROR`);
      console.log(`   Error: ${error.message}`);
      failed++;
    }
  });
  
  console.log('\n📊 Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📝 Total: ${testCases.length}`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! Face detection error logic is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the logic in piapiService.js');
  }
}

// Test error message extraction
function testErrorExtraction() {
  console.log('\n🔍 Testing error message extraction:');
  
  const errorExtractionTests = [
    {
      name: 'String error',
      error: 'Simple error message',
      expected: 'Simple error message'
    },
    {
      name: 'Object with message',
      error: { message: 'Object error message' },
      expected: 'Object error message'
    },
    {
      name: 'Object with error field',
      error: { error: 'Error field message' },
      expected: 'Error field message'
    },
    {
      name: 'Complex object',
      error: { 
        code: 400,
        data: { message: 'Nested message' },
        message: 'Top level message'
      },
      expected: 'Top level message'
    }
  ];
  
  errorExtractionTests.forEach((test, index) => {
    let errorMessage = 'Task failed without specific error message';
    let errorDetails = null;
    
    if (typeof test.error === 'string') {
      errorMessage = test.error;
    } else if (typeof test.error === 'object') {
      errorDetails = test.error;
      errorMessage = test.error.message || 
                   test.error.error || 
                   test.error.description ||
                   JSON.stringify(test.error);
    }
    
    if (errorMessage === test.expected) {
      console.log(`✅ Extraction ${index + 1} (${test.name}): PASSED - "${errorMessage}"`);
    } else {
      console.log(`❌ Extraction ${index + 1} (${test.name}): FAILED`);
      console.log(`   Expected: "${test.expected}"`);
      console.log(`   Got: "${errorMessage}"`);
    }
  });
}

if (require.main === module) {
  runTests();
  testErrorExtraction();
}

module.exports = {
  runTests,
  testErrorExtraction,
  testCases
};
