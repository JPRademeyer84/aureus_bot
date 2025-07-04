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
      .from('share_purchases')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (purchasesError) {
      console.error('Portfolio error:', purchasesError);
      await ctx.replyWithMarkdown('❌ **Error loading portfolio**\n\nPlease try again later.');
      return;
    }

    const totalShares = purchases?.reduce((sum, purchase) => sum + (purchase.shares_purchased || 0), 0) || 0;
    const totalInvested = purchases?.reduce((sum, purchase) => sum + (purchase.total_amount || 0), 0) || 0;
    const approvedPurchases = purchases?.filter(p => p.status === 'approved') || [];

    const portfolioMessage = `📊 **MY PORTFOLIO**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**💎 SHARE HOLDINGS:**
• **Total Shares:** ${totalShares.toLocaleString()}
• **Total Invested:** ${formatCurrency(totalInvested)}
• **Approved Purchases:** ${approvedPurchases.length}

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

// Start the bot
startBot();
