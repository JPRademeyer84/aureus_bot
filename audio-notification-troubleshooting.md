# Audio Notification Troubleshooting Guide

## 🔍 Quick Diagnosis Steps

### Step 1: Check Telegram Client Settings
**Most Common Issue**: Telegram client has notifications disabled

#### For Mobile (iOS/Android):
1. Go to **Telegram Settings** → **Notifications and Sounds**
2. Ensure **Private Chats** notifications are enabled
3. Check **Sound** is not set to "None"
4. Verify **In-App Sounds** are enabled

#### For Desktop:
1. Go to **Settings** → **Notifications**
2. Enable **Desktop notifications**
3. Enable **Play sound**
4. Check system notification settings

#### For Web:
1. Check browser notification permissions
2. Ensure browser sounds are not muted
3. Web version has limited audio support

### Step 2: Test Bot Audio Notifications
1. Send `/start` to your bot
2. Go to **Settings** → **User Settings**
3. Click **🔊 Test Audio Notification**
4. Check if you see the emoji and hear sound

### Step 3: Check User Preferences in Database
Run this query in Supabase to check your preferences:

```sql
SELECT * FROM user_notification_preferences 
WHERE telegram_id = YOUR_TELEGRAM_ID;
```

If no record exists, the bot should use defaults (audio enabled).

### Step 4: Verify Bot Implementation
Check if the bot is actually calling the audio notification functions.

## 🔧 Common Issues and Solutions

### Issue 1: No Database Record
**Symptom**: User preferences not found in database
**Solution**: 
1. Use the bot settings menu to toggle audio notifications
2. This will create the database record
3. Test again

### Issue 2: Telegram Client Muted
**Symptom**: Bot works but no sound
**Solution**:
1. Check Telegram notification settings
2. Ensure device volume is up
3. Test with other Telegram bots

### Issue 3: Bot Not Using Audio Functions
**Symptom**: Messages sent but without audio emojis
**Solution**: Check bot logs for errors

### Issue 4: Database Connection Issues
**Symptom**: Bot falls back to silent notifications
**Solution**: Check database connectivity

## 🧪 Testing Procedure

### Test 1: Manual Audio Test
1. Go to bot settings
2. Click "🔊 Test Audio Notification"
3. Should see: `🔔 AUDIO NOTIFICATION TEST`
4. Should hear notification sound

### Test 2: Real Notification Test
1. Submit a withdrawal request (small amount)
2. Check if you receive audio notification
3. Admin should also receive notification

### Test 3: Different Notification Types
Test each type:
- Payment notifications
- Withdrawal notifications  
- Commission notifications
- System announcements

## 📱 Platform-Specific Issues

### iOS Telegram
- Check **Settings** → **Notifications** → **Telegram**
- Ensure **Allow Notifications** is ON
- Check **Sounds** setting

### Android Telegram
- Check **Settings** → **Apps** → **Telegram** → **Notifications**
- Ensure notifications are enabled
- Check **Sound** settings

### Desktop Telegram
- Check **Settings** → **Notifications**
- Enable **Desktop notifications**
- Enable **Play sound**

### Web Telegram
- Limited audio support
- Check browser notification permissions
- May not support all audio features

## 🔍 Debug Information to Check

### 1. Bot Logs
Look for these log messages:
```
🔊 [AUDIO] Sent SUCCESS notification to user 123456789
🔇 [SILENT] Sent silent INFO notification to user 123456789
```

### 2. Database Queries
Check user preferences:
```sql
-- Check if user has preferences
SELECT * FROM user_notification_preferences WHERE telegram_id = YOUR_ID;

-- Check notification log
SELECT * FROM notification_log WHERE telegram_id = YOUR_ID ORDER BY sent_at DESC LIMIT 10;
```

### 3. Function Calls
Verify these functions are being called:
- `isAudioNotificationEnabled()`
- `sendAudioNotificationToUser()`
- `sendNotificationWithAudio()`

## 🛠️ Quick Fixes

### Fix 1: Reset User Preferences
```sql
DELETE FROM user_notification_preferences WHERE telegram_id = YOUR_ID;
```
Then use bot settings to recreate preferences.

### Fix 2: Force Enable Audio
```sql
UPDATE user_notification_preferences 
SET audio_enabled = true, 
    payment_approval_audio = true,
    withdrawal_approval_audio = true,
    commission_update_audio = true
WHERE telegram_id = YOUR_ID;
```

### Fix 3: Check Bot Restart
Ensure bot was restarted after schema installation.

## 📞 Support Checklist

When reporting audio notification issues, provide:

1. **Platform**: iOS/Android/Desktop/Web
2. **Telegram Version**: Check in Telegram settings
3. **Bot Logs**: Any error messages
4. **Database Check**: User preferences query result
5. **Test Results**: What happens with "Test Audio Notification"
6. **Other Bots**: Do other Telegram bots play sounds?

## 🎯 Expected Behavior

### Working Audio Notifications Should:
1. ✅ Display emoji at start of message (🔔, 💰, ❌, etc.)
2. ✅ Play notification sound (if Telegram settings allow)
3. ✅ Show in notification log with `audio_enabled = true`
4. ✅ Respect user preferences from database

### Silent Notifications Should:
1. ✅ Send message without emoji prefix
2. ✅ Set `disable_notification = true` in Telegram API
3. ✅ Show in notification log with `audio_enabled = false`

## 🔄 Next Steps

1. **Try the Test Audio Notification** feature first
2. **Check Telegram client settings** (most common issue)
3. **Verify database preferences** are correct
4. **Check bot logs** for error messages
5. **Test on different devices/platforms**

If none of these steps resolve the issue, the problem may be in the bot implementation or database connectivity.
