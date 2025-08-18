const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  const missingVars = [];
  if (!supabaseUrl) missingVars.push('SUPABASE_URL');
  if (!supabaseKey) missingVars.push('SUPABASE_ANON_KEY');
  
  throw new Error(`Missing required Supabase configuration: ${missingVars.join(', ')}`);
}

// Создание Supabase client
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false // Для server-side приложений
  }
});

// Функция для тестирования подключения
async function testConnection() {
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