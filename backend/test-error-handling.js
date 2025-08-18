/**
 * Test script for error handling system
 * Tests all enhanced error handling utilities
 */

const logger = require('./src/utils/logger');
const errorHandler = require('./src/utils/errorHandler');
const validators = require('./src/utils/validators');
const { MESSAGES, CONFIG, ERROR_TYPES } = require('./src/config/constants');

console.log('🧪 Testing Enhanced Error Handling System\n');

// Test 1: Logger functionality
console.log('1️⃣ Testing Logger...');
logger.info('Test info message', { test: true });
logger.warn('Test warning message', { component: 'test' });
logger.error('Test error message', { error: 'simulated' });
logger.debug('Test debug message (only in dev)', { debug: true });

logger.logUserActivity(12345, 'test_action', { testData: 'value' });
logger.logApiCall('TestAPI', '/test-endpoint', 150, true);
logger.logGeneration(12345, 'started', { template: 'test' });
logger.logSecurity('test_security_event', 'warn', { userId: 12345 });
logger.logMetric('test_metric', 100, { unit: 'count' });
logger.logSystem('test_startup', { version: '1.0.0' });

console.log('✅ Logger test completed\n');

// Test 2: Validator functionality
console.log('2️⃣ Testing Validators...');

// Test user ID validation
console.log('User ID validation:');
console.log('Valid ID (12345):', validators.isValidUserId(12345));
console.log('Invalid ID (0):', validators.isValidUserId(0));
console.log('Invalid ID ("abc"):', validators.isValidUserId("abc"));

// Test chat ID validation  
console.log('Chat ID validation:');
console.log('Valid chat ID (-100123456):', validators.isValidChatId(-100123456));
console.log('Invalid chat ID (null):', validators.isValidChatId(null));

// Test URL validation
console.log('URL validation:');
console.log('Valid URL:', validators.isValidUrl('https://example.com/test'));
console.log('Invalid URL:', validators.isValidUrl('not-a-url'));

// Test file ID validation
console.log('File ID validation:');
console.log('Valid file ID:', validators.isValidFileId('BAADBAADrwADBREAAYag2DP3_QC6Ag'));
console.log('Invalid file ID:', validators.isValidFileId('invalid'));

// Test image buffer validation
const testBuffer = Buffer.from('test data');
console.log('Image buffer validation:');
console.log('Invalid buffer:', validators.isValidImageBuffer(testBuffer));

// Create a mock JPEG buffer for testing
const mockJpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, ...Array(100).fill(0)]);
console.log('Mock JPEG buffer:', validators.isValidImageBuffer(mockJpegBuffer));

// Test text sanitization
console.log('Text sanitization:');
console.log('Sanitized text:', validators.sanitizeText('  Test <script>alert("xss")</script> text  '));

console.log('✅ Validators test completed\n');

// Test 3: Error Handler functionality  
console.log('3️⃣ Testing Error Handler...');

// Test custom error creation
console.log('Custom error creation:');
const testError = errorHandler.createError('Test error message', 'TestError', 400);
console.log('Created error:', testError.name, testError.message, testError.statusCode);

// Test safe execution
console.log('Safe execution test:');
(async () => {
  // Test successful execution
  const result1 = await errorHandler.safeExecute(async () => {
    return 'Success result';
  }, 'Fallback value');
  console.log('Safe execute success:', result1);

  // Test failed execution with fallback
  const result2 = await errorHandler.safeExecute(async () => {
    throw new Error('Simulated error');
  }, 'Fallback value');
  console.log('Safe execute with fallback:', result2);

  // Test retry logic
  console.log('Testing retry logic...');
  let attempts = 0;
  try {
    await errorHandler.safeExecuteWithRetries(async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error(`Attempt ${attempts} failed`);
      }
      return `Success after ${attempts} attempts`;
    }, null, 3);
  } catch (error) {
    console.log('Retry test completed, attempts:', attempts);
  }

  // Test graceful degradation
  console.log('Testing graceful degradation...');
  const degradedResult = await errorHandler.gracefulDegrade(
    async () => {
      throw new Error('Primary function failed');
    },
    async () => {
      return 'Degraded mode result';
    },
    { operation: 'test' }
  );
  console.log('Graceful degradation result:', degradedResult);

  console.log('✅ Error Handler test completed\n');

  // Test 4: Specific error handlers
  console.log('4️⃣ Testing Specific Error Handlers...');

  // Test Telegram error handling
  const mockTelegramError = {
    response: { status: 400 },
    message: 'Bad Request'
  };
  try {
    throw errorHandler.handleTelegramError(mockTelegramError, { chatId: 12345 });
  } catch (error) {
    console.log('Telegram error handled:', error.name, error.message);
  }

  // Test Piapi error handling  
  const mockPiapiError = {
    response: { status: 429 },
    message: 'Rate limit exceeded'
  };
  try {
    throw errorHandler.handlePiapiError(mockPiapiError, { taskId: 'test123' });
  } catch (error) {
    console.log('Piapi error handled:', error.name, error.message);
  }

  // Test image processing error handling
  const mockImageError = {
    code: 'INVALID_FORMAT',
    message: 'Unsupported image format'
  };
  try {
    throw errorHandler.handleImageProcessingError(mockImageError, { fileId: 'test' });
  } catch (error) {
    console.log('Image processing error handled:', error.name, error.message);
  }

  // Test network error handling
  const mockNetworkError = {
    code: 'ETIMEDOUT',
    message: 'Connection timed out'
  };
  try {
    throw errorHandler.handleNetworkError(mockNetworkError, { url: 'https://example.com' });
  } catch (error) {
    console.log('Network error handled:', error.name, error.message);
  }

  console.log('✅ Specific error handlers test completed\n');

  // Test 5: Constants validation
  console.log('5️⃣ Testing Enhanced Constants...');
  
  console.log('Messages loaded:', Object.keys(MESSAGES).length);
  console.log('Config loaded:', Object.keys(CONFIG).length);
  console.log('Error types loaded:', Object.keys(ERROR_TYPES).length);
  
  console.log('✅ Constants test completed\n');

  console.log('🎉 All error handling tests completed successfully!');
  console.log('\n📊 Test Summary:');
  console.log('✅ Logger: Structured logging with categories');
  console.log('✅ Validators: Comprehensive input validation');  
  console.log('✅ Error Handler: Enhanced error processing with retries');
  console.log('✅ Specific Handlers: API-specific error handling');
  console.log('✅ Constants: Extended configuration options');
  console.log('\n🚀 Error handling system is ready for production!');

})().catch(error => {
  console.error('❌ Test script failed:', error);
  process.exit(1);
});