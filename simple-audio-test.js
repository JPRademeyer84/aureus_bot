// Simple Audio Test - No Database Required
// Add this to your bot temporarily to test basic audio notifications

// Add this function to your bot file temporarily
async function testSimpleAudioNotification(ctx) {
  try {
    console.log('🔊 Testing simple audio notification...');
    
    // Test 1: Basic audio notification
    await ctx.replyWithMarkdown('🔔 **AUDIO TEST 1**\n\nThis should play a notification sound!', {
      disable_notification: false // Explicitly enable sound
    });
    
    // Wait 2 seconds
    setTimeout(async () => {
      // Test 2: Silent notification
      await ctx.replyWithMarkdown('🔇 **SILENT TEST 2**\n\nThis should be silent (no sound)', {
        disable_notification: true // Explicitly disable sound
      });
    }, 2000);
    
    // Wait 4 seconds
    setTimeout(async () => {
      // Test 3: Different emoji
      await ctx.replyWithMarkdown('💰 **PAYMENT TEST 3**\n\nThis should play a notification sound with payment emoji!', {
        disable_notification: false
      });
    }, 4000);
    
    console.log('✅ Simple audio tests sent');
    
  } catch (error) {
    console.error('❌ Error in simple audio test:', error);
    await ctx.reply('Error testing audio notifications');
  }
}

// Add this to your callback handler temporarily
// In your bot.on('callback_query') section, add:
/*
if (callbackData === 'test_simple_audio') {
  await testSimpleAudioNotification(ctx);
}
*/

// Add this button to your main menu temporarily
/*
[{ text: "🔊 Test Simple Audio", callback_data: "test_simple_audio" }]
*/
