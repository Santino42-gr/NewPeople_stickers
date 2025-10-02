const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

let supabase = null;

// Создание Supabase client только если переменные окружения доступны
if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false // Для server-side приложений
      }
    });
    logger.info('Supabase client initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize Supabase client:', error);
    supabase = null;
  }
} else {
  const missingVars = [];
  if (!supabaseUrl) missingVars.push('SUPABASE_URL');
  if (!supabaseKey) missingVars.push('SUPABASE_ANON_KEY');
  
  logger.warn(`Supabase not configured - missing: ${missingVars.join(', ')}`);
}

// Функция для тестирования подключения
async function testConnection() {
  if (!supabase) {
    logger.warn('Supabase client not initialized - skipping connection test');
    return false;
  }
  
  try {
    const { data, error } = await supabase
      .from('user_limits')
      .select('count')
      .limit(1);
      
    if (error) {
      logger.error('Supabase connection test failed:', error);
      return false;
    }
    
    logger.info('Supabase connection test successful');
    return true;
  } catch (error) {
    logger.error('Supabase connection test error:', error);
    return false;
  }
}

module.exports = {
  supabase,
  testConnection
};