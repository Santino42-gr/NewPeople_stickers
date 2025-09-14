/**
 * Test script for broadcast system
 * Tests basic functionality of mass messaging system
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const API_KEY = process.env.API_KEY || 'test-api-key';

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testBroadcastSystem() {
  log('blue', '🚀 Testing Broadcast System...\n');

  try {
    // Test 1: Check broadcast health
    log('yellow', '1. Testing broadcast system health...');
    try {
      const healthResponse = await axios.get(`${BASE_URL}/admin/broadcast/health`);
      
      if (healthResponse.data.healthy) {
        log('green', '✅ Broadcast system is healthy');
      } else {
        log('red', '❌ Broadcast system is not healthy');
        console.log('Response:', healthResponse.data);
      }
    } catch (error) {
      log('red', `❌ Health check failed: ${error.message}`);
    }

    // Test 2: List existing campaigns
    log('yellow', '\n2. Listing existing campaigns...');
    try {
      const listResponse = await axios.get(`${BASE_URL}/admin/broadcast/list`, {
        headers: {
          'X-API-Key': API_KEY
        }
      });
      
      log('green', `✅ Found ${listResponse.data.campaigns.length} existing campaigns`);
      
      if (listResponse.data.campaigns.length > 0) {
        console.log('Recent campaigns:');
        listResponse.data.campaigns.slice(0, 3).forEach(campaign => {
          console.log(`  - ${campaign.name} (${campaign.status}) - ${campaign.campaign_type}`);
        });
      }
    } catch (error) {
      log('red', `❌ List campaigns failed: ${error.message}`);
      if (error.response) {
        console.log('Response:', error.response.data);
      }
    }

    // Test 3: Create text-only campaign
    log('yellow', '\n3. Creating text-only broadcast campaign...');
    try {
      const textCampaign = await axios.post(`${BASE_URL}/admin/broadcast/create`, {
        name: `Test Campaign ${Date.now()}`,
        messageText: '🎉 Тестовое сообщение рассылки!\n\nЭто тестовое сообщение от системы массовой рассылки New People Stickers Bot.',
        campaignType: 'text_only'
      }, {
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'application/json'
        }
      });
      
      log('green', `✅ Text campaign created: ${textCampaign.data.campaign.id}`);
      console.log(`   Name: ${textCampaign.data.campaign.name}`);
      console.log(`   Recipients: ${textCampaign.data.campaign.totalRecipients}`);
      console.log(`   Type: ${textCampaign.data.campaign.campaignType}`);

      const textCampaignId = textCampaign.data.campaign.id;

      // Test 4: Check campaign status
      log('yellow', '\n4. Checking campaign status...');
      try {
        const statusResponse = await axios.get(`${BASE_URL}/admin/broadcast/${textCampaignId}/status`, {
          headers: {
            'X-API-Key': API_KEY
          }
        });
        
        log('green', `✅ Campaign status: ${statusResponse.data.campaign.status}`);
        console.log('Campaign details:');
        console.log(`   Name: ${statusResponse.data.campaign.name}`);
        console.log(`   Type: ${statusResponse.data.campaign.campaign_type}`);
        console.log(`   Total Recipients: ${statusResponse.data.campaign.total_recipients}`);
        console.log(`   Success Rate: ${statusResponse.data.campaign.success_rate_percent}%`);

      } catch (error) {
        log('red', `❌ Status check failed: ${error.message}`);
      }

      // Test 5: Start campaign (commented out for safety)
      log('yellow', '\n5. Campaign start test (simulated - not actually started)');
      log('blue', `   To actually start this campaign, run:`);
      log('blue', `   curl -X POST "${BASE_URL}/admin/broadcast/${textCampaignId}/start" -H "X-API-Key: ${API_KEY}"`);

      // Uncomment the following lines to actually start the campaign:
      /*
      try {
        const startResponse = await axios.post(`${BASE_URL}/admin/broadcast/${textCampaignId}/start`, {}, {
          headers: {
            'X-API-Key': API_KEY
          }
        });
        
        if (startResponse.data.success) {
          log('green', '✅ Campaign started successfully');
          
          // Monitor campaign progress
          log('yellow', '\n6. Monitoring campaign progress...');
          
          let attempts = 0;
          const maxAttempts = 20;
          
          while (attempts < maxAttempts) {
            await sleep(5000); // Wait 5 seconds
            
            try {
              const progressResponse = await axios.get(`${BASE_URL}/admin/broadcast/${textCampaignId}/status`, {
                headers: {
                  'X-API-Key': API_KEY
                }
              });
              
              const campaign = progressResponse.data.campaign;
              console.log(`   Progress: ${campaign.successful_deliveries + campaign.failed_deliveries}/${campaign.total_recipients} (${campaign.success_rate_percent}%)`);
              
              if (campaign.status === 'completed' || campaign.status === 'failed') {
                log('green', `✅ Campaign ${campaign.status}: ${campaign.successful_deliveries} sent, ${campaign.failed_deliveries} failed, ${campaign.blocked_users} blocked`);
                break;
              }
              
            } catch (error) {
              log('red', `❌ Progress check failed: ${error.message}`);
              break;
            }
            
            attempts++;
          }
          
        } else {
          log('red', '❌ Failed to start campaign');
        }
        
      } catch (error) {
        log('red', `❌ Campaign start failed: ${error.message}`);
        if (error.response) {
          console.log('Response:', error.response.data);
        }
      }
      */

    } catch (error) {
      log('red', `❌ Campaign creation failed: ${error.message}`);
      if (error.response) {
        console.log('Response:', error.response.data);
      }
    }

    // Test 6: Create image campaign (if test image exists)
    const testImagePath = path.join(__dirname, 'test-image.png');
    if (fs.existsSync(testImagePath)) {
      log('yellow', '\n6. Creating image campaign with test image...');
      try {
        const form = new FormData();
        form.append('name', `Test Image Campaign ${Date.now()}`);
        form.append('messageText', '🖼️ Тестовое сообщение с картинкой!');
        form.append('imageCaption', 'Тестовое изображение для рассылки');
        form.append('campaignType', 'text_and_image');
        form.append('image', fs.createReadStream(testImagePath));

        const imageCampaign = await axios.post(`${BASE_URL}/admin/broadcast/create`, form, {
          headers: {
            'X-API-Key': API_KEY,
            ...form.getHeaders()
          }
        });
        
        log('green', `✅ Image campaign created: ${imageCampaign.data.campaign.id}`);
        console.log(`   Name: ${imageCampaign.data.campaign.name}`);
        console.log(`   Type: ${imageCampaign.data.campaign.campaignType}`);

      } catch (error) {
        log('red', `❌ Image campaign creation failed: ${error.message}`);
        if (error.response) {
          console.log('Response:', error.response.data);
        }
      }
    } else {
      log('blue', '\n6. Image campaign test skipped (no test-image.png found)');
      log('blue', '   Create a test-image.png file in the project root to test image campaigns');
    }

    log('green', '\n🎉 Broadcast system testing completed!');
    
  } catch (error) {
    log('red', `\n💥 Test suite failed: ${error.message}`);
    process.exit(1);
  }
}

// Additional utility functions for manual testing
async function createTextCampaign(name, message) {
  try {
    const response = await axios.post(`${BASE_URL}/admin/broadcast/create`, {
      name,
      messageText: message,
      campaignType: 'text_only'
    }, {
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data.campaign;
  } catch (error) {
    throw new Error(`Campaign creation failed: ${error.message}`);
  }
}

async function startCampaign(campaignId) {
  try {
    const response = await axios.post(`${BASE_URL}/admin/broadcast/${campaignId}/start`, {}, {
      headers: {
        'X-API-Key': API_KEY
      }
    });
    
    return response.data;
  } catch (error) {
    throw new Error(`Campaign start failed: ${error.message}`);
  }
}

// Command line interface
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'create-text' && process.argv[3] && process.argv[4]) {
    const name = process.argv[3];
    const message = process.argv[4];
    
    createTextCampaign(name, message)
      .then(campaign => {
        console.log(`✅ Campaign created: ${campaign.id}`);
        console.log(`   Name: ${campaign.name}`);
        console.log(`   Recipients: ${campaign.totalRecipients}`);
      })
      .catch(error => {
        console.error(`❌ ${error.message}`);
        process.exit(1);
      });
      
  } else if (command === 'start' && process.argv[3]) {
    const campaignId = process.argv[3];
    
    startCampaign(campaignId)
      .then(result => {
        console.log(`✅ Campaign started: ${result.campaignId}`);
      })
      .catch(error => {
        console.error(`❌ ${error.message}`);
        process.exit(1);
      });
      
  } else if (command === 'help') {
    console.log(`
Usage:
  node test-broadcast.js                              # Run full test suite
  node test-broadcast.js create-text "Name" "Message" # Create text campaign
  node test-broadcast.js start <campaign-id>          # Start campaign
  node test-broadcast.js help                         # Show this help

Environment Variables:
  TEST_BASE_URL - Base URL for testing (default: http://localhost:3000)
  API_KEY       - API key for admin endpoints (default: test-api-key)

Examples:
  node test-broadcast.js create-text "New Year 2025" "🎉 Happy New Year!"
  node test-broadcast.js start abc123-def456-ghi789
`);
  } else {
    // Run full test suite
    testBroadcastSystem();
  }
}

module.exports = {
  testBroadcastSystem,
  createTextCampaign,
  startCampaign
};