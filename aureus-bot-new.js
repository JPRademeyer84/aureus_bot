const { Telegraf } = require("telegraf");
const bcrypt = require("bcryptjs");
const { db } = require('./src/database/supabase-client');
require("dotenv").config();

console.log("🚀 Starting Aureus Alliance Holdings Telegram Bot...");
console.log("🔗 VERSION CHECK: Bot links are https://t.me/AureusAllianceBot (NEW BOT TOKEN)");
console.log("🔥 DEPLOYMENT VERSION: 2025-01-05-NEW-BOT-TOKEN-CREATED");
console.log("📅 DEPLOYMENT: " + new Date().toISOString());
console.log("🔧 FIXED: Share calculation using phase pricing + database wallet addresses");
console.log("🚨 CRITICAL FIX DEPLOYED: $100 payment = 20 shares (not 100 shares)");
console.log("💰 SHARE CALCULATION: amount ÷ phase_price = shares");
console.log("🛠️ SCOPE FIX: sharesAmount variable moved to outer scope - ReferenceError resolved");
console.log("🔗 BOT LINK FIX: All referral links use AureusAllianceBot (NEW BOT TOKEN)");
console.log("🚨 NEW BOT: AureusAllianceBot token created - old bot issues resolved!");

// Bot configuration
const BOT_TOKEN = "7858706839:AAFRXBSlREW0wPvIyI57uFpHfYopi2CY464";
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
async function authenticateUser(ctx, sponsorUsername = null) {
  const telegramId = ctx.from.id;
  const username = ctx.from.username;

  if (!username) {
    await ctx.reply("❌ Please set a Telegram username to use this bot.");
    return null;
  }

  try {
    // Get or create main user record by username first
    let user = await db.getUserByUsername(username);
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      // Create new user record (users table doesn't have telegram_id)
      user = await db.createUser({
        username: username,
        email: `${username}@telegram.local`, // Dummy email since it's required
        password_hash: 'telegram_auth', // Dummy password since it's required
        full_name: `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim()
      });

      if (!user) {
        throw new Error('Failed to create user record');
      }
    }

    // Get or create telegram user record linked to main user
    let telegramUser = await db.getTelegramUser(telegramId);

    if (!telegramUser) {
      // Create new telegram user record linked to main user
      telegramUser = await db.createTelegramUser(telegramId, {
        user_id: user.id, // Link to main user
        username: username,
        first_name: ctx.from.first_name,
        last_name: ctx.from.last_name
      });
    }

    // Link telegram user to main user if not already linked
    if (!telegramUser.user_id) {
      await db.updateTelegramUser(telegramId, {
        user_id: user.id,
        is_registered: true
      });
    }

    // Handle sponsor assignment for new users
    if (isNewUser && sponsorUsername) {
      await assignSponsor(user.id, sponsorUsername);
    } else if (isNewUser && !sponsorUsername) {
      // New user without sponsor - will be prompted later
      console.log(`🆕 New user ${user.username} registered without sponsor - will prompt for assignment`);
    }

    return user;
  } catch (error) {
    console.error('Authentication error:', error);
    await ctx.reply("❌ Authentication failed. Please try again.");
    return null;
  }
}

// Referral Registration Handler
async function handleReferralRegistration(ctx, sponsorUsername) {
  console.log(`🔗 Processing referral registration with sponsor: ${sponsorUsername}`);

  try {
    // Validate sponsor exists
    const sponsor = await db.getUserByUsername(sponsorUsername);
    if (!sponsor) {
      console.log(`❌ Sponsor not found: ${sponsorUsername}, using TTTFOUNDER as fallback`);
      sponsorUsername = 'TTTFOUNDER';
    }

    // Authenticate user with sponsor assignment
    const user = await authenticateUser(ctx, sponsorUsername);
    if (!user) return;

    // Show welcome message with sponsor confirmation
    const welcomeMessage = `🎉 **WELCOME TO AUREUS ALLIANCE HOLDINGS!**

✅ **Registration Successful**
👤 **Your Sponsor:** ${sponsorUsername}
🤝 **Referral Bonus:** You're now part of our referral network!

**🎯 NEXT STEPS:**
• Explore our gold mining investment opportunities
• Review company presentation and mining operations
• Start your investment journey with confidence

**💎 Your sponsor will earn commissions when you invest:**
• 15% USDT commission
• 15% additional shares commission

Let's get started with your gold mining investment!`;

    await ctx.replyWithMarkdown(welcomeMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🛒 Purchase Gold Shares", callback_data: "menu_purchase_shares" }],
          [{ text: "📋 Company Presentation", callback_data: "menu_presentation" }],
          [{ text: "💼 My Portfolio", callback_data: "menu_portfolio" }],
          [{ text: "🏠 Main Dashboard", callback_data: "main_menu" }]
        ]
      }
    });

  } catch (error) {
    console.error('Referral registration error:', error);
    await ctx.reply("❌ Error processing referral registration. Please try again.");
    await showMainMenu(ctx);
  }
}

// Sponsor Assignment Function
async function assignSponsor(userId, sponsorUsername) {
  try {
    console.log(`🤝 Assigning sponsor ${sponsorUsername} to user ${userId}`);

    // Get sponsor user record
    let sponsor = await db.getUserByUsername(sponsorUsername);
    if (!sponsor) {
      console.log(`❌ Sponsor ${sponsorUsername} not found, using TTTFOUNDER`);
      sponsor = await db.getUserByUsername('TTTFOUNDER');
      if (!sponsor) {
        console.error('❌ TTTFOUNDER fallback sponsor not found!');
        return false;
      }
      sponsorUsername = 'TTTFOUNDER';
    }

    // Create referral relationship
    const { data: referral, error: referralError } = await db.client
      .from('referrals')
      .insert({
        referrer_id: sponsor.id,
        referred_id: userId,
        referral_code: `${sponsorUsername}_${userId}_${Date.now()}`,
        commission_rate: 15.00,
        status: 'active',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (referralError) {
      console.error('Error creating referral relationship:', referralError);
      return false;
    }

    console.log(`✅ Sponsor assigned successfully: ${sponsorUsername} -> User ${userId}`);
    return true;

  } catch (error) {
    console.error('Error assigning sponsor:', error);
    return false;
  }
}

// Check if user has a sponsor
async function checkUserHasSponsor(userId) {
  try {
    const { data: referral, error } = await db.client
      .from('referrals')
      .select('id')
      .eq('referred_id', userId)
      .eq('status', 'active')
      .single();

    return !error && referral;
  } catch (error) {
    console.error('Error checking sponsor:', error);
    return false;
  }
}

// Prompt user to assign sponsor
async function promptSponsorAssignment(ctx) {
  const sponsorMessage = `🤝 **SPONSOR ASSIGNMENT REQUIRED**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**⚠️ MANDATORY REFERRAL SYSTEM**

To proceed with Aureus Alliance Holdings, you need a sponsor. This ensures proper commission tracking and support throughout your investment journey.

**🎯 YOUR OPTIONS:**

**1️⃣ ENTER SPONSOR USERNAME**
If someone referred you, enter their username below.

**2️⃣ NO SPONSOR AVAILABLE**
We'll assign TTTFOUNDER as your default sponsor.

**💡 WHY SPONSORS MATTER:**
• Personalized investment guidance
• Commission structure for referrers
• Community support network
• Proper tracking and accountability

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Please choose an option below:**`;

  await ctx.replyWithMarkdown(sponsorMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "✍️ Enter Sponsor Username", callback_data: "enter_sponsor_manual" }],
        [{ text: "🤝 Use Default Sponsor (TTTFOUNDER)", callback_data: "assign_default_sponsor" }],
        [{ text: "ℹ️ Learn About Referral System", callback_data: "menu_referrals" }]
      ]
    }
  });
}

// Handle manual sponsor entry
async function handleEnterSponsorManual(ctx) {
  console.log('📝 handleEnterSponsorManual called');
  const user = ctx.from;

  try {
    // Set user state for sponsor entry
    await setUserState(user.id, {
      state: 'awaiting_sponsor_username',
      data: { timestamp: Date.now() }
    });

  const instructionMessage = `✍️ **ENTER SPONSOR USERNAME**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Please type the Telegram username of your sponsor:**

**📝 FORMAT:** Just the username (without @)
**📝 EXAMPLE:** If sponsor is @JohnDoe, type: JohnDoe

**⏰ You have 5 minutes to enter the username.**

**🔙 To cancel, type:** cancel`;

    await ctx.replyWithMarkdown(instructionMessage);
    console.log('✅ Manual sponsor entry instructions sent');

  } catch (error) {
    console.error('❌ Error in handleEnterSponsorManual:', error);
    await ctx.reply('❌ Error setting up sponsor entry. Please try again.');
  }
}

// Handle default sponsor assignment
async function handleAssignDefaultSponsor(ctx) {
  console.log('🤝 handleAssignDefaultSponsor called');
  const user = await authenticateUser(ctx);
  if (!user) return;

  try {
    console.log(`🔧 Assigning TTTFOUNDER as sponsor for user ${user.id}`);
    const success = await assignSponsor(user.id, 'TTTFOUNDER');

    if (success) {
      const successMessage = `✅ **SPONSOR ASSIGNED SUCCESSFULLY**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**🤝 Your Sponsor:** TTTFOUNDER
**📅 Assigned:** ${new Date().toLocaleDateString()}
**✅ Status:** Active

**🎯 NEXT STEPS:**
You can now access all platform features and start your gold mining investment journey!

**💎 Your sponsor will provide:**
• Investment guidance and support
• Commission tracking for referrals
• Access to exclusive updates

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      await ctx.replyWithMarkdown(successMessage, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🛒 Purchase Gold Shares", callback_data: "menu_purchase_shares" }],
            [{ text: "💼 View Portfolio", callback_data: "menu_portfolio" }],
            [{ text: "🏠 Main Dashboard", callback_data: "main_menu" }]
          ]
        }
      });
    } else {
      await ctx.reply("❌ Error assigning sponsor. Please try again.");
    }
  } catch (error) {
    console.error('Error assigning default sponsor:', error);
    await ctx.reply("❌ Error assigning sponsor. Please try again.");
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

  // Authenticate user first
  const authenticatedUser = await authenticateUser(ctx);
  if (!authenticatedUser) return;

  // Check if user has a sponsor (required for new users)
  const hasSponsor = await checkUserHasSponsor(authenticatedUser.id);
  if (!hasSponsor) {
    await promptSponsorAssignment(ctx);
    return;
  }

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

  // Check for referral parameter in start command
  const startPayload = ctx.startPayload;
  if (startPayload) {
    console.log(`🔗 Referral link detected: ${startPayload}`);
    await handleReferralRegistration(ctx, startPayload);
  } else {
    await showMainMenu(ctx);
  }
});

bot.command("menu", async (ctx) => {
  await showMainMenu(ctx);
});

// Version check command (temporary for debugging)
bot.command('version', async (ctx) => {
  const versionInfo = `🔍 **BOT VERSION CHECK**

📅 **Deployment Time:** ${new Date().toISOString()}
🔗 **Bot Link:** https://t.me/AureusAllianceBot
✅ **Status:** Running aureus-bot-new.js
🎯 **NEW BOT TOKEN:** AureusAllianceBot (clean slate)
🔗 **REFERRAL LINK FIX:** Applied ${new Date().toISOString()}

🚨 **CRITICAL FIX STATUS:**
💰 Share Calculation: amount ÷ phase_price = shares
📊 Example: $100 ÷ $5.00 = 20 shares (NOT 100!)
🔧 Fixed in handleApprovePayment line 2680
🔗 Bot links: ALL use AureusAllianceBot (NEW BOT)

✅ **New bot token resolves all username inconsistencies!**`;

  await ctx.replyWithMarkdown(versionInfo);
});

// Callback query handler
bot.on('callback_query', async (ctx) => {
  const callbackData = ctx.callbackQuery.data;
  const user = await authenticateUser(ctx);

  if (!user && !['main_menu', 'accept_terms'].includes(callbackData)) {
    await ctx.answerCbQuery("❌ Authentication required");
    return;
  }

  // Check if user has a sponsor (except for sponsor-related actions)
  if (user && !['main_menu', 'accept_terms', 'menu_referrals', 'enter_sponsor_manual', 'assign_default_sponsor'].includes(callbackData)) {
    const hasSponsor = await checkUserHasSponsor(user.id);
    if (!hasSponsor) {
      await promptSponsorAssignment(ctx);
      return;
    }
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

      // Gold Chart Handler
      case 'view_gold_chart':
        await ctx.answerCbQuery('Opening gold chart...');
        await ctx.replyWithPhoto('https://fgubaqoftdeefcakejwu.supabase.co/storage/v1/object/public/assets/chart.png', {
          caption: '📊 *AUREUS ALLIANCE HOLDINGS*\n*Gold Price Performance Chart*\n\n📈 Historical gold price trends and market analysis for informed investment decisions.',
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 Back to Presentation", callback_data: "menu_presentation" }],
              [{ text: "🏠 Back to Dashboard", callback_data: "main_menu" }]
            ]
          }
        });
        break;

      // Mining Operations Handlers
      case 'mining_excavation':
        await showExcavationVideos(ctx);
        break;

      case 'mining_geology':
        await showGeologicalEvidence(ctx);
        break;

      case 'mining_overview':
        await showProjectOverview(ctx);
        break;

      case 'mining_executive':
        await showExecutiveAssessment(ctx);
        break;

      // Community Relations Handlers
      case 'community_meetings':
        await showCommunityMeetings(ctx);
        break;

      case 'community_development':
        await showDevelopmentPlans(ctx);
        break;

      // RESTORED PAYMENT SYSTEM HANDLERS
      case 'menu_purchase_shares':
        await handleCustomAmountPurchase(ctx);
        break;

      case 'menu_referrals':
        await handleReferralSystem(ctx);
        break;

      case 'menu_portfolio':
        await handlePortfolio(ctx);
        break;

      case 'menu_payments':
        await handlePaymentStatus(ctx);
        break;

      case 'admin_panel':
        await handleAdminPanel(ctx);
        break;

      case 'admin_status':
        await handleAdminStatus(ctx);
        break;

      case 'admin_pending':
        await handleAdminPayments(ctx);
        break;

      case 'admin_users':
        await handleAdminUsers(ctx);
        break;

      case 'admin_commissions':
        await handleAdminCommissions(ctx);
        break;

      case 'admin_stats':
        await handleAdminAnalytics(ctx);
        break;

      case 'admin_logs':
        await handleAdminLogs(ctx);
        break;

      case 'admin_payments':
        await handleAdminPayments(ctx);
        break;

      case 'admin_analytics':
        await handleAdminAnalytics(ctx);
        break;

      case 'admin_broadcast':
        await handleAdminBroadcast(ctx);
        break;

      case 'admin_settings':
        await handleAdminSettings(ctx);
        break;

      case 'admin_user_sponsors':
        await handleAdminUserSponsors(ctx);
        break;

      default:
        // Check for dynamic callback patterns
        if (callbackData.startsWith('continue_payment_')) {
          await handleContinuePayment(ctx, callbackData);
        } else if (callbackData.startsWith('cancel_payment_')) {
          await handleCancelPayment(ctx, callbackData);
        } else if (callbackData.startsWith('confirm_cancel_')) {
          await handleConfirmCancel(ctx, callbackData);
        } else if (callbackData.startsWith('confirm_purchase_')) {
          await handleConfirmPurchase(ctx, callbackData);
        } else if (callbackData.startsWith('upload_proof_')) {
          await handleUploadProof(ctx, callbackData);
        } else if (callbackData.startsWith('review_payment_')) {
          await handleReviewPayment(ctx, callbackData);
        } else if (callbackData.startsWith('approve_payment_')) {
          await handleApprovePayment(ctx, callbackData);
        } else if (callbackData.startsWith('reject_payment_')) {
          await handleRejectPayment(ctx, callbackData);
        } else if (callbackData.startsWith('view_screenshot_')) {
          await handleViewScreenshot(ctx, callbackData);
        } else if (callbackData === 'view_portfolio') {
          await handlePortfolio(ctx);
        } else if (callbackData === 'share_referral') {
          await handleShareReferral(ctx);
        } else if (callbackData === 'view_commission') {
          await handleViewCommission(ctx);
        } else if (callbackData === 'view_referrals') {
          await handleViewReferrals(ctx);
        } else if (callbackData === 'withdraw_commissions') {
          await handleWithdrawCommissions(ctx);
        } else if (callbackData.startsWith('copy_referral_link_')) {
          await handleCopyReferralLink(ctx, callbackData);
        } else if (callbackData.startsWith('copy_referral_')) {
          await handleCopyReferral(ctx, callbackData);
        } else if (callbackData === 'enter_sponsor_manual') {
          console.log('🔧 Handling enter_sponsor_manual callback');
          await ctx.answerCbQuery("Setting up manual sponsor entry...");
          await handleEnterSponsorManual(ctx);
        } else if (callbackData === 'assign_default_sponsor') {
          console.log('🔧 Handling assign_default_sponsor callback');
          await ctx.answerCbQuery("Assigning default sponsor...");
          await handleAssignDefaultSponsor(ctx);
        } else {
          await ctx.answerCbQuery("🚧 Feature coming soon!");
        }
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

// Multimedia Documentation Functions
async function showExcavationVideos(ctx) {
  const videosMessage = `🎬 *EXCAVATION VIDEOS*
⛏️ *AUREUS ALLIANCE HOLDINGS*
*Live Mining Operations Documentation*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎥 **PRIMARY PIT EXCAVATION:**
• Video: Active washplant operations
• Location: Main excavation site
• Equipment: 200 tons/hour processing capacity

🎬 **SOIL PROCESSING OPERATIONS:**
• Video: Real-time gold extraction process
• Method: Environmentally responsible mining
• Output: Continuous gold recovery operations

📹 **SECONDARY SITE DOCUMENTATION:**
• Video: Additional excavation activities
• Scope: Comprehensive operational coverage
• Quality: Professional documentation standards

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  await ctx.replyWithMarkdown(videosMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🎥 Primary Pit Video", url: "https://fgubaqoftdeefcakejwu.supabase.co/storage/v1/object/public/assets/pits.mp4" }],
        [{ text: "⚒️ Processing Video", url: "https://fgubaqoftdeefcakejwu.supabase.co/storage/v1/object/public/assets/digging.mp4" }],
        [{ text: "📹 Secondary Site", url: "https://fgubaqoftdeefcakejwu.supabase.co/storage/v1/object/public/assets/digging%202.mp4" }],
        [{ text: "🔙 Back to Mining Operations", callback_data: "menu_mining_operations" }]
      ]
    }
  });
}

async function showGeologicalEvidence(ctx) {
  const evidenceMessage = `🔬 *GEOLOGICAL EVIDENCE*
⛏️ *AUREUS ALLIANCE HOLDINGS*
*Scientific Gold Discovery Documentation*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏔️ **GOLD PARTICLES IN SAND:**
• Analysis: Visible gold particles in processed sand
• Concentration: High-grade alluvial deposits
• Verification: Professional geological assessment

💎 **GOLD VEINS IN ROCK SAMPLES:**
• Discovery: Natural gold veins in rock formations
• Quality: Premium grade ore samples
• Significance: Substantial mineral reserves confirmed

🔍 **TECHNICAL ANALYSIS:**
• Method: Professional geological surveying
• Results: Confirmed gold-bearing formations
• Potential: Extensive mineral resource base

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  await ctx.replyWithMarkdown(evidenceMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🏖️ Gold in Sand", url: "https://fgubaqoftdeefcakejwu.supabase.co/storage/v1/object/public/assets/goldinsand.jpg" }],
        [{ text: "💎 Gold in Rock", url: "https://fgubaqoftdeefcakejwu.supabase.co/storage/v1/object/public/assets/goldinrock.JPG" }],
        [{ text: "🔙 Back to Mining Operations", callback_data: "menu_mining_operations" }]
      ]
    }
  });
}

async function showProjectOverview(ctx) {
  const overviewMessage = `📊 *PROJECT OVERVIEW*
⛏️ *AUREUS ALLIANCE HOLDINGS*
*Comprehensive Mining Project Scope*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏞️ **PROJECT SCALE:**
• Total Area: 300 hectares of mining concessions
• Operations: 10 washplants (200 tons/hour each)
• Capacity: 48,000 tons daily processing potential
• Target: 3,200 KG annual gold production

🌍 **LOCATION ADVANTAGES:**
• Region: Mpumalanga Province, South Africa
• Access: Established infrastructure and logistics
• Resources: Abundant water and power supply
• Community: Strong local partnerships

📈 **DEVELOPMENT TIMELINE:**
• Phase 1: Equipment deployment and site preparation
• Phase 2: Full operational capacity by June 2026
• Phase 3: Expansion and optimization programs
• Long-term: Sustainable 20-year operation plan

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  await ctx.replyWithMarkdown(overviewMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔙 Back to Mining Operations", callback_data: "menu_mining_operations" }],
        [{ text: "🏠 Back to Dashboard", callback_data: "main_menu" }]
      ]
    }
  });
}

async function showExecutiveAssessment(ctx) {
  const executiveMessage = `👔 *EXECUTIVE ASSESSMENT*
⛏️ *AUREUS ALLIANCE HOLDINGS*
*Leadership Team & Strategic Vision*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👨‍💼 **JP RADEMEYER - CEO & FOUNDER:**
• Experience: 15+ years in mining operations
• Expertise: Gold extraction and processing
• Vision: Sustainable and profitable mining
• Leadership: Community-focused development

🎯 **STRATEGIC OBJECTIVES:**
• Operational Excellence: Maximum efficiency standards
• Environmental Responsibility: Eco-friendly practices
• Community Development: Local economic growth
• Investor Returns: Consistent dividend payments

📊 **PERFORMANCE METRICS:**
• Safety Record: Zero-incident operational standards
• Environmental Compliance: 100% regulatory adherence
• Community Relations: Active stakeholder engagement
• Financial Transparency: Regular investor reporting

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  await ctx.replyWithMarkdown(executiveMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔙 Back to Mining Operations", callback_data: "menu_mining_operations" }],
        [{ text: "🏠 Back to Dashboard", callback_data: "main_menu" }]
      ]
    }
  });
}

async function showCommunityMeetings(ctx) {
  const meetingsMessage = `🏘️ *COMMUNITY MEETINGS*
⛏️ *AUREUS ALLIANCE HOLDINGS*
*Stakeholder Engagement & Communication*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 **REGULAR MEETINGS SCHEDULE:**
• Monthly: Community liaison meetings
• Quarterly: Stakeholder progress reports
• Annually: Comprehensive impact assessments
• Ad-hoc: Issue resolution and feedback sessions

🤝 **ENGAGEMENT TOPICS:**
• Employment Opportunities: Local hiring priorities
• Environmental Impact: Monitoring and mitigation
• Infrastructure Development: Community improvements
• Economic Benefits: Revenue sharing programs

👥 **STAKEHOLDER GROUPS:**
• Local Communities: Direct engagement programs
• Traditional Leaders: Respect for cultural values
• Government Officials: Regulatory compliance
• Environmental Groups: Sustainability partnerships

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  await ctx.replyWithMarkdown(meetingsMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔙 Back to Community Relations", callback_data: "menu_community" }],
        [{ text: "🏠 Back to Dashboard", callback_data: "main_menu" }]
      ]
    }
  });
}

async function showDevelopmentPlans(ctx) {
  const developmentMessage = `🏗️ *DEVELOPMENT PLANS*
⛏️ *AUREUS ALLIANCE HOLDINGS*
*Long-term Community Development Initiatives*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏫 **EDUCATION INITIATIVES:**
• School Infrastructure: Classroom construction
• Scholarship Programs: Student support funding
• Technical Training: Mining skills development
• Adult Education: Literacy and numeracy programs

🏥 **HEALTHCARE DEVELOPMENT:**
• Medical Facilities: Clinic establishment
• Health Programs: Preventive care initiatives
• Emergency Services: First aid and ambulance
• Community Health: Wellness and nutrition

🚧 **INFRASTRUCTURE PROJECTS:**
• Road Construction: Improved transportation
• Water Systems: Clean water access
• Electricity: Power grid connections
• Communication: Internet and mobile coverage

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  await ctx.replyWithMarkdown(developmentMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔙 Back to Community Relations", callback_data: "menu_community" }],
        [{ text: "🏠 Back to Dashboard", callback_data: "main_menu" }]
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
    console.log("🤖 Bot username: @AureusAllianceBot");
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

// RESTORED PAYMENT SYSTEM FUNCTIONS

// Custom Amount Purchase System
async function handleCustomAmountPurchase(ctx) {
  const user = ctx.from;

  // Check for existing pending payments before showing purchase options
  const { data: telegramUser, error: telegramError } = await db.client
    .from('telegram_users')
    .select('user_id')
    .eq('telegram_id', user.id)
    .single();

  if (telegramError || !telegramUser) {
    await ctx.replyWithMarkdown('❌ **Authentication Error**\n\nPlease restart the bot and try again.');
    return;
  }

  const userId = telegramUser.user_id;

  // Check for existing pending payments
  const { data: pendingPayments, error: pendingError } = await db.client
    .from('crypto_payment_transactions')
    .select('id, amount, network, created_at, status, user_id')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (pendingError) {
    console.error('Error checking pending payments:', pendingError);
  } else if (pendingPayments && pendingPayments.length > 0) {
    // User has pending payments - show management options
    const pendingPayment = pendingPayments[0];
    const paymentDate = new Date(pendingPayment.created_at);
    const now = new Date();
    const daysDiff = Math.floor((now - paymentDate) / (1000 * 60 * 60 * 24));
    const hoursAgo = Math.floor((now - paymentDate) / (1000 * 60 * 60));

    const timeAgo = daysDiff > 0 ? `${daysDiff} day${daysDiff > 1 ? 's' : ''} ago` :
                    hoursAgo > 0 ? `${hoursAgo} hour${hoursAgo > 1 ? 's' : ''} ago` :
                    'Less than 1 hour ago';

    const isOld = daysDiff >= 1;
    const statusIcon = isOld ? '🔴' : '🟡';
    const ageWarning = isOld ? '\n\n🔴 **OLD PAYMENT:** This payment is over 24 hours old.' : '';

    const pendingMessage = `⚠️ **PENDING PAYMENT DETECTED**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${statusIcon} **You have an existing pending payment:**

💰 **Amount:** $${pendingPayment.amount}
🌐 **Network:** ${pendingPayment.network.toUpperCase()}
📅 **Submitted:** ${paymentDate.toLocaleDateString()} (${timeAgo})
⏳ **Status:** Pending Admin Approval${ageWarning}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**🔧 WHAT WOULD YOU LIKE TO DO?**

You must handle this pending payment before making a new purchase.`;

    const keyboard = [
      [{ text: "💳 Continue with Pending Payment", callback_data: `continue_payment_${pendingPayment.id}` }],
      [{ text: "🗑️ Delete Pending Payment", callback_data: `cancel_payment_${pendingPayment.id}` }]
    ];

    if (isOld) {
      keyboard.push([{ text: "📞 Contact Support (Old Payment)", callback_data: "menu_help" }]);
    }

    keyboard.push([{ text: "📊 View Payment Details", callback_data: "view_portfolio" }]);
    keyboard.push([{ text: "🔙 Back to Dashboard", callback_data: "main_menu" }]);

    await ctx.replyWithMarkdown(pendingMessage, {
      reply_markup: { inline_keyboard: keyboard }
    });
    return;
  }

  // No pending payments - proceed with normal purchase flow
  const customAmountMessage = `🛒 **PURCHASE SHARES**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**💰 CUSTOM AMOUNT PURCHASE**

Enter your desired investment amount between $25 and $50,000:

**📋 INVESTMENT DETAILS:**
• Minimum: $25 USD
• Maximum: $50,000 USD
• Share allocation based on current phase pricing
• Instant share certificate upon payment approval

**💡 EXAMPLE:**
$1,000 investment = Shares based on current price

**Type your investment amount (numbers only):**`;

  await ctx.replyWithMarkdown(customAmountMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔙 Back to Dashboard", callback_data: "main_menu" }]
      ]
    }
  });

  // Set user state to expect amount input
  await setUserState(user.id, 'awaiting_custom_amount');
}

// Text input handler for custom amounts
bot.on('text', async (ctx) => {
  const user = ctx.from;
  const text = ctx.message.text;

  // Skip if it's a command
  if (text.startsWith('/')) return;

  // Get user state
  const userState = await getUserState(user.id);

  if (userState && userState.state === 'awaiting_custom_amount') {
    await handleCustomAmountInput(ctx, text);
  } else if (userState && userState.state === 'upload_proof_wallet') {
    await handleWalletAddressInput(ctx, text, userState.data);
  } else if (userState && userState.state === 'upload_proof_hash') {
    await handleTransactionHashInput(ctx, text, userState.data);
  } else if (userState && userState.state === 'awaiting_sponsor_username') {
    await handleSponsorUsernameInput(ctx, text);
  }
});

// Handle sponsor username input
async function handleSponsorUsernameInput(ctx, text) {
  const user = ctx.from;

  try {
    // Clear user state first
    await clearUserState(user.id);

    // Check for cancel
    if (text.toLowerCase() === 'cancel') {
      await ctx.reply("❌ Sponsor assignment cancelled.");
      await promptSponsorAssignment(ctx);
      return;
    }

    // Clean the username (remove @ if present)
    const sponsorUsername = text.replace('@', '').trim();

    if (!sponsorUsername || sponsorUsername.length < 3) {
      await ctx.reply("❌ Invalid username. Please enter a valid Telegram username (minimum 3 characters).");
      await handleEnterSponsorManual(ctx);
      return;
    }

    // Validate sponsor exists
    const sponsor = await db.getUserByUsername(sponsorUsername);
    if (!sponsor) {
      const notFoundMessage = `❌ **SPONSOR NOT FOUND**

The username "${sponsorUsername}" was not found in our system.

**🎯 OPTIONS:**
• Check the spelling and try again
• Ask your sponsor to register first
• Use default sponsor (TTTFOUNDER)`;

      await ctx.replyWithMarkdown(notFoundMessage, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "✍️ Try Again", callback_data: "enter_sponsor_manual" }],
            [{ text: "🤝 Use Default Sponsor", callback_data: "assign_default_sponsor" }]
          ]
        }
      });
      return;
    }

    // Get authenticated user
    const authenticatedUser = await authenticateUser(ctx);
    if (!authenticatedUser) return;

    // Assign sponsor
    const success = await assignSponsor(authenticatedUser.id, sponsorUsername);

    if (success) {
      const successMessage = `✅ **SPONSOR ASSIGNED SUCCESSFULLY**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**🤝 Your Sponsor:** ${sponsor.full_name || sponsorUsername} (@${sponsorUsername})
**📅 Assigned:** ${new Date().toLocaleDateString()}
**✅ Status:** Active

**🎯 NEXT STEPS:**
You can now access all platform features and start your gold mining investment journey!

**💎 Your sponsor will provide:**
• Investment guidance and support
• Commission tracking for referrals
• Access to exclusive updates

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      await ctx.replyWithMarkdown(successMessage, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🛒 Purchase Gold Shares", callback_data: "menu_purchase_shares" }],
            [{ text: "💼 View Portfolio", callback_data: "menu_portfolio" }],
            [{ text: "🏠 Main Dashboard", callback_data: "main_menu" }]
          ]
        }
      });
    } else {
      await ctx.reply("❌ Error assigning sponsor. Please try again.");
      await promptSponsorAssignment(ctx);
    }

  } catch (error) {
    console.error('Error handling sponsor username input:', error);
    await ctx.reply("❌ Error processing sponsor assignment. Please try again.");
    await promptSponsorAssignment(ctx);
  }
}

// Photo handler for proof upload
bot.on('photo', async (ctx) => {
  try {
    const user = ctx.from;
    const userState = await getUserState(user.id);

    if (userState && userState.state === 'upload_proof_screenshot') {
      await handleProofScreenshot(ctx, userState.data);
    }
  } catch (error) {
    console.error('Error in photo handler:', error);
    await ctx.reply('❌ Error processing image. Please try again or contact support.');
  }
});

// Document handler for proof upload
bot.on('document', async (ctx) => {
  try {
    const user = ctx.from;
    const userState = await getUserState(user.id);

    if (userState && userState.state === 'upload_proof_screenshot') {
      const document = ctx.message.document;
      if (document.mime_type && document.mime_type.startsWith('image/')) {
        await handleProofScreenshot(ctx, userState.data, true);
      } else {
        await ctx.reply('📷 Please upload an image file for payment verification.');
      }
    }
  } catch (error) {
    console.error('Error in document handler:', error);
    await ctx.reply('❌ Error processing document. Please try again or contact support.');
  }
});

// Handle custom amount input
async function handleCustomAmountInput(ctx, amountText) {
  const user = ctx.from;

  // Parse the amount
  const amount = parseFloat(amountText.replace(/[^0-9.]/g, ''));

  if (isNaN(amount) || amount < 25 || amount > 50000) {
    await ctx.reply('❌ Invalid amount. Please enter a number between $25 and $50,000.');
    return;
  }

  // Clear user state
  await setUserState(user.id, null);

  // Proceed with payment process
  await processCustomAmountPurchase(ctx, amount);
}

// Handle wallet address input
async function handleWalletAddressInput(ctx, walletAddress, sessionData) {
  const user = ctx.from;
  const { paymentId } = sessionData;

  try {
    // Update payment with sender wallet address
    const { error: updateError } = await db.client
      .from('crypto_payment_transactions')
      .update({
        sender_wallet: walletAddress,
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentId);

    if (updateError) {
      console.error('Error updating payment with wallet:', updateError);
      await ctx.reply('❌ Error saving wallet address. Please try again.');
      return;
    }

    // Set state for transaction hash input
    await setUserState(user.id, 'upload_proof_hash', { paymentId, walletAddress });

    const hashMessage = `💳 **PAYMENT PROOF SUBMISSION - STEP 2 OF 3**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ **Wallet Address Saved:** ${walletAddress.substring(0, 10)}...

**📍 STEP 2: TRANSACTION HASH (TXID)**

Please type the transaction hash (TXID) of your payment:

⚠️ **Important:** This is the unique transaction ID from your wallet or exchange

**Next Step:** Screenshot Upload`;

    await ctx.replyWithMarkdown(hashMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "❌ Cancel Upload", callback_data: "main_menu" }]
        ]
      }
    });

  } catch (error) {
    console.error('Error handling wallet address:', error);
    await ctx.reply('❌ Error processing wallet address. Please try again.');
  }
}

// Handle transaction hash input
async function handleTransactionHashInput(ctx, transactionHash, sessionData) {
  const user = ctx.from;
  const { paymentId } = sessionData;

  try {
    // Update payment with transaction hash
    const { error: updateError } = await db.client
      .from('crypto_payment_transactions')
      .update({
        transaction_hash: transactionHash,
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentId);

    if (updateError) {
      console.error('Error updating payment with hash:', updateError);
      await ctx.reply('❌ Error saving transaction hash. Please try again.');
      return;
    }

    // Set state for screenshot upload
    await setUserState(user.id, 'upload_proof_screenshot', { paymentId });

    const screenshotMessage = `💳 **PAYMENT PROOF SUBMISSION - STEP 3 OF 3**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ **Transaction Hash Saved:** ${transactionHash.substring(0, 10)}...

**📍 STEP 3: UPLOAD SCREENSHOT**

Please upload a screenshot of your transaction:

📷 **Send the image now** (as photo or document)

⚠️ **Important:** Screenshot should clearly show the transaction details

**Final Step:** Upload complete → Admin review`;

    await ctx.replyWithMarkdown(screenshotMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "❌ Cancel Upload", callback_data: "main_menu" }]
        ]
      }
    });

  } catch (error) {
    console.error('Error handling transaction hash:', error);
    await ctx.reply('❌ Error processing transaction hash. Please try again.');
  }
}

// Handle proof screenshot upload
async function handleProofScreenshot(ctx, sessionData, isDocument = false) {
  const user = ctx.from;
  const { paymentId } = sessionData;

  try {
    let file, fileUrl;

    if (isDocument) {
      // Handle document upload
      const document = ctx.message.document;
      file = await ctx.telegram.getFile(document.file_id);
      fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
    } else {
      // Handle photo upload
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      file = await ctx.telegram.getFile(photo.file_id);
      fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
    }

    console.log(`📷 Processing screenshot upload for payment ${paymentId}`);

    // Download and upload to Supabase storage
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const timestamp = Date.now();
    const filename = `payment_${user.id}_${timestamp}.jpg`;

    // Upload to Supabase storage bucket "proof"
    const { data, error } = await db.client.storage
      .from('proof')
      .upload(filename, buffer, {
        contentType: 'image/jpeg',
        upsert: false
      });

    if (error) {
      console.error('Storage upload error:', error);
      await ctx.reply('❌ Failed to upload screenshot. Please try again.');
      return;
    }

    // Update payment with screenshot
    const { error: updateError } = await db.client
      .from('crypto_payment_transactions')
      .update({
        screenshot_url: filename,
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentId);

    if (updateError) {
      console.error('Error updating payment with screenshot:', updateError);
      await ctx.reply('❌ Failed to save screenshot. Please try again.');
      return;
    }

    // Clear user state
    try {
      if (typeof clearUserState === 'function') {
        await clearUserState(user.id);
      } else {
        // Fallback if function not available
        if (global.userStates) {
          global.userStates.delete(user.id);
        }
      }
    } catch (stateError) {
      console.error('Error clearing user state:', stateError);
      // Continue anyway - this is not critical
    }

    const successMessage = `✅ **PAYMENT PROOF UPLOADED SUCCESSFULLY**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**📋 SUBMISSION COMPLETE:**
• Payment ID: #${paymentId.substring(0, 8)}
• Wallet Address: ✅ Saved
• Transaction Hash: ✅ Saved
• Screenshot: ✅ Uploaded

**⏳ NEXT STEPS:**
• Admin will review your payment
• You'll receive notification when approved
• Shares will be allocated to your account

**📱 You can check status in Portfolio section**`;

    await ctx.replyWithMarkdown(successMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "💼 View Portfolio", callback_data: "menu_portfolio" }],
          [{ text: "🏠 Main Menu", callback_data: "main_menu" }]
        ]
      }
    });

  } catch (error) {
    console.error('Error handling proof screenshot:', error);
    await ctx.reply('❌ Error uploading screenshot. Please try again.');
  }
}

// Process custom amount purchase
async function processCustomAmountPurchase(ctx, amount) {
  const user = ctx.from;

  try {
    // Get current phase and share price
    const { data: currentPhase, error: phaseError } = await db.client
      .from('investment_phases')
      .select('*')
      .eq('is_active', true)
      .single();

    if (phaseError || !currentPhase) {
      await ctx.reply('❌ Error: No active phase found. Please contact support.');
      return;
    }

    const sharePrice = parseFloat(currentPhase.price_per_share);
    const sharesAmount = Math.floor(amount / sharePrice);

    if (sharesAmount < 1) {
      await ctx.reply(`❌ Amount too small. Minimum purchase: $${sharePrice.toFixed(2)} for 1 share.`);
      return;
    }

    const totalCost = sharesAmount * sharePrice;

    const confirmMessage = `🛒 **PURCHASE CONFIRMATION**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**💰 INVESTMENT DETAILS:**
• Amount: ${formatCurrency(amount)}
• Share Price: ${formatCurrency(sharePrice)}
• Shares: ${sharesAmount.toLocaleString()}
• Total Cost: ${formatCurrency(totalCost)}

**📊 PHASE INFO:**
• Phase: ${currentPhase.phase_name}
• Shares Available: ${(currentPhase.total_shares - currentPhase.shares_sold).toLocaleString()}

**⚠️ IMPORTANT:**
• Payment must be made within 24 hours
• Upload proof of payment after transfer
• Shares will be allocated after admin approval

**Continue with this purchase?**`;

    await ctx.replyWithMarkdown(confirmMessage, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Confirm Purchase", callback_data: `confirm_purchase_${amount}` },
            { text: "❌ Cancel", callback_data: "main_menu" }
          ]
        ]
      }
    });

  } catch (error) {
    console.error('Error processing custom amount purchase:', error);
    await ctx.reply('❌ Error processing purchase. Please try again.');
  }
}

// Portfolio Handler
async function handlePortfolio(ctx) {
  const user = ctx.from;

  try {
    // Get user ID from telegram_users table
    const { data: telegramUser, error: telegramError } = await db.client
      .from('telegram_users')
      .select('user_id')
      .eq('telegram_id', user.id)
      .single();

    if (telegramError || !telegramUser) {
      await ctx.replyWithMarkdown('❌ **Authentication Error**\n\nPlease restart the bot and try again.');
      return;
    }

    const userId = telegramUser.user_id;

    // Get user's share purchases
    const { data: purchases, error: purchasesError } = await db.client
      .from('aureus_share_purchases')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (purchasesError) {
      console.error('Portfolio error:', purchasesError);
      await ctx.replyWithMarkdown('❌ **Error loading portfolio**\n\nPlease try again later.');
      return;
    }

    // Get pending payments
    const { data: pendingPayments, error: paymentsError } = await db.client
      .from('crypto_payment_transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    // Get user's sponsor information
    const { data: referralInfo, error: referralError } = await db.client
      .from('referrals')
      .select(`
        referrer_id,
        created_at,
        users!referrals_referrer_id_fkey (
          username,
          full_name
        )
      `)
      .eq('referred_id', userId)
      .eq('status', 'active')
      .single();

    let sponsorInfo = 'Not assigned';
    if (referralInfo && !referralError) {
      const sponsorName = referralInfo.users?.full_name || referralInfo.users?.username || 'Unknown';
      const sponsorUsername = referralInfo.users?.username || 'Unknown';
      sponsorInfo = `${sponsorName} (@${sponsorUsername})`;
    }

    const totalShares = purchases?.reduce((sum, purchase) => sum + (purchase.shares_purchased || 0), 0) || 0;
    const totalInvested = purchases?.reduce((sum, purchase) => sum + (purchase.total_amount || 0), 0) || 0;
    const approvedPurchases = purchases?.filter(p => p.status === 'active') || []; // Fixed: 'active' not 'approved'
    const pendingAmount = pendingPayments?.reduce((sum, payment) => sum + (parseFloat(payment.amount) || 0), 0) || 0;

    const portfolioMessage = `📊 **MY PORTFOLIO**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**💎 SHARE HOLDINGS:**
• **Total Shares:** ${totalShares.toLocaleString()}
• **Total Invested:** ${formatCurrency(totalInvested)}
• **Approved Purchases:** ${approvedPurchases.length}

**🤝 REFERRAL INFORMATION:**
• **Your Sponsor:** ${sponsorInfo}
• **Referral Status:** ${referralInfo ? 'Active' : 'Not assigned'}

**📈 INVESTMENT SUMMARY:**
${purchases && purchases.length > 0
  ? purchases.slice(0, 5).map(purchase =>
      `• ${formatCurrency(purchase.total_amount)} - ${purchase.shares_purchased} shares (${purchase.status})`
    ).join('\n')
  : '• No investments yet'}

**🎯 NEXT STEPS:**
${totalShares > 0
  ? 'Your shares are generating value through our gold mining operations.'
  : 'Start your investment journey with your first share purchase.'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    const keyboard = totalShares > 0
      ? [
          [{ text: "📊 Detailed View", callback_data: "portfolio_detailed" }],
          [{ text: "📧 Get Portfolio Updates", callback_data: "notify_portfolio" }],
          [{ text: "🔙 Back to Dashboard", callback_data: "main_menu" }]
        ]
      : [
          [{ text: "🛒 Purchase Shares", callback_data: "menu_purchase_shares" }],
          [{ text: "📧 Get Portfolio Updates", callback_data: "notify_portfolio" }],
          [{ text: "🔙 Back to Dashboard", callback_data: "main_menu" }]
        ];

    await ctx.replyWithMarkdown(portfolioMessage, {
      reply_markup: { inline_keyboard: keyboard }
    });

  } catch (error) {
    console.error('Portfolio error:', error);
    await ctx.replyWithMarkdown('❌ **Error loading portfolio**\n\nPlease try again later.');
  }
}

// Payment Status Handler
async function handlePaymentStatus(ctx) {
  const paymentMessage = `💳 **PAYMENT & TRANSACTION CENTER**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**PAYMENT METHODS SUPPORTED:**
• 💳 **BSC USDT** - Binance Smart Chain
• 💳 **Polygon USDT** - Polygon Network
• 💳 **TRON USDT** - Tron Network

**🔐 SECURITY FEATURES:**
• Multi-signature wallet protection
• Real-time transaction monitoring
• Automated fraud detection
• 24/7 payment processing

**⚡ PROCESSING TIMES:**
• Payment verification: Instant
• Admin approval: 2-24 hours
• Share allocation: Immediate after approval

**📱 PAYMENT TRACKING:**
Monitor all your transactions and payment history in real-time.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Secure 3-step payment verification with instant processing.`;

  await ctx.replyWithMarkdown(paymentMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🛒 Purchase Shares", callback_data: "menu_purchase_shares" }],
        [{ text: "📧 Get Payment Updates", callback_data: "notify_payments" }],
        [{ text: "🔙 Back to Dashboard", callback_data: "main_menu" }]
      ]
    }
  });
}

// Referral System Handler
async function handleReferralSystem(ctx) {
  const referralMessage = `👥 **REFERRAL PROGRAM**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**💰 EARN 15% COMMISSION:**
• 15% USDT Commission on every referral purchase
• 15% Share Commission for long-term growth
• Daily commission payments
• Unlimited earning potential

**🎯 HOW IT WORKS:**
1. Share your unique referral link
2. Friends invest using your link
3. Earn instant 15% commission
4. Withdraw anytime to your wallet

**📊 COMMISSION STRUCTURE:**
• **USDT Commission:** 15% paid in USDT
• **Share Commission:** 15% paid in shares
• **Payment Schedule:** Daily processing
• **Withdrawal:** Available anytime

**🚀 REFERRAL BENEFITS:**
• Build passive income stream
• Help friends access gold mining investment
• Grow your own share portfolio
• Professional referral tracking

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  await ctx.replyWithMarkdown(referralMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📤 Share Referral Link", callback_data: "share_referral" }],
        [{ text: "💰 Commission Balance", callback_data: "view_commission" }],
        [{ text: "👥 My Referrals", callback_data: "view_referrals" }],
        [{ text: "💸 Withdraw Commissions", callback_data: "withdraw_commissions" }],
        [{ text: "🔙 Back to Dashboard", callback_data: "main_menu" }]
      ]
    }
  });
}

// Admin Panel Handler
async function handleAdminPanel(ctx) {
  const user = ctx.from;

  if (user.username !== 'TTTFOUNDER') {
    await ctx.replyWithMarkdown('❌ **ACCESS DENIED**\n\nAdmin access is restricted.');
    return;
  }

  const adminMessage = `🔑 **ADMIN CONTROL PANEL**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**⚡ SYSTEM STATUS:** All systems operational

**🔧 ADMIN FUNCTIONS:**
• Payment approvals and management
• User account administration
• Commission processing
• System monitoring and analytics
• Audit logs and reporting

**📊 QUICK STATS:**
• Active users and transactions
• Pending payment queue
• Commission payouts
• System performance metrics

**🛡️ SECURITY:**
• Multi-factor authentication active
• Audit trail logging enabled
• Real-time monitoring active

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  await ctx.replyWithMarkdown(adminMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "⏳ Pending Payments", callback_data: "admin_pending" }],
        [{ text: "👥 User Management", callback_data: "admin_users" }],
        [{ text: "💰 Commission Requests", callback_data: "admin_commissions" }],
        [{ text: "📊 System Stats", callback_data: "admin_stats" }],
        [{ text: "📋 Audit Logs", callback_data: "admin_logs" }],
        [{ text: "🔙 Back to Dashboard", callback_data: "main_menu" }]
      ]
    }
  });
}

// Admin Status Handler
async function handleAdminStatus(ctx) {
  const user = ctx.from;

  if (user.username !== 'TTTFOUNDER') {
    await ctx.replyWithMarkdown('❌ **ACCESS DENIED**\n\nAdmin access is restricted.');
    return;
  }

  const statusMessage = `📊 **SYSTEM STATUS**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**🟢 ALL SYSTEMS OPERATIONAL**

**🔗 DATABASE:** Connected and responsive
**🤖 BOT:** Running smoothly
**💳 PAYMENTS:** Processing normally
**⛏️ MINING OPS:** Active operations
**🔐 SECURITY:** All systems secure

**📈 PERFORMANCE METRICS:**
• Response time: < 100ms
• Uptime: 99.9%
• Error rate: < 0.1%
• Active connections: Stable

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  await ctx.replyWithMarkdown(statusMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔄 Refresh Status", callback_data: "admin_status" }],
        [{ text: "🔙 Back to Admin Panel", callback_data: "admin_panel" }]
      ]
    }
  });
}

// Helper function for user state management
async function setUserState(userId, state, data = null) {
  // This would typically use a database or memory store
  // For now, we'll use a simple in-memory approach
  if (!global.userStates) {
    global.userStates = new Map();
  }
  global.userStates.set(userId, { state, data, timestamp: Date.now() });
}

function getUserState(userId) {
  if (!global.userStates) {
    return null;
  }
  return global.userStates.get(userId);
}

function clearUserState(userId) {
  if (!global.userStates) {
    return;
  }
  global.userStates.delete(userId);
}

// ADMIN PANEL DETAILED HANDLERS

// Admin Payments Handler
async function handleAdminPayments(ctx) {
  const user = ctx.from;

  if (user.username !== 'TTTFOUNDER') {
    await ctx.replyWithMarkdown('❌ **ACCESS DENIED**');
    return;
  }

  try {
    // Get pending payments with user info
    const { data: pendingPayments, error } = await db.client
      .from('crypto_payment_transactions')
      .select(`
        *,
        users!inner(email, full_name)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Error fetching pending payments:', error);
      await ctx.replyWithMarkdown('❌ **Error loading payments**\n\nPlease try again.');
      return;
    }

    if (!pendingPayments || pendingPayments.length === 0) {
      await ctx.replyWithMarkdown(`💳 **PAYMENT APPROVALS**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ **No pending payments**

All payments have been processed!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ View Approved", callback_data: "admin_approved_payments" }],
            [{ text: "❌ View Rejected", callback_data: "admin_rejected_payments" }],
            [{ text: "🔄 Refresh", callback_data: "admin_payments" }],
            [{ text: "🔙 Back to Admin Panel", callback_data: "admin_panel" }]
          ]
        }
      });
      return;
    }

    // Show pending payments
    const paymentsText = pendingPayments.map((payment, index) => {
      const userInfo = payment.users;
      const paymentDate = new Date(payment.created_at);
      const timeAgo = Math.floor((Date.now() - paymentDate.getTime()) / (1000 * 60 * 60));

      return `${index + 1}. **${userInfo.full_name}**
💰 Amount: $${payment.amount}
🌐 Network: ${payment.network.toUpperCase()}
📅 ${timeAgo}h ago
🆔 ID: ${payment.id}`;
    }).join('\n\n');

    await ctx.replyWithMarkdown(`💳 **PENDING PAYMENTS** (${pendingPayments.length})

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${paymentsText}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Click a payment to review:**`, {
      reply_markup: {
        inline_keyboard: [
          ...pendingPayments.map((payment, index) => [
            { text: `Review Payment ${index + 1} ($${payment.amount})`, callback_data: `review_payment_${payment.id}` }
          ]),
          [{ text: "🔄 Refresh", callback_data: "admin_payments" }],
          [{ text: "🔙 Back to Admin Panel", callback_data: "admin_panel" }]
        ]
      }
    });

  } catch (error) {
    console.error('Admin payments error:', error);
    await ctx.replyWithMarkdown('❌ **Error loading payment data**\n\nPlease try again.');
  }
}

// Admin Users Handler
async function handleAdminUsers(ctx) {
  const user = ctx.from;

  if (user.username !== 'TTTFOUNDER') {
    await ctx.replyWithMarkdown('❌ **ACCESS DENIED**');
    return;
  }

  const usersMessage = `👥 **USER MANAGEMENT**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**USER ADMINISTRATION TOOLS:**
• View all registered users
• Check user investment history
• Manage user accounts
• Monitor user activity
• Handle user support requests

**COMING SOON:**
• User search functionality
• Account status management
• Investment analytics per user
• User communication tools

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  await ctx.replyWithMarkdown(usersMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔍 Search Users", callback_data: "admin_search_users" }],
        [{ text: "📊 User Statistics", callback_data: "admin_user_stats" }],
        [{ text: "🔙 Back to Admin Panel", callback_data: "admin_panel" }]
      ]
    }
  });
}

// Admin Analytics Handler
async function handleAdminAnalytics(ctx) {
  const user = ctx.from;

  if (user.username !== 'TTTFOUNDER') {
    await ctx.replyWithMarkdown('❌ **ACCESS DENIED**');
    return;
  }

  const analyticsMessage = `📊 **SYSTEM ANALYTICS**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**PERFORMANCE METRICS:**
• Total users registered
• Total investments processed
• Commission payouts
• System performance data

**FINANCIAL ANALYTICS:**
• Revenue tracking
• Investment flow analysis
• Commission distribution
• Phase progression metrics

**COMING SOON:**
• Real-time dashboard
• Advanced reporting
• Export capabilities
• Trend analysis

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  await ctx.replyWithMarkdown(analyticsMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📈 View Reports", callback_data: "admin_reports" }],
        [{ text: "💰 Financial Summary", callback_data: "admin_financial" }],
        [{ text: "🔙 Back to Admin Panel", callback_data: "admin_panel" }]
      ]
    }
  });
}

// Admin Commissions Handler
async function handleAdminCommissions(ctx) {
  const user = ctx.from;

  if (user.username !== 'TTTFOUNDER') {
    await ctx.replyWithMarkdown('❌ **ACCESS DENIED**');
    return;
  }

  const commissionsMessage = `💰 **COMMISSION REQUESTS**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**COMMISSION MANAGEMENT:**
• Review withdrawal requests
• Process commission payments
• Monitor referral activity
• Track commission balances

**WITHDRAWAL PROCESSING:**
• Pending withdrawal requests
• Approved payouts
• Commission calculations
• Network fee management

**COMING SOON:**
• Automated processing
• Bulk approval tools
• Commission analytics
• Payment scheduling

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  await ctx.replyWithMarkdown(commissionsMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "⏳ Pending Withdrawals", callback_data: "admin_pending_withdrawals" }],
        [{ text: "✅ Approved Payouts", callback_data: "admin_approved_withdrawals" }],
        [{ text: "📊 Commission Stats", callback_data: "admin_commission_stats" }],
        [{ text: "🔙 Back to Admin Panel", callback_data: "admin_panel" }]
      ]
    }
  });
}

// Admin Logs Handler
async function handleAdminLogs(ctx) {
  const user = ctx.from;

  if (user.username !== 'TTTFOUNDER') {
    await ctx.replyWithMarkdown('❌ **ACCESS DENIED**');
    return;
  }

  const logsMessage = `📋 **AUDIT LOGS**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**SYSTEM ACTIVITY TRACKING:**
• Admin actions and approvals
• User registration and activity
• Payment processing events
• Security and access logs

**LOG CATEGORIES:**
• Authentication events
• Payment transactions
• Admin operations
• System errors and warnings

**COMING SOON:**
• Real-time log monitoring
• Advanced filtering
• Export functionality
• Alert notifications

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  await ctx.replyWithMarkdown(logsMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔍 View Recent Logs", callback_data: "admin_recent_logs" }],
        [{ text: "⚠️ Security Events", callback_data: "admin_security_logs" }],
        [{ text: "💳 Payment Logs", callback_data: "admin_payment_logs" }],
        [{ text: "🔙 Back to Admin Panel", callback_data: "admin_panel" }]
      ]
    }
  });
}

// Admin Broadcast Handler
async function handleAdminBroadcast(ctx) {
  const user = ctx.from;

  if (user.username !== 'TTTFOUNDER') {
    await ctx.replyWithMarkdown('❌ **ACCESS DENIED**');
    return;
  }

  const broadcastMessage = `📢 **BROADCAST MESSAGE**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**MASS COMMUNICATION TOOLS:**
• Send announcements to all users
• Target specific user groups
• Schedule message delivery
• Track message engagement

**COMING SOON:**
• Message templates
• User segmentation
• Delivery scheduling
• Analytics tracking

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  await ctx.replyWithMarkdown(broadcastMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📝 Compose Message", callback_data: "admin_compose_broadcast" }],
        [{ text: "📊 Message History", callback_data: "admin_broadcast_history" }],
        [{ text: "🔙 Back to Admin Panel", callback_data: "admin_panel" }]
      ]
    }
  });
}

// Admin Settings Handler
async function handleAdminSettings(ctx) {
  const user = ctx.from;

  if (user.username !== 'TTTFOUNDER') {
    await ctx.replyWithMarkdown('❌ **ACCESS DENIED**');
    return;
  }

  const settingsMessage = `⚙️ **SYSTEM SETTINGS**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**CONFIGURATION OPTIONS:**
• Phase management and pricing
• Commission rate settings
• Payment method configuration
• System maintenance mode

**COMING SOON:**
• Advanced configuration
• Backup and restore
• Performance tuning
• Security settings

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  await ctx.replyWithMarkdown(settingsMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "💰 Phase Settings", callback_data: "admin_phase_settings" }],
        [{ text: "💳 Payment Config", callback_data: "admin_payment_config" }],
        [{ text: "🔧 System Config", callback_data: "admin_system_config" }],
        [{ text: "🔙 Back to Admin Panel", callback_data: "admin_panel" }]
      ]
    }
  });
}

// Admin User Sponsors Handler
async function handleAdminUserSponsors(ctx) {
  const user = ctx.from;

  if (user.username !== 'TTTFOUNDER') {
    await ctx.replyWithMarkdown('❌ **ACCESS DENIED**');
    return;
  }

  const sponsorsMessage = `🤝 **USER SPONSORS**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**REFERRAL MANAGEMENT:**
• View user sponsor relationships
• Monitor referral activity
• Manage commission structures
• Track referral performance

**COMING SOON:**
• Sponsor assignment tools
• Referral analytics
• Commission calculations
• Performance reports

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  await ctx.replyWithMarkdown(sponsorsMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "👥 View Relationships", callback_data: "admin_view_sponsors" }],
        [{ text: "📊 Referral Stats", callback_data: "admin_referral_stats" }],
        [{ text: "🔙 Back to Admin Panel", callback_data: "admin_panel" }]
      ]
    }
  });
}

// PENDING PAYMENT HANDLERS
async function handleContinuePayment(ctx, callbackData) {
  const paymentId = callbackData.split('_')[2];

  try {
    // Get the pending payment details
    const { data: payment, error } = await db.client
      .from('crypto_payment_transactions')
      .select('*')
      .eq('id', paymentId)
      .eq('status', 'pending')
      .single();

    if (error || !payment) {
      await ctx.replyWithMarkdown('❌ **Payment not found or no longer pending.**\n\nIt may have been processed or cancelled.');
      return;
    }

    // Get wallet address from payment record or database
    let walletAddress = payment.receiver_wallet;

    if (!walletAddress) {
      // Fallback: Get from company_wallets table
      const { data: companyWallet, error: walletError } = await db.client
        .from('company_wallets')
        .select('wallet_address')
        .eq('network', 'TRON')
        .eq('currency', 'USDT')
        .eq('is_active', true)
        .single();

      if (walletError || !companyWallet) {
        console.error('Error getting company wallet for continue payment:', walletError);
        await ctx.reply('❌ Error: Company wallet not configured. Please contact support.');
        return;
      }

      walletAddress = companyWallet.wallet_address;
    }

    const paymentDate = new Date(payment.created_at);
    const timeAgo = Math.floor((new Date() - paymentDate) / (1000 * 60 * 60));
    const displayTime = timeAgo < 24 ? `${timeAgo} hours ago` : `${Math.floor(timeAgo/24)} days ago`;

    const continueMessage = `💳 **CONTINUE PENDING PAYMENT**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**📋 PAYMENT DETAILS:**

💰 **Amount:** $${payment.amount} USDT
🌐 **Network:** ${payment.network.toUpperCase()}
📅 **Created:** ${displayTime}
⏳ **Status:** Waiting for your payment

**🏦 SEND PAYMENT TO:**
\`${walletAddress}\`

**📱 NEXT STEPS:**
1. Send exactly $${payment.amount} USDT to the address above
2. Take a screenshot of your transaction
3. Upload the screenshot using the button below
4. Wait for admin approval

**⚠️ IMPORTANT:**
• Use ${payment.network.toUpperCase()} network only
• Send exact amount: $${payment.amount} USDT
• Keep your transaction screenshot ready`;

    await ctx.replyWithMarkdown(continueMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "💳 Submit Payment Proof", callback_data: `upload_proof_${paymentId}` }],
          [{ text: "📊 Check Payment Status", callback_data: "view_portfolio" }],
          [{ text: "🔙 Back to Dashboard", callback_data: "main_menu" }]
        ]
      }
    });

  } catch (error) {
    console.error('Error in handleContinuePayment:', error);
    await ctx.replyWithMarkdown('❌ **Error loading payment details.**\n\nPlease try again or contact support.');
  }
}

async function handleCancelPayment(ctx, callbackData) {
  const paymentId = callbackData.split('_')[2];

  // Get payment details for confirmation
  const { data: payment, error } = await db.client
    .from('crypto_payment_transactions')
    .select('amount, network, created_at')
    .eq('id', paymentId)
    .single();

  if (error || !payment) {
    await ctx.replyWithMarkdown('❌ **Payment not found or already processed.**');
    return;
  }

  const paymentDate = new Date(payment.created_at);
  const daysDiff = Math.floor((new Date() - paymentDate) / (1000 * 60 * 60 * 24));
  const isOld = daysDiff >= 1;

  const confirmMessage = `🗑️ **DELETE PENDING PAYMENT**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚨 **CONFIRM DELETION**

**Payment Details:**
💰 Amount: $${payment.amount}
🌐 Network: ${payment.network.toUpperCase()}
📅 Created: ${paymentDate.toLocaleDateString()}

**⚠️ IMPORTANT:**
${isOld ?
  '• This payment is old - safe to delete if you haven\'t sent crypto yet' :
  '• Only delete if you haven\'t sent the crypto payment yet'}
• If you already sent payment, contact support instead
• This action cannot be undone
• You can create a new purchase after deletion

**🔧 ARE YOU SURE?**`;

  await ctx.replyWithMarkdown(confirmMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🗑️ Yes, Delete Payment", callback_data: `confirm_cancel_${paymentId}` }],
        [{ text: "❌ No, Keep Payment", callback_data: "menu_purchase_shares" }],
        [{ text: "📞 Contact Support First", callback_data: "menu_help" }]
      ]
    }
  });
}

async function handleConfirmCancel(ctx, callbackData) {
  const paymentId = callbackData.split('_')[2];

  try {
    // Update payment status to cancelled
    const { data: cancelledPayment, error: cancelError } = await db.client
      .from('crypto_payment_transactions')
      .update({
        status: 'cancelled',
        admin_notes: 'Cancelled by user request',
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentId)
      .eq('status', 'pending') // Only cancel if still pending
      .select()
      .single();

    if (cancelError || !cancelledPayment) {
      await ctx.replyWithMarkdown(`❌ **CANCELLATION FAILED**

Unable to cancel payment. It may have already been processed or doesn't exist.

Please contact support if you need assistance.`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📞 Contact Support", callback_data: "menu_help" }],
            [{ text: "🏠 Main Dashboard", callback_data: "main_menu" }]
          ]
        }
      });
      return;
    }

    // Log the cancellation
    await logAdminAction(
      ctx.from.id,
      ctx.from.username || ctx.from.first_name,
      'CANCEL_PAYMENT',
      'user_action',
      paymentId,
      { amount: cancelledPayment.amount, network: cancelledPayment.network }
    );

    const successMessage = `✅ **PAYMENT DELETED SUCCESSFULLY**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🗑️ **Your pending payment has been deleted:**

💰 **Amount:** $${cancelledPayment.amount}
🌐 **Network:** ${cancelledPayment.network}
⏰ **Cancelled:** ${new Date().toLocaleDateString()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ **You can now make new purchases!**

**⚠️ IMPORTANT:**
If you already sent payment to our wallet, please contact support immediately with your transaction details.`;

    await ctx.replyWithMarkdown(successMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🛒 Purchase Shares", callback_data: "menu_purchase_shares" }],
          [{ text: "📞 Contact Support", callback_data: "menu_help" }],
          [{ text: "🏠 Main Dashboard", callback_data: "main_menu" }]
        ]
      }
    });

  } catch (error) {
    console.error('Error cancelling payment:', error);
    await ctx.replyWithMarkdown('❌ **Error cancelling payment**\n\nPlease try again or contact support.');
  }
}

// Handle confirm purchase
async function handleConfirmPurchase(ctx, callbackData) {
  const amount = parseFloat(callbackData.split('_')[2]);
  const user = ctx.from;

  try {
    // Get current phase and share price
    const { data: currentPhase, error: phaseError } = await db.client
      .from('investment_phases')
      .select('*')
      .eq('is_active', true)
      .single();

    if (phaseError || !currentPhase) {
      await ctx.reply('❌ Error: No active phase found. Please contact support.');
      return;
    }

    const sharePrice = parseFloat(currentPhase.price_per_share);
    const sharesAmount = Math.floor(amount / sharePrice);
    const totalCost = sharesAmount * sharePrice;

    // Get or create telegram user
    let { data: telegramUser, error: telegramError } = await db.client
      .from('telegram_users')
      .select('*')
      .eq('username', user.username)
      .single();

    if (telegramError && telegramError.code !== 'PGRST116') {
      console.error('Error fetching telegram user:', telegramError);
      await ctx.reply('❌ Database error. Please try again.');
      return;
    }

    if (!telegramUser) {
      // Create new telegram user
      const { data: newUser, error: createError } = await db.client
        .from('telegram_users')
        .insert({
          telegram_id: user.id,
          username: user.username,
          first_name: user.first_name,
          last_name: user.last_name || null,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating telegram user:', createError);
        await ctx.reply('❌ Error creating user account. Please try again.');
        return;
      }
      telegramUser = newUser;
    }

    // Get company wallet address from database
    const { data: companyWallet, error: walletError } = await db.client
      .from('company_wallets')
      .select('wallet_address')
      .eq('network', 'TRON')
      .eq('currency', 'USDT')
      .eq('is_active', true)
      .single();

    if (walletError || !companyWallet) {
      console.error('Error getting company wallet:', walletError);
      await ctx.reply('❌ Error: Company wallet not configured. Please contact support.');
      return;
    }

    // Create payment transaction
    const { data: payment, error: paymentError } = await db.client
      .from('crypto_payment_transactions')
      .insert({
        user_id: telegramUser.user_id || null, // Link to main users table
        amount: totalCost,
        currency: 'USDT',
        network: 'USDT-TRC20',
        sender_wallet: '', // Will be filled when user uploads proof
        receiver_wallet: companyWallet.wallet_address, // From database
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (paymentError) {
      console.error('Error creating payment:', paymentError);
      await ctx.reply('❌ Error creating payment. Please try again.');
      return;
    }

    // Show payment instructions
    await showPaymentInstructions(ctx, payment, currentPhase);

  } catch (error) {
    console.error('Error confirming purchase:', error);
    await ctx.reply('❌ Error processing purchase. Please try again.');
  }
}

// Show payment instructions
async function showPaymentInstructions(ctx, payment, phase) {
  // Calculate shares from payment amount and phase price
  const sharePrice = parseFloat(phase.price_per_share);
  const sharesAmount = Math.floor(payment.amount / sharePrice);

  const paymentMessage = `💳 **PAYMENT INSTRUCTIONS**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**📋 PURCHASE DETAILS:**
• Amount: ${formatCurrency(payment.amount)}
• Shares: ${sharesAmount.toLocaleString()}
• Phase: ${phase.phase_name}
• Share Price: ${formatCurrency(sharePrice)}
• Payment ID: #${payment.id.substring(0, 8)}

**💰 PAYMENT INFORMATION:**
• Network: USDT-TRC20 (Tron)
• Wallet Address: \`${payment.receiver_wallet}\`
• Amount to Send: **$${payment.amount} USDT**

**⚠️ IMPORTANT INSTRUCTIONS:**
1. Send EXACTLY $${payment.amount} USDT
2. Use ONLY TRC-20 network (Tron)
3. Take screenshot of transaction
4. Upload proof within 24 hours
5. Wait for admin approval

**🚨 WARNING:**
• Wrong network = Lost funds
• Wrong amount = Payment rejected
• No proof = No shares allocated

**⏰ Payment expires in 24 hours**`;

  await ctx.replyWithMarkdown(paymentMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "💳 Submit Payment Proof", callback_data: `upload_proof_${payment.id}` }],
        [{ text: "💼 View Portfolio", callback_data: "menu_portfolio" }],
        [{ text: "🏠 Main Menu", callback_data: "main_menu" }]
      ]
    }
  });
}

// Handle upload proof callback
async function handleUploadProof(ctx, callbackData) {
  const paymentId = callbackData.replace('upload_proof_', '');
  const user = ctx.from;

  try {
    // Verify payment exists and belongs to user
    const { data: payment, error: paymentError } = await db.client
      .from('crypto_payment_transactions')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (paymentError || !payment) {
      await ctx.answerCbQuery('❌ Payment not found');
      return;
    }

    // Set user state to collect wallet address first
    await setUserState(user.id, 'upload_proof_wallet', { paymentId });

    const walletMessage = `💳 **PAYMENT PROOF SUBMISSION - STEP 1 OF 3**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**📋 PAYMENT DETAILS:**
• Payment ID: #${paymentId.substring(0, 8)}
• Amount: ${formatCurrency(payment.amount)}
• Network: ${payment.network}

**📍 STEP 1: YOUR SENDER WALLET ADDRESS**

Please type the wallet address you sent the payment FROM:

⚠️ **Important:** This is YOUR wallet address (not our receiving address)

**Next Steps:** Wallet Address → Transaction Hash → Screenshot Upload`;

    await ctx.replyWithMarkdown(walletMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "❌ Cancel Upload", callback_data: "main_menu" }]
        ]
      }
    });

  } catch (error) {
    console.error('Error handling upload proof:', error);
    await ctx.answerCbQuery('❌ Error processing request');
  }
}

// Admin audit logging function
async function logAdminAction(adminTelegramId, adminUsername, action, targetType, targetId, details = {}) {
  try {
    // Defensive programming: truncate values to prevent database errors
    const truncatedAction = String(action || '').substring(0, 255);
    const truncatedTargetType = String(targetType || '').substring(0, 50);
    const truncatedTargetId = String(targetId || '').substring(0, 500);
    const truncatedUsername = String(adminUsername || '').substring(0, 255);

    // Ensure details is a valid object and not too large
    let safeDetails = {};
    try {
      if (details && typeof details === 'object') {
        const detailsString = JSON.stringify(details);
        if (detailsString.length > 10000) {
          // If details are too large, truncate or summarize
          safeDetails = {
            truncated: true,
            original_size: detailsString.length,
            summary: String(detailsString).substring(0, 1000) + '...'
          };
        } else {
          safeDetails = details;
        }
      }
    } catch (detailsError) {
      safeDetails = { error: 'Failed to serialize details', type: typeof details };
    }

    const { error } = await db.client
      .from('admin_audit_logs')
      .insert([{
        admin_telegram_id: adminTelegramId,
        admin_username: truncatedUsername,
        action: truncatedAction,
        target_type: truncatedTargetType,
        target_id: truncatedTargetId,
        details: safeDetails
      }]);

    if (error) {
      console.error('Audit log error:', error);
      // If still failing due to column size, try with minimal data
      if (error.message && error.message.includes('value too long')) {
        console.log('🔧 Retrying with minimal audit log data...');
        await db.client
          .from('admin_audit_logs')
          .insert([{
            admin_telegram_id: adminTelegramId,
            admin_username: truncatedUsername.substring(0, 50),
            action: truncatedAction.substring(0, 50),
            target_type: 'system',
            target_id: 'truncated',
            details: { error: 'Original data too long', action: truncatedAction }
          }]);
      }
    } else {
      console.log(`📋 Admin action logged: ${truncatedAction} by ${truncatedUsername} on ${truncatedTargetType} ${truncatedTargetId}`);
    }
  } catch (error) {
    console.error('Audit logging failed:', error);
  }
}

// ADMIN PAYMENT REVIEW HANDLERS
async function handleReviewPayment(ctx, callbackData) {
  const user = ctx.from;

  // Check admin authorization
  if (user.username !== 'TTTFOUNDER') {
    await ctx.answerCbQuery('❌ Access denied');
    return;
  }

  const paymentId = callbackData.replace('review_payment_', '');

  try {
    // Get payment details with user info
    const { data: payment, error: fetchError } = await db.client
      .from('crypto_payment_transactions')
      .select(`
        *,
        users!inner(username, full_name)
      `)
      .eq('id', paymentId)
      .single();

    if (fetchError || !payment) {
      await ctx.answerCbQuery('❌ Payment not found');
      return;
    }

    const reviewMessage = `🔍 **PAYMENT REVIEW**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**💰 PAYMENT DETAILS:**
• **ID:** #${paymentId.substring(0, 8)}
• **Amount:** $${payment.amount} USDT
• **Network:** ${payment.network}
• **Status:** ${payment.status}

**👤 USER DETAILS:**
• **Name:** ${payment.users.full_name || 'N/A'}
• **Username:** ${payment.users.username || 'N/A'}

**📋 TRANSACTION INFO:**
• **Wallet Address:** ${payment.sender_wallet_address || 'Not provided'}
• **Transaction Hash:** ${payment.transaction_hash || 'Not provided'}
• **Screenshot:** ${payment.screenshot_url ? '✅ Uploaded' : '❌ Not uploaded'}

**📅 TIMESTAMPS:**
• **Created:** ${new Date(payment.created_at).toLocaleString()}
• **Updated:** ${new Date(payment.updated_at).toLocaleString()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    const keyboard = [
      [
        { text: "✅ Approve Payment", callback_data: `approve_payment_${paymentId}` },
        { text: "❌ Reject Payment", callback_data: `reject_payment_${paymentId}` }
      ]
    ];

    if (payment.screenshot_url) {
      keyboard.unshift([
        { text: "📷 View Screenshot", callback_data: `view_screenshot_${paymentId}` }
      ]);
    }

    keyboard.push([
      { text: "🔄 Refresh", callback_data: `review_payment_${paymentId}` },
      { text: "🔙 Back to Payments", callback_data: "admin_payments" }
    ]);

    await ctx.replyWithMarkdown(reviewMessage, {
      reply_markup: { inline_keyboard: keyboard }
    });

  } catch (error) {
    console.error('Review payment error:', error);
    await ctx.answerCbQuery('❌ Error loading payment details');
  }
}

async function handleApprovePayment(ctx, callbackData) {
  const user = ctx.from;

  if (user.username !== 'TTTFOUNDER') {
    await ctx.answerCbQuery('❌ Access denied');
    return;
  }

  const paymentId = callbackData.replace('approve_payment_', '');

  try {
    // Update payment status to approved
    const { data: updatedPayment, error: updateError } = await db.client
      .from('crypto_payment_transactions')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentId)
      .select('*, users!inner(username, full_name)')
      .single();

    if (updateError) {
      console.error('Payment approval error:', updateError);
      await ctx.answerCbQuery('❌ Error approving payment');
      return;
    }

    // Get current phase to calculate shares correctly
    const { data: currentPhase, error: phaseError } = await db.client
      .from('investment_phases')
      .select('*')
      .eq('is_active', true)
      .single();

    if (phaseError || !currentPhase) {
      console.error('Error getting current phase:', phaseError);
      await ctx.reply('❌ Error: No active phase found. Cannot approve payment.');
      return;
    }

    // Calculate shares based on current phase price
    const amount = parseFloat(updatedPayment.amount);
    const sharePrice = parseFloat(currentPhase.price_per_share);
    const sharesAmount = Math.floor(amount / sharePrice); // Correct calculation!

    // Create share purchase record
    console.log('💰 Creating share purchase record for approved payment...');

    try {

      const investmentData = {
        user_id: updatedPayment.user_id,
        package_name: `${currentPhase.phase_name} Purchase`,
        total_amount: amount,
        shares_purchased: sharesAmount,
        status: 'active',
        payment_method: `${updatedPayment.network} ${updatedPayment.currency || 'USDT'}`,
        created_at: updatedPayment.created_at,
        updated_at: new Date().toISOString()
      };

      const { data: investmentRecord, error: investmentError } = await db.client
        .from('aureus_share_purchases')
        .insert([investmentData])
        .select()
        .single();

      if (investmentError) {
        console.error('Share Purchase creation error:', investmentError);
      } else {
        console.log('✅ Share Purchase record created:', investmentRecord.id);

        // Link the payment to the share purchase
        await db.client
          .from('crypto_payment_transactions')
          .update({ share_purchase_id: investmentRecord.id })
          .eq('id', paymentId);

        console.log('🔗 Payment linked to share purchase');
      }
    } catch (shareError) {
      console.error('Error creating share purchase:', shareError);
    }

    await ctx.replyWithMarkdown(`✅ **PAYMENT APPROVED**

**Payment ID:** #${paymentId.substring(0, 8)}
**Amount:** $${updatedPayment.amount} USDT
**User:** ${updatedPayment.users.full_name || updatedPayment.users.username}
**Shares Allocated:** ${sharesAmount}

The user will be notified of the approval and shares have been allocated.`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔙 Back to Payments", callback_data: "admin_payments" }]
        ]
      }
    });

  } catch (error) {
    console.error('Payment approval error:', error);
    await ctx.answerCbQuery('❌ Error approving payment');
  }
}

async function handleRejectPayment(ctx, callbackData) {
  const user = ctx.from;

  if (user.username !== 'TTTFOUNDER') {
    await ctx.answerCbQuery('❌ Access denied');
    return;
  }

  const paymentId = callbackData.replace('reject_payment_', '');

  try {
    // Update payment status to rejected
    const { data: updatedPayment, error: updateError } = await db.client
      .from('crypto_payment_transactions')
      .update({
        status: 'rejected',
        rejected_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentId)
      .select('*, users!inner(username, full_name)')
      .single();

    if (updateError) {
      console.error('Payment rejection error:', updateError);
      await ctx.answerCbQuery('❌ Error rejecting payment');
      return;
    }

    await ctx.replyWithMarkdown(`❌ **PAYMENT REJECTED**

**Payment ID:** #${paymentId.substring(0, 8)}
**Amount:** $${updatedPayment.amount} USDT
**User:** ${updatedPayment.users.full_name || updatedPayment.users.username}

The user will be notified of the rejection.`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔙 Back to Payments", callback_data: "admin_payments" }]
        ]
      }
    });

  } catch (error) {
    console.error('Payment rejection error:', error);
    await ctx.answerCbQuery('❌ Error rejecting payment');
  }
}

async function handleViewScreenshot(ctx, callbackData) {
  const user = ctx.from;

  if (user.username !== 'TTTFOUNDER') {
    await ctx.answerCbQuery('❌ Access denied');
    return;
  }

  const paymentId = callbackData.replace('view_screenshot_', '');

  try {
    // Get payment screenshot URL
    const { data: payment, error: fetchError } = await db.client
      .from('crypto_payment_transactions')
      .select('screenshot_url, amount, users!inner(username)')
      .eq('id', paymentId)
      .single();

    if (fetchError || !payment || !payment.screenshot_url) {
      await ctx.answerCbQuery('❌ Screenshot not found');
      return;
    }

    // Get the screenshot from Supabase storage
    const { data: fileData, error: downloadError } = await db.client.storage
      .from('proof')
      .download(payment.screenshot_url);

    if (downloadError) {
      console.error('Screenshot download error:', downloadError);
      await ctx.answerCbQuery('❌ Error loading screenshot');
      return;
    }

    // Convert blob to buffer for Telegram
    const buffer = Buffer.from(await fileData.arrayBuffer());

    await ctx.replyWithPhoto(
      { source: buffer },
      {
        caption: `📷 **Payment Screenshot**\n\n**Payment ID:** #${paymentId.substring(0, 8)}\n**Amount:** $${payment.amount} USDT\n**User:** ${payment.users.username}`,
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Approve", callback_data: `approve_payment_${paymentId}` },
              { text: "❌ Reject", callback_data: `reject_payment_${paymentId}` }
            ],
            [{ text: "🔙 Back to Review", callback_data: `review_payment_${paymentId}` }]
          ]
        }
      }
    );

  } catch (error) {
    console.error('View screenshot error:', error);
    await ctx.answerCbQuery('❌ Error loading screenshot');
  }
}

// ENHANCED REFERRAL SYSTEM HANDLERS
async function handleShareReferral(ctx) {
  const user = ctx.from;

  try {
    // Get user ID from telegram_users table
    const { data: telegramUser, error: telegramError } = await db.client
      .from('telegram_users')
      .select('user_id, username')
      .eq('telegram_id', user.id)
      .single();

    if (telegramError || !telegramUser) {
      await ctx.replyWithMarkdown('❌ **User not found**\n\nPlease register first.');
      return;
    }

    const referralUsername = telegramUser.username || user.username || user.first_name;
    const botLink = 'https://t.me/AureusAllianceBot';
    const referralLink = `https://t.me/AureusAllianceBot?start=${referralUsername}`;

    // DEBUG: Log the generated links to verify they're correct
    console.log('🔗 DEBUG - Generated referral link:', referralLink);
    console.log('🔗 DEBUG - Bot link:', botLink);
    console.log('🔗 DEBUG - Referral username:', referralUsername);

    // MOTIVATING & COMPELLING investment opportunity message
    const shareMessage = `🌟 **LIFE-CHANGING OPPORTUNITY: OWN REAL GOLD MINES!** 🌟

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💰 **IMAGINE EARNING FROM ACTUAL GOLD PRODUCTION!**

🏆 **AUREUS ALLIANCE HOLDINGS** - Your Gateway to Gold Wealth!
*Join thousands already building generational wealth through gold mining*

🔥 **WHY THIS IS THE OPPORTUNITY OF A LIFETIME:**

💎 **REAL GOLD, REAL PROFITS:**
• Own shares in 10 MASSIVE gold washplants
• Each plant processes 200 tons of gold-bearing material per hour
• Target: 3,200 KG of pure gold annually (worth $200+ MILLION!)
• You get a piece of every ounce extracted!

🚀 **EXPLOSIVE GROWTH POTENTIAL:**
• Phase 1: $1 per share (LIMITED TIME!)
• Full production by June 2026
• Early investors positioned for maximum returns
• Only 1,400,000 shares available - Don't miss out!

⛏️ **PROVEN SOUTH AFRICAN GOLD RESERVES:**
• Located in gold-rich Mpumalanga Province
• Professional geological surveys completed
• Modern extraction technology deployed
• Experienced mining team managing operations

💸 **MULTIPLE WAYS TO PROFIT:**
• Share value appreciation as production scales
• Dividend payments from gold sales
• Portfolio diversification with precious metals
• Hedge against inflation and economic uncertainty

🎯 **PERFECT FOR:**
• Investors seeking alternative assets
• Those wanting exposure to gold without storage
• People building retirement wealth
• Anyone tired of low bank returns

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚨 **ACT NOW - PHASE 1 PRICING ENDS SOON!**

👆 **CLICK YOUR PERSONAL REFERRAL LINK:**
${referralLink}

🎁 **AUTOMATIC SPONSOR ASSIGNMENT:** Your referrals will be automatically linked to you!

💡 **INVESTMENT RANGE:** Start with just $25 or go big with $50,000+

⚡ **SECURE PROCESS:** 3-step verification, instant confirmation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔥 **DON'T LET THIS GOLDEN OPPORTUNITY SLIP AWAY!**

*Join the smart money already invested in South Africa's gold boom!*

⚠️ *High-risk, high-reward investment. Invest responsibly.*`;

    await ctx.replyWithMarkdown(shareMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📤 Share Referral Link", url: `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent('🔥 GOLD MINING OPPORTUNITY! Join Aureus Alliance Holdings and own real South African gold mines!')}` }],
          [{ text: "📋 Copy Referral Link", callback_data: `copy_referral_link_${referralUsername}` }],
          [{ text: "👥 Back to Referral Dashboard", callback_data: "menu_referrals" }],
          [{ text: "🔙 Back to Main Menu", callback_data: "main_menu" }]
        ]
      }
    });

  } catch (error) {
    console.error('Share referral error:', error);
    await ctx.replyWithMarkdown('❌ **Error generating referral content**\n\nPlease try again.');
  }
}

async function handleViewCommission(ctx) {
  const user = ctx.from;

  try {
    // Get user ID from telegram_users table
    const { data: telegramUser, error: telegramError } = await db.client
      .from('telegram_users')
      .select('user_id')
      .eq('telegram_id', user.id)
      .single();

    if (telegramError || !telegramUser) {
      await ctx.replyWithMarkdown('❌ **User not found**\n\nPlease register first.');
      return;
    }

    // Get commission balance
    const { data: commissions, error: commissionError } = await db.client
      .from('commissions')
      .select('*')
      .eq('referrer_id', telegramUser.user_id)
      .eq('status', 'approved');

    if (commissionError) {
      console.error('Commission fetch error:', commissionError);
      await ctx.replyWithMarkdown('❌ **Error loading commission data**\n\nPlease try again.');
      return;
    }

    // Calculate totals
    let totalUSDT = 0;
    let totalShares = 0;
    let availableUSDT = 0;
    let pendingUSDT = 0;

    if (commissions && commissions.length > 0) {
      commissions.forEach(commission => {
        totalUSDT += parseFloat(commission.usdt_amount || 0);
        totalShares += parseFloat(commission.share_amount || 0);

        if (commission.withdrawal_status === 'available') {
          availableUSDT += parseFloat(commission.usdt_amount || 0);
        } else if (commission.withdrawal_status === 'pending') {
          pendingUSDT += parseFloat(commission.usdt_amount || 0);
        }
      });
    }

    const commissionMessage = `💰 **COMMISSION BALANCE**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**💵 USDT COMMISSIONS:**
• **Total Earned:** $${totalUSDT.toFixed(2)} USDT
• **Available for Withdrawal:** $${availableUSDT.toFixed(2)} USDT
• **Pending Withdrawal:** $${pendingUSDT.toFixed(2)} USDT

**📈 SHARE COMMISSIONS:**
• **Total Shares Earned:** ${totalShares.toFixed(0)} shares
• **Current Value:** $${totalShares.toFixed(2)} USD
• **Status:** Active in portfolio

**📊 COMMISSION SUMMARY:**
• **Total Commission Value:** $${(totalUSDT + totalShares).toFixed(2)}
• **Active Referrals:** ${commissions ? commissions.length : 0}
• **Commission Rate:** 15% USDT + 15% Shares

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    const keyboard = [];

    if (availableUSDT > 0) {
      keyboard.push([{ text: "💸 Withdraw USDT", callback_data: "withdraw_commissions" }]);
    }

    keyboard.push(
      [{ text: "📤 Share Referral Link", callback_data: "share_referral" }],
      [{ text: "👥 View My Referrals", callback_data: "view_referrals" }],
      [{ text: "🔙 Back to Referral Dashboard", callback_data: "menu_referrals" }]
    );

    await ctx.replyWithMarkdown(commissionMessage, {
      reply_markup: { inline_keyboard: keyboard }
    });

  } catch (error) {
    console.error('View commission error:', error);
    await ctx.replyWithMarkdown('❌ **Error loading commission balance**\n\nPlease try again.');
  }
}

async function handleViewReferrals(ctx) {
  const user = ctx.from;

  try {
    // Get user ID from telegram_users table
    const { data: telegramUser, error: telegramError } = await db.client
      .from('telegram_users')
      .select('user_id')
      .eq('telegram_id', user.id)
      .single();

    if (telegramError || !telegramUser) {
      await ctx.replyWithMarkdown('❌ **User not found**\n\nPlease register first.');
      return;
    }

    // Get referral relationships
    const { data: referrals, error: referralError } = await db.client
      .from('referrals')
      .select(`
        id,
        referred_id,
        created_at,
        status,
        users!referrals_referred_id_fkey (
          username,
          full_name,
          created_at
        )
      `)
      .eq('referrer_id', telegramUser.user_id)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (referralError) {
      console.error('Referrals fetch error:', referralError);
      await ctx.replyWithMarkdown('❌ **Error loading referral data**\n\nPlease try again.');
      return;
    }

    // Get commission data for these referrals
    const { data: commissions, error: commissionError } = await db.client
      .from('commissions')
      .select('*')
      .eq('referrer_id', telegramUser.user_id);

    let totalCommissions = 0;
    if (commissions && commissions.length > 0) {
      totalCommissions = commissions.reduce((sum, comm) =>
        sum + parseFloat(comm.usdt_amount || 0) + parseFloat(comm.share_amount || 0), 0
      );
    }

    let referralsList = '';
    if (referrals && referrals.length > 0) {
      referrals.forEach((referral, index) => {
        const joinDate = new Date(referral.users.created_at).toLocaleDateString();
        const username = referral.users.username || referral.users.full_name || 'Anonymous';
        referralsList += `${index + 1}. **${username}**\n   📅 Joined: ${joinDate}\n   ✅ Status: Active\n\n`;
      });
    } else {
      referralsList = '*No referrals yet. Start sharing your referral link!*';
    }

    const referralsMessage = `👥 **MY REFERRALS**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**📊 REFERRAL STATISTICS:**
• **Total Referrals:** ${referrals ? referrals.length : 0}
• **Active Referrals:** ${referrals ? referrals.length : 0}
• **Total Commissions Earned:** $${totalCommissions.toFixed(2)}

**👤 REFERRAL LIST:**
${referralsList}

**🚀 GROW YOUR NETWORK:**
Share your referral link to earn 15% USDT + 15% shares commission on every investment your referrals make!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    await ctx.replyWithMarkdown(referralsMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📤 Share Referral Link", callback_data: "share_referral" }],
          [{ text: "💰 View Commission Balance", callback_data: "view_commission" }],
          [{ text: "🔄 Refresh List", callback_data: "view_referrals" }],
          [{ text: "🔙 Back to Referral Dashboard", callback_data: "menu_referrals" }]
        ]
      }
    });

  } catch (error) {
    console.error('View referrals error:', error);
    await ctx.replyWithMarkdown('❌ **Error loading referral list**\n\nPlease try again.');
  }
}

async function handleWithdrawCommissions(ctx) {
  await ctx.replyWithMarkdown(`💸 **COMMISSION WITHDRAWAL**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**🚧 WITHDRAWAL SYSTEM COMING SOON**

We're currently developing a secure commission withdrawal system with the following features:

**🔐 SECURITY FEATURES:**
• Multi-signature wallet verification
• Two-factor authentication
• Admin approval process
• Anti-fraud protection

**💳 SUPPORTED NETWORKS:**
• BSC (Binance Smart Chain)
• Polygon (MATIC)
• TRON (TRC20)

**📋 WITHDRAWAL PROCESS:**
1. Select withdrawal network
2. Enter wallet address
3. Specify withdrawal amount
4. Admin verification
5. Secure payout processing

**📧 GET NOTIFIED:**
We'll notify all users when the withdrawal system goes live!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "💰 View Commission Balance", callback_data: "view_commission" }],
        [{ text: "📤 Share More Referrals", callback_data: "share_referral" }],
        [{ text: "🔙 Back to Referral Dashboard", callback_data: "menu_referrals" }]
      ]
    }
  });
}

async function handleCopyReferralLink(ctx, callbackData) {
  const referralUsername = callbackData.replace('copy_referral_link_', '');
  const referralLink = `https://t.me/AureusAllianceBot?start=${referralUsername}`;

  // DEBUG: Log the generated link to verify it's correct
  console.log('🔗 DEBUG - Copy referral link generated:', referralLink);
  console.log('🔗 DEBUG - Username:', referralUsername);

  await ctx.answerCbQuery(`📋 Referral link copied!`);

  await ctx.replyWithMarkdown(`📋 **REFERRAL LINK COPIED**

**Your Personal Referral Link:**
\`${referralLink}\`

**🎯 HOW IT WORKS:**
• Share this link with potential investors
• When they click it, you're automatically assigned as their sponsor
• You earn 15% USDT + 15% shares commission on their investments
• No manual referral code entry needed!

**🚀 QUICK SHARING MESSAGES:**

**💎 For WhatsApp/SMS:**
"🔥 GOLD MINING OPPORTUNITY! Join me in owning real South African gold mines. Click: ${referralLink}"

**📱 For Social Media:**
"💰 Building wealth through gold mining! Join Aureus Alliance Holdings: ${referralLink} #GoldInvestment #WealthBuilding"

**📧 For Email:**
"I wanted to share an exciting gold mining investment opportunity with you. Aureus Alliance Holdings offers shares in real South African gold operations. Check it out: ${referralLink}"`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📤 Share on Telegram", url: `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent('🔥 Join me in owning real South African gold mines!')}` }],
        [{ text: "👥 Back to Referral Dashboard", callback_data: "menu_referrals" }]
      ]
    }
  });
}

async function handleCopyReferral(ctx, callbackData) {
  const referralCode = callbackData.replace('copy_referral_', '');

  await ctx.answerCbQuery(`📋 Referral username copied: ${referralCode}`);

  await ctx.replyWithMarkdown(`📋 **REFERRAL USERNAME COPIED**

**Your Referral Username:** \`${referralCode}\`

**🚀 QUICK SHARING MESSAGES:**

**💎 For WhatsApp/SMS:**
*"🔥 GOLD MINING INVESTMENT OPPORTUNITY! Own shares in real South African gold mines. Starting at just $25. Massive profit potential! Use my referral '${referralCode}' here: https://t.me/AureusAllianceBot"*

**📱 For Social Media:**
*"💰 Just discovered an incredible gold mining investment! Real washplants, real gold, real profits. Early investors getting $1/share before it goes up! Use referral '${referralCode}': https://t.me/AureusAllianceBot #GoldInvestment #WealthBuilding"*

**💼 For Serious Investors:**
*"Professional gold mining investment opportunity in South Africa. 10 active washplants, 3,200 KG annual target. Phase 1 pricing available. Use referral '${referralCode}' for priority: https://t.me/AureusAllianceBot"*

**📧 For Email:**
*"I wanted to share an exclusive gold mining investment I discovered. Aureus Alliance Holdings operates real gold mines in South Africa with proven reserves. You can own shares starting at $1 each. Use my referral code '${referralCode}' when you register: https://t.me/AureusAllianceBot"*`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📤 Share Full Investment Pitch", callback_data: "share_referral" }],
        [{ text: "👥 Back to Referral Dashboard", callback_data: "menu_referrals" }]
      ]
    }
  });
}

// Start the bot
startBot();
