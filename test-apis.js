require('dotenv').config();

console.log('🚀 Тестирование всех внешних API интеграций\n');

async function runAllTests() {
  console.log('=' .repeat(50));
  console.log('📱 TELEGRAM BOT API');
  console.log('=' .repeat(50));
  
  try {
    require('./test-telegram-api.js');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Пауза между тестами
  } catch (error) {
    console.error('Ошибка при тестировании Telegram API:', error.message);
  }
  
  console.log('\n' + '=' .repeat(50));
  console.log('🤖 PIAPI AI API'); 
  console.log('=' .repeat(50));
  
  try {
    require('./test-piapi-api.js');
  } catch (error) {
    console.error('Ошибка при тестировании Piapi API:', error.message);
  }
  
  console.log('\n' + '=' .repeat(50));
  console.log('📋 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ');
  console.log('=' .repeat(50));
  
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const piapiKey = process.env.PIAPI_API_KEY;
  
  console.log('\n🔧 Статус настройки переменных окружения:');
  console.log(`   TELEGRAM_BOT_TOKEN: ${telegramToken && telegramToken !== 'your_telegram_bot_token' ? '✅ Настроен' : '❌ Не настроен'}`);
  console.log(`   PIAPI_API_KEY: ${piapiKey && piapiKey !== 'your_piapi_api_key' ? '✅ Настроен' : '❌ Не настроен'}`);
  console.log(`   SUPABASE_URL: ${process.env.SUPABASE_URL ? '✅ Настроен' : '❌ Не настроен'}`);
  console.log(`   SUPABASE_ANON_KEY: ${process.env.SUPABASE_ANON_KEY ? '✅ Настроен' : '❌ Не настроен'}`);
  
  const allConfigured = telegramToken && telegramToken !== 'your_telegram_bot_token' &&
                       piapiKey && piapiKey !== 'your_piapi_api_key' &&
                       process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY;
  
  if (allConfigured) {
    console.log('\n🎉 Все API ключи настроены! Готов к разработке основного функционала.');
  } else {
    console.log('\n⚠️  Некоторые API ключи не настроены. Проверьте инструкции по настройке.');
  }
}

// Запускаем только если этот файл выполняется напрямую
if (require.main === module) {
  runAllTests();
}