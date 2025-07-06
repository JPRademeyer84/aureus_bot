const { Telegraf } = require("telegraf");
const bcrypt = require("bcryptjs");
const { db } = require('./src/database/supabase-client');
require("dotenv").config();

console.log("🚀 Starting Aureus Alliance Holdings Telegram Bot - DEVELOPMENT VERSION...");
console.log("🔗 DEV BOT: Bot links are https://t.me/AureusAllianceDevBot (DEVELOPMENT BOT)");
console.log("🔥 DEVELOPMENT VERSION: 2025-07-06-LOCAL-DEV-BOT");
console.log("📅 STARTUP: " + new Date().toISOString());
console.log("🔧 DEVELOPMENT: Safe testing environment - no impact on live users");
console.log("🛡️ ISOLATED: Changes only affect development bot");
console.log("💰 SHARE CALCULATION: amount ÷ phase_price = shares");
console.log("🧪 TESTING MODE: All features available for safe testing");
console.log("🔗 DEV BOT LINK: All referral links use AureusAllianceDevBot");
console.log("🚨 DEVELOPMENT BOT: @AureusAllianceDevBot for local testing!");

// Bot configuration - Development only
const BOT_TOKEN = "8165881275:AAGCpFnHR-mYUeawUTyfbOa1jrDz5w2NWtQ";
const ADMIN_USERNAME = "TTTFOUNDER";

console.log("📊 Database: Supabase PostgreSQL");
console.log("🔧 ENVIRONMENT: DEVELOPMENT");
console.log("🤖 BOT: @AureusAllianceDevBot (DEV)");
console.log("🔐 TOKEN: 8165881275...");

// Create bot instance
const bot = new Telegraf(BOT_TOKEN);

// Utility functions
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

// Package formatting function removed - using custom amounts only

function createMainMenuKeyboard(isAdmin = false) {
  const keyboard = [
    [
      { text: "🛒 Purchase Gold Shares", callback_data: "menu_purchase_shares" }
    ],
    [
      { text: "👥 Referral Program", callback_data: "menu_referrals" },
      { text: "📊 My Portfolio", callback_data: "menu_portfolio" }
    ],
    [
      { text: "💳 Payment Status", callback_data: "menu_payments" },
      { text: "📋 Company Presentation", callback_data: "menu_presentation" }
    ],
    [
      { text: "⛏️ Mining Operations", callback_data: "menu_mining_operations" },
      { text: "📈 Investment Calculator", callback_data: "menu_calculator" }
    ]
  ];

  if (isAdmin) {
    keyboard.push([
      { text: "👨‍💼 Admin Panel", callback_data: "admin_panel" }
    ]);
  }

  return keyboard;
}

function createPurchaseMenuKeyboard() {
  return [
    [
      { text: "💰 Custom Amount", callback_data: "purchase_custom" }
    ],
    [
      { text: "📊 Current Phase Info", callback_data: "phase_info" },
      { text: "💳 Payment Methods", callback_data: "payment_methods" }
    ],
    [
      { text: "🔙 Back to Dashboard", callback_data: "main_menu" }
    ]
  ];
}

// Authentication functions
async function authenticateUser(ctx, referralCode = null) {
  try {
    const telegramUser = ctx.from;
    
    if (!telegramUser) {
      console.log('❌ No Telegram user data available');
      return null;
    }

    console.log(`🔍 [AUTH] Authenticating user: ${telegramUser.first_name} (@${telegramUser.username})`);

    // Check if user exists in telegram_users table
    let user = await db.getUserByTelegramId(telegramUser.id);
    
    if (!user) {
      console.log(`👤 [AUTH] User not found, creating new user: ${telegramUser.id}`);
      
      // Create new user
      const userData = {
        telegram_id: telegramUser.id,
        username: telegramUser.username || null,
        first_name: telegramUser.first_name || '',
        last_name: telegramUser.last_name || '',
        registration_mode: 'register',
        referral_code: referralCode
      };

      user = await db.createTelegramUser(userData);
      
      if (!user) {
        console.error('❌ Failed to create user');
        await ctx.reply("❌ Registration failed. Please try again.");
        return null;
      }

      console.log(`✅ [AUTH] New user created: ${user.id}`);
    } else {
      console.log(`✅ [AUTH] Existing user found: ${user.id}`);
    }

    return user;
  } catch (error) {
    console.error('❌ Authentication error:', error);
    await ctx.reply("❌ Authentication failed. Please try again.");
    return null;
  }
}

// Terms and conditions functions
async function checkTermsAcceptance(userId) {
  try {
    const acceptance = await db.getTermsAcceptance(userId);
    return acceptance !== null;
  } catch (error) {
    console.error('Error checking terms acceptance:', error);
    return false;
  }
}

async function showTermsAndConditions(ctx, referralCode = null) {
  const termsMessage = `📋 **TERMS AND CONDITIONS**

🏆 **AUREUS ALLIANCE HOLDINGS**
*Premium Gold Mining Investment Platform*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**📜 INVESTMENT TERMS:**

1. **🎯 Investment Structure**
   • Share-based ownership in gold mining operations
   • Minimum investment: Custom amounts accepted
   • Share pricing based on current phase rates

2. **💰 Returns & Dividends**
   • Target annual return: 15%
   • Quarterly dividend distributions
   • Performance-based bonus opportunities

3. **⚖️ Legal Framework**
   • Regulated investment opportunity
   • Full compliance with applicable laws
   • Investor protection measures in place

4. **🔒 Risk Disclosure**
   • Mining investments carry inherent risks
   • Returns not guaranteed
   • Past performance doesn't predict future results

5. **📞 Support & Communication**
   • 24/7 investor support available
   • Regular operational updates provided
   • Transparent reporting standards

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**⚠️ IMPORTANT:** By accepting these terms, you acknowledge understanding of the investment risks and agree to the platform's operating procedures.

**🔗 DEVELOPMENT NOTE:** This is the development bot for testing purposes only.`;

  await ctx.replyWithMarkdown(termsMessage, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Accept Terms & Continue", callback_data: `accept_terms${referralCode ? '_' + referralCode : ''}` }
        ],
        [
          { text: "❌ Decline", callback_data: "decline_terms" }
        ]
      ]
    }
  });
}

async function handleTermsAcceptance(ctx, referralCode = null) {
  try {
    const user = await authenticateUser(ctx);
    if (!user) return;

    // Record terms acceptance
    const accepted = await db.recordTermsAcceptance(user.id);
    
    if (accepted) {
      console.log(`✅ [TERMS] User ${user.id} accepted terms`);
      
      if (referralCode) {
        console.log(`🔗 [TERMS] Processing referral code: ${referralCode}`);
        await handleReferralRegistration(ctx, referralCode);
      } else {
        await showMainMenu(ctx);
      }
    } else {
      await ctx.reply("❌ Failed to record terms acceptance. Please try again.");
    }
  } catch (error) {
    console.error('Error handling terms acceptance:', error);
    await ctx.reply("❌ An error occurred. Please try again.");
  }
}

// Main menu function
async function showMainMenu(ctx) {
  const user = await authenticateUser(ctx);
  if (!user) return;

  const currentPhase = await db.getCurrentPhase();
  const isAdmin = user.username === ADMIN_USERNAME;

  // Send the new Aureus Alliance Holdings company logo
  try {
    const logoUrl = 'https://fgubaqoftdeefcakejwu.supabase.co/storage/v1/object/public/assets/logonew.png';
    await ctx.replyWithPhoto(logoUrl, {
      caption: `🏆 **AUREUS ALLIANCE HOLDINGS** 🏆\n*Premium Gold Mining Investments*\n\n🧪 **DEVELOPMENT BOT** - Safe Testing Environment`,
      parse_mode: 'Markdown'
    });
  } catch (logoError) {
    console.log('Company logo not available, proceeding with text menu:', logoError.message);
  }

  const welcomeMessage = `🏆 **WELCOME TO AUREUS ALLIANCE HOLDINGS**
*Premium Gold Mining Investment Platform*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👋 **Hello ${user.first_name}!**

🧪 **DEVELOPMENT ENVIRONMENT**
This is the development bot for safe testing of new features and upgrades.

📊 **CURRENT PHASE:** ${currentPhase ? currentPhase.phase_number : 'Loading...'}
💰 **Share Price:** ${currentPhase ? formatCurrency(currentPhase.price_per_share) : 'Loading...'}
📈 **Shares Available:** ${currentPhase ? currentPhase.shares_available?.toLocaleString() : 'Loading...'}

🎯 **INVESTMENT HIGHLIGHTS:**
• 🥇 Alluvial gold mining operations
• 📍 Mpumalanga Province, South Africa  
• ⛏️ 10 Washplants, 200 tons/hour each
• 📈 Target: 3,200 KG gold annually
• 💎 15% annual return target

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Choose an option below to get started:**`;

  await ctx.replyWithMarkdown(welcomeMessage, {
    reply_markup: {
      inline_keyboard: createMainMenuKeyboard(isAdmin)
    }
  });
}

// Referral and sponsor functions
async function handleReferralRegistration(ctx, referralCode) {
  try {
    console.log(`🔗 [DEV] Processing referral registration with code: ${referralCode}`);
    await ctx.reply(`🔗 **Referral Registration**\n\n🧪 Development feature: Referral code "${referralCode}" received!\n\nThis feature is being tested in the development environment.`);
    await showMainMenu(ctx);
  } catch (error) {
    console.error('Error handling referral registration:', error);
    await ctx.reply("❌ An error occurred processing the referral. Please try again.");
  }
}

async function checkUserHasSponsor(userId) {
  try {
    // In development, we'll assume users have sponsors to avoid blocking
    console.log(`🔍 [DEV] Checking sponsor for user ${userId} - allowing for testing`);
    return true;
  } catch (error) {
    console.error('Error checking user sponsor:', error);
    return true; // Allow in development
  }
}

async function promptSponsorAssignment(ctx) {
  const message = `👥 **Sponsor Assignment Required**

🧪 **Development Note:** This is the sponsor assignment system being tested.

In the live bot, users would need to have a sponsor assigned before accessing most features.

For development testing, this requirement is bypassed.`;

  await ctx.replyWithMarkdown(message, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🏠 Continue to Dashboard", callback_data: "main_menu" }]
      ]
    }
  });
}

// Bot commands
bot.start(async (ctx) => {
  console.log(`👤 [START] User started DEV bot: ${ctx.from.first_name} (@${ctx.from.username})`);

  // Check for referral parameter in start command
  const startPayload = ctx.startPayload;

  // First, check if user has accepted terms
  const user = await authenticateUser(ctx, startPayload);
  if (!user) return;

  console.log(`🔍 [START] Checking terms acceptance for user ${user.id}`);
  const hasAcceptedTerms = await checkTermsAcceptance(user.id);

  if (!hasAcceptedTerms) {
    console.log(`📋 [START] User ${user.id} has not accepted terms - showing terms`);
    await showTermsAndConditions(ctx, startPayload);
  } else {
    console.log(`✅ [START] User ${user.id} has accepted terms - proceeding`);
    if (startPayload) {
      console.log(`🔗 [START] Referral link detected with payload: ${startPayload}`);
      await handleReferralRegistration(ctx, startPayload);
    } else {
      console.log(`🏠 [START] No referral payload, showing main menu`);
      await showMainMenu(ctx);
    }
  }
});

bot.command("menu", async (ctx) => {
  await showMainMenu(ctx);
});

// Development version check command
bot.command('version', async (ctx) => {
  const versionInfo = `🔍 **DEVELOPMENT BOT VERSION CHECK**

📅 **Startup Time:** ${new Date().toISOString()}
🔗 **Dev Bot Link:** https://t.me/AureusAllianceDevBot
✅ **Status:** Running aureus-bot-dev.js (DEVELOPMENT)
🧪 **Environment:** Local Development Testing
🔗 **Safe Testing:** No impact on live users

🚨 **DEVELOPMENT FEATURES:**
💰 Share Calculation: amount ÷ phase_price = shares
📊 Example: $100 ÷ $5.00 = 20 shares (NOT 100!)
🔧 All features available for testing
🔗 Bot links: Use AureusAllianceDevBot for testing

✅ **Development environment ready for testing!**`;

  await ctx.replyWithMarkdown(versionInfo);
});

// Basic callback query handler for development
bot.on('callback_query', async (ctx) => {
  const callbackData = ctx.callbackQuery.data;
  const user = await authenticateUser(ctx);

  if (!user && !['main_menu', 'accept_terms'].includes(callbackData)) {
    await ctx.answerCbQuery("❌ Authentication required");
    return;
  }

  console.log(`🔍 DEV Callback: ${callbackData} from ${ctx.from.username}`);

  try {
    switch (callbackData) {
      case 'main_menu':
        await showMainMenu(ctx);
        break;

      case 'accept_terms':
        await handleTermsAcceptance(ctx);
        break;

      case 'decline_terms':
        await ctx.reply("❌ Terms declined. You must accept the terms to use this platform.");
        break;

      case 'menu_purchase_shares':
        await ctx.reply("🛒 **Share Purchase System**\n\n🧪 Development feature - coming soon in dev bot!");
        break;

      case 'menu_referrals':
        await ctx.reply("👥 **Referral Program**\n\n🧪 Development feature - coming soon in dev bot!");
        break;

      case 'menu_portfolio':
        await ctx.reply("📊 **Portfolio Management**\n\n🧪 Development feature - coming soon in dev bot!");
        break;

      case 'menu_payments':
        await ctx.reply("💳 **Payment Status**\n\n🧪 Development feature - coming soon in dev bot!");
        break;

      case 'menu_presentation':
        await ctx.reply("📋 **Company Presentation**\n\n🧪 Development feature - coming soon in dev bot!");
        break;

      case 'menu_mining_operations':
        await ctx.reply("⛏️ **Mining Operations**\n\n🧪 Development feature - coming soon in dev bot!");
        break;

      case 'menu_calculator':
        await ctx.reply("📈 **Investment Calculator**\n\n🧪 Development feature - coming soon in dev bot!");
        break;

      case 'admin_panel':
        if (user.username === ADMIN_USERNAME) {
          await ctx.reply("👨‍💼 **Admin Panel**\n\n🧪 Development admin features - coming soon in dev bot!");
        } else {
          await ctx.answerCbQuery("❌ Admin access required");
        }
        break;

      default:
        await ctx.answerCbQuery("🧪 Development feature - coming soon!");
        break;
    }

    await ctx.answerCbQuery();
  } catch (error) {
    console.error('❌ Callback error:', error);
    await ctx.answerCbQuery("❌ An error occurred");
  }
});

// Error handling
bot.catch((err, ctx) => {
  console.error('❌ Bot error:', err);
  console.error('Context:', ctx.update);
});

// Start bot function
async function startBot() {
  try {
    console.log("🔍 Testing database connection...");
    const isDbConnected = await db.testConnection();

    if (!isDbConnected) {
      console.log("⚠️ Database connection failed, but starting bot anyway...");
    }

    console.log("🤖 Starting development bot in polling mode...");
    await bot.launch();
    console.log("✅ Aureus Alliance Holdings Development Bot is running!");
    console.log("🤖 Bot username: @AureusAllianceDevBot (DEVELOPMENT)");
    console.log("🧪 Safe testing environment ready!");
  } catch (error) {
    console.error("❌ Failed to start development bot:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.once("SIGINT", () => {
  console.log("🛑 Stopping development bot...");
  bot.stop("SIGINT");
});

process.once("SIGTERM", () => {
  console.log("🛑 Stopping development bot...");
  bot.stop("SIGTERM");
});

// Start the development bot
startBot();
