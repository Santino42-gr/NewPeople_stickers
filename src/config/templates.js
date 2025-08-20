/**
 * Meme templates configuration
 * Contains all meme templates used for sticker generation
 */

const MEME_TEMPLATES = [
  {
    id: '1',
    name: 'Meme Template 1',
    emoji: '😄',
    imageUrl: 'https://raw.githubusercontent.com/Santino42-gr/NewPeople_stickers/main/assets/memes/meme-1.png',
    description: 'Meme template for stickers'
  },
  {
    id: '2',
    name: 'Meme Template 2',
    emoji: '😎',
    imageUrl: 'https://raw.githubusercontent.com/Santino42-gr/NewPeople_stickers/main/assets/memes/meme-2.png',
    description: 'Meme template for stickers'
  },
  {
    id: '3',
    name: 'Meme Template 3',
    emoji: '🤪',
    imageUrl: 'https://raw.githubusercontent.com/Santino42-gr/NewPeople_stickers/main/assets/memes/meme-3.png',
    description: 'Meme template for stickers'
  },
  {
    id: '4',
    name: 'Meme Template 4',
    emoji: '😏',
    imageUrl: 'https://raw.githubusercontent.com/Santino42-gr/NewPeople_stickers/main/assets/memes/meme-4.png',
    description: 'Meme template for stickers'
  },
  {
    id: '5',
    name: 'Meme Template 5',
    emoji: '🥳',
    imageUrl: 'https://raw.githubusercontent.com/Santino42-gr/NewPeople_stickers/main/assets/memes/meme-5.png',
    description: 'Meme template for stickers'
  },
  {
    id: '6',
    name: 'Meme Template 6',
    emoji: '🤯',
    imageUrl: 'https://raw.githubusercontent.com/Santino42-gr/NewPeople_stickers/main/assets/memes/meme-6.png',
    description: 'Meme template for stickers'
  },
  {
    id: '7',
    name: 'Meme Template 7',
    emoji: '😂',
    imageUrl: 'https://raw.githubusercontent.com/Santino42-gr/NewPeople_stickers/main/assets/memes/meme-7.png',
    description: 'Meme template for stickers'
  },
  {
    id: '8',
    name: 'Meme Template 8',
    emoji: '🔥',
    imageUrl: 'https://raw.githubusercontent.com/Santino42-gr/NewPeople_stickers/main/assets/memes/meme-8.png',
    description: 'Meme template for stickers'
  },
  {
    id: '9',
    name: 'Meme Template 9',
    emoji: '💪',
    imageUrl: 'https://raw.githubusercontent.com/Santino42-gr/NewPeople_stickers/main/assets/memes/meme-9.png',
    description: 'Meme template for stickers'
  },
  {
    id: '10',
    name: 'Meme Template 10',
    emoji: '🚀',
    imageUrl: 'https://raw.githubusercontent.com/Santino42-gr/NewPeople_stickers/main/assets/memes/meme-10.png',
    description: 'Meme template for stickers'
  },
  {
    id: '11',
    name: 'Стикер 11',
    emoji: '😁',
    imageUrl: 'https://raw.githubusercontent.com/Santino42-gr/NewPeople_stickers/main/assets/memes/стикер%2011%20(1).png',
    description: 'Готовый стикер 11'
  },
  {
    id: '12',
    name: 'Стикер 12',
    emoji: '🤩',
    imageUrl: 'https://raw.githubusercontent.com/Santino42-gr/NewPeople_stickers/main/assets/memes/стикер%2012%20(1).png',
    description: 'Готовый стикер 12'
  }
];

// Template validation
const validateTemplate = (template) => {
  const required = ['id', 'name', 'emoji', 'imageUrl', 'description'];
  
  for (const field of required) {
    if (!template[field]) {
      throw new Error(`Template missing required field: ${field}`);
    }
  }
  
  // Validate emoji (should be a single emoji)
  if (template.emoji.length > 2) {
    throw new Error(`Invalid emoji for template ${template.id}: ${template.emoji}`);
  }
  
  // Validate URL format (basic URL validation)
  try {
    new URL(template.imageUrl);
  } catch (error) {
    throw new Error(`Invalid URL for template ${template.id}: ${template.imageUrl}`);
  }
  
  return true;
};

// Validate all templates on load
MEME_TEMPLATES.forEach(validateTemplate);

// Template utilities
const getTemplateById = (id) => {
  const template = MEME_TEMPLATES.find(t => t.id === id);
  if (!template) {
    throw new Error(`Template not found: ${id}`);
  }
  return template;
};

const getAllTemplates = () => {
  return [...MEME_TEMPLATES]; // Return copy to prevent mutations
};

const getTemplateCount = () => {
  return MEME_TEMPLATES.length;
};

const getRandomTemplate = () => {
  const randomIndex = Math.floor(Math.random() * MEME_TEMPLATES.length);
  return MEME_TEMPLATES[randomIndex];
};

// Template processing configuration
const TEMPLATE_CONFIG = {
  // Processing settings
  MAX_PROCESSING_TIME: 10 * 60 * 1000, // 10 minutes total
  PROCESSING_TIMEOUT_PER_TEMPLATE: 60 * 1000, // 1 minute per template
  MAX_RETRIES_PER_TEMPLATE: 2,
  BATCH_SIZE: 3, // Process templates in batches
  
  // Image settings
  TEMPLATE_IMAGE_MAX_SIZE: 5 * 1024 * 1024, // 5MB
  OUTPUT_STICKER_SIZE: 512, // 512x512 pixels
  OUTPUT_QUALITY: 85,
  
  // AI processing
  FACE_SWAP_QUALITY: 'high',
  FACE_DETECTION_CONFIDENCE: 0.7,
  
  // Error handling
  CONTINUE_ON_TEMPLATE_ERROR: true, // Continue processing other templates if one fails
  MIN_SUCCESSFUL_STICKERS: 5 // Minimum stickers needed for a successful pack
};

// Error types for template processing
const TEMPLATE_ERROR_TYPES = {
  DOWNLOAD_FAILED: 'template_download_failed',
  FACE_SWAP_FAILED: 'face_swap_failed',
  CONVERSION_FAILED: 'conversion_failed',
  UPLOAD_FAILED: 'upload_failed',
  TIMEOUT: 'processing_timeout',
  VALIDATION_FAILED: 'validation_failed'
};

module.exports = {
  MEME_TEMPLATES,
  TEMPLATE_CONFIG,
  TEMPLATE_ERROR_TYPES,
  getTemplateById,
  getAllTemplates,
  getTemplateCount,
  getRandomTemplate,
  validateTemplate
};