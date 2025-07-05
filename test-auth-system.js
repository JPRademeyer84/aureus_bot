const { db } = require('./src/database/supabase-client');
const bcrypt = require('bcryptjs');
require('dotenv').config();

console.log('🧪 Testing Authentication System...');

async function testAuthSystem() {
  try {
    console.log('🔍 Testing database connection...');
    const isConnected = await db.testConnection();
    if (!isConnected) {
      console.log('❌ Database connection failed');
      return;
    }
    console.log('✅ Database connected');

    // Test user creation
    console.log('\n📝 Testing user creation...');
    const testEmail = 'test@example.com';
    const testPassword = 'testpass123';
    
    // Check if test user already exists
    let existingUser = await db.getUserByEmail(testEmail);
    if (existingUser) {
      console.log('🗑️ Cleaning up existing test user...');
      await db.client.from('users').delete().eq('email', testEmail);
    }
    
    // Create new user
    const passwordHash = await bcrypt.hash(testPassword, 10);
    const newUser = await db.createUser({
      username: 'testuser',
      email: testEmail,
      password_hash: passwordHash,
      full_name: 'Test User',
      is_active: true,
      is_verified: true
    });
    
    if (newUser) {
      console.log('✅ User created successfully:', newUser.id);
    } else {
      console.log('❌ User creation failed');
      return;
    }

    // Test user retrieval by email
    console.log('\n🔍 Testing user retrieval by email...');
    const retrievedUser = await db.getUserByEmail(testEmail);
    if (retrievedUser) {
      console.log('✅ User retrieved successfully:', retrievedUser.email);
    } else {
      console.log('❌ User retrieval failed');
      return;
    }

    // Test password verification
    console.log('\n🔒 Testing password verification...');
    const isPasswordValid = await bcrypt.compare(testPassword, retrievedUser.password_hash);
    if (isPasswordValid) {
      console.log('✅ Password verification successful');
    } else {
      console.log('❌ Password verification failed');
      return;
    }

    // Test Telegram user creation
    console.log('\n📱 Testing Telegram user creation...');
    const testTelegramId = 123456789;
    
    // Clean up existing telegram user
    await db.client.from('telegram_users').delete().eq('telegram_id', testTelegramId);
    
    const telegramUser = await db.createTelegramUser(testTelegramId, {
      username: 'testuser_tg',
      first_name: 'Test',
      last_name: 'User',
      user_id: newUser.id,
      is_registered: true
    });
    
    if (telegramUser) {
      console.log('✅ Telegram user created successfully');
    } else {
      console.log('❌ Telegram user creation failed');
      return;
    }

    // Test Telegram user retrieval
    console.log('\n📱 Testing Telegram user retrieval...');
    const retrievedTgUser = await db.getTelegramUser(testTelegramId);
    if (retrievedTgUser && retrievedTgUser.is_registered) {
      console.log('✅ Telegram user retrieved successfully');
    } else {
      console.log('❌ Telegram user retrieval failed');
      return;
    }

    // Test session management
    console.log('\n🔄 Testing session management...');
    const session = await db.createUserSession(testTelegramId, 'test_state', { test: 'data' });
    if (session) {
      console.log('✅ Session created successfully');
    } else {
      console.log('❌ Session creation failed');
      return;
    }

    const retrievedSession = await db.getUserSession(testTelegramId);
    if (retrievedSession && retrievedSession.session_state === 'test_state') {
      console.log('✅ Session retrieved successfully');
    } else {
      console.log('❌ Session retrieval failed');
      return;
    }

    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    await db.client.from('telegram_users').delete().eq('telegram_id', testTelegramId);
    await db.client.from('users').delete().eq('email', testEmail);
    await db.client.from('user_sessions').delete().eq('telegram_id', testTelegramId);
    console.log('✅ Test data cleaned up');

    console.log('\n🎉 All authentication tests passed!');
    console.log('\n📋 Authentication System Status:');
    console.log('✅ User registration with email/password');
    console.log('✅ User login with email/password verification');
    console.log('✅ Telegram account linking');
    console.log('✅ Session state management');
    console.log('✅ Password hashing and verification');
    console.log('✅ Database integration');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testAuthSystem();
