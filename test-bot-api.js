const https = require('https');

const BOT_TOKEN = "8015476800:AAGMH8HMXRurphYHRQDJdeHLO10ghZVzBt8";

console.log("🔧 Testing Telegram Bot API...");

// Test 1: Get bot info
function testGetMe() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${BOT_TOKEN}/getMe`,
      method: 'GET'
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log("✅ Bot API Test - getMe:", response);
          resolve(response);
        } catch (error) {
          console.error("❌ Bot API Test - Parse Error:", error);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error("❌ Bot API Test - Request Error:", error);
      reject(error);
    });

    req.end();
  });
}

// Test 2: Get updates
function testGetUpdates() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${BOT_TOKEN}/getUpdates?limit=1`,
      method: 'GET'
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log("✅ Bot API Test - getUpdates:", response);
          resolve(response);
        } catch (error) {
          console.error("❌ Bot API Test - Parse Error:", error);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error("❌ Bot API Test - Request Error:", error);
      reject(error);
    });

    req.end();
  });
}

// Run tests
async function runTests() {
  try {
    console.log("🔧 Test 1: Getting bot information...");
    await testGetMe();
    
    console.log("🔧 Test 2: Getting recent updates...");
    await testGetUpdates();
    
    console.log("✅ All API tests completed!");
  } catch (error) {
    console.error("❌ API tests failed:", error);
  }
}

runTests();
