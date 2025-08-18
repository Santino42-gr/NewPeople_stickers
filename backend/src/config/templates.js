/**
 * Meme templates configuration
 * Contains all meme templates used for sticker generation
 */

const MEME_TEMPLATES = [
  {
    id: 'distracted_boyfriend',
    name: 'Distracted Boyfriend',
    emoji: '😍',
    imageUrl: 'https://drive.google.com/uc?id=1ABC123DEF456GHI789JKL0MN',
    description: 'Классический мем с парнем, который отвлекся на другую девушку'
  },
  {
    id: 'drake_pointing',
    name: 'Drake Pointing',
    emoji: '👍',
    imageUrl: 'https://drive.google.com/uc?id=2DEF456GHI789JKL0MN1ABC23',
    description: 'Дрейк показывает на что-то пальцем'
  },
  {
    id: 'woman_yelling_cat',
    name: 'Woman Yelling at Cat',
    emoji: '😾',
    imageUrl: 'https://drive.google.com/uc?id=3GHI789JKL0MN1ABC234DEF56',
    description: 'Женщина кричит на кота за столом'
  },
  {
    id: 'expanding_brain',
    name: 'Expanding Brain',
    emoji: '🧠',
    imageUrl: 'https://drive.google.com/uc?id=4JKL0MN1ABC234DEF567GHI89',
    description: 'Расширяющийся мозг - эволюция мышления'
  },
  {
    id: 'this_is_fine',
    name: 'This Is Fine',
    emoji: '🔥',
    imageUrl: 'https://drive.google.com/uc?id=5MN1ABC234DEF567GHI890JKL',
    description: 'Собака в горящей комнате говорит "This is fine"'
  },
  {
    id: 'surprised_pikachu',
    name: 'Surprised Pikachu',
    emoji: '😲',
    imageUrl: 'https://drive.google.com/uc?id=6ABC234DEF567GHI890JKL1MN',
    description: 'Удивленный Пикачу'
  },
  {
    id: 'change_my_mind',
    name: 'Change My Mind',
    emoji: '🤔',
    imageUrl: 'https://drive.google.com/uc?id=7DEF567GHI890JKL1MN2ABC3',
    description: 'Стивен Кроудер с табличкой "Change my mind"'
  },
  {
    id: 'two_buttons',
    name: 'Two Buttons',
    emoji: '😰',
    imageUrl: 'https://drive.google.com/uc?id=8GHI890JKL1MN2ABC345DEF6',
    description: 'Сложный выбор между двумя кнопками'
  },
  {
    id: 'galaxy_brain',
    name: 'Galaxy Brain',
    emoji: '🌌',
    imageUrl: 'https://drive.google.com/uc?id=9JKL1MN2ABC345DEF678GHI9',
    description: 'Галактический мозг - высший уровень мышления'
  },
  {
    id: 'stonks',
    name: 'Stonks',
    emoji: '📈',
    imageUrl: 'https://drive.google.com/uc?id=0MN2ABC345DEF678GHI901JKL',
    description: 'Мем "Stonks" - рост и успех'
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
  
  // Validate URL format
  if (!template.imageUrl.includes('drive.google.com')) {
    throw new Error(`Invalid Google Drive URL for template ${template.id}`);
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