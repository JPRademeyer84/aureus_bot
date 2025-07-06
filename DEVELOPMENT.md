# 🤖 Dual Bot Development Environment

## Overview

This project uses a **dual-bot setup** with separate files to ensure safe development and testing without affecting the live production bot that users are actively using on Railway.

## 🔐 Bot Configuration

### Production Bot (Live) 🟢
- **File**: `aureus-bot-new.js`
- **Token**: `7858706839:AAFRXBSlREW0wPvIyI57uFpHfYopi2CY464`
- **Username**: `@AureusAllianceBot`
- **Location**: **Railway Cloud** (from main GitHub repo)
- **Status**: **PROTECTED** - Live users are using this bot
- **Usage**: Only for final deployments via Railway

### Development Bot (Testing) 🟡
- **File**: `aureus-bot-dev.js`
- **Token**: `8165881275:AAGCpFnHR-mYUeawUTyfbOa1jrDz5w2NWtQ`
- **Username**: `@AureusAllianceDevBot`
- **Location**: **Local Development** (this machine)
- **Status**: Safe for testing and development
- **Usage**: All development and testing work

## 🚀 Running the Bot

### Development Mode (Safe Testing)
```bash
# Start development bot with auto-restart (recommended)
npm run dev

# Start development bot (single run)
npm run dev:start

# Start development bot with file watching
npm run dev:watch
```

### Production Mode (Live Bot on Railway)
```bash
# Production bot runs automatically on Railway
# File: aureus-bot-new.js
# No local commands needed - managed by Railway

# For local production testing only (NOT recommended)
npm run prod
```

## 🔧 Environment Configuration

The bot automatically selects the correct token based on the `NODE_ENV` environment variable:

- `NODE_ENV=development` → Uses development bot token
- `NODE_ENV=production` → Uses production bot token

## 📁 Environment Files

### `.env` (Current environment)
Contains the active configuration for your current development session.

### `.env.example` (Template)
Template file showing all required environment variables.

## 🛡️ Safety Guidelines

### ✅ DO (Development)
- Use `npm run dev` for all testing
- Test new features on `@AureusAllianceDevBot`
- Make changes and experiment freely
- Test with small amounts or test data

### ❌ DON'T (Production)
- Never run `npm start` or `npm run start:prod` during development
- Don't test unfinished features on the live bot
- Don't push untested changes to production
- Don't use production bot for debugging

## 🔄 Deployment Workflow

1. **Develop** → Test on `@AureusAllianceDevBot`
2. **Test** → Verify all features work correctly
3. **Review** → Ensure code is production-ready
4. **Deploy** → Switch to production mode when ready

## 🔍 Environment Verification

When the bot starts, it will log:
```
🔧 ENVIRONMENT: DEVELOPMENT
🤖 BOT: @AureusAllianceDevBot (DEV)
🔐 TOKEN: 8165881275...
```

Always verify you're running the correct environment before testing!

## 🆘 Emergency Procedures

If you accidentally start the production bot during development:
1. **Immediately stop the process** (Ctrl+C)
2. **Check the logs** to see which bot was started
3. **Restart in development mode** using `npm run dev`
4. **Verify the environment** in the startup logs

## 📞 Support

- **Development Issues**: Test on `@AureusAllianceDevBot`
- **Production Issues**: Contact admin before making changes
- **Token Issues**: Regenerate tokens via BotFather if compromised
