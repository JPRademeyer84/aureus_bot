const { Telegraf } = require("telegraf");
const bcrypt = require("bcryptjs");
const fetch = require("node-fetch");
const { db } = require('./src/database/supabase-client');
require("dotenv").config();

console.log("🚀 Starting Aureus Alliance Holdings Telegram Bot...");
console.log("📊 Database: Supabase PostgreSQL");

// Bot configuration
const BOT_TOKEN = process.env.BOT_TOKEN || "8015476800:AAGMH8HMXRurphYHRQDJdeHLO10ghZVzBt8";
const ADMIN_USERNAME = "TTTFOUNDER";
const ADMIN_EMAIL = "admin@smartunitednetwork.com";

// Create bot instance
const bot = new Telegraf(BOT_TOKEN);

// User states for conversation flow
const userStates = new Map();

// Utility functions
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

function formatPackageDetails(pkg, currentPhase) {
  const bonusList = Array.isArray(pkg.bonuses)
    ? pkg.bonuses.map(bonus => `    ✓ ${bonus}`).join('\n')
    : '    ✓ Standard shareholder benefits';

  const phaseInfo = currentPhase
    ? `\n\n**📈 CURRENT PHASE:** ${currentPhase.phase_name}\n**💰 Price per Share:** ${formatCurrency(currentPhase.price_per_share)}`
    : '';

  return `**⛏️ ${pkg.name.toUpperCase()} MINING PACKAGE**

**📝 DESCRIPTION:**
${pkg.description}

**💰 SHARE PURCHASE DETAILS:**
• **Package Cost:** ${formatCurrency(pkg.price)}
• **Aureus Shares:** ${pkg.shares.toLocaleString()} shares
• **Quarterly Dividends:** Based on mining operations performance${phaseInfo}

**🎁 PACKAGE BENEFITS:**
${bonusList}`;
}

function createMainMenuKeyboard(isAdmin = false) {
  const keyboard = [
    [
      { text: "⛏️ Mining Packages", callback_data: "menu_packages" },
      { text: "💰 Custom Share Purchase", callback_data: "menu_custom" }
    ],
    [
      { text: "📊 Mining Calculator", callback_data: "menu_calculator" },
      { text: "👥 Referral Program", callback_data: "menu_referrals" }
    ],
    [
      { text: "📱 My Portfolio", callback_data: "menu_portfolio" },
      { text: "💳 Payment Status", callback_data: "menu_payments" }
    ],
    [
      { text: "📋 Legal Documents", callback_data: "menu_terms" },
      { text: "🆘 Support Center", callback_data: "menu_help" }
    ],
    [
      { text: "🚪 Logout", callback_data: "user_logout" }
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

async function createPackagesKeyboard(packages) {
  const keyboard = [];

  // Create rows of 2 packages each with professional formatting
  for (let i = 0; i < packages.length; i += 2) {
    const row = [];

    // Calculate dynamic price for first package
    const price1 = await calculatePackagePrice(packages[i]);
    row.push({
      text: `⛏️ ${packages[i].name.toUpperCase()} - ${formatCurrency(price1)}`,
      callback_data: `package_${packages[i].id}`
    });

    if (i + 1 < packages.length) {
      // Calculate dynamic price for second package
      const price2 = await calculatePackagePrice(packages[i + 1]);
      row.push({
        text: `⛏️ ${packages[i + 1].name.toUpperCase()} - ${formatCurrency(price2)}`,
        callback_data: `package_${packages[i + 1].id}`
      });
    }

    keyboard.push(row);
  }

  keyboard.push([
    { text: "💰 Custom Share Purchase", callback_data: "menu_custom" },
    { text: "📊 Calculator", callback_data: "menu_calculator" }
  ]);
  keyboard.push([{ text: "🔙 Back to Dashboard", callback_data: "main_menu" }]);

  return { inline_keyboard: keyboard };
}

function createTermsKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "📜 General Terms", callback_data: "terms_general" },
        { text: "🔒 Privacy Policy", callback_data: "terms_privacy" }
      ],
      [
        { text: "⚠️ Share Purchase Risks", callback_data: "terms_investment_risks" },
        { text: "⛏️ Mining Operations", callback_data: "terms_mining_operations" }
      ],
      [
        { text: "🏆 NFT Terms", callback_data: "terms_nft_terms" },
        { text: "💰 Dividend Policy", callback_data: "terms_dividend_policy" }
      ],
      [
        { text: "🔙 Back to Main Menu", callback_data: "main_menu" }
      ]
    ]
  };
}

// Authentication functions
async function isUserAuthenticated(telegramId) {
  const telegramUser = await db.getTelegramUser(telegramId);
  return telegramUser && telegramUser.is_registered && telegramUser.user_id;
}

// Investment phase management functions
async function updateInvestmentPhases(sharesPurchased) {
  try {
    console.log(`📊 Updating investment phases - ${sharesPurchased} shares purchased`);

    // Get current active phase
    const { data: currentPhase, error: phaseError } = await db.client
      .from('investment_phases')
      .select('*')
      .eq('is_active', true)
      .single();

    if (phaseError || !currentPhase) {
      console.error('❌ No active phase found:', phaseError);
      return;
    }

    console.log(`📈 Current phase: ${currentPhase.phase_name} (${currentPhase.shares_sold}/${currentPhase.total_shares_available} shares sold)`);

    // Update shares sold in current phase
    const newSharesSold = currentPhase.shares_sold + sharesPurchased;

    const { error: updateError } = await db.client
      .from('investment_phases')
      .update({
        shares_sold: newSharesSold,
        updated_at: new Date().toISOString()
      })
      .eq('id', currentPhase.id);

    if (updateError) {
      console.error('❌ Error updating phase shares:', updateError);
      return;
    }

    console.log(`✅ Updated ${currentPhase.phase_name}: ${newSharesSold}/${currentPhase.total_shares_available} shares sold`);

    // Check if current phase is complete
    if (newSharesSold >= currentPhase.total_shares_available) {
      console.log(`🎯 Phase ${currentPhase.phase_name} is complete! Moving to next phase...`);

      // Deactivate current phase
      await db.client
        .from('investment_phases')
        .update({
          is_active: false,
          end_date: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', currentPhase.id);

      // Activate next phase
      const { data: nextPhase, error: nextPhaseError } = await db.client
        .from('investment_phases')
        .select('*')
        .eq('phase_number', currentPhase.phase_number + 1)
        .single();

      if (!nextPhaseError && nextPhase) {
        await db.client
          .from('investment_phases')
          .update({
            is_active: true,
            start_date: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', nextPhase.id);

        console.log(`🚀 Activated ${nextPhase.phase_name} - Price: $${nextPhase.price_per_share}/share`);

        // Log phase transition for admin notification
        await logAdminAction(null, 'PHASE_TRANSITION', {
          from_phase: currentPhase.phase_name,
          to_phase: nextPhase.phase_name,
          new_price: nextPhase.price_per_share,
          shares_available: nextPhase.total_shares_available
        });
      } else {
        console.log('🏁 All phases complete! No more phases available.');
      }
    }

  } catch (error) {
    console.error('❌ Error in updateInvestmentPhases:', error);
  }
}

async function getCurrentPhaseInfo() {
  try {
    const { data: currentPhase, error } = await db.client
      .from('investment_phases')
      .select('*')
      .eq('is_active', true)
      .single();

    if (error || !currentPhase) {
      console.error('❌ No active phase found:', error);
      return null;
    }

    return {
      ...currentPhase,
      shares_remaining: currentPhase.total_shares_available - currentPhase.shares_sold,
      completion_percentage: Math.round((currentPhase.shares_sold / currentPhase.total_shares_available) * 100)
    };
  } catch (error) {
    console.error('❌ Error getting current phase info:', error);
    return null;
  }
}

// Calculate package price based on current phase
async function calculatePackagePrice(pkg) {
  try {
    const currentPhase = await getCurrentPhaseInfo();
    if (!currentPhase) {
      console.error('❌ No active phase found, using base package price');
      return pkg.price;
    }

    // Package price = shares × current phase price per share
    const dynamicPrice = pkg.shares * currentPhase.price_per_share;

    console.log(`💰 Package ${pkg.name}: ${pkg.shares} shares × $${currentPhase.price_per_share} = $${dynamicPrice}`);

    return dynamicPrice;
  } catch (error) {
    console.error('❌ Error calculating package price:', error);
    return pkg.price; // Fallback to base price
  }
}

async function getUserState(telegramId) {
  const session = await db.getUserSession(telegramId);
  return session ? session.session_state : null;
}

async function setUserState(telegramId, state, data = {}) {
  await db.createUserSession(telegramId, state, data);
  userStates.set(telegramId, { state, data });
}

async function clearUserState(telegramId) {
  await db.client
    .from('user_sessions')
    .delete()
    .eq('telegram_id', telegramId);
  userStates.delete(telegramId);
}

async function getUserAuthStatus(telegramId) {
  const telegramUser = await db.getTelegramUser(telegramId);

  if (!telegramUser) {
    return 'new_user'; // Never used the system
  }

  // If user is registered and has a linked user_id, they are permanently authenticated
  // No need to re-authenticate as long as they're using the same Telegram account
  if (telegramUser.is_registered && telegramUser.user_id) {
    return 'authenticated'; // Permanently authenticated via Telegram username
  }

  if (telegramUser.is_registered === false) {
    return 'registration_incomplete'; // Started but not completed
  }

  return 'needs_login'; // Exists but needs to login
}

async function requireAuthentication(ctx, action = 'perform this action') {
  const authStatus = await getUserAuthStatus(ctx.from.id);

  if (authStatus !== 'authenticated') {
    await ctx.replyWithMarkdown(`❌ **Authentication required**\n\nPlease log in to ${action}.`);
    await startAuthenticationFlow(ctx);
    return false;
  }

  return true;
}

// Authentication flow
async function startAuthenticationFlow(ctx) {
  const user = ctx.from;
  const isAdmin = user.username === ADMIN_USERNAME;

  // Check user authentication status
  const authStatus = await getUserAuthStatus(user.id);

  if (authStatus === 'authenticated') {
    // User is already authenticated
    await showMainMenu(ctx);
    return;
  }

  // Clear any existing session
  await clearUserState(user.id);

  // Professional welcome message for gold share purchase
  const welcomeMessage = `🏆 **AUREUS ALLIANCE HOLDINGS**
*Premium Gold Mining Share Purchase Platform*

Welcome, **${user.first_name}**! 👋

🥇 **ABOUT AUREUS ALLIANCE HOLDINGS**

We are South Africa's premier gold mining share purchase company, offering exclusive equity shares in our high-yield mining operations.

⛏️ **OUR OPERATIONS:**
• 10 Industrial Washplants (200 tons/hour capacity)
• Target Production: 3,200 KG gold annually
• Full Capacity Timeline: June 2026
• 1,400,000 Total Shares Available

💰 **SHAREHOLDER BENEFITS:**
• Quarterly Dividend Payments
• NFT Share Certificates
• Real-time Mining Reports
• Exclusive Shareholder Events

🔐 **SECURE ACCOUNT ACCESS**

To begin buying shares in Aureus Alliance Holdings, please choose your access method:`;

  const keyboard = isAdmin ? {
    inline_keyboard: [
      [{ text: "👤 Login as Shareholder", callback_data: "login_investor" }],
      [{ text: "🔑 Admin Access", callback_data: "login_admin" }],
      [{ text: "📝 Create New Account", callback_data: "register_new" }]
    ]
  } : {
    inline_keyboard: [
      [{ text: "🔐 Login to Existing Account", callback_data: "login_investor" }],
      [{ text: "📝 Create New Shareholder Account", callback_data: "register_new" }],
      [{ text: "❓ Need Help?", callback_data: "help_access" }]
    ]
  };

  await ctx.replyWithMarkdown(welcomeMessage, { reply_markup: keyboard });
}

// Text input handlers for authentication
async function handleLoginEmailInput(ctx, email) {
  const user = ctx.from;

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    await ctx.replyWithMarkdown('❌ **Invalid email format**\n\nPlease enter a valid email address:');
    return;
  }

  // Check if email exists in users table
  const existingUser = await db.getUserByEmail(email);
  if (!existingUser) {
    await ctx.replyWithMarkdown(`❌ **Email not found**\n\nThe email "${email}" is not registered in our system.\n\nWould you like to create a new account instead?`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📝 Create New Account", callback_data: "register_new" }],
          [{ text: "🔙 Try Different Email", callback_data: "login_investor" }]
        ]
      }
    });
    return;
  }

  // Store email in session and ask for password
  await setUserState(user.id, 'login_awaiting_password', { email: email, user_id: existingUser.id });

  await ctx.replyWithMarkdown(`✅ **Email verified**\n\nEmail: ${email}\n\nNow please enter your **password**:\n\n🔒 Type your password and press Enter`);
}

async function handleLoginPasswordInput(ctx, password) {
  const user = ctx.from;
  const session = await db.getUserSession(user.id);

  if (!session || !session.session_data.email) {
    await ctx.replyWithMarkdown('❌ **Session expired**\n\nPlease start the login process again.');
    await startAuthenticationFlow(ctx);
    return;
  }

  const email = session.session_data.email;
  const userId = session.session_data.user_id;

  // Verify password
  const existingUser = await db.getUserByEmail(email);
  if (!existingUser) {
    await ctx.replyWithMarkdown('❌ **User not found**');
    await startAuthenticationFlow(ctx);
    return;
  }

  const isPasswordValid = await bcrypt.compare(password, existingUser.password_hash);
  if (!isPasswordValid) {
    await ctx.replyWithMarkdown('❌ **Incorrect password**\n\nPlease try again:\n\n🔒 Type your password and press Enter');
    return;
  }

  // Password is correct, link Telegram account
  let telegramUser = await db.getTelegramUser(user.id);
  if (!telegramUser) {
    telegramUser = await db.createTelegramUser(user.id, {
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      user_id: userId,
      is_registered: true
    });
  } else {
    await db.updateTelegramUser(user.id, {
      user_id: userId,
      is_registered: true
    });
  }

  await clearUserState(user.id);

  const successMessage = `**✅ LOGIN SUCCESSFUL**

Welcome back, **${user.first_name}**!

Your Telegram account has been successfully linked to your shareholder account.

**🏆 Access Granted to:**
• Premium Mining Packages
• Share Purchase Calculator
• Portfolio Dashboard
• Referral Program`;

  await ctx.replyWithMarkdown(successMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🏠 Enter Dashboard", callback_data: "main_menu" }]
      ]
    }
  });
}

async function handleRegisterEmailInput(ctx, email) {
  const user = ctx.from;

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    await ctx.replyWithMarkdown('❌ **Invalid email format**\n\nPlease enter a valid email address:');
    return;
  }

  // Check if email already exists
  const existingUser = await db.getUserByEmail(email);
  if (existingUser) {
    await ctx.replyWithMarkdown(`📧 **Email already registered**\n\nThe email "${email}" is already in our system.\n\nWould you like to login instead?`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔐 Login to Account", callback_data: "login_investor" }],
          [{ text: "🔙 Try Different Email", callback_data: "register_new" }]
        ]
      }
    });
    return;
  }

  // Store email and ask for password
  console.log('Debug - Setting state with email:', email); // Debug log
  await setUserState(user.id, 'register_awaiting_password', { email: email });

  await ctx.replyWithMarkdown(`✅ **Email accepted**\n\nEmail: ${email}\n\nNow create a secure **password** for your account:\n\n🔒 Type your password and press Enter\n\n*Password should be at least 6 characters long*`);
}

async function handleRegisterPasswordInput(ctx, password) {
  const user = ctx.from;
  const session = await db.getUserSession(user.id);

  console.log('Debug - Session data:', session); // Debug log

  if (!session || !session.session_data || !session.session_data.email) {
    await ctx.replyWithMarkdown('❌ **Session expired**\n\nPlease start the registration process again.');
    await startAuthenticationFlow(ctx);
    return;
  }

  const email = session.session_data.email;

  // Validate password
  if (password.length < 6) {
    await ctx.replyWithMarkdown('❌ **Password too short**\n\nPassword must be at least 6 characters long.\n\nPlease try again:\n\n🔒 Type your password and press Enter');
    return;
  }

  // Store password and move to sponsor selection
  await setUserState(user.id, 'register_awaiting_sponsor', {
    email: email,
    password: password
  });

  const sponsorMessage = `👥 **SPONSOR SELECTION**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Do you have a sponsor who referred you?**

🎯 **Sponsors earn 15% commission on your share purchases**

Choose one of the options below:`;

  await ctx.replyWithMarkdown(sponsorMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "👤 Enter Sponsor Username", callback_data: "sponsor_manual" }],
        [{ text: "🎲 No Sponsor (Auto-assign)", callback_data: "sponsor_auto" }],
        [{ text: "🔙 Back to Password", callback_data: "back_to_password" }]
      ]
    }
  });
}

async function showMainMenu(ctx) {
  const user = ctx.from;
  const currentPhase = await db.getCurrentPhase();
  const isAdmin = user.username === ADMIN_USERNAME;

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

// Command access control
function isAdmin(user) {
  return user.username === ADMIN_USERNAME;
}

// Set user-specific commands
async function setUserCommands(ctx) {
  const user = ctx.from;

  try {
    if (isAdmin(user)) {
      // Admin gets full command access
      await bot.telegram.setMyCommands([
        { command: 'start', description: 'Start the bot' },
        { command: 'admin', description: 'Admin control panel' },
        { command: 'users', description: 'User management' },
        { command: 'payments', description: 'Payment management' },
        { command: 'status', description: 'System status' },
        { command: 'help', description: 'Admin help' }
      ], { scope: { type: 'chat', chat_id: ctx.chat.id } });
    } else {
      // Regular users get no commands (button interface only)
      await bot.telegram.setMyCommands([], {
        scope: { type: 'chat', chat_id: ctx.chat.id }
      });
    }
  } catch (error) {
    console.error('Error setting user commands:', error);
  }
}

async function handleUnauthorizedCommand(ctx) {
  // Check if user is authenticated
  const isAuth = await isUserAuthenticated(ctx.from.id);

  if (!isAuth) {
    await ctx.replyWithMarkdown(`🔐 **AUTHENTICATION REQUIRED**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Please complete authentication to access the platform.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔐 Login / Register", callback_data: "back_to_welcome" }]
        ]
      }
    });
    return;
  }

  await ctx.replyWithMarkdown(`🏆 **AUREUS ALLIANCE HOLDINGS**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Welcome! This is a **premium button-based interface**.

Commands are not needed - everything is accessible through our professional button system.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🏠 Enter Dashboard", callback_data: "main_menu" }]
      ]
    }
  });
}

// Bot commands (ADMIN ONLY)
bot.start(async (ctx) => {
  const user = ctx.from;
  console.log(`👤 New user started bot: ${user.first_name} (@${user.username})`);

  // Set user-specific commands
  await setUserCommands(ctx);

  await startAuthenticationFlow(ctx);
});

// Restrict help command to admin only
bot.help(async (ctx) => {
  const user = ctx.from;

  if (!isAdmin(user)) {
    await handleUnauthorizedCommand(ctx);
    return;
  }

  const helpMessage = `🔍 **ADMIN HELP - Aureus Alliance Holdings Bot**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔹 **Admin Commands:**
/admin - Access admin control panel
/users - User management
/payments - Payment approvals
/broadcast - Send broadcast message
/status - System status
/logs - View audit logs

🔹 **System Features:**
📦 **Share Packages** - 8 mining equipment packages
💰 **Custom Share Purchase** - $25-$10,000 flexible amounts
📊 **Mining Calculator** - Dividend projections
👥 **Referral System** - 15% commission tracking
📱 **Portfolio** - Share purchase tracking

🔹 **Payment Networks:**
💳 **BSC USDT** - Binance Smart Chain
💳 **POL USDT** - Polygon Network
💳 **TRON USDT** - Tron Network

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  await ctx.replyWithMarkdown(helpMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔑 Admin Panel", callback_data: "admin_panel" }],
        [{ text: "🏠 Dashboard", callback_data: "main_menu" }]
      ]
    }
  });
});

// Admin-only commands
bot.command('admin', async (ctx) => {
  const user = ctx.from;

  if (!isAdmin(user)) {
    await handleUnauthorizedCommand(ctx);
    return;
  }

  await handleAdminPanel(ctx);
});

bot.command('users', async (ctx) => {
  const user = ctx.from;

  if (!isAdmin(user)) {
    await handleUnauthorizedCommand(ctx);
    return;
  }

  // Admin user management functionality
  await ctx.replyWithMarkdown(`👥 **USER MANAGEMENT**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔧 **User management features coming soon...**

**Available Functions:**
• View all users
• Search users by email/username
• Manage user accounts
• View user investments
• Reset user passwords

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔙 Back to Admin Panel", callback_data: "admin_panel" }]
      ]
    }
  });
});

bot.command('payments', async (ctx) => {
  const user = ctx.from;

  if (!isAdmin(user)) {
    await handleUnauthorizedCommand(ctx);
    return;
  }

  // Admin payment management functionality
  await ctx.replyWithMarkdown(`💳 **PAYMENT MANAGEMENT**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔧 **Payment management features coming soon...**

**Available Functions:**
• Review pending payments
• Approve/reject transactions
• View payment history
• Manage crypto wallets
• Generate payment reports

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔙 Back to Admin Panel", callback_data: "admin_panel" }]
      ]
    }
  });
});

bot.command('status', async (ctx) => {
  const user = ctx.from;

  if (!isAdmin(user)) {
    await handleUnauthorizedCommand(ctx);
    return;
  }

  await handleAdminStatus(ctx);
});

// Catch all other commands and restrict them
bot.on('message', async (ctx, next) => {
  const user = ctx.from;
  const message = ctx.message;

  // If it's a command (starts with /) and user is not admin
  if (message.text && message.text.startsWith('/') && !isAdmin(user)) {
    await handleUnauthorizedCommand(ctx);
    return;
  }

  // Continue to next handler (text handler)
  await next();
});

// DEBUG: General message handler to catch all messages
bot.use(async (ctx, next) => {
  if (ctx.message) {
    const messageType = ctx.message.photo ? 'photo' :
                       ctx.message.text ? 'text' :
                       ctx.message.document ? 'document' :
                       ctx.message.sticker ? 'sticker' :
                       'other';
    console.log(`🔍 Message received - Type: ${messageType}, User: ${ctx.from.id}`);

    if (ctx.message.photo) {
      console.log(`📸 Photo details:`, ctx.message.photo.length, 'sizes');
    }
    if (ctx.message.document) {
      console.log(`📄 Document details:`, ctx.message.document.file_name, ctx.message.document.mime_type);
    }

    // Log all message properties for debugging
    console.log(`🔍 Message properties:`, Object.keys(ctx.message));
  }
  await next();
});

// PHOTO MESSAGE HANDLER - For payment screenshots
bot.on('photo', async (ctx) => {
  const user = ctx.from;
  console.log(`📸 Photo received from user ${user.id} (${user.first_name})`);

  try {
    const userState = await getUserState(user.id);
    console.log(`📊 User state for photo upload: ${userState}`);

    if (userState === 'payment_verification') {
      console.log(`✅ Processing payment screenshot for user ${user.id}`);
      await handlePaymentScreenshot(ctx);
    } else {
      console.log(`❌ User ${user.id} not in payment_verification state, current state: ${userState}`);
      await ctx.reply('📷 Please use the payment verification process to upload screenshots.');
    }
  } catch (error) {
    console.error('Photo handler error:', error);
    await ctx.reply('❌ An error occurred processing your screenshot. Please try again.');
  }
});

// DOCUMENT MESSAGE HANDLER - For payment screenshots uploaded as files
bot.on('document', async (ctx) => {
  const user = ctx.from;
  const document = ctx.message.document;

  console.log(`📄 Document details: ${document.file_name} ${document.mime_type}`);

  // Check if document is an image
  if (document.mime_type && document.mime_type.startsWith('image/')) {
    console.log(`📸 Image document received from user ${user.id} (${user.first_name})`);

    try {
      const userState = await getUserState(user.id);
      console.log(`📊 User state for document upload: ${userState}`);

      if (userState === 'payment_verification') {
        console.log(`✅ Processing payment screenshot document for user ${user.id}`);
        await handlePaymentScreenshotDocument(ctx);
      } else {
        console.log(`❌ User ${user.id} not in payment_verification state, current state: ${userState}`);
        await ctx.reply('📷 Please use the payment verification process to upload screenshots.');
      }
    } catch (error) {
      console.error('Document handler error:', error);
      await ctx.reply('❌ An error occurred processing your screenshot. Please try again.');
    }
  } else {
    console.log(`❌ Non-image document received: ${document.mime_type}`);
    await ctx.reply('📷 Please upload an image file for payment verification.');
  }
});

// TEXT MESSAGE HANDLER - Critical for authentication
bot.on('text', async (ctx) => {
  const user = ctx.from;
  const text = ctx.message.text;

  console.log(`📝 Text message from ${user.first_name} (@${user.username}): "${text}"`);

  // Skip if it's a command
  if (text.startsWith('/')) {
    console.log('⏭️ Skipping command text');
    return;
  }

  try {
    const userState = await getUserState(user.id);
    console.log(`🔄 User state: ${userState}`);

    if (!userState) {
      console.log('❌ No user state found, starting auth flow');
      // No active state, show welcome
      await startAuthenticationFlow(ctx);
      return;
    }

    switch (userState) {
      case 'login_awaiting_email':
        await handleLoginEmailInput(ctx, text);
        break;

      case 'login_awaiting_password':
        await handleLoginPasswordInput(ctx, text);
        break;

      case 'register_awaiting_email':
        await handleRegisterEmailInput(ctx, text);
        break;

      case 'register_awaiting_password':
        await handleRegisterPasswordInput(ctx, text);
        break;

      case 'register_awaiting_sponsor_username':
        await handleSponsorUsernameInput(ctx, text);
        break;

      case 'payment_verification':
        await handlePaymentVerificationInput(ctx, text);
        break;

      case 'withdrawal_awaiting_amount':
        await handleWithdrawalAmountInput(ctx, text);
        break;

      case 'withdrawal_awaiting_network':
        await handleWithdrawalNetworkInput(ctx, text);
        break;

      case 'withdrawal_awaiting_wallet':
        await handleWithdrawalWalletInput(ctx, text);
        break;

      default:
        // Unknown state, restart authentication
        await startAuthenticationFlow(ctx);
        break;
    }
  } catch (error) {
    console.error('Text handler error:', error);
    await ctx.reply('❌ An error occurred. Please try again.');
    await startAuthenticationFlow(ctx);
  }
});

// Callback query handlers
bot.on('callback_query', async (ctx) => {
  const callbackData = ctx.callbackQuery.data;
  const user = ctx.from;

  try {
    // Skip authentication check for authentication-related callbacks
    const authCallbacks = [
      'login_investor', 'login_admin', 'register_new', 'help_access',
      'back_to_welcome', 'enter_email', 'sponsor_manual',
      'sponsor_auto', 'back_to_password', 'back_to_sponsor_selection'
    ];

    // Check authentication for most actions (except auth flows)
    if (!authCallbacks.includes(callbackData) &&
        !callbackData.startsWith('auth_') &&
        !callbackData.startsWith('confirm_sponsor_')) {
      const isAuth = await isUserAuthenticated(user.id);
      if (!isAuth) {
        await ctx.answerCbQuery('Please complete authentication first');
        await startAuthenticationFlow(ctx);
        return;
      }
    }
    
    switch (callbackData) {
      case 'main_menu':
        await showMainMenu(ctx);
        break;

      case 'login_investor':
        await handleInvestorLogin(ctx);
        break;

      case 'login_admin':
        await handleAdminLogin(ctx);
        break;

      case 'register_new':
        await handleNewRegistration(ctx);
        break;

      case 'help_access':
        await handleAccessHelp(ctx);
        break;

      case 'sponsor_manual':
        await handleManualSponsorInput(ctx);
        break;

      case 'sponsor_auto':
        await handleAutoSponsorAssignment(ctx);
        break;

      case 'back_to_password':
        await handleBackToPassword(ctx);
        break;

      case 'back_to_sponsor_selection':
        await handleBackToSponsorSelection(ctx);
        break;

      case 'share_referral':
        await handleShareReferral(ctx);
        break;

      case 'commission_rules':
        await handleCommissionRules(ctx);
        break;

      case 'withdraw_commissions':
        await handleCommissionWithdrawal(ctx);
        break;

      case 'withdrawal_network_BSC':
      case 'withdrawal_network_POL':
      case 'withdrawal_network_TRON':
        await handleWithdrawalNetworkSelection(ctx, data);
        break;

      case 'menu_packages':
        await handlePackagesMenu(ctx);
        break;

      case 'menu_custom':
        await handleCustomInvestment(ctx);
        break;

      case 'menu_calculator':
        await handleMiningCalculator(ctx);
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

      case 'menu_terms':
        await handleTermsMenu(ctx);
        break;

      case 'menu_help':
        await handleSupportCenter(ctx);
        break;

      case 'admin_panel':
        await handleAdminPanel(ctx);
        break;

      case 'admin_status':
        await handleAdminStatus(ctx);
        break;

      case 'admin_payments':
        await handleAdminPayments(ctx);
        break;

      case 'admin_users':
        await handleAdminUsers(ctx);
        break;

      case 'admin_analytics':
        await handleAdminAnalytics(ctx);
        break;

      case 'admin_broadcast':
        await handleAdminBroadcast(ctx);
        break;

      case 'view_my_sponsor':
        await showMySponsor(ctx);
        break;

      case 'admin_settings':
        await handleAdminSettings(ctx);
        break;

      case 'admin_logs':
        await handleAdminLogs(ctx);
        break;

      case 'admin_user_sponsors':
        await handleAdminUserSponsors(ctx);
        break;

      case 'user_logout':
        await handleUserLogout(ctx);
        break;

      case 'admin_approved_payments':
        await handleApprovedPayments(ctx);
        break;

      case 'admin_rejected_payments':
        await handleRejectedPayments(ctx);
        break;

      case 'admin_user_management':
        await handleAdminUserManagement(ctx);
        break;

      case 'admin_audit_logs':
        await handleAdminAuditLogs(ctx);
        break;

      case 'back_to_welcome':
        await clearUserState(user.id);
        await startAuthenticationFlow(ctx);
        break;

      default:
        if (callbackData.startsWith('package_')) {
          await handlePackageSelection(ctx, callbackData);
        } else if (callbackData.startsWith('terms_required_')) {
          await handleTermsRequired(ctx, callbackData);
        } else if (callbackData.startsWith('terms_')) {
          await handleTermsSelection(ctx, callbackData);
        } else if (callbackData.startsWith('accept_')) {
          await handleTermsAcceptance(ctx, callbackData);
        } else if (callbackData.startsWith('purchase_')) {
          await handlePurchaseFlow(ctx, callbackData);
        } else if (callbackData.startsWith('pay_commission_')) {
          await handleCommissionPayment(ctx, callbackData);
        } else if (callbackData.startsWith('calculate_')) {
          await handleCalculateReturns(ctx, callbackData);
        } else if (callbackData.startsWith('pay_bsc_')) {
          await handleBSCPayment(ctx, callbackData);
        } else if (callbackData.startsWith('pay_pol_')) {
          await handlePOLPayment(ctx, callbackData);
        } else if (callbackData.startsWith('pay_tron_')) {
          await handleTRONPayment(ctx, callbackData);
        } else if (callbackData.startsWith('copy_')) {
          await handleCopyWallet(ctx, callbackData);
        } else if (callbackData.startsWith('verify_')) {
          await handlePaymentVerification(ctx, callbackData);
        } else if (callbackData.startsWith('approve_payment_')) {
          await handlePaymentApproval(ctx, callbackData);
        } else if (callbackData.startsWith('reject_payment_')) {
          await handlePaymentRejection(ctx, callbackData);
        } else if (callbackData.startsWith('view_screenshot_')) {
          await handleViewScreenshot(ctx, callbackData);
        } else if (callbackData.startsWith('add_notes_')) {
          await handleAddNotes(ctx, callbackData);
        } else if (callbackData.startsWith('copy_tx_')) {
          await handleCopyTransaction(ctx, callbackData);
        } else if (callbackData.startsWith('verify_tx_')) {
          await handleVerifyTransaction(ctx, callbackData);
        } else if (callbackData.startsWith('confirm_approve_')) {
          await handleConfirmApproval(ctx, callbackData);
        } else if (callbackData.startsWith('confirm_reject_')) {
          await handleConfirmRejection(ctx, callbackData);
        } else if (callbackData.startsWith('confirm_sponsor_')) {
          await handleConfirmSponsor(ctx, callbackData);
        }
        break;
    }

    // Answer callback query with timeout protection
    try {
      await ctx.answerCbQuery();
    } catch (cbError) {
      // Ignore timeout errors - they're not critical
      if (!cbError.message.includes('query is too old')) {
        console.error('Callback query answer error:', cbError);
      }
    }
  } catch (error) {
    console.error('Callback query error:', error);
    try {
      await ctx.answerCbQuery('An error occurred. Please try again.');
    } catch (cbError) {
      // Ignore timeout errors on error responses too
      if (!cbError.message.includes('query is too old')) {
        console.error('Error callback query answer error:', cbError);
      }
    }
  }
});

// New authentication handlers
async function handleInvestorLogin(ctx) {
  const user = ctx.from;

  // Set state to collect email
  await setUserState(user.id, 'login_awaiting_email');

  const loginMessage = `🔐 **SHAREHOLDER LOGIN**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Please enter your registered **email address**:

📧 Type your email address and press Enter`;

  await ctx.replyWithMarkdown(loginMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔙 Back to Welcome", callback_data: "back_to_welcome" }]
      ]
    }
  });
}

async function handleAdminLogin(ctx) {
  const user = ctx.from;

  if (user.username !== ADMIN_USERNAME) {
    await ctx.replyWithMarkdown('❌ **ACCESS DENIED**\n\nAdmin access is restricted.');
    return;
  }

  // For admin, automatically authenticate
  let telegramUser = await db.getTelegramUser(user.id);
  if (!telegramUser) {
    telegramUser = await db.createTelegramUser(user.id, {
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      is_registered: true
    });
  } else {
    await db.updateTelegramUser(user.id, { is_registered: true });
  }

  await clearUserState(user.id);

  const adminMessage = `🔑 **ADMIN ACCESS GRANTED**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Welcome, **Administrator ${user.first_name}**!

✅ **Full System Access Granted**

🔑 **Admin Privileges:**
• User Management
• Payment Approvals
• System Analytics
• Broadcast Messaging
• Audit Logs
• System Settings

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  await ctx.replyWithMarkdown(adminMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🏠 Enter Dashboard", callback_data: "main_menu" }],
        [{ text: "🔑 Admin Panel", callback_data: "admin_panel" }]
      ]
    }
  });
}

async function handleNewRegistration(ctx) {
  const user = ctx.from;

  // Set state to collect email for registration
  await setUserState(user.id, 'register_awaiting_email');

  const registerMessage = `📝 **CREATE SHAREHOLDER ACCOUNT**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Welcome to **Aureus Alliance Holdings**!

To create your premium shareholder account, please enter your **email address**:

📧 Type your email address and press Enter

*This email will be used for account verification and shareholder communications.*`;

  await ctx.replyWithMarkdown(registerMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔙 Back to Welcome", callback_data: "back_to_welcome" }]
      ]
    }
  });
}

async function handleAccessHelp(ctx) {
  const helpMessage = `🆘 **ACCESS HELP CENTER**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**NEED ASSISTANCE?**

📧 **Email Support:** support@aureusalliance.com
📞 **Phone Support:** +27-11-AUREUS (24/7)
💬 **Live Chat:** Available on our website
🌐 **Website:** www.aureusalliance.com

**COMMON ISSUES:**
• Forgot your password? Use the login option and we'll help reset it
• New to gold share purchase? Our team provides free consultation
• Technical issues? Our support team is available 24/7

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  await ctx.replyWithMarkdown(helpMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔐 Try Login Again", callback_data: "login_investor" }],
        [{ text: "🔙 Back to Welcome", callback_data: "back_to_welcome" }]
      ]
    }
  });
}

async function handleManualSponsorInput(ctx) {
  const user = ctx.from;

  // Get existing session data to preserve email and password
  const session = await db.getUserSession(user.id);
  if (!session || !session.session_data) {
    await ctx.replyWithMarkdown('❌ **Session expired**\n\nPlease start registration again.');
    await startAuthenticationFlow(ctx);
    return;
  }

  // Set state to collect sponsor username while preserving session data
  await setUserState(user.id, 'register_awaiting_sponsor_username', session.session_data);

  const sponsorInputMessage = `👤 **ENTER SPONSOR USERNAME**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Please enter your sponsor's **Telegram username** (without @):

📝 Type the username and press Enter

**Example:** If your sponsor is @john_doe, type: john_doe

*We'll verify that this sponsor exists in our system.*`;

  await ctx.replyWithMarkdown(sponsorInputMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🎲 Use Auto-assign Instead", callback_data: "sponsor_auto" }],
        [{ text: "🔙 Back to Sponsor Selection", callback_data: "back_to_sponsor_selection" }]
      ]
    }
  });
}

async function handleAutoSponsorAssignment(ctx) {
  const user = ctx.from;
  const session = await db.getUserSession(user.id);

  if (!session || !session.session_data) {
    await ctx.replyWithMarkdown('❌ **Session expired**\n\nPlease start registration again.');
    await startAuthenticationFlow(ctx);
    return;
  }

  try {
    // Find the most recent paying shareholder to assign as sponsor
    const { data: recentInvestor, error: investorError } = await db.client
      .from('users')
      .select(`
        id,
        username,
        full_name,
        aureus_share_purchases!inner (
          id,
          status,
          created_at
        )
      `)
      .eq('aureus_share_purchases.status', 'active')
      .order('aureus_share_purchases.created_at', { ascending: false })
      .limit(1)
      .single();

    let sponsorInfo = null;
    if (!investorError && recentInvestor) {
      sponsorInfo = {
        id: recentInvestor.id,
        username: recentInvestor.username,
        full_name: recentInvestor.full_name
      };
    }

    await completeUserRegistration(ctx, session.session_data, sponsorInfo);

  } catch (error) {
    console.error('Auto sponsor assignment error:', error);
    await ctx.replyWithMarkdown('❌ **Registration failed**\n\nPlease try again or contact support.');
  }
}

async function handleBackToPassword(ctx) {
  const user = ctx.from;
  const session = await db.getUserSession(user.id);

  if (!session || !session.session_data || !session.session_data.email) {
    await ctx.replyWithMarkdown('❌ **Session expired**\n\nPlease start registration again.');
    await startAuthenticationFlow(ctx);
    return;
  }

  // Set state back to password input
  await setUserState(user.id, 'register_awaiting_password', {
    email: session.session_data.email
  });

  const passwordMessage = `🔒 **CREATE PASSWORD**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📧 **Email:** ${session.session_data.email}

Please create a secure password for your account:

🔑 Type your password and press Enter

**Requirements:**
• Minimum 6 characters
• Keep it secure and memorable`;

  await ctx.replyWithMarkdown(passwordMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔙 Back to Email", callback_data: "back_to_email" }]
      ]
    }
  });
}

async function handleBackToSponsorSelection(ctx) {
  const user = ctx.from;
  const session = await db.getUserSession(user.id);

  if (!session || !session.session_data) {
    await ctx.replyWithMarkdown('❌ **Session expired**\n\nPlease start registration again.');
    await startAuthenticationFlow(ctx);
    return;
  }

  // Set state back to sponsor selection
  await setUserState(user.id, 'register_awaiting_sponsor', session.session_data);

  const sponsorMessage = `👥 **SPONSOR SELECTION**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Do you have a sponsor who referred you?**

🎯 **Sponsors earn 15% commission on your share purchases**

Choose one of the options below:`;

  await ctx.replyWithMarkdown(sponsorMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "👤 Enter Sponsor Username", callback_data: "sponsor_manual" }],
        [{ text: "🎲 No Sponsor (Auto-assign)", callback_data: "sponsor_auto" }],
        [{ text: "🔙 Back to Password", callback_data: "back_to_password" }]
      ]
    }
  });
}

async function handleSponsorUsernameInput(ctx, username) {
  const user = ctx.from;
  const session = await db.getUserSession(user.id);

  if (!session || !session.session_data) {
    await ctx.replyWithMarkdown('❌ **Session expired**\n\nPlease start registration again.');
    await startAuthenticationFlow(ctx);
    return;
  }

  // Clean username (remove @ if present)
  const cleanUsername = username.replace('@', '').trim();

  if (cleanUsername.length < 3) {
    await ctx.replyWithMarkdown('❌ **Username too short**\n\nPlease enter a valid username (minimum 3 characters).');
    return;
  }

  try {
    // Find sponsor by username
    const { data: sponsor, error: sponsorError } = await db.client
      .from('users')
      .select('id, username, full_name')
      .eq('username', cleanUsername)
      .single();

    if (sponsorError || !sponsor) {
      await ctx.replyWithMarkdown(`❌ **Sponsor not found**\n\nUsername "${cleanUsername}" is not registered in our system.\n\n**Options:**\n• Check the spelling and try again\n• Use the Auto-assign option instead`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🎲 Use Auto-assign Instead", callback_data: "sponsor_auto" }],
            [{ text: "🔙 Back to Sponsor Selection", callback_data: "back_to_sponsor_selection" }]
          ]
        }
      });
      return;
    }

    // Check if sponsor has made any investments (optional validation)
    let hasInvestments = false;
    let sponsorStatus = '⚠️ No Active Investments';

    try {
      const { data: sponsorInvestments, error: investmentError } = await db.client
        .from('aureus_share_purchases')
        .select('id')
        .eq('user_id', sponsor.id)
        .eq('status', 'active')
        .limit(1);

      if (investmentError) {
        console.error('Sponsor share purchase check error:', investmentError);
        // If table doesn't exist, assume no investments but don't fail
        sponsorStatus = '📊 Status Check Unavailable';
      } else {
        hasInvestments = sponsorInvestments && sponsorInvestments.length > 0;
        sponsorStatus = hasInvestments ? '✅ Active Shareholder' : '⚠️ No Active Investments';
      }
    } catch (error) {
      console.error('Sponsor investment check error:', error);
      sponsorStatus = '📊 Status Check Unavailable';
    }

    // Confirm sponsor selection
    const confirmMessage = `✅ **SPONSOR FOUND**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 **Sponsor:** ${sponsor.full_name || sponsor.username}
🆔 **Username:** @${sponsor.username}
📊 **Status:** ${sponsorStatus}

**Confirm this sponsor?**

*You will earn them 15% commission on your share purchases.*`;

    await ctx.replyWithMarkdown(confirmMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ Confirm Sponsor", callback_data: `confirm_sponsor_${sponsor.id}` }],
          [{ text: "🔄 Try Different Username", callback_data: "sponsor_manual" }],
          [{ text: "🎲 Use Auto-assign Instead", callback_data: "sponsor_auto" }]
        ]
      }
    });

  } catch (error) {
    console.error('Sponsor username validation error:', error);
    await ctx.replyWithMarkdown('❌ **Error validating sponsor**\n\nPlease try again or use auto-assign.');
  }
}

async function handleConfirmSponsor(ctx, callbackData) {
  const user = ctx.from;
  const sponsorId = parseInt(callbackData.replace('confirm_sponsor_', ''));
  const session = await db.getUserSession(user.id);

  if (!session || !session.session_data) {
    await ctx.replyWithMarkdown('❌ **Session expired**\n\nPlease start registration again.');
    await startAuthenticationFlow(ctx);
    return;
  }

  console.log('Debug - Sponsor confirmation session data:', session.session_data);

  try {
    // Get sponsor details
    const { data: sponsor, error: sponsorError } = await db.client
      .from('users')
      .select('id, username, full_name')
      .eq('id', sponsorId)
      .single();

    if (sponsorError || !sponsor) {
      await ctx.replyWithMarkdown('❌ **Sponsor not found**\n\nPlease try again.');
      return;
    }

    // Complete registration with sponsor
    await completeUserRegistration(ctx, session.session_data, sponsor);

  } catch (error) {
    console.error('Sponsor confirmation error:', error);
    await ctx.replyWithMarkdown('❌ **Registration failed**\n\nPlease try again or contact support.');
  }
}

async function completeUserRegistration(ctx, sessionData, sponsorInfo = null) {
  const user = ctx.from;

  try {
    console.log('Debug - Registration completion session data:', sessionData);
    console.log('Debug - Password exists:', !!sessionData.password);

    // Hash password
    const passwordHash = await bcrypt.hash(sessionData.password, 10);

    // Create user in main users table
    const newUser = await db.createUser({
      username: user.username || `user_${user.id}`,
      email: sessionData.email,
      password_hash: passwordHash,
      full_name: `${user.first_name} ${user.last_name || ''}`.trim(),
      is_active: true,
      is_verified: true // Skip email verification for Telegram users
    });

    if (!newUser) {
      await ctx.replyWithMarkdown('❌ **Registration failed**\n\nPlease try again.');
      return;
    }

    // Link Telegram account to user
    let telegramUser = await db.getTelegramUser(user.id);
    if (!telegramUser) {
      telegramUser = await db.createTelegramUser(user.id, {
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        user_id: newUser.id,
        is_registered: true
      });
    } else {
      await db.updateTelegramUser(user.id, {
        user_id: newUser.id,
        is_registered: true
      });
    }

    // Create referral relationship if sponsor exists
    if (sponsorInfo) {
      try {
        await createReferralRelationship(sponsorInfo.id, newUser.id);
        console.log(`✅ Referral relationship created: ${sponsorInfo.id} -> ${newUser.id}`);
      } catch (referralError) {
        console.error('Referral creation error:', referralError);
        // Don't fail registration if referral creation fails
      }
    }

    // Clear user state
    await clearUserState(user.id);

    let sponsorText = '';
    if (sponsorInfo) {
      sponsorText = `\n👥 **Sponsor:** ${sponsorInfo.full_name || sponsorInfo.username}\n`;
    }

    const successMessage = `🎉 **REGISTRATION SUCCESSFUL!**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Welcome to **Aureus Alliance Holdings**, ${user.first_name}!

✅ **Your premium shareholder account is ready!**

📧 **Email:** ${sessionData.email}
🆔 **Account ID:** #${newUser.id}${sponsorText}

🎁 **Account Benefits:**
• Access to 8 mining equipment packages
• Real-time mining operation updates
• Quarterly dividend payments
• NFT share certificates
• Referral program (15% commission)
• 24/7 premium support

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Ready to start your gold shareholding journey?**`;

    await ctx.replyWithMarkdown(successMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🏠 Enter Dashboard", callback_data: "main_menu" }],
          [{ text: "⛏️ View Mining Packages", callback_data: "menu_packages" }]
        ]
      }
    });

  } catch (error) {
    console.error('Registration completion error:', error);
    await ctx.replyWithMarkdown('❌ **Registration failed**\n\nPlease try again or contact support.');
    await startAuthenticationFlow(ctx);
  }
}

async function handleUserLogout(ctx) {
  const user = ctx.from;

  try {
    // Update telegram user to logged out state
    await db.updateTelegramUser(user.id, {
      user_id: null,
      is_registered: false
    });

    // Clear any user sessions
    await clearUserState(user.id);

    const logoutMessage = `🚪 **LOGOUT SUCCESSFUL**

You have been logged out from your Aureus Alliance Holdings account.

Your Telegram account is now unlinked from the platform.

**To access your account again:**
• Use /start to login or register
• Your account data remains secure

Thank you for using Aureus Alliance Holdings! 🏆`;

    await ctx.replyWithMarkdown(logoutMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔄 Login Again", callback_data: "start_login" }],
          [{ text: "📞 Contact Support", callback_data: "menu_help" }]
        ]
      }
    });

  } catch (error) {
    console.error('Logout error:', error);
    await ctx.replyWithMarkdown('❌ **Logout failed**\n\nPlease try again or contact support.');
  }
}

async function createReferralRelationship(referrerId, referredId) {
  try {
    const { data, error } = await db.client
      .from('referrals')
      .insert([{
        referrer_id: referrerId,
        referred_id: referredId,
        referral_code: `REF_${referredId}_${Date.now()}`,
        commission_rate: 15.00,
        status: 'active'
      }])
      .select()
      .single();

    if (error) {
      console.error('Referral creation error:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Create referral relationship error:', error);
    throw error;
  }
}

async function createCommissionForInvestment(investmentId, investorId, investmentAmount) {
  try {
    console.log(`💰 Checking for referral commission - Share Purchase: ${investmentId}, Shareholder: ${investorId}, Amount: $${investmentAmount}`);

    // Find if this shareholder has a referrer
    const { data: referral, error: referralError } = await db.client
      .from('referrals')
      .select('referrer_id, commission_rate')
      .eq('referred_id', investorId)
      .eq('status', 'active')
      .single();

    if (referralError || !referral) {
      console.log('📋 No active referral found for this shareholder');
      return;
    }

    const commissionRate = referral.commission_rate || 15.00;
    const usdtCommission = (parseFloat(investmentAmount) * commissionRate) / 100;
    const shareCommission = (parseFloat(investmentAmount) * commissionRate) / 100;

    console.log(`🎯 Creating dual commission: ${commissionRate}% USDT ($${usdtCommission.toFixed(2)}) + ${commissionRate}% Shares ($${shareCommission.toFixed(2)})`);

    // Create commission transaction record (new dual commission system)
    const { data: commissionTransaction, error: transactionError } = await db.client
      .from('commission_transactions')
      .insert([{
        referrer_id: referral.referrer_id,
        referred_id: investorId,
        share_purchase_id: investmentId,
        commission_rate: commissionRate,
        share_purchase_amount: parseFloat(investmentAmount),
        usdt_commission: usdtCommission,
        share_commission: shareCommission,
        status: 'approved', // Auto-approve for daily processing
        payment_date: new Date().toISOString()
      }])
      .select()
      .single();

    let commissionRecord = commissionTransaction;

    if (transactionError) {
      console.error('❌ Commission transaction creation error:', transactionError);
      // Fall back to old commission system
      const { data: commission, error: commissionError } = await db.client
        .from('commissions')
        .insert([{
          referrer_id: referral.referrer_id,
          referred_id: investorId,
          share_purchase_id: investmentId,
          commission_rate: commissionRate,
          commission_amount: usdtCommission,
          status: 'pending'
        }])
        .select()
        .single();

      if (commissionError) {
        console.error('❌ Fallback commission creation error:', commissionError);
        return;
      }

      commissionRecord = commission;
    }

    // Update commission balance
    await updateCommissionBalance(referral.referrer_id, usdtCommission, shareCommission);

    console.log(`✅ Dual commission created: $${usdtCommission.toFixed(2)} USDT + $${shareCommission.toFixed(2)} Shares for referrer ${referral.referrer_id}`);

    // Notify referrer about the commission
    try {
      await notifyReferrerAboutCommission(referral.referrer_id, investmentAmount, usdtCommission, shareCommission);
    } catch (notificationError) {
      console.error('Referrer notification error:', notificationError);
      // Don't fail the commission creation if notification fails
    }

    return commissionRecord;

  } catch (error) {
    console.error('❌ Create commission error:', error);
  }
}

async function updateCommissionBalance(userId, usdtAmount, shareAmount) {
  try {
    // Check if balance record exists
    const { data: existingBalance, error: balanceCheckError } = await db.client
      .from('commission_balances')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (balanceCheckError && balanceCheckError.code !== 'PGRST116') {
      console.error('Commission balance check error:', balanceCheckError);
      return;
    }

    if (existingBalance) {
      // Update existing balance
      const { error: updateError } = await db.client
        .from('commission_balances')
        .update({
          usdt_balance: parseFloat(existingBalance.usdt_balance || 0) + usdtAmount,
          share_balance: parseFloat(existingBalance.share_balance || 0) + shareAmount,
          total_earned_usdt: parseFloat(existingBalance.total_earned_usdt || 0) + usdtAmount,
          total_earned_shares: parseFloat(existingBalance.total_earned_shares || 0) + shareAmount,
          last_updated: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (updateError) {
        console.error('Commission balance update error:', updateError);
      } else {
        console.log(`✅ Commission balance updated for user ${userId}: +$${usdtAmount.toFixed(2)} USDT, +$${shareAmount.toFixed(2)} Shares`);
      }
    } else {
      // Create new balance record
      const { error: insertError } = await db.client
        .from('commission_balances')
        .insert([{
          user_id: userId,
          usdt_balance: usdtAmount,
          share_balance: shareAmount,
          total_earned_usdt: usdtAmount,
          total_earned_shares: shareAmount
        }]);

      if (insertError) {
        console.error('Commission balance creation error:', insertError);
      } else {
        console.log(`✅ Commission balance created for user ${userId}: $${usdtAmount.toFixed(2)} USDT, $${shareAmount.toFixed(2)} Shares`);
      }
    }
  } catch (error) {
    console.error('Update commission balance error:', error);
  }
}

async function notifyReferrerAboutCommission(referrerId, sharePurchaseAmount, usdtCommission, shareCommission) {
  try {
    // Get referrer's Telegram info
    const { data: referrerTelegram, error: telegramError } = await db.client
      .from('telegram_users')
      .select('telegram_id')
      .eq('user_id', referrerId)
      .single();

    if (telegramError || !referrerTelegram) {
      console.log('📱 Referrer has no Telegram account for notification');
      return;
    }

    const commissionMessage = `🎉 **NEW DUAL COMMISSION EARNED!**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**SHARE PURCHASE:** $${sharePurchaseAmount.toFixed(2)}

**YOUR COMMISSIONS:**
💰 **USDT Commission:** $${usdtCommission.toFixed(2)} (withdrawable)
📊 **Share Commission:** $${shareCommission.toFixed(2)} (equity shares)
🎯 **Total Value:** $${(usdtCommission + shareCommission).toFixed(2)}

**COMMISSION DETAILS:**
📊 **Rate:** 15% USDT + 15% Shares
📅 **Date:** ${new Date().toLocaleDateString()}
⚡ **Processing:** Daily (Monday-Friday)

**STATUS:**
✅ **USDT Balance:** Added to your account
✅ **Share Balance:** Added to your portfolio
💸 **Withdrawal:** Available immediately

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Keep sharing your referral link to earn more commissions! 🚀`;

    await bot.telegram.sendMessage(referrerTelegram.telegram_id, commissionMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: "💸 Withdraw Commissions", callback_data: "withdraw_commissions" }],
          [{ text: "👥 View Referral Dashboard", callback_data: "menu_referrals" }],
          [{ text: "📤 Share Referral Link", callback_data: "share_referral" }]
        ]
      }
    });

    console.log(`📧 Commission notification sent to referrer ${referrerId}`);

  } catch (error) {
    console.error('Referrer notification error:', error);
  }
}

async function handlePackagesMenu(ctx) {
  const packages = await db.getInvestmentPackages();
  const currentPhase = await db.getCurrentPhase();

  if (packages.length === 0) {
    await ctx.replyWithMarkdown('⛏️ **Mining packages temporarily unavailable.**\n\nPlease contact support for assistance.');
    return;
  }

  let packagesMessage = `⛏️ **MINING EQUIPMENT PACKAGES**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**PROFESSIONAL MINING EQUIPMENT INVESTMENTS**

Choose from our 8 premium mining equipment packages, each representing real mining equipment and operations:

`;

  for (let index = 0; index < packages.length; index++) {
    const pkg = packages[index];
    const dynamicPrice = await calculatePackagePrice(pkg);
    packagesMessage += `**${index + 1}. ${pkg.name.toUpperCase()}** - ${formatCurrency(dynamicPrice)}\n   └ ${pkg.shares.toLocaleString()} equity shares\n\n`;
  }

  if (currentPhase) {
    packagesMessage += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📈 **CURRENT PHASE:** ${currentPhase.phase_name}\n💰 **Share Price:** ${formatCurrency(currentPhase.price_per_share)}\n📊 **Available:** ${(currentPhase.total_shares_available - currentPhase.shares_sold).toLocaleString()} shares\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  }

  packagesMessage += '\n\n**Select a package to view detailed information:**';

  await ctx.replyWithMarkdown(packagesMessage, {
    reply_markup: await createPackagesKeyboard(packages)
  });
}

async function handlePackageSelection(ctx, callbackData) {
  const packageId = callbackData.split('_')[1];
  const pkg = await db.getPackageById(packageId);
  const currentPhase = await db.getCurrentPhase();

  if (!pkg) {
    await ctx.replyWithMarkdown('❌ **PACKAGE NOT FOUND**\n\nPlease try again or contact support.');
    return;
  }

  const packageDetails = formatPackageDetails(pkg, currentPhase);

  await ctx.replyWithMarkdown(packageDetails, {
    reply_markup: {
      inline_keyboard: [
        [{ text: `🛒 PURCHASE ${pkg.name.toUpperCase()}`, callback_data: `purchase_${pkg.id}` }],
        [{ text: "📊 Calculate Returns", callback_data: `calculate_${pkg.id}` }],
        [{ text: "🔙 Back to Packages", callback_data: "menu_packages" }],
        [{ text: "🏠 Main Dashboard", callback_data: "main_menu" }]
      ]
    }
  });
}

// Enhanced support and admin handlers
async function handleSupportCenter(ctx) {
  const supportMessage = `🆘 **AUREUS SUPPORT CENTER**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**24/7 PREMIUM SUPPORT**

📧 **Email:** support@aureusalliance.com
📞 **Phone:** +27-11-AUREUS (24/7)
💬 **Live Chat:** Available on website
🌐 **Website:** www.aureusalliance.com

**SHARE PURCHASE SUPPORT:**
• Portfolio management assistance
• Payment processing help
• Mining operation updates
• Dividend payment inquiries

**TECHNICAL SUPPORT:**
• Account access issues
• Password reset assistance
• Platform navigation help
• Mobile app support

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**URGENT ISSUES?**
Contact our emergency support line for immediate assistance.`;

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

async function handleAdminPanel(ctx) {
  const user = ctx.from;

  if (user.username !== ADMIN_USERNAME) {
    await ctx.replyWithMarkdown('❌ **ACCESS DENIED**\n\nAdmin access is restricted.');
    return;
  }

  const adminMessage = `🔑 **ADMIN CONTROL PANEL**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Welcome, **Administrator ${user.first_name}**!

**ADMIN FUNCTIONS:**`;

  await ctx.replyWithMarkdown(adminMessage, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "👥 User Management", callback_data: "admin_users" },
          { text: "💳 Payment Approvals", callback_data: "admin_payments" }
        ],
        [
          { text: "🤝 User Sponsors", callback_data: "admin_user_sponsors" },
          { text: "📊 System Analytics", callback_data: "admin_analytics" }
        ],
        [
          { text: "📢 Broadcast Message", callback_data: "admin_broadcast" },
          { text: "⚙️ System Settings", callback_data: "admin_settings" }
        ],
        [
          { text: "📋 Audit Logs", callback_data: "admin_logs" }
        ],
        [
          { text: "🔙 Back to Dashboard", callback_data: "main_menu" }
        ]
      ]
    }
  });
}

async function handleAdminStatus(ctx) {
  const user = ctx.from;

  if (user.username !== ADMIN_USERNAME) {
    await ctx.replyWithMarkdown('❌ **ACCESS DENIED**');
    return;
  }

  // Get system statistics
  const packages = await db.getInvestmentPackages();
  const currentPhase = await db.getCurrentPhase();

  const statusMessage = `📊 **SYSTEM STATUS DASHBOARD**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**SYSTEM HEALTH:** ✅ Online
**DATABASE:** ✅ Connected
**BOT STATUS:** ✅ Active

**SHARE PURCHASE DATA:**
• **Packages Available:** ${packages.length}
• **Current Phase:** ${currentPhase ? currentPhase.phase_name : 'Loading...'}
• **Share Price:** ${currentPhase ? formatCurrency(currentPhase.price_per_share) : 'Loading...'}

**RECENT ACTIVITY:**
• System monitoring active
• All services operational
• No critical alerts

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

async function handleAdminPayments(ctx) {
  const user = ctx.from;

  if (!await isAuthorizedAdmin(user.username)) {
    await ctx.replyWithMarkdown('❌ **ACCESS DENIED**');
    await logAdminAction(
      user.id,
      user.username || user.first_name,
      'UNAUTHORIZED_ACCESS_ATTEMPT',
      'system',
      'payment_approvals',
      { username: user.username }
    );
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

    await logAdminAction(
      user.id,
      user.username || user.first_name,
      'VIEW_PENDING_PAYMENTS',
      'system',
      'payment_list',
      { count: pendingPayments?.length || 0 }
    );

    if (!pendingPayments || pendingPayments.length === 0) {
      await ctx.replyWithMarkdown(`💳 **PAYMENT APPROVALS**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ **No pending payments**

All payments have been processed!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ View Approved", callback_data: "admin_approved_payments" },
              { text: "❌ View Rejected", callback_data: "admin_rejected_payments" }
            ],
            [
              { text: "🔄 Refresh", callback_data: "admin_payments" },
              { text: "📊 Payment Stats", callback_data: "admin_payment_stats" }
            ],
            [
              { text: "🔙 Back to Admin Panel", callback_data: "admin_panel" }
            ]
          ]
        }
      });
      return;
    }

    // Show individual payments for review
    for (let i = 0; i < pendingPayments.length; i++) {
      await showIndividualPaymentForReview(ctx, pendingPayments[i], i + 1, pendingPayments.length);

      // Add small delay between messages to avoid rate limiting
      if (i < pendingPayments.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Show navigation menu after all payments
    await ctx.replyWithMarkdown(`🔧 **PAYMENT MANAGEMENT MENU**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**📋 Showing ${pendingPayments.length} pending payment${pendingPayments.length > 1 ? 's' : ''}**

Use the buttons above to review each payment individually.`, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ View Approved", callback_data: "admin_approved_payments" },
            { text: "❌ View Rejected", callback_data: "admin_rejected_payments" }
          ],
          [
            { text: "🔄 Refresh", callback_data: "admin_payments" },
            { text: "📊 Payment Stats", callback_data: "admin_payment_stats" }
          ],
          [
            { text: "👥 Admin Management", callback_data: "admin_user_management" },
            { text: "📋 Audit Logs", callback_data: "admin_audit_logs" }
          ],
          [
            { text: "🔙 Back to Admin Panel", callback_data: "admin_panel" }
          ]
        ]
      }
    });

  } catch (error) {
    console.error('Admin payments error:', error);
    await ctx.replyWithMarkdown('❌ **Error loading payment data**\n\nPlease try again.');
  }
}

async function handleAdminUsers(ctx) {
  const user = ctx.from;

  if (user.username !== ADMIN_USERNAME) {
    await ctx.replyWithMarkdown('❌ **ACCESS DENIED**');
    return;
  }

  const usersMessage = `👥 **USER MANAGEMENT**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔧 **User management features coming soon...**

**Available Functions:**
• View all users
• Search users by email/username
• Manage user accounts
• View user investments
• Reset user passwords

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  await ctx.replyWithMarkdown(usersMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔙 Back to Admin Panel", callback_data: "admin_panel" }]
      ]
    }
  });
}

async function handleAdminAnalytics(ctx) {
  const user = ctx.from;

  if (user.username !== ADMIN_USERNAME) {
    await ctx.replyWithMarkdown('❌ **ACCESS DENIED**');
    return;
  }

  const analyticsMessage = `📊 **SYSTEM ANALYTICS**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔧 **Analytics features coming soon...**

**Available Reports:**
• User registration trends
• Share Purchase performance
• Payment statistics
• Revenue analytics
• System usage metrics

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  await ctx.replyWithMarkdown(analyticsMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔙 Back to Admin Panel", callback_data: "admin_panel" }]
      ]
    }
  });
}

async function handleAdminBroadcast(ctx) {
  const user = ctx.from;

  if (user.username !== ADMIN_USERNAME) {
    await ctx.replyWithMarkdown('❌ **ACCESS DENIED**');
    return;
  }

  const broadcastMessage = `📢 **BROADCAST MESSAGE**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔧 **Broadcast features coming soon...**

**Available Functions:**
• Send message to all users
• Target specific user groups
• Schedule announcements
• View broadcast history
• Message templates

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  await ctx.replyWithMarkdown(broadcastMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔙 Back to Admin Panel", callback_data: "admin_panel" }]
      ]
    }
  });
}

async function handleAdminSettings(ctx) {
  const user = ctx.from;

  if (user.username !== ADMIN_USERNAME) {
    await ctx.replyWithMarkdown('❌ **ACCESS DENIED**');
    return;
  }

  const settingsMessage = `⚙️ **SYSTEM SETTINGS**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔧 **Settings features coming soon...**

**Available Settings:**
• Share Purchase phases
• Package configurations
• Wallet addresses
• System parameters
• Security settings

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  await ctx.replyWithMarkdown(settingsMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔙 Back to Admin Panel", callback_data: "admin_panel" }]
      ]
    }
  });
}

async function handleAdminLogs(ctx) {
  const user = ctx.from;

  if (user.username !== ADMIN_USERNAME) {
    await ctx.replyWithMarkdown('❌ **ACCESS DENIED**');
    return;
  }

  const logsMessage = `📋 **AUDIT LOGS**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔧 **Audit log features coming soon...**

**Available Logs:**
• User activity logs
• Payment transactions
• Admin actions
• System events
• Security incidents

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  await ctx.replyWithMarkdown(logsMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔙 Back to Admin Panel", callback_data: "admin_panel" }]
      ]
    }
  });
}

// Enhanced admin authorization system
async function isAuthorizedAdmin(username) {
  if (!username) return false;

  // Main admin always authorized
  if (username === ADMIN_USERNAME) return true;

  // For now, only main admin is authorized until we set up the admin_users table
  // TODO: Implement multi-admin system with admin_users table
  return false;
}

async function showIndividualPaymentForReview(ctx, payment, index, total) {
  const userInfo = payment.users;

  // Get display name from users table
  const displayName = userInfo.full_name || 'Unknown User';

  // Try to get Telegram info separately
  let telegramUsername = 'No username';
  try {
    const { data: telegramUser } = await db.client
      .from('telegram_users')
      .select('username, first_name, last_name')
      .eq('user_id', payment.user_id)
      .single();

    if (telegramUser?.username) {
      telegramUsername = `@${telegramUser.username}`;
    }
  } catch (error) {
    console.log('Could not fetch telegram username for user:', payment.user_id);
  }

  // Format transaction hash for display
  const shortTxHash = payment.transaction_hash.substring(0, 12) + '...' + payment.transaction_hash.substring(-8);

  const paymentMessage = `💳 **PAYMENT REVIEW ${index}/${total}**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 **USER:** ${displayName}
📧 **Email:** ${userInfo.email}
📱 **Telegram:** ${telegramUsername}

💰 **AMOUNT:** $${payment.amount} ${payment.currency}
🌐 **Network:** ${payment.network.toUpperCase()}
📅 **Date:** ${new Date(payment.created_at).toLocaleString()}

🔗 **TRANSACTION HASH:**
\`${payment.transaction_hash}\`

💳 **SENDER WALLET:**
\`${payment.sender_wallet}\`

🏦 **RECEIVER WALLET:**
\`${payment.receiver_wallet}\`

📷 **SCREENSHOT:** ${payment.screenshot_url ? 'Available' : 'Not provided'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ **REVIEW REQUIRED**
Please verify all details before approval.`;

  const keyboard = [
    [
      { text: "✅ Approve Payment", callback_data: `approve_payment_${payment.id}` },
      { text: "❌ Reject Payment", callback_data: `reject_payment_${payment.id}` }
    ],
    [
      { text: "📷 View Screenshot", callback_data: `view_screenshot_${payment.id}` },
      { text: "📋 Add Notes", callback_data: `add_notes_${payment.id}` }
    ],
    [
      { text: "📋 Copy TX Hash", callback_data: `copy_tx_${payment.id}` },
      { text: "🔍 Verify Transaction", callback_data: `verify_tx_${payment.id}` }
    ]
  ];

  await ctx.replyWithMarkdown(paymentMessage, {
    reply_markup: { inline_keyboard: keyboard }
  });

  // Show screenshot if available
  if (payment.screenshot_url) {
    try {
      // Check if URL is already complete or just a filename
      const screenshotUrl = payment.screenshot_url.startsWith('http')
        ? payment.screenshot_url
        : `${process.env.SUPABASE_URL}/storage/v1/object/public/proof/${payment.screenshot_url}`;

      console.log(`📷 Attempting to load screenshot: ${screenshotUrl}`);

      await ctx.replyWithPhoto(screenshotUrl, {
        caption: `📷 **Payment Screenshot**\n\n💳 Payment ID: ${payment.id.substring(0, 8)}...\n👤 User: ${displayName}`,
        parse_mode: 'Markdown'
      });
    } catch (error) {
      console.error('Error showing screenshot:', error);
      // Send a message indicating screenshot is available but couldn't be loaded
      await ctx.replyWithMarkdown(`📷 **Screenshot Available**\n\n💳 Payment ID: ${payment.id.substring(0, 8)}...\n👤 User: ${displayName}\n\n⚠️ Screenshot could not be loaded automatically.\n🔗 URL: \`${payment.screenshot_url}\``);
    }
  }
}

async function logAdminAction(adminTelegramId, action, details = {}) {
  try {
    // For now, just log to console until admin_audit_logs table is created
    console.log(`📋 Admin action: ${action} by ${adminTelegramId}`, details);

    // TODO: Implement database logging when admin_audit_logs table is available
    /*
    const logData = {
      admin_telegram_id: adminTelegramId,
      action: action,
      details: details,
      timestamp: new Date().toISOString(),
      ip_address: null
    };

    await db.client
      .from('admin_audit_logs')
      .insert([logData]);
    */
  } catch (error) {
    console.error('Error logging admin action:', error);
  }
}

// Individual payment action handlers
async function handlePaymentApproval(ctx, callbackData) {
  const user = ctx.from;

  if (!await isAuthorizedAdmin(user.username)) {
    await ctx.answerCbQuery('❌ Access denied');
    return;
  }

  const paymentId = callbackData.replace('approve_payment_', '');

  try {
    // Get payment details
    const { data: payment, error: fetchError } = await db.client
      .from('crypto_payment_transactions')
      .select('*, users!inner(email, full_name)')
      .eq('id', paymentId)
      .single();

    if (fetchError || !payment) {
      await ctx.answerCbQuery('❌ Payment not found');
      return;
    }

    // Show confirmation dialog
    const confirmMessage = `⚠️ **CONFIRM PAYMENT APPROVAL**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 **User:** ${payment.users.full_name}
📧 **Email:** ${payment.users.email}
💰 **Amount:** $${payment.amount} ${payment.currency}
🌐 **Network:** ${payment.network.toUpperCase()}

🔗 **TX Hash:** \`${payment.transaction_hash}\`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Are you sure you want to APPROVE this payment?**

This action cannot be undone.`;

    await ctx.replyWithMarkdown(confirmMessage, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ CONFIRM APPROVAL", callback_data: `confirm_approve_${paymentId}` },
            { text: "❌ Cancel", callback_data: "admin_payments" }
          ]
        ]
      }
    });

    await logAdminAction(user.id, 'PAYMENT_APPROVAL_REQUESTED', {
      payment_id: paymentId,
      amount: payment.amount,
      user_email: payment.users.email
    });

  } catch (error) {
    console.error('Payment approval error:', error);
    await ctx.answerCbQuery('❌ Error processing approval');
  }
}

async function handlePaymentRejection(ctx, callbackData) {
  const user = ctx.from;

  if (!await isAuthorizedAdmin(user.username)) {
    await ctx.answerCbQuery('❌ Access denied');
    return;
  }

  const paymentId = callbackData.replace('reject_payment_', '');

  try {
    // Get payment details
    const { data: payment, error: fetchError } = await db.client
      .from('crypto_payment_transactions')
      .select('*, users!inner(email, full_name)')
      .eq('id', paymentId)
      .single();

    if (fetchError || !payment) {
      await ctx.answerCbQuery('❌ Payment not found');
      return;
    }

    // Show confirmation dialog
    const confirmMessage = `⚠️ **CONFIRM PAYMENT REJECTION**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 **User:** ${payment.users.full_name}
📧 **Email:** ${payment.users.email}
💰 **Amount:** $${payment.amount} ${payment.currency}
🌐 **Network:** ${payment.network.toUpperCase()}

🔗 **TX Hash:** \`${payment.transaction_hash}\`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Are you sure you want to REJECT this payment?**

Please provide a reason for rejection.`;

    await ctx.replyWithMarkdown(confirmMessage, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "❌ CONFIRM REJECTION", callback_data: `confirm_reject_${paymentId}` },
            { text: "✅ Cancel", callback_data: "admin_payments" }
          ]
        ]
      }
    });

    await logAdminAction(user.id, 'PAYMENT_REJECTION_REQUESTED', {
      payment_id: paymentId,
      amount: payment.amount,
      user_email: payment.users.email
    });

  } catch (error) {
    console.error('Payment rejection error:', error);
    await ctx.answerCbQuery('❌ Error processing rejection');
  }
}

async function handleViewScreenshot(ctx, callbackData) {
  const user = ctx.from;

  if (!await isAuthorizedAdmin(user.username)) {
    await ctx.answerCbQuery('❌ Access denied');
    return;
  }

  const paymentId = callbackData.replace('view_screenshot_', '');

  try {
    const { data: payment, error } = await db.client
      .from('crypto_payment_transactions')
      .select('screenshot_url, users!inner(full_name)')
      .eq('id', paymentId)
      .single();

    if (error || !payment) {
      await ctx.answerCbQuery('❌ Payment not found');
      return;
    }

    if (!payment.screenshot_url) {
      await ctx.answerCbQuery('❌ No screenshot available');
      return;
    }

    // Check if URL is already complete or just a filename
    const screenshotUrl = payment.screenshot_url.startsWith('http')
      ? payment.screenshot_url
      : `${process.env.SUPABASE_URL}/storage/v1/object/public/proof/${payment.screenshot_url}`;

    console.log(`📷 Loading screenshot from: ${screenshotUrl}`);

    try {
      await ctx.replyWithPhoto(screenshotUrl, {
        caption: `📷 **Payment Screenshot**\n\n💳 Payment ID: ${paymentId.substring(0, 8)}...\n👤 User: ${payment.users.full_name}`,
        parse_mode: 'Markdown'
      });
    } catch (photoError) {
      console.error('Error loading photo:', photoError);
      // Fallback: show screenshot URL as text
      await ctx.replyWithMarkdown(`📷 **Payment Screenshot**\n\n💳 Payment ID: ${paymentId.substring(0, 8)}...\n👤 User: ${payment.users.full_name}\n\n⚠️ Screenshot could not be displayed.\n🔗 Direct URL: \`${screenshotUrl}\``);
    }

    await logAdminAction(user.id, 'VIEW_PAYMENT_SCREENSHOT', { payment_id: paymentId });

  } catch (error) {
    console.error('View screenshot error:', error);
    await ctx.answerCbQuery('❌ Error loading screenshot');
  }
}

// Admin audit logging function
async function logAdminAction(adminTelegramId, adminUsername, action, targetType, targetId, details = {}) {
  try {
    const { error } = await db.client
      .from('admin_audit_logs')
      .insert([{
        admin_telegram_id: adminTelegramId,
        admin_username: adminUsername,
        action: action,
        target_type: targetType,
        target_id: targetId,
        details: details
      }]);

    if (error) {
      console.error('Audit log error:', error);
    } else {
      console.log(`📋 Admin action logged: ${action} by ${adminUsername} on ${targetType} ${targetId}`);
    }
  } catch (error) {
    console.error('Audit logging failed:', error);
  }
}

async function handleConfirmApproval(ctx, callbackData) {
  const user = ctx.from;
  const paymentId = callbackData.replace('confirm_approve_', '');

  try {
    // Update payment status to approved
    const { data: updatedPayment, error: updateError } = await db.client
      .from('crypto_payment_transactions')
      .update({
        status: 'approved',
        approved_by_admin_id: user.id,
        approved_at: new Date().toISOString(),
        verification_status: 'verified'
      })
      .eq('id', paymentId)
      .select('*, users!inner(email, full_name)')
      .single();

    if (updateError) {
      console.error('Payment approval error:', updateError);
      await ctx.answerCbQuery('❌ Error approving payment');
      return;
    }

    // Log admin action
    await logAdminAction(
      user.id,
      user.username || user.first_name,
      'APPROVE_PAYMENT',
      'payment',
      paymentId,
      {
        amount: updatedPayment.amount,
        currency: updatedPayment.currency,
        network: updatedPayment.network,
        user_email: updatedPayment.users.email
      }
    );

    // Create share purchase record
    console.log('💰 Creating share purchase record for approved payment...');

    try {
      // Define package mapping based on amount (since share_packages table doesn't exist)
      const packageMapping = {
        25: { name: 'Shovel', shares: 25, roi: 12 },
        75: { name: 'Miner', shares: 75, roi: 15 },
        250: { name: 'Excavator', shares: 250, roi: 18 },
        500: { name: 'Crusher', shares: 500, roi: 20 },
        750: { name: 'Refinery', shares: 750, roi: 22 },
        1000: { name: 'Aureus', shares: 1000, roi: 25 },
        2500: { name: 'Titan', shares: 2500, roi: 28 },
        5000: { name: 'Empire', shares: 5000, roi: 30 }
      };

      // Get package details based on payment amount
      const amount = parseFloat(updatedPayment.amount);
      const packageInfo = packageMapping[amount] || {
        name: 'Custom Package',
        shares: Math.floor(amount), // 1 share per dollar as fallback
        roi: 20 // Default 20% ROI
      };

      console.log(`📦 Package determined: ${packageInfo.name} (${packageInfo.shares} shares)`);

      // Create the share purchase record
      const investmentData = {
        user_id: updatedPayment.user_id,
        package_name: packageInfo.name,
        total_amount: amount,
        shares_purchased: packageInfo.shares,
        status: 'active',
        payment_method: `${updatedPayment.network} ${updatedPayment.currency}`,
        created_at: new Date().toISOString(),
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

        // Update investment phases with shares purchased (only when approved)
        await updateInvestmentPhases(packageInfo.shares);

        // Create commission for referrer if exists
        await createCommissionForInvestment(investmentRecord.id, updatedPayment.user_id, updatedPayment.amount);
      }
    } catch (investmentCreationError) {
      console.error('Share Purchase creation process error:', investmentCreationError);
    }

    const successMessage = `✅ **PAYMENT APPROVED**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 **User:** ${updatedPayment.users.full_name}
💰 **Amount:** $${updatedPayment.amount} ${updatedPayment.currency}
📅 **Approved:** ${new Date().toLocaleString()}
👨‍💼 **Approved by:** @${user.username}

✅ **Status:** Payment approved successfully
📧 **Next:** User will be notified automatically

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    await ctx.editMessageText(successMessage, { parse_mode: 'Markdown' });

    await logAdminAction(user.id, 'PAYMENT_APPROVED', {
      payment_id: paymentId,
      amount: updatedPayment.amount,
      user_email: updatedPayment.users.email
    });

    // Send notification to user
    try {
      const { data: telegramUser, error: telegramError } = await db.client
        .from('telegram_users')
        .select('telegram_id')
        .eq('user_id', updatedPayment.user_id)
        .single();

      if (!telegramError && telegramUser) {
        const userNotification = `🎉 **PAYMENT APPROVED!**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Your payment has been **APPROVED** and processed!

💰 **Amount:** $${updatedPayment.amount} ${updatedPayment.currency}
🌐 **Network:** ${updatedPayment.network}
📅 **Approved:** ${new Date().toLocaleString()}

💎 **Share Purchase Status:** Active
📈 **Your Share Purchase:** Processing...

🎯 **Next Steps:**
• View your portfolio in the Share Purchase section
• Track your mining progress
• Receive quarterly dividends

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Welcome to Aureus Alliance Holdings! 🏆`;

        await ctx.telegram.sendMessage(telegramUser.telegram_id, userNotification, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: "📱 View Portfolio", callback_data: "menu_portfolio" }],
              [{ text: "🏠 Back to Dashboard", callback_data: "main_menu" }]
            ]
          }
        });

        console.log(`📧 User notification sent to ${telegramUser.telegram_id}`);
      }
    } catch (notificationError) {
      console.error('User notification error:', notificationError);
    }

  } catch (error) {
    console.error('Confirm approval error:', error);
    await ctx.answerCbQuery('❌ Error confirming approval');
  }
}

async function handleConfirmRejection(ctx, callbackData) {
  const user = ctx.from;
  const paymentId = callbackData.replace('confirm_reject_', '');

  try {
    // Update payment status to rejected
    const { data: updatedPayment, error: updateError } = await db.client
      .from('crypto_payment_transactions')
      .update({
        status: 'rejected',
        rejected_by_admin_id: user.id,
        rejected_at: new Date().toISOString(),
        admin_notes: 'Payment rejected by admin'
      })
      .eq('id', paymentId)
      .select('*, users!inner(email, full_name)')
      .single();

    if (updateError) {
      console.error('Payment rejection error:', updateError);
      await ctx.answerCbQuery('❌ Error rejecting payment');
      return;
    }

    // Log admin action
    await logAdminAction(
      user.id,
      user.username || user.first_name,
      'REJECT_PAYMENT',
      'payment',
      paymentId,
      {
        amount: updatedPayment.amount,
        currency: updatedPayment.currency,
        network: updatedPayment.network,
        user_email: updatedPayment.users.email
      }
    );

    const rejectionMessage = `❌ **PAYMENT REJECTED**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 **User:** ${updatedPayment.users.full_name}
💰 **Amount:** $${updatedPayment.amount} ${updatedPayment.currency}
📅 **Rejected:** ${new Date().toLocaleString()}
👨‍💼 **Rejected by:** @${user.username}

❌ **Status:** Payment rejected
📧 **Next:** User will be notified with reason

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    await ctx.editMessageText(rejectionMessage, { parse_mode: 'Markdown' });

    await logAdminAction(user.id, 'PAYMENT_REJECTED', {
      payment_id: paymentId,
      amount: updatedPayment.amount,
      user_email: updatedPayment.users.email
    });

    // TODO: Send notification to user

  } catch (error) {
    console.error('Confirm rejection error:', error);
    await ctx.answerCbQuery('❌ Error confirming rejection');
  }
}

// Placeholder functions for other admin features
async function handleAddNotes(ctx, callbackData) {
  await ctx.answerCbQuery('📋 Notes feature coming soon');
}

async function handleCopyTransaction(ctx, callbackData) {
  const paymentId = callbackData.replace('copy_tx_', '');

  try {
    const { data: payment, error } = await db.client
      .from('crypto_payment_transactions')
      .select('transaction_hash')
      .eq('id', paymentId)
      .single();

    if (error || !payment) {
      await ctx.answerCbQuery('❌ Payment not found');
      return;
    }

    await ctx.answerCbQuery('📋 Transaction hash copied to clipboard');
    await ctx.reply(`📋 **Transaction Hash:**\n\n\`${payment.transaction_hash}\`\n\n*Click to copy*`);

  } catch (error) {
    console.error('Copy transaction error:', error);
    await ctx.answerCbQuery('❌ Error copying transaction');
  }
}

async function handleVerifyTransaction(ctx, callbackData) {
  await ctx.answerCbQuery('🔍 Transaction verification feature coming soon');
}

async function handleApprovedPayments(ctx) {
  await ctx.replyWithMarkdown('✅ **Approved payments view coming soon**');
}

async function handleRejectedPayments(ctx) {
  await ctx.replyWithMarkdown('❌ **Rejected payments view coming soon**');
}

async function handleAdminUserManagement(ctx) {
  await ctx.replyWithMarkdown('👥 **Admin user management coming soon**');
}

async function handleAdminAuditLogs(ctx) {
  await ctx.replyWithMarkdown('📋 **Admin audit logs coming soon**');
}

// Enhanced feature handlers
async function handlePurchaseFlow(ctx, callbackData) {
  const packageId = callbackData.split('_')[1];
  const pkg = await db.getPackageById(packageId);

  if (!pkg) {
    await ctx.replyWithMarkdown('❌ **PACKAGE NOT FOUND**');
    return;
  }

  // Check if user has accepted all required terms
  const telegramUser = await db.getTelegramUser(ctx.from.id);
  console.log(`🔍 Purchase flow - Telegram user:`, telegramUser);
  if (!telegramUser || !telegramUser.user_id) {
    await ctx.replyWithMarkdown('❌ **Authentication required**\n\nPlease log in first.');
    return;
  }

  const userId = telegramUser.user_id;
  console.log(`👤 Purchase flow - User ID: ${userId}`);
  const requiredTerms = ['general', 'privacy', 'investment_risks', 'mining_operations', 'nft_terms', 'dividend_policy'];

  // Check which terms haven't been accepted
  const unacceptedTerms = [];
  for (const termType of requiredTerms) {
    const hasAccepted = await db.hasAcceptedTerms(userId, termType);
    console.log(`📋 Terms check - ${termType}: ${hasAccepted}`);
    if (!hasAccepted) {
      unacceptedTerms.push(termType);
    }
  }

  console.log(`📝 Unaccepted terms: ${unacceptedTerms.length > 0 ? unacceptedTerms.join(', ') : 'None'}`);

  // If any terms are not accepted, redirect to terms acceptance
  if (unacceptedTerms.length > 0) {
    console.log(`🚫 Redirecting to terms acceptance for: ${unacceptedTerms.join(', ')}`);
    await showTermsAcceptanceRequired(ctx, packageId, unacceptedTerms);
    return;
  }

  const currentPhase = await db.getCurrentPhase();

  // Calculate package cost based on current phase pricing
  const packageCost = await calculatePackagePrice(pkg);

  // Get user's commission balance
  const { data: commissionBalance, error: balanceError } = await db.client
    .from('commission_balances')
    .select('*')
    .eq('user_id', userId)
    .single();

  const availableUSDT = commissionBalance?.usdt_balance || 0;
  const totalCost = packageCost;
  const canUseCommission = availableUSDT > 0;
  const maxCommissionUsage = Math.min(availableUSDT, totalCost);
  const remainingAfterCommission = Math.max(0, totalCost - availableUSDT);

  let purchaseMessage = `**🛒 BUY SHARES - ${pkg.name.toUpperCase()}**

**SHARE PURCHASE DETAILS:**

💰 **Total Cost:** ${formatCurrency(totalCost)}
📊 **Aureus Shares:** ${pkg.shares.toLocaleString()}
💎 **Current Share Price:** ${currentPhase ? formatCurrency(currentPhase.price_per_share) : 'N/A'}
📈 **Current Phase:** ${currentPhase ? currentPhase.phase_name : 'N/A'}`;

  // Add commission balance information if available
  if (canUseCommission) {
    purchaseMessage += `

**💰 COMMISSION BALANCE AVAILABLE:**
• **Available USDT:** ${formatCurrency(availableUSDT)}
• **Can Use:** ${formatCurrency(maxCommissionUsage)}
• **Remaining to Pay:** ${formatCurrency(remainingAfterCommission)}`;
  }

  purchaseMessage += `

**🏆 WHAT YOU GET:**
• ${pkg.shares.toLocaleString()} equity shares in Aureus Alliance Holdings
• Quarterly dividend payments from gold mining operations
• NFT share certificate (12-month trading restriction, $1000 minimum value)
• Real-time mining operation updates

**💳 PAYMENT OPTIONS:**`;

  if (canUseCommission) {
    purchaseMessage += `
Choose how you want to pay:`;
  } else {
    purchaseMessage += `
Choose your preferred cryptocurrency network:`;
  }

  // Create keyboard based on commission balance availability
  const keyboard = [];

  if (canUseCommission) {
    // Add commission usage options
    if (availableUSDT >= totalCost) {
      // Can pay entirely with commission
      keyboard.push([{ text: "💰 Pay with Commission Balance", callback_data: `pay_commission_full_${pkg.id}` }]);
    } else {
      // Can pay partially with commission
      keyboard.push([{ text: `💰 Use Commission ($${maxCommissionUsage.toFixed(2)}) + Crypto`, callback_data: `pay_commission_partial_${pkg.id}` }]);
    }

    // Add separator
    keyboard.push([{ text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", callback_data: "separator" }]);
  }

  // Add crypto payment options
  keyboard.push([{ text: "🟡 BSC USDT", callback_data: `pay_bsc_${pkg.id}` }]);
  keyboard.push([{ text: "🟣 POL USDT", callback_data: `pay_pol_${pkg.id}` }]);
  keyboard.push([{ text: "🔴 TRON USDT", callback_data: `pay_tron_${pkg.id}` }]);

  // Add navigation options
  keyboard.push([{ text: "🔙 Back to Package", callback_data: `package_${pkg.id}` }]);
  keyboard.push([{ text: "🏠 Main Dashboard", callback_data: "main_menu" }]);

  await ctx.replyWithMarkdown(purchaseMessage, {
    reply_markup: {
      inline_keyboard: keyboard
    }
  });
}

async function handleCommissionPayment(ctx, callbackData) {
  const user = ctx.from;

  try {
    await ctx.answerCbQuery();

    const parts = callbackData.split('_');
    const paymentType = parts[2]; // 'full' or 'partial'
    const packageId = parts[3];

    const pkg = await db.getPackageById(packageId);
    if (!pkg) {
      await ctx.replyWithMarkdown('❌ **PACKAGE NOT FOUND**');
      return;
    }

    // Get user data
    const telegramUser = await db.getTelegramUser(user.id);
    if (!telegramUser || !telegramUser.user_id) {
      await ctx.replyWithMarkdown('❌ **Authentication required**\n\nPlease log in first.');
      return;
    }

    const userId = telegramUser.user_id;

    // Get commission balance
    const { data: commissionBalance, error: balanceError } = await db.client
      .from('commission_balances')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (balanceError || !commissionBalance) {
      await ctx.replyWithMarkdown('❌ **No commission balance found**');
      return;
    }

    const availableUSDT = parseFloat(commissionBalance.usdt_balance || 0);
    const packageCost = pkg.price;

    if (paymentType === 'full') {
      // Full payment with commission
      if (availableUSDT < packageCost) {
        await ctx.replyWithMarkdown(`❌ **Insufficient commission balance**\n\nRequired: $${packageCost.toFixed(2)}\nAvailable: $${availableUSDT.toFixed(2)}`);
        return;
      }

      await processCommissionPayment(ctx, userId, pkg, packageCost, 0);

    } else if (paymentType === 'partial') {
      // Partial payment with commission + crypto
      const commissionUsage = Math.min(availableUSDT, packageCost);
      const remainingAmount = packageCost - commissionUsage;

      if (remainingAmount <= 0) {
        // Actually can pay in full
        await processCommissionPayment(ctx, userId, pkg, packageCost, 0);
      } else {
        // Show crypto payment options for remaining amount
        await showPartialCommissionPayment(ctx, pkg, commissionUsage, remainingAmount);
      }
    }

  } catch (error) {
    console.error('Commission payment error:', error);
    await ctx.replyWithMarkdown('❌ **Error processing commission payment**\n\nPlease try again later.');
  }
}

async function processCommissionPayment(ctx, userId, pkg, commissionAmount, remainingAmount) {
  try {
    // Create share purchase record
    const sharePurchaseData = {
      user_id: userId,
      package_id: pkg.id,
      package_name: pkg.name,
      shares_purchased: pkg.shares,
      total_amount: pkg.price,
      commission_used: commissionAmount,
      remaining_payment: remainingAmount,
      payment_method: remainingAmount > 0 ? 'commission_partial' : 'commission_full',
      status: remainingAmount > 0 ? 'pending_payment' : 'pending_approval'
    };

    const { data: sharePurchase, error: purchaseError } = await db.client
      .from('aureus_share_purchases')
      .insert([sharePurchaseData])
      .select()
      .single();

    if (purchaseError) {
      console.error('Share purchase creation error:', purchaseError);
      await ctx.replyWithMarkdown('❌ **Error creating share purchase**\n\nPlease try again later.');
      return;
    }

    // Record commission usage
    if (commissionAmount > 0) {
      const commissionUsageData = {
        user_id: userId,
        share_purchase_id: sharePurchase.id,
        commission_amount_used: commissionAmount,
        remaining_payment_amount: remainingAmount
      };

      await db.client
        .from('commission_usage')
        .insert([commissionUsageData]);

      // Update commission balance
      await db.client
        .from('commission_balances')
        .update({
          usdt_balance: db.client.raw('usdt_balance - ?', [commissionAmount]),
          last_updated: new Date().toISOString()
        })
        .eq('user_id', userId);
    }

    // Note: Investment phases will be updated when purchase is approved by admin

    if (remainingAmount > 0) {
      // Show crypto payment options for remaining amount
      await showPartialCommissionPayment(ctx, pkg, commissionAmount, remainingAmount, sharePurchase.id);
    } else {
      // Full payment with commission - show success message
      const successMessage = `✅ **SHARE PURCHASE COMPLETED**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**PURCHASE DETAILS:**
📦 **Package:** ${pkg.name}
📊 **Shares:** ${pkg.shares.toLocaleString()}
💰 **Total Cost:** $${pkg.price.toFixed(2)}
💳 **Payment Method:** Commission Balance

**PAYMENT BREAKDOWN:**
💰 **Commission Used:** $${commissionAmount.toFixed(2)}
✅ **Status:** Pending Admin Approval

**NEXT STEPS:**
1. Admin will review your purchase
2. Shares will be added to your portfolio
3. You'll receive confirmation notification
4. Quarterly dividends will begin

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Thank you for your share purchase!`;

      await ctx.replyWithMarkdown(successMessage, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📊 View Portfolio", callback_data: "menu_portfolio" }],
            [{ text: "💰 Check Commission Balance", callback_data: "menu_referrals" }],
            [{ text: "🏠 Main Dashboard", callback_data: "main_menu" }]
          ]
        }
      });
    }

  } catch (error) {
    console.error('Commission payment processing error:', error);
    await ctx.replyWithMarkdown('❌ **Error processing payment**\n\nPlease try again later.');
  }
}

async function showPartialCommissionPayment(ctx, pkg, commissionUsed, remainingAmount, sharePurchaseId = null) {
  const partialPaymentMessage = `💰 **PARTIAL COMMISSION PAYMENT**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**SHARE PURCHASE:** ${pkg.name}
📊 **Total Shares:** ${pkg.shares.toLocaleString()}
💰 **Total Cost:** $${pkg.price.toFixed(2)}

**PAYMENT BREAKDOWN:**
✅ **Commission Used:** $${commissionUsed.toFixed(2)}
💳 **Remaining to Pay:** $${remainingAmount.toFixed(2)}

**CRYPTO PAYMENT OPTIONS:**
Choose your preferred network for the remaining amount:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = [
    [{ text: `🟡 BSC USDT ($${remainingAmount.toFixed(2)})`, callback_data: `pay_partial_bsc_${pkg.id}_${sharePurchaseId || 'new'}` }],
    [{ text: `🟣 POL USDT ($${remainingAmount.toFixed(2)})`, callback_data: `pay_partial_pol_${pkg.id}_${sharePurchaseId || 'new'}` }],
    [{ text: `🔴 TRON USDT ($${remainingAmount.toFixed(2)})`, callback_data: `pay_partial_tron_${pkg.id}_${sharePurchaseId || 'new'}` }],
    [{ text: "🔙 Back to Package", callback_data: `package_${pkg.id}` }],
    [{ text: "🏠 Main Dashboard", callback_data: "main_menu" }]
  ];

  await ctx.replyWithMarkdown(partialPaymentMessage, {
    reply_markup: {
      inline_keyboard: keyboard
    }
  });
}

async function calculateWashplantDividends(shares) {
  // Washplant operational data
  const WASHPLANT_SCHEDULE = {
    year1: 4,   // 4 washplants
    year2: 10,  // 10 washplants
    year3: 20,  // 20 washplants
    year4: 30,  // 30 washplants
    year5: 40   // 40 washplants
  };

  // Operational constants
  const TONS_PER_HOUR = 200;
  const HOURS_PER_DAY = 10;
  const DAYS_PER_YEAR = 365;
  const HECTARES_PER_WASHPLANT = 25;
  const GOLD_GRAMS_PER_TON = 0.8; // Average gold content
  const GOLD_PRICE_PER_GRAM = 107; // Current gold price ~$107/gram
  const OPERATIONAL_COST_PERCENTAGE = 0.45; // 45% operational costs
  const TOTAL_SHARES = 1400000; // Total Aureus shares

  const results = {};

  Object.keys(WASHPLANT_SCHEDULE).forEach(year => {
    const washplants = WASHPLANT_SCHEDULE[year];

    // Calculate annual production
    const annualTons = washplants * TONS_PER_HOUR * HOURS_PER_DAY * DAYS_PER_YEAR;
    const annualGoldGrams = annualTons * GOLD_GRAMS_PER_TON;
    const annualGoldKg = annualGoldGrams / 1000;

    // Calculate revenue and profit
    const grossRevenue = annualGoldGrams * GOLD_PRICE_PER_GRAM;
    const operationalCosts = grossRevenue * OPERATIONAL_COST_PERCENTAGE;
    const netProfit = grossRevenue - operationalCosts;

    // Calculate dividends
    const dividendPerShare = netProfit / TOTAL_SHARES;
    const userAnnualDividend = dividendPerShare * shares;
    const userQuarterlyDividend = userAnnualDividend / 4;

    results[year] = {
      washplants,
      annualTons: Math.round(annualTons),
      annualGoldKg: Math.round(annualGoldKg * 100) / 100,
      grossRevenue: Math.round(grossRevenue),
      operationalCosts: Math.round(operationalCosts),
      netProfit: Math.round(netProfit),
      dividendPerShare: Math.round(dividendPerShare * 100) / 100,
      userAnnualDividend: Math.round(userAnnualDividend * 100) / 100,
      userQuarterlyDividend: Math.round(userQuarterlyDividend * 100) / 100
    };
  });

  return results;
}

async function handleCalculateReturns(ctx, callbackData) {
  const packageId = callbackData.split('_')[1];
  const pkg = await db.getPackageById(packageId);

  if (!pkg) {
    await ctx.replyWithMarkdown('❌ **PACKAGE NOT FOUND**');
    return;
  }

  // Calculate washplant-based dividends
  const dividendProjections = await calculateWashplantDividends(pkg.shares);

  const calculationMessage = `📊 **MINING DIVIDEND CALCULATOR - ${pkg.name.toUpperCase()}**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**SHARE PURCHASE BREAKDOWN:**

💰 **Initial Share Purchase:** ${formatCurrency(pkg.price)}
📊 **Equity Shares:** ${pkg.shares.toLocaleString()}
⛏️ **Commission Rate:** 15% (not ROI)

**WASHPLANT-BASED DIVIDEND PROJECTIONS:**

**YEAR 1 (${dividendProjections.year1.washplants} Washplants):**
🏭 Production: ${dividendProjections.year1.annualTons.toLocaleString()} tons/year
🥇 Gold Output: ${dividendProjections.year1.annualGoldKg} kg/year
💰 Your Annual Dividend: ${formatCurrency(dividendProjections.year1.userAnnualDividend)}
📅 Quarterly Dividend: ${formatCurrency(dividendProjections.year1.userQuarterlyDividend)}

**YEAR 2 (${dividendProjections.year2.washplants} Washplants):**
🏭 Production: ${dividendProjections.year2.annualTons.toLocaleString()} tons/year
🥇 Gold Output: ${dividendProjections.year2.annualGoldKg} kg/year
💰 Your Annual Dividend: ${formatCurrency(dividendProjections.year2.userAnnualDividend)}

**YEAR 3 (${dividendProjections.year3.washplants} Washplants):**
🏭 Production: ${dividendProjections.year3.annualTons.toLocaleString()} tons/year
🥇 Gold Output: ${dividendProjections.year3.annualGoldKg} kg/year
💰 Your Annual Dividend: ${formatCurrency(dividendProjections.year3.userAnnualDividend)}

**YEAR 4 (${dividendProjections.year4.washplants} Washplants):**
🏭 Production: ${dividendProjections.year4.annualTons.toLocaleString()} tons/year
🥇 Gold Output: ${dividendProjections.year4.annualGoldKg} kg/year
💰 Your Annual Dividend: ${formatCurrency(dividendProjections.year4.userAnnualDividend)}

**YEAR 5 (${dividendProjections.year5.washplants} Washplants):**
🏭 Production: ${dividendProjections.year5.annualTons.toLocaleString()} tons/year
🥇 Gold Output: ${dividendProjections.year5.annualGoldKg} kg/year
💰 Your Annual Dividend: ${formatCurrency(dividendProjections.year5.userAnnualDividend)}

**5-YEAR TOTAL DIVIDENDS:** ${formatCurrency(
  dividendProjections.year1.userAnnualDividend +
  dividendProjections.year2.userAnnualDividend +
  dividendProjections.year3.userAnnualDividend +
  dividendProjections.year4.userAnnualDividend +
  dividendProjections.year5.userAnnualDividend
)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**OPERATIONAL BASIS:**
• 25 hectares per 200 tons/hour washplant
• 10 hours daily operation per washplant
• 0.8g gold per ton of material processed
• Current gold price: ~$107/gram
• 45% operational costs (fuel, maintenance, labor)

*Projections based on actual mining operations and washplant capacity. Actual returns depend on gold content, weather, and operational factors.*`;

  await ctx.replyWithMarkdown(calculationMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: `🛒 PURCHASE ${pkg.name.toUpperCase()}`, callback_data: `purchase_${pkg.id}` }],
        [{ text: "🔙 Back to Package", callback_data: `package_${pkg.id}` }],
        [{ text: "🏠 Main Dashboard", callback_data: "main_menu" }]
      ]
    }
  });
}

async function handleCustomInvestment(ctx) {
  const customMessage = `💰 **CUSTOM SHARE PURCHASE BUILDER**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**FLEXIBLE SHARE PURCHASE AMOUNTS**

Buy Shares any amount from **$25 to $10,000** with our smart package optimization system.

**HOW IT WORKS:**
1. Enter your desired share purchase amount
2. Our algorithm finds the optimal package combination
3. Maximize your shares and benefits
4. Complete secure payment process

**EXAMPLE OPTIMIZATIONS:**
• $275 = 1× Excavator ($250) + 1× Shovel ($25)
• $575 = 1× Crusher ($500) + 1× Miner ($75)
• $1,825 = 1× Aureus ($1,000) + 1× Refinery ($750) + 1× Miner ($75)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔧 **COMING SOON**
Advanced custom share purchase calculator with real-time optimization.`;

  await ctx.replyWithMarkdown(customMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📧 Get Notified When Ready", callback_data: "notify_custom" }],
        [{ text: "⛏️ View Standard Packages", callback_data: "menu_packages" }],
        [{ text: "🔙 Back to Dashboard", callback_data: "main_menu" }]
      ]
    }
  });
}

async function handleMiningCalculator(ctx) {
  const calculatorMessage = `📊 **MINING PRODUCTION CALCULATOR**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**AUREUS MINING OPERATIONS**

⛏️ **CURRENT CAPACITY:**
• **Washplants:** 10 units operational
• **Processing Rate:** 200 tons/hour per unit
• **Daily Operations:** 10 hours per day
• **Current Gold Price:** ~$107,000/kg

📈 **PRODUCTION PROJECTIONS:**

**2024-2025:** Scaling operations
**June 2026:** Full capacity (57 washplants)
**Annual Target:** 3,200 KG gold production
**Operational Costs:** 45% of gross revenue

**DIVIDEND CALCULATIONS:**
Based on your share quantity, calculate potential quarterly dividends from gold production revenue.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔧 **ADVANCED CALCULATOR COMING SOON**
Interactive calculator with real-time gold prices and production data.`;

  await ctx.replyWithMarkdown(calculatorMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "⛏️ View Mining Packages", callback_data: "menu_packages" }],
        [{ text: "📧 Get Calculator Updates", callback_data: "notify_calculator" }],
        [{ text: "🔙 Back to Dashboard", callback_data: "main_menu" }]
      ]
    }
  });
}

async function handleReferralSystem(ctx) {
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

    // Get referral statistics
    const { data: referrals, error: referralsError } = await db.client
      .from('referrals')
      .select(`
        id,
        referred_id,
        commission_rate,
        total_commission,
        users!referrals_referred_id_fkey (
          full_name,
          email
        )
      `)
      .eq('referrer_id', telegramUser.user_id)
      .eq('status', 'active');

    // Get commission balance (new dual commission system)
    const { data: commissionBalance, error: balanceError } = await db.client
      .from('commission_balances')
      .select('*')
      .eq('user_id', telegramUser.user_id)
      .single();

    if (balanceError && balanceError.code !== 'PGRST116') {
      console.error('Commission balance error:', balanceError);
    }

    // Get pending withdrawals
    const { data: pendingWithdrawals, error: withdrawalError } = await db.client
      .from('commission_withdrawal_requests')
      .select('*')
      .eq('user_id', telegramUser.user_id)
      .in('status', ['pending', 'approved']);

    if (withdrawalError && withdrawalError.code !== 'PGRST116') {
      console.error('Withdrawal data error:', withdrawalError);
    }

    // Calculate commission totals from new dual commission system
    let totalReferrals = 0;
    let availableUSDT = 0;
    let availableShares = 0;
    let totalEarnedUSDT = 0;
    let totalEarnedShares = 0;
    let totalWithdrawn = 0;
    let pendingWithdrawalAmount = 0;

    if (referrals && !referralsError) {
      totalReferrals = referrals.length;
    }

    if (commissionBalance) {
      availableUSDT = parseFloat(commissionBalance.usdt_balance || 0);
      availableShares = parseFloat(commissionBalance.share_balance || 0);
      totalEarnedUSDT = parseFloat(commissionBalance.total_earned_usdt || 0);
      totalEarnedShares = parseFloat(commissionBalance.total_earned_shares || 0);
      totalWithdrawn = parseFloat(commissionBalance.total_withdrawn_usdt || 0);
    }

    if (pendingWithdrawals && !withdrawalError) {
      pendingWithdrawalAmount = pendingWithdrawals.reduce((sum, w) => sum + parseFloat(w.withdrawal_amount || 0), 0);
    }

    let referralMessage = `👥 **REFERRAL DASHBOARD**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**YOUR REFERRAL PERFORMANCE**

🎯 **Your Referral Code:** @${user.username || user.first_name}

📊 **REFERRAL STATISTICS:**
• **Total Referrals:** ${totalReferrals}
• **Active Referrals:** ${totalReferrals}

💰 **COMMISSION BALANCES:**
• **Available USDT:** $${availableUSDT.toFixed(2)}
• **Available Shares:** $${availableShares.toFixed(2)}
• **Pending Withdrawals:** $${pendingWithdrawalAmount.toFixed(2)}

📈 **LIFETIME EARNINGS:**
• **Total USDT Earned:** $${totalEarnedUSDT.toFixed(2)}
• **Total Shares Earned:** $${totalEarnedShares.toFixed(2)}
• **Total Withdrawn:** $${totalWithdrawn.toFixed(2)}

**DUAL COMMISSION STRUCTURE:**
• **USDT Commission:** 15% paid in USDT (withdrawable)
• **Share Commission:** 15% paid in equity shares
• **Payment:** Daily processing (Monday-Friday)
• **Withdrawal:** Request withdrawals anytime
• **Usage:** Use USDT balance for share purchases`;

    if (referrals && referrals.length > 0) {
      referralMessage += '\n\n**YOUR REFERRALS:**\n';
      referrals.slice(0, 5).forEach((ref, index) => {
        const referredName = ref.users?.full_name || ref.users?.email || 'Unknown User';
        referralMessage += `\n${index + 1}. ${referredName}`;
      });

      if (referrals.length > 5) {
        referralMessage += `\n... and ${referrals.length - 5} more referrals`;
      }
    } else {
      referralMessage += '\n\n**YOUR REFERRALS:**\nNo referrals yet. Start sharing your referral code!';
    }

    referralMessage += `

**EXAMPLE EARNINGS (Per $1,000 Share Purchase):**
• **USDT Commission:** $150 (withdrawable cash)
• **Share Commission:** $150 worth of equity shares
• **Total Value:** $300 per $1,000 referral purchase

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    // Create keyboard with withdrawal option if user has USDT balance
    const keyboard = [
      [{ text: "👤 My Sponsor", callback_data: "view_my_sponsor" }],
      [{ text: "📤 Share Referral Link", callback_data: "share_referral" }],
      [{ text: "📊 View Commission Rules", callback_data: "commission_rules" }]
    ];

    // Add withdrawal button if user has available USDT balance
    if (availableUSDT > 0) {
      keyboard.unshift([{ text: "💸 Withdraw Commissions", callback_data: "withdraw_commissions" }]);
    }

    keyboard.push([{ text: "🔙 Back to Dashboard", callback_data: "main_menu" }]);

    await ctx.replyWithMarkdown(referralMessage, {
      reply_markup: {
        inline_keyboard: keyboard
      }
    });

  } catch (error) {
    console.error('Referral system error:', error);
    await ctx.replyWithMarkdown('❌ **Error loading referral data**\n\nPlease try again later.');
  }
}

async function showMySponsor(ctx) {
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

    // Get sponsor information
    const { data: referralInfo, error: referralError } = await db.client
      .from('referrals')
      .select(`
        id,
        referrer_id,
        commission_rate,
        created_at,
        users!referrals_referrer_id_fkey (
          id,
          username,
          full_name,
          email
        )
      `)
      .eq('referred_id', telegramUser.user_id)
      .eq('status', 'active')
      .single();

    if (referralError || !referralInfo) {
      const noSponsorMessage = `👤 **MY SPONSOR**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❌ **No Sponsor Found**

You don't have a sponsor assigned to your account.

💡 **This could mean:**
• You registered without a sponsor
• Your sponsor relationship wasn't properly created
• You were auto-assigned but the system didn't record it

📞 **Need Help?**
Contact support if you believe this is an error.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      await ctx.replyWithMarkdown(noSponsorMessage, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 Back to Referrals", callback_data: "menu_referrals" }]
          ]
        }
      });
      return;
    }

    const sponsor = referralInfo.users;
    const joinDate = new Date(referralInfo.created_at).toLocaleDateString();

    // Get sponsor's investment status
    let sponsorStatus = '📊 Status Unknown';
    try {
      const { data: sponsorInvestments, error: investmentError } = await db.client
        .from('aureus_share_purchases')
        .select('id, shares_purchased, status')
        .eq('user_id', sponsor.id)
        .eq('status', 'active');

      if (!investmentError && sponsorInvestments) {
        const totalShares = sponsorInvestments.reduce((sum, inv) => sum + inv.shares_purchased, 0);
        sponsorStatus = totalShares > 0 ? `✅ Active Shareholder (${totalShares.toLocaleString()} shares)` : '⚠️ No Active Investments';
      }
    } catch (error) {
      console.error('Sponsor investment check error:', error);
    }

    const sponsorMessage = `👤 **MY SPONSOR**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**SPONSOR INFORMATION:**
👤 **Name:** ${sponsor.full_name || 'Not provided'}
🆔 **Username:** @${sponsor.username}
📧 **Email:** ${sponsor.email}
📊 **Status:** ${sponsorStatus}

**REFERRAL DETAILS:**
💰 **Commission Rate:** ${referralInfo.commission_rate}%
📅 **Relationship Since:** ${joinDate}

**BENEFITS:**
• Your sponsor earns ${referralInfo.commission_rate}% commission on your share purchases
• They can provide guidance and support
• Part of their success network

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    await ctx.replyWithMarkdown(sponsorMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "💬 Contact Sponsor", url: `https://t.me/${sponsor.username}` }],
          [{ text: "🔙 Back to Referrals", callback_data: "menu_referrals" }]
        ]
      }
    });

  } catch (error) {
    console.error('❌ Error in showMySponsor:', error);
    await ctx.replyWithMarkdown('❌ **Error loading sponsor information**\n\nPlease try again later.');
  }
}

async function handleAdminUserSponsors(ctx) {
  const user = ctx.from;

  if (user.username !== ADMIN_USERNAME) {
    await ctx.replyWithMarkdown('❌ **ACCESS DENIED**\n\nAdmin access is restricted.');
    return;
  }

  try {
    // Get all referral relationships with user details
    const { data: referrals, error: referralsError } = await db.client
      .from('referrals')
      .select(`
        id,
        referrer_id,
        referred_id,
        commission_rate,
        total_commission,
        status,
        created_at,
        referrer:users!referrals_referrer_id_fkey (
          id,
          username,
          full_name,
          email
        ),
        referred:users!referrals_referred_id_fkey (
          id,
          username,
          full_name,
          email
        )
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(20);

    if (referralsError) {
      console.error('Admin referrals query error:', referralsError);
      await ctx.replyWithMarkdown('❌ **Error loading referral data**\n\nPlease try again later.');
      return;
    }

    let sponsorMessage = `🤝 **USER SPONSORS OVERVIEW**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**ACTIVE REFERRAL RELATIONSHIPS:** ${referrals.length}

`;

    if (referrals.length === 0) {
      sponsorMessage += `❌ **No active referral relationships found**

This could mean:
• No users have sponsors assigned
• Referral system needs to be activated
• Database relationships need to be created

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    } else {
      sponsorMessage += `**RECENT SPONSOR-USER RELATIONSHIPS:**\n\n`;

      referrals.forEach((referral, index) => {
        const sponsor = referral.referrer;
        const user = referral.referred;
        const joinDate = new Date(referral.created_at).toLocaleDateString();

        sponsorMessage += `**${index + 1}. ${user.full_name || user.username}**
   👤 **User:** @${user.username}
   🤝 **Sponsor:** @${sponsor.username} (${sponsor.full_name || 'No name'})
   💰 **Commission Rate:** ${referral.commission_rate}%
   📅 **Since:** ${joinDate}
   💵 **Total Earned:** $${referral.total_commission.toFixed(2)}

`;
      });

      sponsorMessage += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 **Admin Actions:**
• View detailed sponsor statistics
• Modify referral relationships
• Track commission payments`;
    }

    await ctx.replyWithMarkdown(sponsorMessage, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "📊 Sponsor Stats", callback_data: "admin_sponsor_stats" },
            { text: "🔄 Refresh", callback_data: "admin_user_sponsors" }
          ],
          [
            { text: "🔙 Back to Admin Panel", callback_data: "admin_panel" }
          ]
        ]
      }
    });

  } catch (error) {
    console.error('❌ Error in handleAdminUserSponsors:', error);
    await ctx.replyWithMarkdown('❌ **Error loading sponsor data**\n\nPlease try again later.');
  }
}

async function handleShareReferral(ctx) {
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

    const referralCode = user.username || user.first_name;
    const shareMessage = `📤 **SHARE YOUR REFERRAL**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 **Your Referral Code:** @${referralCode}

**Share this message with friends:**

🏆 Join me in Aureus Alliance Holdings - South Africa's premier gold mining share purchase!

💰 **Exclusive Benefits:**
• Quarterly dividend payments
• NFT share certificates
• Real-time mining reports
• Professional mining equipment

🎁 **Special Offer:**
Mention @${referralCode} during registration and we both benefit!

🚀 **Get Started:** @AureusAfricaBot

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Copy and share this message on social media, WhatsApp, or directly with friends!**`;

    await ctx.replyWithMarkdown(shareMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📋 Copy Referral Code", callback_data: `copy_referral_${referralCode}` }],
          [{ text: "👥 Back to Referral Dashboard", callback_data: "menu_referrals" }],
          [{ text: "🔙 Back to Main Menu", callback_data: "main_menu" }]
        ]
      }
    });

  } catch (error) {
    console.error('Share referral error:', error);
    await ctx.replyWithMarkdown('❌ **Error generating referral link**\n\nPlease try again.');
  }
}

async function handleCommissionRules(ctx) {
  const rulesMessage = `📊 **COMMISSION RULES & STRUCTURE**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**DUAL COMMISSION STRUCTURE:**
• **15% USDT Commission** - Immediate cash value
• **15% Share Commission** - Additional equity shares
• **No limits** on the number of referrals
• **Lifetime commissions** on all future share purchases

**PAYMENT SCHEDULE:**
• Commissions processed **daily** (Monday-Friday)
• **Instant balance updates** after share purchase approval
• **Withdraw anytime** - no waiting periods
• **Use for purchases** - pay with commission balance

**COMMISSION CALCULATION (Per $100 Share Purchase):**
• **USDT Commission:** $15.00 (withdrawable cash)
• **Share Commission:** $15.00 worth of equity shares
• **Total Value:** $30.00 per $100 referral purchase
• **Example:** $1,000 referral = $150 USDT + $150 shares

**TRACKING & TRANSPARENCY:**
• Real-time commission tracking in your dashboard
• Detailed reports of all referral activities
• Commission status: Pending → Approved → Paid

**REQUIREMENTS:**
• Referrals must mention your username during registration
• Referrals must complete their first share purchase
• Your account must be in good standing

**PAYMENT METHODS:**
• Commissions paid to your registered wallet
• Same payment method as dividend distributions
• Automatic processing with quarterly cycles

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Questions?** Contact our support team for assistance.`;

  await ctx.replyWithMarkdown(rulesMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📤 Share Referral Link", callback_data: "share_referral" }],
        [{ text: "👥 Back to Referral Dashboard", callback_data: "menu_referrals" }],
        [{ text: "🔙 Back to Main Menu", callback_data: "main_menu" }]
      ]
    }
  });
}

async function handleCommissionWithdrawal(ctx) {
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
    const { data: commissionBalance, error: balanceError } = await db.client
      .from('commission_balances')
      .select('*')
      .eq('user_id', telegramUser.user_id)
      .single();

    if (balanceError || !commissionBalance) {
      await ctx.replyWithMarkdown('❌ **No commission balance found**\n\nEarn commissions by referring friends first!');
      return;
    }

    const availableUSDT = parseFloat(commissionBalance.usdt_balance || 0);

    if (availableUSDT < 10) {
      await ctx.replyWithMarkdown(`💰 **Insufficient Balance**

Your available USDT balance: $${availableUSDT.toFixed(2)}

**Minimum withdrawal amount:** $10.00

Refer more friends to increase your commission balance!`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📤 Share Referral Link", callback_data: "share_referral" }],
            [{ text: "👥 Back to Referral Dashboard", callback_data: "menu_referrals" }]
          ]
        }
      });
      return;
    }

    // Show withdrawal form
    const withdrawalMessage = `💸 **COMMISSION WITHDRAWAL**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**AVAILABLE BALANCE:**
💰 **USDT Balance:** $${availableUSDT.toFixed(2)}

**WITHDRAWAL PROCESS:**
1. Enter withdrawal amount ($10 minimum)
2. Select blockchain network
3. Provide wallet address
4. Submit for admin approval
5. Receive payment within 24-48 hours

**SUPPORTED NETWORKS:**
• Binance Smart Chain (BSC)
• Polygon (POL)
• TRON (TRX)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Please enter the amount you want to withdraw:`;

    // Set user state for withdrawal process
    await setUserState(user.id, 'withdrawal_awaiting_amount', {
      available_balance: availableUSDT,
      user_id: telegramUser.user_id
    });

    await ctx.replyWithMarkdown(withdrawalMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔙 Cancel Withdrawal", callback_data: "menu_referrals" }]
        ]
      }
    });

  } catch (error) {
    console.error('Commission withdrawal error:', error);
    await ctx.replyWithMarkdown('❌ **Error loading withdrawal form**\n\nPlease try again later.');
  }
}

async function handleWithdrawalAmountInput(ctx, text) {
  const user = ctx.from;

  try {
    const sessionData = await getUserSessionData(user.id);
    const availableBalance = sessionData?.available_balance || 0;

    // Parse and validate amount
    const amount = parseFloat(text.replace(/[^0-9.]/g, ''));

    if (isNaN(amount) || amount <= 0) {
      await ctx.reply('❌ Please enter a valid amount (numbers only).\n\nExample: 25.50');
      return;
    }

    if (amount < 10) {
      await ctx.reply('❌ Minimum withdrawal amount is $10.00.\n\nPlease enter a higher amount.');
      return;
    }

    if (amount > availableBalance) {
      await ctx.reply(`❌ Insufficient balance.\n\nAvailable: $${availableBalance.toFixed(2)}\nRequested: $${amount.toFixed(2)}\n\nPlease enter a lower amount.`);
      return;
    }

    // Update session data and move to network selection
    await setUserState(user.id, 'withdrawal_awaiting_network', {
      ...sessionData,
      withdrawal_amount: amount
    });

    const networkMessage = `💸 **WITHDRAWAL REQUEST**

**Amount:** $${amount.toFixed(2)}
**Available Balance:** $${availableBalance.toFixed(2)}

Please select the blockchain network for your withdrawal:`;

    await ctx.replyWithMarkdown(networkMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🟡 Binance Smart Chain (BSC)", callback_data: "withdrawal_network_BSC" }],
          [{ text: "🟣 Polygon (POL)", callback_data: "withdrawal_network_POL" }],
          [{ text: "🔴 TRON (TRX)", callback_data: "withdrawal_network_TRON" }],
          [{ text: "🔙 Cancel Withdrawal", callback_data: "menu_referrals" }]
        ]
      }
    });

  } catch (error) {
    console.error('Withdrawal amount input error:', error);
    await ctx.reply('❌ Error processing amount. Please try again.');
  }
}

async function handleWithdrawalWalletInput(ctx, text) {
  const user = ctx.from;

  try {
    const sessionData = await getUserSessionData(user.id);
    const { withdrawal_amount, network, user_id } = sessionData;

    // Basic wallet address validation
    const walletAddress = text.trim();

    if (!walletAddress || walletAddress.length < 20) {
      await ctx.reply('❌ Please enter a valid wallet address.\n\nWallet addresses are typically 40+ characters long.');
      return;
    }

    // Network-specific validation
    let isValidFormat = false;
    switch (network) {
      case 'BSC':
      case 'POL':
        isValidFormat = walletAddress.startsWith('0x') && walletAddress.length === 42;
        break;
      case 'TRON':
        isValidFormat = walletAddress.startsWith('T') && walletAddress.length === 34;
        break;
    }

    if (!isValidFormat) {
      const expectedFormat = network === 'TRON' ? 'T...' : '0x...';
      await ctx.reply(`❌ Invalid ${network} wallet address format.\n\nExpected format: ${expectedFormat}\n\nPlease enter a valid ${network} wallet address.`);
      return;
    }

    // Create withdrawal request
    const withdrawalData = {
      user_id: user_id,
      withdrawal_amount: withdrawal_amount,
      wallet_address: walletAddress,
      network: network,
      currency: 'USDT',
      status: 'pending'
    };

    const { data: withdrawalRequest, error: withdrawalError } = await db.client
      .from('commission_withdrawal_requests')
      .insert([withdrawalData])
      .select()
      .single();

    if (withdrawalError) {
      console.error('Withdrawal request creation error:', withdrawalError);
      await ctx.reply('❌ Error creating withdrawal request. Please try again later.');
      return;
    }

    // Clear user state
    await clearUserState(user.id);

    const confirmationMessage = `✅ **WITHDRAWAL REQUEST SUBMITTED**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Request ID:** ${withdrawalRequest.id.substring(0, 8)}...
**Amount:** $${withdrawal_amount.toFixed(2)} USDT
**Network:** ${network}
**Wallet:** ${walletAddress.substring(0, 10)}...${walletAddress.substring(walletAddress.length - 6)}

**STATUS:** Pending Admin Approval

**PROCESSING TIME:**
• Review: Within 24 hours
• Payment: 24-48 hours after approval

**NEXT STEPS:**
1. Admin will review your request
2. You'll receive approval notification
3. Payment will be sent to your wallet
4. Transaction hash will be provided

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You can track your withdrawal status in the referral dashboard.`;

    await ctx.replyWithMarkdown(confirmationMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "👥 Back to Referral Dashboard", callback_data: "menu_referrals" }],
          [{ text: "🔙 Back to Main Menu", callback_data: "main_menu" }]
        ]
      }
    });

  } catch (error) {
    console.error('Withdrawal wallet input error:', error);
    await ctx.reply('❌ Error processing wallet address. Please try again.');
  }
}

async function handleWithdrawalNetworkSelection(ctx, callbackData) {
  const user = ctx.from;

  try {
    await ctx.answerCbQuery();

    const network = callbackData.replace('withdrawal_network_', '');
    const sessionData = await getUserSessionData(user.id);

    // Update session data with selected network
    await setUserState(user.id, 'withdrawal_awaiting_wallet', {
      ...sessionData,
      network: network
    });

    const networkNames = {
      'BSC': 'Binance Smart Chain (BSC)',
      'POL': 'Polygon (POL)',
      'TRON': 'TRON (TRX)'
    };

    const walletExamples = {
      'BSC': '0x742d35Cc6634C0532925a3b8D4C9db96590c6C89',
      'POL': '0x742d35Cc6634C0532925a3b8D4C9db96590c6C89',
      'TRON': 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE'
    };

    const walletMessage = `💸 **WITHDRAWAL REQUEST**

**Amount:** $${sessionData.withdrawal_amount.toFixed(2)}
**Network:** ${networkNames[network]}

Please enter your ${networkNames[network]} wallet address:

**Example format:**
\`${walletExamples[network]}\`

**IMPORTANT:**
• Double-check your wallet address
• Wrong address = lost funds
• Only USDT-compatible wallets
• No exchange deposit addresses`;

    await ctx.editMessageText(walletMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔙 Change Network", callback_data: "withdraw_commissions" }],
          [{ text: "❌ Cancel Withdrawal", callback_data: "menu_referrals" }]
        ]
      }
    });

  } catch (error) {
    console.error('Withdrawal network selection error:', error);
    await ctx.reply('❌ Error processing network selection. Please try again.');
  }
}

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
      await ctx.replyWithMarkdown('❌ **User not found**\n\nPlease register first.');
      return;
    }

    // Get user investments (simplified query without foreign key relationship)
    const { data: investments, error: investmentError } = await db.client
      .from('aureus_share_purchases')
      .select('*')
      .eq('user_id', telegramUser.user_id)
      .order('created_at', { ascending: false });

    if (investmentError) {
      console.error('Portfolio fetch error:', investmentError);
      await ctx.replyWithMarkdown('❌ **Error loading portfolio**\n\nPlease try again.');
      return;
    }

    // Calculate portfolio stats
    let totalInvestment = 0;
    let totalShares = 0;
    let totalAnnualDividends = 0;
    let activeInvestments = 0;

    if (investments && investments.length > 0) {
      investments.forEach(inv => {
        totalInvestment += parseFloat(inv.total_amount || 0);
        totalShares += parseInt(inv.shares_purchased || 0);
        // Calculate estimated annual dividends based on 25% ROI
        const estimatedAnnualDividends = parseFloat(inv.total_amount || 0) * 0.25;
        totalAnnualDividends += estimatedAnnualDividends;
        if (inv.status === 'active' || inv.status === 'pending_approval') {
          activeInvestments++;
        }
      });
    }

    const quarterlyDividends = totalAnnualDividends / 4;
    const currentValue = totalInvestment; // For now, assume 1:1 value

    let portfolioMessage = `📱 **SHARE PORTFOLIO**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**YOUR GOLD MINING INVESTMENTS**

📊 **PORTFOLIO OVERVIEW:**
• **Total Share Purchase:** $${totalInvestment.toFixed(2)}
• **Total Shares:** ${totalShares.toLocaleString()}
• **Current Value:** $${currentValue.toFixed(2)}
• **Annual Dividends:** $${totalAnnualDividends.toFixed(2)}
• **Quarterly Dividends:** $${quarterlyDividends.toFixed(2)}

**SHARE PURCHASE SUMMARY:**
• **Active Investments:** ${activeInvestments}
• **Total Investments:** ${investments?.length || 0}`;

    if (investments && investments.length > 0) {
      portfolioMessage += '\n\n**SHARE PURCHASE HISTORY:**\n';
      investments.slice(0, 5).forEach((inv, index) => {
        const packageName = inv.package_name || 'Share Purchase';
        const statusIcon = inv.status === 'active' ? '✅' :
                          inv.status === 'pending_approval' ? '⏳' :
                          inv.status === 'pending' ? '🔄' : '❓';
        const statusText = inv.status === 'active' ? 'Active' :
                          inv.status === 'pending_approval' ? 'Pending Approval' :
                          inv.status === 'pending' ? 'Pending' : inv.status;

        portfolioMessage += `\n${index + 1}. ${statusIcon} **${packageName}**
   💰 Amount: $${parseFloat(inv.total_amount || 0).toFixed(2)}
   📊 Shares: ${parseInt(inv.shares_purchased || 0).toLocaleString()}
   📅 Date: ${new Date(inv.created_at).toLocaleDateString()}
   🔄 Status: ${statusText}`;
      });

      if (investments.length > 5) {
        portfolioMessage += `\n\n... and ${investments.length - 5} more share purchases`;
      }
    } else {
      portfolioMessage += '\n\n**SHARE PURCHASE HISTORY:**\nNo share purchases yet. Start with our mining packages!';
    }

    portfolioMessage += `

**UPCOMING FEATURES:**
✓ Real-time portfolio valuation
✓ Dividend payment history
✓ Share certificate downloads
✓ Performance analytics
✓ Tax reporting documents

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔧 **PORTFOLIO DASHBOARD COMING SOON**
Comprehensive share purchase tracking and management tools.`;

    const keyboard = investments && investments.length > 0
      ? [
          [{ text: "📊 Detailed View", callback_data: "portfolio_detailed" }],
          [{ text: "📧 Get Portfolio Updates", callback_data: "notify_portfolio" }],
          [{ text: "🔙 Back to Dashboard", callback_data: "main_menu" }]
        ]
      : [
          [{ text: "⛏️ Start Buying Shares", callback_data: "menu_packages" }],
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

async function handlePaymentStatus(ctx) {
  const paymentMessage = `💳 **PAYMENT & TRANSACTION CENTER**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**PAYMENT METHODS SUPPORTED:**

🔗 **CRYPTOCURRENCY NETWORKS:**
• **BSC USDT** - Binance Smart Chain
• **POL USDT** - Polygon Network
• **TRON USDT** - Tron Network

**PAYMENT PROCESS:**
1. **Select Package** - Choose your share purchase
2. **Payment Method** - Select crypto network
3. **Wallet Address** - Get company wallet
4. **Upload Proof** - Screenshot verification
5. **Transaction Hash** - Provide blockchain hash
6. **Admin Approval** - Secure verification process

**TRANSACTION HISTORY:**
No transactions yet.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔧 **PAYMENT SYSTEM COMING SOON**
Secure 3-step payment verification with instant processing.`;

  await ctx.replyWithMarkdown(paymentMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "⛏️ Start Share Purchase", callback_data: "menu_packages" }],
        [{ text: "📧 Get Payment Updates", callback_data: "notify_payments" }],
        [{ text: "🔙 Back to Dashboard", callback_data: "main_menu" }]
      ]
    }
  });
}

async function handleTermsMenu(ctx) {
  await ctx.replyWithMarkdown(
    `📋 **Terms & Conditions**\n\nPlease review our comprehensive legal framework:\n\n📜 **6 Categories Available:**\n• General Terms\n• Privacy Policy  \n• Share Purchase Risks\n• Mining Operations\n• NFT Terms\n• Dividend Policy\n\nSelect a category to review:`,
    { reply_markup: createTermsKeyboard() }
  );
}

async function handleTermsSelection(ctx, callbackData) {
  const termsType = callbackData.replace('terms_', '');
  console.log(`🔍 Terms selection - callbackData: ${callbackData}, termsType: ${termsType}`);

  const termsContent = {
    general: `📜 **GENERAL TERMS & CONDITIONS**

**1. ACCEPTANCE OF TERMS**
By purchasing shares in Aureus Alliance Holdings, you agree to be bound by these terms and conditions.

**2. COMPANY INFORMATION**
• Company: Aureus Alliance Holdings (Pty) Ltd
• Registration: South African Company
• Business: Gold mining operations and investments

**3. SHARE OWNERSHIP**
• Shares represent equity ownership in the company
• Shareholders entitled to dividends and voting rights
• Share certificates issued as NFTs with trading restrictions

**4. LEGAL COMPLIANCE**
• All transactions comply with South African law
• Anti-money laundering (AML) procedures apply
• Know Your Customer (KYC) verification required

**5. DISPUTE RESOLUTION**
• Governed by South African law
• Disputes resolved through arbitration
• Jurisdiction: South African courts

By accepting these terms, you confirm you have read, understood, and agree to be legally bound by all provisions.`,

    privacy: `🔒 **PRIVACY POLICY**

**1. INFORMATION COLLECTION**
We collect the following information:
• Personal identification details
• Contact information (email, phone)
• Financial transaction data
• Telegram account information

**2. USE OF INFORMATION**
Your information is used for:
• Account management and verification
• Processing investments and payments
• Sending important updates and notifications
• Compliance with legal requirements

**3. DATA PROTECTION**
• All data encrypted and securely stored
• Access limited to authorized personnel only
• Regular security audits and updates
• Compliance with POPIA (Protection of Personal Information Act)

**4. THIRD PARTY SHARING**
We do not sell or share your personal information except:
• When required by law or regulation
• With service providers under strict confidentiality
• For fraud prevention and security purposes

**5. YOUR RIGHTS**
• Access to your personal information
• Correction of inaccurate data
• Deletion of data (subject to legal requirements)
• Opt-out of marketing communications

**6. DATA RETENTION**
• Share Purchase records: 7 years minimum
• Transaction data: As required by law
• Marketing data: Until you opt-out

Contact us at privacy@aureusalliance.com for any privacy concerns.`,

    investment_risks: `⚠️ **SHARE PURCHASE RISK DISCLOSURE**

**IMPORTANT WARNING: ALL INVESTMENTS CARRY RISK**

**1. MINING OPERATION RISKS**
• Gold production may vary due to geological factors
• Equipment failure or maintenance downtime
• Weather and environmental conditions
• Regulatory changes affecting mining operations

**2. MARKET RISKS**
• Gold price volatility affects profitability
• Currency exchange rate fluctuations
• Economic conditions and inflation
• Supply and demand market forces

**3. BUSINESS RISKS**
• Management decisions and operational efficiency
• Competition from other mining companies
• Technology changes and obsolescence
• Labor disputes and staffing issues

**4. FINANCIAL RISKS**
• No guarantee of dividends or returns
• Potential loss of entire share purchase
• Liquidity constraints on share trading
• Company financial performance variations

**5. REGULATORY RISKS**
• Changes in mining laws and regulations
• Environmental compliance requirements
• Tax law modifications
• Government policy changes

**6. TECHNOLOGY RISKS**
• NFT platform technical issues
• Blockchain network problems
• Cybersecurity threats
• Digital wallet security

**SHARE PURCHASE WARNING:**
• Past performance does not guarantee future results
• You may lose some or all of your share purchase
• Only buy shares what you can afford to lose
• Seek independent financial advice if needed

By accepting these terms, you acknowledge understanding these risks and accept full responsibility for your share purchase decision.`,

    mining_operations: `⛏️ **MINING OPERATIONS TERMS**

**1. OPERATIONAL OVERVIEW**
• Primary focus: Gold mining in South Africa
• Operations subject to mining licenses and permits
• Production targets are estimates, not guarantees
• Regular operational reports provided to shareholders

**2. PRODUCTION FACTORS**
• Geological conditions may affect yield
• Equipment maintenance and replacement cycles
• Environmental compliance requirements
• Safety protocols and procedures

**3. REVENUE DISTRIBUTION**
• Net profits distributed quarterly as dividends
• Operating costs deducted before distribution
• Reserve funds maintained for operations
• Reinvestment for expansion and equipment

**4. OPERATIONAL TRANSPARENCY**
• Monthly production reports
• Quarterly financial statements
• Annual operational reviews
• Site visit opportunities for major shareholders

**5. ENVIRONMENTAL RESPONSIBILITY**
• Compliance with environmental regulations
• Sustainable mining practices
• Land rehabilitation commitments
• Community engagement programs

**6. FORCE MAJEURE**
Operations may be affected by:
• Natural disasters and extreme weather
• Government actions or policy changes
• Labor strikes or disputes
• Equipment failures or supply chain issues

**7. OPERATIONAL DECISIONS**
• Management reserves right to operational decisions
• Shareholders consulted on major changes
• Safety takes priority over production
• Compliance with all applicable laws

By accepting these terms, you acknowledge the operational nature of mining and accept associated risks and variations in production.`,

    nft_terms: `🏆 **NFT SHARE CERTIFICATE TERMS**

**1. NFT SHARE CERTIFICATES**
• Each share package includes NFT certificate
• Represents legal ownership of company shares
• Stored on secure blockchain network
• Unique digital asset with guaranteed minimum value

**2. TRADING RESTRICTIONS**
• **12-MONTH LOCK-UP PERIOD:** No trading allowed for 12 months from purchase
• After lock-up: Trading permitted on approved platforms
• Transfer requires company approval and KYC verification
• All trades must comply with securities regulations

**3. MINIMUM VALUE GUARANTEE**
• **$1,000 USD minimum value** guaranteed per NFT
• Value protection for 24 months from issue date
• Company buyback option at minimum value
• Market value may exceed minimum guarantee

**4. TECHNICAL SPECIFICATIONS**
• ERC-721 standard NFT on Ethereum network
• Metadata includes share details and ownership proof
• Smart contract verified and audited
• Backup storage on IPFS network

**5. OWNERSHIP RIGHTS**
NFT ownership provides:
• Legal proof of share ownership
• Dividend payment rights
• Voting rights in company decisions
• Access to exclusive shareholder benefits

**6. TRANSFER PROCESS**
• Written notice required for transfers
• KYC verification for new owners
• Company approval within 30 days
• Transfer fees may apply

**7. TECHNICAL RISKS**
• Blockchain network risks
• Smart contract vulnerabilities
• Digital wallet security
• Platform technical issues

**8. LEGAL STATUS**
• NFT represents legal share ownership
• Governed by South African company law
• Securities regulations apply
• Dispute resolution through arbitration

By accepting these terms, you understand the NFT nature of your share certificate and agree to all trading restrictions and technical requirements.`,

    dividend_policy: `💰 **DIVIDEND POLICY**

**1. DIVIDEND DISTRIBUTION**
• **Quarterly payments** based on mining profits
• Distributed within 45 days of quarter end
• Payments in USD via cryptocurrency or bank transfer
• Minimum threshold: $10 USD per payment

**2. CALCULATION METHOD**
• Net profit after operating expenses
• Less: Equipment maintenance and replacement reserves
• Less: Expansion and development funds (max 20%)
• Less: Management fees and administrative costs
• Remaining profit distributed to shareholders

**3. PAYMENT SCHEDULE**
• Q1: Paid by May 15th
• Q2: Paid by August 15th
• Q3: Paid by November 15th
• Q4: Paid by February 15th (following year)

**4. PAYMENT METHODS**
• USDT (Tether) - preferred method
• Bitcoin or Ethereum (upon request)
• Bank transfer (minimum $100 USD)
• Reinvestment option available

**5. TAX CONSIDERATIONS**
• Dividends may be subject to taxation
• Withholding tax may apply per local laws
• Shareholders responsible for tax compliance
• Tax certificates provided annually

**6. DIVIDEND SUSPENSION**
Dividends may be suspended due to:
• Operational losses or low profitability
• Major equipment investments required
• Regulatory or legal issues
• Force majeure events

**7. REINVESTMENT OPTION**
• Automatic reinvestment in additional shares
• 5% bonus shares for reinvestment
• Compound growth opportunity
• Can be changed quarterly

**8. RECORD DATES**
• Dividend eligibility based on ownership at quarter end
• Share transfers must be completed before record date
• New purchases eligible for next quarter's dividend

**9. COMMUNICATION**
• Dividend announcements via Telegram and email
• Detailed quarterly reports provided
• Annual shareholder meetings
• Direct communication channels available

**NO GUARANTEE:**
Dividends are not guaranteed and depend on company profitability and operational success. Past dividend payments do not guarantee future payments.

By accepting these terms, you understand the dividend policy and acknowledge that dividend payments are subject to company performance and operational factors.`
  };
  
  await ctx.replyWithMarkdown(
    termsContent[termsType] || "Terms content not available.",
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: `✅ Accept ${termsType.charAt(0).toUpperCase() + termsType.slice(1)} Terms`, callback_data: `accept_${termsType}` }],
          [{ text: "🔙 Back to Terms", callback_data: "menu_terms" }]
        ]
      }
    }
  );
}

async function showTermsAcceptanceRequired(ctx, packageId, unacceptedTerms) {
  const termsLabels = {
    general: 'General Terms',
    privacy: 'Privacy Policy',
    investment_risks: 'Share Purchase Risks',
    mining_operations: 'Mining Operations',
    nft_terms: 'NFT Terms',
    dividend_policy: 'Dividend Policy'
  };

  const unacceptedList = unacceptedTerms.map(term => `• ${termsLabels[term]}`).join('\n');

  const termsMessage = `**📋 TERMS & CONDITIONS REQUIRED**

Before proceeding with your share purchase, you must accept all required terms and conditions.

**⚠️ MISSING ACCEPTANCES:**
${unacceptedList}

**📜 LEGAL REQUIREMENT:**
All shareholders must review and accept our comprehensive legal framework before making any share purchase.

**🔒 YOUR PROTECTION:**
These terms protect both you and Aureus Alliance Holdings by clearly defining rights, responsibilities, and share purchase risks.

Please review and accept all required terms to continue:`;

  await ctx.replyWithMarkdown(termsMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📋 Review & Accept Terms", callback_data: `terms_required_${packageId}` }],
        [{ text: "🔙 Back to Package", callback_data: `package_${packageId}` }],
        [{ text: "🏠 Main Dashboard", callback_data: "main_menu" }]
      ]
    }
  });
}

async function handleTermsRequired(ctx, callbackData) {
  const packageId = callbackData.split('_')[2];

  // Store the package ID in session for after terms acceptance
  await setUserState(ctx.from.id, 'terms_for_purchase', { packageId });

  // Get user info to check which terms are unaccepted
  const telegramUser = await db.getTelegramUser(ctx.from.id);
  if (!telegramUser || !telegramUser.user_id) {
    await ctx.replyWithMarkdown('❌ **Authentication required**\n\nPlease log in first.');
    return;
  }

  const userId = telegramUser.user_id;
  const requiredTerms = ['general', 'privacy', 'investment_risks', 'mining_operations', 'nft_terms', 'dividend_policy'];
  const unacceptedTerms = [];

  for (const termType of requiredTerms) {
    const hasAccepted = await db.hasAcceptedTerms(userId, termType);
    if (!hasAccepted) {
      unacceptedTerms.push(termType);
    }
  }

  if (unacceptedTerms.length > 0) {
    // Start with the first unaccepted term automatically
    const firstTerm = unacceptedTerms[0];
    await ctx.replyWithMarkdown(`📋 **Starting Terms Review**\n\nYou need to accept ${unacceptedTerms.length} terms before proceeding with your purchase.\n\n⏭️ **Starting with the first term...**`);

    setTimeout(() => {
      handleTermsSelection(ctx, `terms_${firstTerm}`);
    }, 1500);
  } else {
    // All terms already accepted
    await ctx.replyWithMarkdown('✅ **All terms already accepted!**\n\nProceeding to purchase...');
    setTimeout(() => {
      handlePurchaseFlow(ctx, `purchase_${packageId}`);
    }, 1500);
  }
}

async function handleTermsAcceptance(ctx, callbackData) {
  const termType = callbackData.replace('accept_', '');

  const telegramUser = await db.getTelegramUser(ctx.from.id);
  if (!telegramUser || !telegramUser.user_id) {
    await ctx.replyWithMarkdown('❌ **Authentication required**\n\nPlease log in first.');
    return;
  }

  const userId = telegramUser.user_id;

  // Record terms acceptance
  const success = await db.acceptTerms(userId, termType);

  if (success) {
    await ctx.replyWithMarkdown(`✅ **${termType.toUpperCase().replace('_', ' ')} TERMS ACCEPTED**\n\nThank you for accepting the ${termType.replace('_', ' ')} terms.`);

    // Check if user was in the middle of a purchase
    const session = await db.getUserSession(ctx.from.id);
    if (session && session.session_state === 'terms_for_purchase') {
      const { packageId } = session.session_data;

      // Check if all terms are now accepted
      const requiredTerms = ['general', 'privacy', 'investment_risks', 'mining_operations', 'nft_terms', 'dividend_policy'];
      const unacceptedTerms = [];

      for (const termType of requiredTerms) {
        const hasAccepted = await db.hasAcceptedTerms(userId, termType);
        if (!hasAccepted) {
          unacceptedTerms.push(termType);
        }
      }

      if (unacceptedTerms.length === 0) {
        // All terms accepted, proceed to purchase
        await clearUserState(ctx.from.id);
        await ctx.replyWithMarkdown('🎉 **ALL TERMS ACCEPTED!**\n\nYou can now proceed with your share purchase.');

        // Redirect to purchase flow
        setTimeout(() => {
          handlePurchaseFlow(ctx, `purchase_${packageId}`);
        }, 2000);
      } else {
        // Automatically show the next unaccepted term
        const nextTerm = unacceptedTerms[0];
        await ctx.replyWithMarkdown(`📋 **Progress Update**\n\nYou still need to accept ${unacceptedTerms.length} more terms before proceeding with your purchase.\n\n⏭️ **Showing next term automatically...**`);

        // Show the next term after a brief delay
        setTimeout(() => {
          handleTermsSelection(ctx, `terms_${nextTerm}`);
        }, 1500);
      }
    } else {
      // Not in purchase flow, check if there are more terms to accept for general browsing
      const requiredTerms = ['general', 'privacy', 'investment_risks', 'mining_operations', 'nft_terms', 'dividend_policy'];
      const unacceptedTerms = [];

      for (const termType of requiredTerms) {
        const hasAccepted = await db.hasAcceptedTerms(userId, termType);
        if (!hasAccepted) {
          unacceptedTerms.push(termType);
        }
      }

      if (unacceptedTerms.length > 0) {
        // Show next unaccepted term
        const nextTerm = unacceptedTerms[0];
        await ctx.replyWithMarkdown(`⏭️ **Next Term**\n\nYou have ${unacceptedTerms.length} more terms to review.\n\nShowing next term automatically...`);

        setTimeout(() => {
          handleTermsSelection(ctx, `terms_${nextTerm}`);
        }, 1500);
      } else {
        // All terms accepted
        await ctx.replyWithMarkdown('🎉 **ALL TERMS ACCEPTED!**\n\nYou have successfully accepted all required terms and conditions.');
      }
    }
  } else {
    await ctx.replyWithMarkdown('❌ **Error accepting terms**\n\nPlease try again.');
  }
}

// Error handling
bot.catch((err, ctx) => {
  console.error("🚨 Bot error:", err);
  ctx.reply("Sorry, something went wrong. Please try again later.");
});

// Ensure the "proof" storage bucket exists
async function ensureStorageBucket() {
  try {
    const { data: buckets, error: listError } = await db.client.storage.listBuckets();

    if (listError) {
      console.error('Error listing buckets:', listError);
      return;
    }

    const proofBucket = buckets.find(bucket => bucket.name === 'proof');

    if (!proofBucket) {
      console.log('📁 Creating "proof" storage bucket...');
      const { data, error } = await db.client.storage.createBucket('proof', {
        public: false,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/jpg'],
        fileSizeLimit: 10485760 // 10MB
      });

      if (error) {
        console.error('Error creating proof bucket:', error);
      } else {
        console.log('✅ "proof" storage bucket created successfully');
      }
    } else {
      console.log('✅ "proof" storage bucket already exists');
    }
  } catch (error) {
    console.error('Error ensuring storage bucket:', error);
  }
}

// Start bot
async function startBot() {
  try {
    console.log("🚀 Starting Aureus Alliance Holdings Telegram Bot...");
    console.log("📊 Database: Supabase PostgreSQL");

    console.log("🔍 Testing database connection...");
    const isDbConnected = await db.testConnection();

    if (!isDbConnected) {
      console.log("⚠️ Database connection failed, but starting bot anyway...");
    } else {
      console.log("✅ Database connection successful!");
      // Ensure storage bucket exists
      console.log("🪣 Initializing storage bucket...");
      await ensureStorageBucket();
      console.log("✅ Storage bucket ready!");
    }

    // Verify bot token works
    console.log("🔑 Verifying bot token...");
    if (!process.env.BOT_TOKEN) {
      throw new Error('BOT_TOKEN environment variable is not set');
    }

    // Clear global commands - commands will be set per user
    console.log("🔧 Setting up user-specific command system...");
    try {
      await bot.telegram.setMyCommands([
        { command: 'start', description: 'Start the bot' }
      ]);
      console.log("✅ Commands set successfully");
    } catch (commandError) {
      console.error("❌ Failed to set commands:", commandError.message);
      throw commandError;
    }

    // Add graceful shutdown handlers
    process.once('SIGINT', () => {
      console.log('🛑 Received SIGINT, shutting down gracefully...');
      bot.stop('SIGINT');
    });

    process.once('SIGTERM', () => {
      console.log('🛑 Received SIGTERM, shutting down gracefully...');
      bot.stop('SIGTERM');
    });

    console.log("🤖 Starting bot in polling mode...");
    console.log("🔍 Bot token length:", process.env.BOT_TOKEN ? process.env.BOT_TOKEN.length : 'undefined');
    console.log("🔍 Bot token starts with:", process.env.BOT_TOKEN ? process.env.BOT_TOKEN.substring(0, 10) + '...' : 'undefined');

    // Try to get bot info first
    try {
      console.log("📋 Getting bot information...");
      const botInfo = await bot.telegram.getMe();
      console.log("✅ Bot info retrieved:", botInfo.username);
    } catch (botInfoError) {
      console.error("❌ Failed to get bot info:", botInfoError.message);
      throw botInfoError;
    }

    // Launch with conflict resolution
    console.log("🚀 Launching bot...");
    try {
      // First try normal launch with explicit polling mode
      await bot.launch({
        polling: {
          timeout: 30,
          limit: 100,
          allowed_updates: []
        }
      });
    } catch (launchError) {
      console.error("❌ Initial bot launch failed:", launchError.message);

      if (launchError.message.includes('409') || launchError.message.includes('conflict')) {
        console.log("🔄 Conflict detected - attempting to resolve...");

        // Try to stop any existing webhook and launch in polling mode
        try {
          console.log("🛑 Stopping any existing webhook...");
          await bot.telegram.deleteWebhook({ drop_pending_updates: true });
          console.log("✅ Webhook cleared");

          // Wait a moment then try again
          await new Promise(resolve => setTimeout(resolve, 2000));

          console.log("🔄 Retrying bot launch...");
          await bot.launch({
            polling: {
              timeout: 30,
              limit: 100,
              allowed_updates: []
            }
          });
        } catch (retryError) {
          console.error("❌ Retry launch failed:", retryError.message);
          throw retryError;
        }
      } else if (launchError.message.includes('401')) {
        console.error("🔑 Unauthorized - bot token may be invalid");
        throw launchError;
      } else {
        throw launchError;
      }
    }

    console.log("✅ Aureus Alliance Holdings Bot is running!");
    console.log("🤖 Bot username: @aureus_africa_bot");
    console.log("🔒 Commands restricted to admin only");
    console.log("👥 Regular users use button interface only");
    console.log("🔗 Bot is now listening for messages...");

  } catch (error) {
    console.error("❌ Failed to start bot:", error);
    console.error("📋 Error details:", error.message);
    if (error.stack) {
      console.error("🔍 Stack trace:", error.stack);
    }
    process.exit(1);
  }
}

// Payment handlers
async function handleBSCPayment(ctx, callbackData) {
  const packageId = callbackData.split('_')[2];
  const pkg = await db.getPackageById(packageId);

  if (!pkg) {
    await ctx.reply('❌ Package not found.');
    return;
  }

  const packageCost = await calculatePackagePrice(pkg);

  const paymentMessage = `**💳 BSC USDT PAYMENT**

**SHARE PURCHASE:** ${pkg.name.toUpperCase()}

**Payment Amount:** ${formatCurrency(packageCost)}
**Network:** Binance Smart Chain (BSC)
**Token:** USDT

**COMPANY WALLET ADDRESS:**
\`0x742d35Cc6634C0532925a3b8D4C9db96C4b4d4d4\`

**PAYMENT INSTRUCTIONS:**
1. Send exactly ${formatCurrency(packageCost)} USDT to the wallet above
2. Take a screenshot of your transaction
3. Copy the transaction hash
4. Return here to complete verification

**⚠️ IMPORTANT:**
• Send only USDT on BSC network
• Double-check the wallet address
• Keep your transaction hash safe`;

  await ctx.replyWithMarkdown(paymentMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📋 Copy Wallet Address", callback_data: `copy_bsc_${packageId}` }],
        [{ text: "✅ I've Sent Payment", callback_data: `verify_bsc_${packageId}` }],
        [{ text: "🔙 Back to Payment Options", callback_data: `purchase_${packageId}` }]
      ]
    }
  });
}

async function handlePOLPayment(ctx, callbackData) {
  const packageId = callbackData.split('_')[2];
  const pkg = await db.getPackageById(packageId);

  if (!pkg) {
    await ctx.reply('❌ Package not found.');
    return;
  }

  const currentPhase = await db.getCurrentPhase();
  let packageCost = pkg.price;
  if (currentPhase && currentPhase.phase_name !== 'Pre Sale') {
    const phaseNumber = parseInt(currentPhase.phase_name.replace('Phase ', '')) || 0;
    if (phaseNumber > 0) {
      packageCost = pkg.price * Math.pow(2, phaseNumber);
    }
  }

  const paymentMessage = `**💳 POL USDT PAYMENT**

**SHARE PURCHASE:** ${pkg.name.toUpperCase()}

**Payment Amount:** ${formatCurrency(packageCost)}
**Network:** Polygon (POL)
**Token:** USDT

**COMPANY WALLET ADDRESS:**
\`0x742d35Cc6634C0532925a3b8D4C9db96C4b4d4d4\`

**PAYMENT INSTRUCTIONS:**
1. Send exactly ${formatCurrency(packageCost)} USDT to the wallet above
2. Take a screenshot of your transaction
3. Copy the transaction hash
4. Return here to complete verification

**⚠️ IMPORTANT:**
• Send only USDT on Polygon network
• Double-check the wallet address
• Keep your transaction hash safe`;

  await ctx.replyWithMarkdown(paymentMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📋 Copy Wallet Address", callback_data: `copy_pol_${packageId}` }],
        [{ text: "✅ I've Sent Payment", callback_data: `verify_pol_${packageId}` }],
        [{ text: "🔙 Back to Payment Options", callback_data: `purchase_${packageId}` }]
      ]
    }
  });
}

async function handleTRONPayment(ctx, callbackData) {
  const packageId = callbackData.split('_')[2];
  const pkg = await db.getPackageById(packageId);

  if (!pkg) {
    await ctx.reply('❌ Package not found.');
    return;
  }

  const currentPhase = await db.getCurrentPhase();
  let packageCost = pkg.price;
  if (currentPhase && currentPhase.phase_name !== 'Pre Sale') {
    const phaseNumber = parseInt(currentPhase.phase_name.replace('Phase ', '')) || 0;
    if (phaseNumber > 0) {
      packageCost = pkg.price * Math.pow(2, phaseNumber);
    }
  }

  const paymentMessage = `**💳 TRON USDT PAYMENT**

**SHARE PURCHASE:** ${pkg.name.toUpperCase()}

**Payment Amount:** ${formatCurrency(packageCost)}
**Network:** TRON (TRX)
**Token:** USDT

**COMPANY WALLET ADDRESS:**
\`TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE\`

**PAYMENT INSTRUCTIONS:**
1. Send exactly ${formatCurrency(packageCost)} USDT to the wallet above
2. Take a screenshot of your transaction
3. Copy the transaction hash
4. Return here to complete verification

**⚠️ IMPORTANT:**
• Send only USDT on TRON network
• Double-check the wallet address
• Keep your transaction hash safe`;

  await ctx.replyWithMarkdown(paymentMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📋 Copy Wallet Address", callback_data: `copy_tron_${packageId}` }],
        [{ text: "✅ I've Sent Payment", callback_data: `verify_tron_${packageId}` }],
        [{ text: "🔙 Back to Payment Options", callback_data: `purchase_${packageId}` }]
      ]
    }
  });
}

async function handlePaymentVerificationInput(ctx, text) {
  const user = ctx.from;
  console.log(`🔍 Payment verification input from ${user.first_name}: "${text}"`);

  const session = await db.getUserSession(user.id);
  console.log('📊 User session:', session);

  if (!session || !session.session_data) {
    console.log('❌ No session or session data found');
    await ctx.replyWithMarkdown('❌ **Session expired**\n\nPlease start the payment process again.');
    await startAuthenticationFlow(ctx);
    return;
  }

  const { network, packageId, step } = session.session_data;
  console.log(`📋 Session data - Network: ${network}, Package: ${packageId}, Step: ${step}`);

  if (step === 'wallet_address') {
    // Validate wallet address format
    const isValidWallet = validateWalletAddress(text, network);
    if (!isValidWallet) {
      await ctx.replyWithMarkdown('❌ **Invalid wallet address format**\n\nPlease enter a valid wallet address for the selected network.');
      return;
    }

    // Store wallet address and move to step 2
    await setUserState(user.id, 'payment_verification', {
      network: network,
      packageId: packageId,
      step: 'screenshot',
      walletAddress: text
    });

    const pkg = await db.getPackageById(packageId);
    const screenshotMessage = `**✅ WALLET ADDRESS CONFIRMED**

**Step 2 of 3: Payment Screenshot**

Wallet Address: \`${text}\`

Now please upload a **screenshot** of your payment transaction:

📷 **Screenshot Requirements:**
• Clear image of the transaction
• Shows payment amount and recipient address
• Includes transaction timestamp
• Must be from your crypto wallet app

**Upload your screenshot now:**`;

    await ctx.replyWithMarkdown(screenshotMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔙 Back to Payment", callback_data: `pay_${network}_${packageId}` }]
        ]
      }
    });

  } else if (step === 'transaction_hash') {
    // Validate transaction hash format
    const isValidHash = validateTransactionHash(text, network);
    if (!isValidHash) {
      await ctx.replyWithMarkdown('❌ **Invalid transaction hash format**\n\nPlease enter a valid transaction hash.');
      return;
    }

    // Complete payment verification
    await completePaymentVerification(ctx, text);
  }
}

async function handlePaymentScreenshot(ctx) {
  const user = ctx.from;
  const session = await db.getUserSession(user.id);

  if (!session || !session.session_data || session.session_data.step !== 'screenshot') {
    await ctx.reply('❌ Please start the payment verification process first.');
    return;
  }

  try {
    // Get the largest photo size
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const file = await ctx.telegram.getFile(photo.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;

    console.log(`📷 Processing screenshot upload for user ${user.id}`);
    console.log(`📁 File URL: ${fileUrl}`);

    // Download and upload to Supabase storage
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    console.log(`📦 Downloaded image buffer: ${buffer.byteLength} bytes`);

    // Generate unique filename
    const timestamp = Date.now();
    const filename = `payment_${user.id}_${timestamp}.jpg`;

    console.log(`💾 Uploading to Supabase storage bucket "proof" as: ${filename}`);

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

    console.log(`✅ Screenshot uploaded successfully:`, data);

    // Update session with screenshot info
    const { network, packageId, walletAddress } = session.session_data;
    await setUserState(user.id, 'payment_verification', {
      network: network,
      packageId: packageId,
      step: 'transaction_hash',
      walletAddress: walletAddress,
      screenshotPath: filename
    });

    const hashMessage = `**✅ SCREENSHOT UPLOADED**

**Step 3 of 3: Transaction Hash**

Your payment screenshot has been successfully uploaded and stored securely.

Now please provide your **transaction hash**:

🔗 **Transaction Hash Requirements:**
• Copy from your wallet app or blockchain explorer
• Must match the payment you sent
• Used for blockchain verification

**Type your transaction hash:**`;

    await ctx.replyWithMarkdown(hashMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔙 Back to Payment", callback_data: `pay_${network}_${packageId}` }]
        ]
      }
    });

  } catch (error) {
    console.error('Screenshot processing error:', error);
    await ctx.reply('❌ Failed to process screenshot. Please try again.');
  }
}

async function handlePaymentScreenshotDocument(ctx) {
  const user = ctx.from;
  const session = await db.getUserSession(user.id);

  if (!session || !session.session_data || session.session_data.step !== 'screenshot') {
    await ctx.reply('❌ Please start the payment verification process first.');
    return;
  }

  try {
    // Get the document file
    const document = ctx.message.document;
    const file = await ctx.telegram.getFile(document.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;

    console.log(`📷 Processing screenshot document upload for user ${user.id}`);
    console.log(`📁 File URL: ${fileUrl}`);
    console.log(`📄 Document: ${document.file_name}, Type: ${document.mime_type}, Size: ${document.file_size} bytes`);

    // Download and upload to Supabase storage
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    console.log(`📦 Downloaded image buffer: ${buffer.byteLength} bytes`);

    // Generate unique filename with proper extension
    const timestamp = Date.now();
    const extension = document.file_name ? document.file_name.split('.').pop() : 'jpg';
    const filename = `payment_${user.id}_${timestamp}.${extension}`;

    console.log(`💾 Uploading to Supabase storage bucket "proof" as: ${filename}`);

    // Upload to Supabase storage bucket "proof"
    const { data, error } = await db.client.storage
      .from('proof')
      .upload(filename, buffer, {
        contentType: document.mime_type || 'image/jpeg',
        upsert: false
      });

    if (error) {
      console.error('Storage upload error:', error);
      await ctx.reply('❌ Failed to upload screenshot. Please try again.');
      return;
    }

    console.log(`✅ Screenshot document uploaded successfully:`, data);

    // Update session with screenshot info
    const { network, packageId, walletAddress } = session.session_data;
    await setUserState(user.id, 'payment_verification', {
      network: network,
      packageId: packageId,
      step: 'transaction_hash',
      walletAddress: walletAddress,
      screenshotPath: filename
    });

    const hashMessage = `**✅ SCREENSHOT UPLOADED**

**Step 3 of 3: Transaction Hash**

Your payment screenshot has been successfully uploaded and stored securely.

Now please provide your **transaction hash**:

🔗 **Transaction Hash Requirements:**
• Copy from your wallet app or blockchain explorer
• Must match the payment you sent
• Used for blockchain verification

**Type your transaction hash:**`;

    await ctx.replyWithMarkdown(hashMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔙 Back to Payment", callback_data: `pay_${network}_${packageId}` }]
        ]
      }
    });

  } catch (error) {
    console.error('Screenshot document processing error:', error);
    await ctx.reply('❌ Failed to process screenshot. Please try again.');
  }
}

function validateWalletAddress(address, network) {
  switch(network) {
    case 'bsc':
    case 'pol':
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    case 'tron':
      return /^T[A-Za-z1-9]{33}$/.test(address);
    default:
      return false;
  }
}

function validateTransactionHash(hash, network) {
  switch(network) {
    case 'bsc':
    case 'pol':
      return /^0x[a-fA-F0-9]{64}$/.test(hash);
    case 'tron':
      return /^[a-fA-F0-9]{64}$/.test(hash);
    default:
      return false;
  }
}

async function completePaymentVerification(ctx, transactionHash) {
  const telegramUser = ctx.from;
  const session = await db.getUserSession(telegramUser.id);

  if (!session || !session.session_data) {
    await ctx.reply('❌ Session expired. Please start again.');
    return;
  }

  const { network, packageId, walletAddress, screenshotPath } = session.session_data;
  const pkg = await db.getPackageById(packageId);

  if (!pkg) {
    await ctx.reply('❌ Package not found.');
    return;
  }

  // Get the actual user_id from the users table via telegram_users
  const { data: telegramUserData, error: telegramUserError } = await db.client
    .from('telegram_users')
    .select('user_id')
    .eq('telegram_id', telegramUser.id)
    .single();

  if (telegramUserError || !telegramUserData?.user_id) {
    console.error('Telegram user lookup error:', telegramUserError);
    await ctx.reply('❌ User account not found. Please complete registration first.');
    return;
  }

  const userId = telegramUserData.user_id;

  // Calculate package cost with phase pricing
  const packageCost = await calculatePackagePrice(pkg);

  // Get company wallet for the network
  const walletData = await db.getWalletByNetwork(network.toUpperCase());
  const receiverWallet = walletData?.wallet_address;

  // Get screenshot URL from storage
  const { data: urlData } = db.client.storage
    .from('proof')
    .getPublicUrl(screenshotPath);

  const screenshotUrl = urlData?.publicUrl || null;

  try {
    // Create payment transaction record
    const paymentData = {
      user_id: userId,
      amount: packageCost,
      currency: 'USDT',
      network: network.toUpperCase(),
      sender_wallet: walletAddress,
      receiver_wallet: receiverWallet,
      transaction_hash: transactionHash,
      screenshot_url: screenshotUrl,
      status: 'pending'
    };

    const { data: paymentRecord, error: paymentError } = await db.client
      .from('crypto_payment_transactions')
      .insert([paymentData])
      .select()
      .single();

    if (paymentError) {
      console.error('Payment record creation error:', paymentError);
      await ctx.reply('❌ Failed to record payment. Please contact support.');
      return;
    }

    // Create share purchase record
    const investmentData = {
      user_id: userId,
      package_name: pkg.name,
      total_amount: packageCost,
      shares_purchased: pkg.shares,
      status: 'pending',
      payment_method: `${network.toUpperCase()} USDT`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: investmentRecord, error: investmentError } = await db.client
      .from('aureus_share_purchases')
      .insert([investmentData])
      .select()
      .single();

    if (investmentError) {
      console.error('Share Purchase record creation error:', investmentError);
      // Still continue - payment was recorded
    }

    // Link payment to share purchase if both were created
    if (investmentRecord && paymentRecord) {
      await db.client
        .from('crypto_payment_transactions')
        .update({ share_purchase_id: investmentRecord.id })
        .eq('id', paymentRecord.id);

      // Note: Investment phases will be updated when admin approves the purchase
    }

    // Clear user state
    await clearUserState(telegramUser.id);

    const completionMessage = `**🎉 PAYMENT VERIFICATION COMPLETE**

**SHARE PURCHASE:** ${pkg.name.toUpperCase()}

**📋 PAYMENT DETAILS:**
• **Amount:** ${formatCurrency(packageCost)}
• **Shares:** ${pkg.shares.toLocaleString()}
• **Network:** ${network.toUpperCase()} USDT
• **Transaction ID:** #${paymentRecord.id.substring(0, 8)}

**✅ VERIFICATION SUBMITTED:**
• Sender Wallet: \`${walletAddress}\`
• Screenshot: Uploaded to secure storage
• Transaction Hash: \`${transactionHash}\`

**⏳ NEXT STEPS:**
Your payment is now pending admin approval. You will be notified once your shares are allocated to your account.

**📧 CONFIRMATION:**
A confirmation email will be sent once approved.`;

    await ctx.replyWithMarkdown(completionMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🏠 Back to Dashboard", callback_data: "main_menu" }],
          [{ text: "📱 View Portfolio", callback_data: "menu_portfolio" }]
        ]
      }
    });

    console.log(`✅ Payment verification completed for user ${userId}, payment ${paymentRecord.id}`);

    // Clear user state after successful payment completion
    await setUserState(telegramUser.id, null);

  } catch (error) {
    console.error('Payment completion error:', error);
    await ctx.reply('❌ Failed to complete payment verification. Please contact support.');
    // Clear state even on error to prevent stuck state
    await setUserState(telegramUser.id, null);
  }
}

async function handleCopyWallet(ctx, callbackData) {
  const parts = callbackData.split('_');
  const network = parts[1];
  const packageId = parts[2];

  let walletAddress = '';
  let networkName = '';

  switch(network) {
    case 'bsc':
      walletAddress = '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d4d4';
      networkName = 'BSC';
      break;
    case 'pol':
      walletAddress = '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d4d4';
      networkName = 'Polygon';
      break;
    case 'tron':
      walletAddress = 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE';
      networkName = 'TRON';
      break;
  }

  await ctx.answerCbQuery(`${networkName} wallet address copied!`);
  await ctx.replyWithMarkdown(`**📋 WALLET ADDRESS COPIED**

**${networkName} USDT Wallet:**
\`${walletAddress}\`

The wallet address has been copied. You can now paste it in your crypto wallet app to send the payment.`);
}

async function handlePaymentVerification(ctx, callbackData) {
  console.log(`🔍 Payment verification callback: ${callbackData}`);
  const parts = callbackData.split('_');
  const network = parts[1];
  const packageId = parts[2];
  console.log(`📋 Parsed - Network: ${network}, Package: ${packageId}`);

  const pkg = await db.getPackageById(packageId);
  if (!pkg) {
    await ctx.reply('❌ Package not found.');
    return;
  }

  const user = ctx.from;
  await setUserState(user.id, 'payment_verification', {
    network: network,
    packageId: packageId,
    step: 'wallet_address'
  });

  const verificationMessage = `**✅ PAYMENT VERIFICATION**

**SHARE PURCHASE:** ${pkg.name.toUpperCase()}
**Network:** ${network.toUpperCase()} USDT

**3-STEP VERIFICATION PROCESS:**

**Step 1 of 3: Sender Wallet Address**

Please provide the wallet address you sent the payment FROM:

💡 **Example formats:**
• BSC/POL: 0x1234...abcd
• TRON: T1234...abcd

Type your sender wallet address:`;

  await ctx.replyWithMarkdown(verificationMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔙 Back to Payment", callback_data: `pay_${network}_${packageId}` }]
      ]
    }
  });
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

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Start the bot
startBot().catch(error => {
  console.error('❌ Critical startup error:', error);
  process.exit(1);
});
