/**
 * Example script for testing image broadcast functionality
 * Shows how to send campaigns with base64 images
 */

const fs = require('fs');
const path = require('path');

// Function to convert image file to base64 data URL
function imageToBase64DataUrl(imagePath) {
  const imageBuffer = fs.readFileSync(imagePath);
  const ext = path.extname(imagePath).toLowerCase();
  
  let mimeType;
  if (ext === '.png') {
    mimeType = 'image/png';
  } else if (ext === '.jpg' || ext === '.jpeg') {
    mimeType = 'image/jpeg';
  } else {
    throw new Error('Unsupported image format. Use PNG or JPEG only.');
  }
  
  const base64String = imageBuffer.toString('base64');
  return `data:${mimeType};base64,${base64String}`;
}

// Example data for different campaign types
const examples = {
  textOnly: {
    name: "Текстовая рассылка",
    campaignType: "text_only",
    messageText: "Привет! Это тестовое текстовое сообщение для всех пользователей."
  },

  imageOnly: {
    name: "Рассылка изображения",
    campaignType: "image_only",
    imageCaption: "Это тестовое изображение",
    // imageBase64 will be added programmatically
  },

  textAndImage: {
    name: "Текст + изображение",
    campaignType: "text_and_image",
    messageText: "Привет! Смотри какое классное изображение:",
    imageCaption: "Подпись к изображению",
    // imageBase64 will be added programmatically
  }
};

// Function to create example image as base64 (tiny 1x1 PNG)
function createExampleImageBase64() {
  // This is a tiny 1x1 transparent PNG in base64
  const tinyPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  return `data:image/png;base64,${tinyPngBase64}`;
}

// Postman collection example
const postmanExamples = {
  textOnly: {
    method: 'POST',
    url: 'http://localhost:3000/admin/broadcast/create',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'your_api_key_here'
    },
    body: examples.textOnly
  },

  imageOnly: {
    method: 'POST', 
    url: 'http://localhost:3000/admin/broadcast/create',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'your_api_key_here'
    },
    body: {
      ...examples.imageOnly,
      imageBase64: createExampleImageBase64()
    }
  },

  textAndImage: {
    method: 'POST',
    url: 'http://localhost:3000/admin/broadcast/create', 
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'your_api_key_here'
    },
    body: {
      ...examples.textAndImage,
      imageBase64: createExampleImageBase64()
    }
  }
};

console.log('📝 Image Broadcast Examples\n');

console.log('1️⃣ Text Only Campaign:');
console.log(JSON.stringify(examples.textOnly, null, 2));
console.log('\n');

console.log('2️⃣ Image Only Campaign:');
console.log(JSON.stringify({
  ...examples.imageOnly,
  imageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
}, null, 2));
console.log('\n');

console.log('3️⃣ Text + Image Campaign:');
console.log(JSON.stringify({
  ...examples.textAndImage, 
  imageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
}, null, 2));
console.log('\n');

console.log('📮 Postman Instructions:');
console.log('1. Откройте Postman');
console.log('2. Создайте новый POST запрос на: http://localhost:3000/admin/broadcast/create');
console.log('3. В Headers добавьте:');
console.log('   - Content-Type: application/json');
console.log('   - X-API-Key: ' + (process.env.API_KEY || 'your_api_key_here'));
console.log('4. В Body выберите "raw" и "JSON", затем вставьте один из примеров выше');
console.log('5. Отправьте запрос');
console.log('\n');

console.log('🖼️ Как добавить своё изображение:');
console.log('1. Конвертируйте изображение в base64 онлайн: https://www.base64-image.de/');  
console.log('2. Или используйте функцию imageToBase64DataUrl() из этого файла');
console.log('3. Замените поле imageBase64 на полученную строку');
console.log('\n');

console.log('🚀 Шаги для рассылки:');
console.log('1. Создайте кампанию (POST /admin/broadcast/create)');
console.log('2. Запустите кампанию (POST /admin/broadcast/{campaignId}/start)');  
console.log('3. Проверьте статус (GET /admin/broadcast/{campaignId}/status)');

// Export for use in other scripts
module.exports = {
  examples,
  postmanExamples,
  imageToBase64DataUrl,
  createExampleImageBase64
};