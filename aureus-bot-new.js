const { Telegraf } = require("telegraf");
const bcrypt = require("bcryptjs");
const { db } = require('./src/database/supabase-client');
require("dotenv").config();

console.log("🚀 Starting Aureus Alliance Holdings Telegram Bot...");

// Bot configuration
const BOT_TOKEN = "8015476800:AAGMH8HMXRurphYHRQDJdeHLO10ghZVzBt8";
const ADMIN_USERNAME = "TTTFOUNDER";

console.log("📊 Database: Supabase PostgreSQL");

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
      { text: "🏘️ Community Relations", callback_data: "menu_community" }
    ],
    [
      { text: "🆘 Support Center", callback_data: "menu_help" }
    ]
  ];

  // Add admin options if user is admin
  if (isAdmin) {
    keyboard.push([
      { text: "🔑 Admin Panel", callback_data: "admin_panel" },
      { text: "📊 System Status", callback_data: "admin_status" }
    ]);
  }

  return { inline_keyboard: keyboard };
}

// Package keyboard function removed - using custom amounts only

function createTermsKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "✅ I Accept Terms & Conditions", callback_data: "accept_terms" }
      ],
      [
        { text: "📋 Read Full Terms", url: "https://aureusalliance.com/terms" }
      ],
      [
        { text: "🔙 Back to Dashboard", callback_data: "main_menu" }
      ]
    ]
  };
}

function createPaymentMethodKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "₿ Bitcoin (BTC)", callback_data: "payment_btc" },
        { text: "🔷 Ethereum (ETH)", callback_data: "payment_eth" }
      ],
      [
        { text: "💎 Tether (USDT)", callback_data: "payment_usdt" }
      ],
      [
        { text: "🔙 Back to Dashboard", callback_data: "main_menu" }
      ]
    ]
  };
}

function createReferralKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "👥 My Referrals", callback_data: "view_referrals" },
        { text: "💰 Commission Balance", callback_data: "view_commission" }
      ],
      [
        { text: "💸 Request Withdrawal", callback_data: "request_withdrawal" }
      ],
      [
        { text: "🔙 Back to Dashboard", callback_data: "main_menu" }
      ]
    ]
  };
}

function createPortfolioKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "📊 Share Holdings", callback_data: "view_holdings" },
        { text: "💰 Investment History", callback_data: "view_history" }
      ],
      [
        { text: "📈 Performance", callback_data: "view_performance" }
      ],
      [
        { text: "🔙 Back to Dashboard", callback_data: "main_menu" }
      ]
    ]
  };
}

function createPaymentStatusKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "⏳ Pending Payments", callback_data: "view_pending" },
        { text: "✅ Approved Payments", callback_data: "view_approved" }
      ],
      [
        { text: "❌ Rejected Payments", callback_data: "view_rejected" }
      ],
      [
        { text: "🔙 Back to Dashboard", callback_data: "main_menu" }
      ]
    ]
  };
}

function createAdminKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "⏳ Pending Payments", callback_data: "admin_pending" },
        { text: "👥 User Management", callback_data: "admin_users" }
      ],
      [
        { text: "💰 Commission Requests", callback_data: "admin_commissions" },
        { text: "📊 System Stats", callback_data: "admin_stats" }
      ],
      [
        { text: "📋 Audit Logs", callback_data: "admin_logs" }
      ],
      [
        { text: "🔙 Back to Dashboard", callback_data: "main_menu" }
      ]
    ]
  };
}

// Authentication functions
async function authenticateUser(ctx) {
  const telegramId = ctx.from.id;
  const username = ctx.from.username;
  
  if (!username) {
    await ctx.reply("❌ Please set a Telegram username to use this bot.");
    return null;
  }

  try {
    // Get or create telegram user record
    let telegramUser = await db.getTelegramUser(telegramId);
    
    if (!telegramUser) {
      // Create new telegram user record
      telegramUser = await db.createTelegramUser(telegramId, {
        username: username,
        first_name: ctx.from.first_name,
        last_name: ctx.from.last_name
      });
    }

    // Get or create main user record by username
    let user = await db.getUserByUsername(username);
    
    if (!user) {
      // Create new user record
      user = await db.createUser({
        username: username,
        full_name: `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim(),
        telegram_id: telegramId
      });
      
      if (!user) {
        throw new Error('Failed to create user record');
      }
    }

    // Link telegram user to main user if not already linked
    if (!telegramUser.user_id) {
      await db.updateTelegramUser(telegramId, {
        user_id: user.id,
        is_registered: true
      });
    }

    return user;
  } catch (error) {
    console.error('Authentication error:', error);
    await ctx.reply("❌ Authentication failed. Please try again.");
    return null;
  }
}

// Terms acceptance handler
async function handleTermsAcceptance(ctx) {
  const user = await authenticateUser(ctx);
  if (!user) return;

  try {
    // Check if user has already accepted terms
    const existingAcceptance = await db.getUserTermsAcceptance(user.id);
    
    if (existingAcceptance) {
      await ctx.answerCbQuery("✅ You have already accepted the terms and conditions.");
      await ctx.editMessageText(
        "✅ **Terms Already Accepted**\n\nYou have previously accepted our terms and conditions. You can proceed with all platform features.",
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: "🛒 Purchase Gold Shares", callback_data: "menu_purchase_shares" }],
              [{ text: "🔙 Back to Dashboard", callback_data: "main_menu" }]
            ]
          }
        }
      );
      return;
    }

    // Record terms acceptance
    const accepted = await db.recordTermsAcceptance(user.id, ctx.from.id);
    
    if (accepted) {
      await ctx.answerCbQuery("✅ Terms accepted successfully!");
      await ctx.editMessageText(
        "✅ **Terms & Conditions Accepted**\n\nThank you for accepting our terms and conditions. You can now proceed with purchasing gold shares.",
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: "🛒 Purchase Gold Shares", callback_data: "menu_purchase_shares" }],
              [{ text: "🔙 Back to Dashboard", callback_data: "main_menu" }]
            ]
          }
        }
      );
    } else {
      await ctx.answerCbQuery("❌ Failed to record terms acceptance");
      await ctx.reply("❌ Failed to record terms acceptance. Please try again.");
    }
  } catch (error) {
    console.error('Terms acceptance error:', error);
    await ctx.answerCbQuery("❌ Error processing terms acceptance");
    await ctx.reply("❌ Error processing terms acceptance. Please try again.");
  }
}

async function showMainMenu(ctx) {
  const user = ctx.from;
  const currentPhase = await db.getCurrentPhase();
  const isAdmin = user.username === ADMIN_USERNAME;

  // Send the new Aureus Alliance Holdings company logo
  try {
    const logoUrl = 'https://fgubaqoftdeefcakejwu.supabase.co/storage/v1/object/public/assets/logonew.png';
    await ctx.replyWithPhoto(logoUrl, {
      caption: `🏆 **AUREUS ALLIANCE HOLDINGS** 🏆\n*Premium Gold Mining Investments*`,
      parse_mode: 'Markdown'
    });
  } catch (logoError) {
    console.log('Company logo not available, proceeding with text menu:', logoError.message);
  }

  const phaseInfo = currentPhase
    ? `📈 **CURRENT PHASE:** ${currentPhase.phase_name}\n💰 **Share Price:** ${formatCurrency(currentPhase.price_per_share)}\n📊 **Available:** ${(currentPhase.total_shares_available - currentPhase.shares_sold).toLocaleString()} shares`
    : '📈 **PHASE:** Loading...';

  const menuMessage = `🏆 **AUREUS ALLIANCE HOLDINGS**
*Premium Gold Mining Share Purchase Dashboard*

Welcome back, **${user.first_name}**! 👋

${phaseInfo}

⛏️ **MINING OPERATIONS STATUS:**
• 🏭 **Washplants:** 10 units (200 tons/hour each)
• 🥇 **Annual Target:** 3,200 KG gold production
• 📅 **Full Capacity:** June 2026
• 📊 **Total Shares:** 1,400,000 available

💎 **SHARE PURCHASE OPPORTUNITIES:**
Choose your preferred method to buy shares in Aureus Alliance Holdings below.`;

  await ctx.replyWithMarkdown(menuMessage, {
    reply_markup: createMainMenuKeyboard(isAdmin)
  });
}

// Company Presentation Handler
async function handleCompanyPresentation(ctx) {
  const presentationMessage = `📋 **COMPANY PRESENTATION**

🏆 **AUREUS ALLIANCE HOLDINGS**
*Premium Gold Mining Investment Opportunity*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 **EXECUTIVE SUMMARY:**
• 🥇 **Focus:** Alluvial gold mining operations
• 📍 **Location:** Mpumalanga Province, South Africa
• ⛏️ **Method:** Environmentally responsible placer mining
• 💰 **Investment:** Share-based ownership structure

🎯 **INVESTMENT HIGHLIGHTS:**
• 🏭 **10 Washplants:** 200 tons/hour processing capacity each
• 📈 **Production Target:** 3,200 KG gold annually at full capacity
• 📅 **Timeline:** Full operations by June 2026
• 💎 **Total Shares:** 1,400,000 available for purchase

📋 **COMPREHENSIVE DOCUMENTATION:**
Access our complete business plan, geological surveys, and financial projections.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  await ctx.replyWithMarkdown(presentationMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📄 Download Full Presentation", url: "https://fgubaqoftdeefcakejwu.supabase.co/storage/v1/object/public/assets/presentation.pdf" }],
        [{ text: "📊 View Gold Chart", callback_data: "view_gold_chart" }],
        [{ text: "🛒 Purchase Gold Shares", callback_data: "menu_purchase_shares" }],
        [{ text: "🔙 Back to Dashboard", callback_data: "main_menu" }]
      ]
    }
  });
}

// Mining Operations Handler
async function handleMiningOperations(ctx) {
  const miningMessage = `⛏️ **MINING OPERATIONS OVERVIEW**

🏭 **AUREUS ALLIANCE HOLDINGS**
*Advanced Alluvial Gold Mining Operations*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔧 **OPERATIONAL SPECIFICATIONS:**
• 🏭 **Washplants:** 10 units operational
• ⚡ **Capacity:** 200 tons/hour per unit
• 📊 **Daily Processing:** 48,000 tons potential
• 🥇 **Annual Target:** 3,200 KG gold production

🌍 **ENVIRONMENTAL COMMITMENT:**
• ♻️ **Sustainable Methods:** Eco-friendly extraction
• 💧 **Water Management:** Closed-loop systems
• 🌱 **Land Restoration:** Post-mining rehabilitation
• 📋 **Compliance:** All environmental permits secured

📹 **MULTIMEDIA DOCUMENTATION:**
Explore our comprehensive visual documentation of mining operations.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  await ctx.replyWithMarkdown(miningMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🎬 Excavation Videos", callback_data: "mining_excavation" }],
        [{ text: "🔬 Geological Evidence", callback_data: "mining_geology" }],
        [{ text: "📊 Project Overview", callback_data: "mining_overview" }],
        [{ text: "👔 Executive Assessment", callback_data: "mining_executive" }],
        [{ text: "🔙 Back to Dashboard", callback_data: "main_menu" }]
      ]
    }
  });
}

// Community Relations Handler
async function handleCommunityRelations(ctx) {
  const communityMessage = `🏘️ **COMMUNITY RELATIONS**

🤝 **AUREUS ALLIANCE HOLDINGS**
*Building Sustainable Community Partnerships*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌟 **COMMUNITY ENGAGEMENT:**
• 👥 **Local Employment:** Priority hiring from surrounding communities
• 🏫 **Education Support:** Funding for local schools and training programs
• 🏥 **Healthcare Initiatives:** Medical facility support and health programs
• 🛤️ **Infrastructure:** Road improvements and utility upgrades

💼 **ECONOMIC IMPACT:**
• 💰 **Job Creation:** 200+ direct employment opportunities
• 🏪 **Local Business:** Support for community suppliers and services
• 📈 **Economic Growth:** Sustainable development initiatives
• 🎓 **Skills Development:** Mining and technical training programs

🤝 **STAKEHOLDER RELATIONS:**
Regular community meetings and transparent communication about our operations.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  await ctx.replyWithMarkdown(communityMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📅 Community Meetings", callback_data: "community_meetings" }],
        [{ text: "🏗️ Development Plans", callback_data: "community_development" }],
        [{ text: "📞 Contact Community Liaison", url: "mailto:community@aureusalliance.com" }],
        [{ text: "🔙 Back to Dashboard", callback_data: "main_menu" }]
      ]
    }
  });
}

// Bot commands
bot.start(async (ctx) => {
  console.log(`👤 User started bot: ${ctx.from.first_name} (@${ctx.from.username})`);
  await showMainMenu(ctx);
});

bot.command("menu", async (ctx) => {
  await showMainMenu(ctx);
});

// Callback query handler
bot.on('callback_query', async (ctx) => {
  const callbackData = ctx.callbackQuery.data;
  const user = await authenticateUser(ctx);

  if (!user && !['main_menu', 'accept_terms'].includes(callbackData)) {
    await ctx.answerCbQuery("❌ Authentication required");
    return;
  }

  console.log(`🔍 Callback: ${callbackData} from ${ctx.from.username}`);

  try {
    switch (callbackData) {
      case 'main_menu':
        await showMainMenu(ctx);
        break;

      case 'accept_terms':
        await handleTermsAcceptance(ctx);
        break;

      case 'menu_presentation':
        await handleCompanyPresentation(ctx);
        break;

      case 'menu_mining_operations':
        await handleMiningOperations(ctx);
        break;

      case 'menu_community':
        await handleCommunityRelations(ctx);
        break;

      case 'menu_help':
        await handleSupportCenter(ctx);
        break;

      default:
        await ctx.answerCbQuery("🚧 Feature coming soon!");
        break;
    }
  } catch (error) {
    console.error('Callback error:', error);
    await ctx.answerCbQuery("❌ Error processing request");
  }
});

// Support Center Handler
async function handleSupportCenter(ctx) {
  const supportMessage = `🆘 **AUREUS SUPPORT CENTER**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**24/7 PREMIUM SUPPORT**

🌟 **CONTACT OPTIONS:**
• 📧 **Email:** support@aureusalliance.com
• 🌐 **Website:** https://aureusalliance.com
• 💬 **Live Chat:** Available on website
• 📱 **WhatsApp:** +27 XX XXX XXXX

🔧 **SUPPORT SERVICES:**
• ❓ General inquiries and assistance
• 💰 Payment and transaction support
• 📊 Portfolio and investment guidance
• 🔐 Account security and access issues

⏰ **RESPONSE TIMES:**
• 📧 Email: Within 24 hours
• 💬 Live Chat: Immediate during business hours
• 📱 WhatsApp: Within 2 hours

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  await ctx.replyWithMarkdown(supportMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📧 Email Support", url: "mailto:support@aureusalliance.com" }],
        [{ text: "🌐 Visit Website", url: "https://aureusalliance.com" }],
        [{ text: "🔙 Back to Dashboard", callback_data: "main_menu" }]
      ]
    }
  });
}

// Error handling
bot.catch((err, ctx) => {
  console.error("🚨 Bot error:", err);
  ctx.reply("Sorry, something went wrong. Please try again later.");
});

// Start bot
async function startBot() {
  try {
    console.log("🔍 Testing database connection...");
    const isDbConnected = await db.testConnection();

    if (!isDbConnected) {
      console.log("⚠️ Database connection failed, but starting bot anyway...");
    }

    console.log("🤖 Starting bot in polling mode...");
    await bot.launch();
    console.log("✅ Aureus Alliance Holdings Bot is running!");
    console.log("🤖 Bot username: @aureus_africa_bot");
  } catch (error) {
    console.error("❌ Failed to start bot:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.once("SIGINT", () => {
  console.log("🛑 Stopping bot...");
  bot.stop("SIGINT");
});

process.once("SIGTERM", () => {
  console.log("🛑 Stopping bot...");
  bot.stop("SIGTERM");
});

// Start the bot
startBot();
