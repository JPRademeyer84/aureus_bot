# 🚂 Railway Deployment Guide for Web Authentication

## ⚠️ **IMPORTANT: Live Bot Deployment Process**

Since your bot is live on Railway, we need to deploy the updated code safely without breaking the production bot.

## 🔧 **Pre-Deployment Checklist**

### **1. Create Database Table First** (CRITICAL)
**⚠️ Do this BEFORE deploying the bot code!**

Go to your Supabase SQL Editor and run:

```sql
-- Create auth_tokens table for web-telegram authentication
CREATE TABLE IF NOT EXISTS auth_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    token VARCHAR(255) UNIQUE NOT NULL,
    telegram_id BIGINT,
    user_data JSONB,
    confirmed BOOLEAN DEFAULT FALSE,
    cancelled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '10 minutes')
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_auth_tokens_token ON auth_tokens(token);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_created_at ON auth_tokens(created_at);

-- Enable RLS
ALTER TABLE auth_tokens ENABLE ROW LEVEL SECURITY;

-- Create policy for public access (needed for authentication polling)
CREATE POLICY "Allow public access to auth_tokens" ON auth_tokens
    FOR ALL USING (true);
```

### **2. Verify Environment Variables**
Make sure these are set in Railway:
- `TELEGRAM_BOT_TOKEN` - Your bot token
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anon key

## 🚀 **Safe Deployment Steps**

### **Option 1: Git Deployment (Recommended)**
```bash
# From the aureus_bot directory
git add .
git commit -m "Add web authentication support - /webauth command"
git push origin master
```

### **Option 2: Railway CLI Deployment**
```bash
# Install Railway CLI if not already installed
npm install -g @railway/cli

# Login to Railway
railway login

# Deploy from aureus_bot directory
cd aureus_bot
railway up
```

### **Option 3: Manual File Upload via Railway Dashboard**
1. Go to your Railway project dashboard
2. Navigate to the deployments section
3. Upload the updated `aureus-bot-new.js` file
4. Trigger a redeploy

## 🧪 **Testing After Deployment**

### **Step 1: Verify Bot is Running**
1. Check Railway logs for successful startup
2. Look for the console logs:
   - "🚀 Starting Aureus Alliance Holdings Telegram Bot..."
   - "🤖 Aureus Alliance Bot started successfully!"

### **Step 2: Test Web Authentication**
1. Go to your web app (localhost:3003)
2. Click "🔐 Authenticate with Telegram"
3. Follow the `/webauth` command instructions
4. Test with @AureusAllianceBot in Telegram

### **Step 3: Monitor Railway Logs**
Watch for these log messages during testing:
```
🔐 [WEBAUTH] Web authentication request from username (telegram_id)
🔐 [WEBAUTH-CONFIRM] Processing confirmation for token: abc123
🔐 [WEBAUTH-CONFIRM] Successfully confirmed authentication for token: abc123
```

## 🚨 **Rollback Plan**

If something goes wrong:

### **Quick Rollback via Railway**
1. Go to Railway dashboard
2. Navigate to deployments
3. Click on the previous working deployment
4. Click "Redeploy"

### **Emergency Rollback via Git**
```bash
git revert HEAD
git push origin master
```

## ✅ **Success Indicators**

You'll know the deployment worked when:
- ✅ Railway shows "Deployed" status
- ✅ Bot responds to existing commands (like `/start`)
- ✅ New `/webauth` command works
- ✅ Web authentication flow completes successfully
- ✅ No error messages in Railway logs

## 📋 **Post-Deployment Verification**

1. **Basic Bot Functions**: Test `/start`, `/menu` commands
2. **Web Authentication**: Complete full auth flow
3. **Database Writes**: Verify auth_tokens table gets populated
4. **Error Handling**: Test invalid `/webauth` commands

## 💡 **Pro Tips**

- **Deploy during low-traffic hours** to minimize user impact
- **Monitor Railway logs** for 10-15 minutes after deployment
- **Test immediately** after deployment to catch issues quickly
- **Keep the Railway dashboard open** during deployment for quick monitoring

Your bot will continue running uninterrupted with the new web authentication features! 🎉
