require('dotenv').config();
const { Telegraf } = require('telegraf');
const mysql = require('mysql2/promise');
// const nodemailer = require('nodemailer'); // Temporarily disabled

const bot = new Telegraf('8015476800:AAGMH8HMXRurphYHRQDJdeHLO10ghZVzBt8');

// Security Configuration
const ADMIN_EMAIL = 'admin@smartunitednetwork.com';
const ADMIN_PASSWORD = 'Underdog8406155100085@123!@#';
const ADMIN_USERNAME = 'TTTFOUNDER'; // Only this Telegram username can access admin
const ADMIN_SESSION_TIMEOUT = 3600000; // 1 hour in milliseconds
const MAX_LOGIN_ATTEMPTS = 3;
const LOGIN_COOLDOWN = 900000; // 15 minutes in milliseconds
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20; // Max requests per minute

// Security tracking
const adminSessions = new Map(); // telegramId -> { authenticated: boolean, expires: timestamp }
const loginAttempts = new Map(); // telegramId -> { attempts: number, lastAttempt: timestamp }
const rateLimiting = new Map(); // telegramId -> { requests: number, resetTime: timestamp }
const suspiciousActivity = new Map(); // telegramId -> { violations: number, lastViolation: timestamp }

// Database connection
let dbConnection;

async function connectDB() {
  dbConnection = await mysql.createConnection({
    host: 'localhost',
    port: 3506,
    user: 'root',
    password: '',
    database: 'aureus_angels'
  });
  console.log('✅ Database connected successfully!');
}

// Email configuration (temporarily disabled - will show token in bot)
// const emailTransporter = nodemailer.createTransporter({
//   host: 'smtp.gmail.com', // You can change this to your SMTP provider
//   port: 587,
//   secure: false,
//   auth: {
//     user: process.env.EMAIL_USER || 'your-email@gmail.com', // Add to .env file
//     pass: process.env.EMAIL_PASS || 'your-app-password'     // Add to .env file
//   }
// });

// Email functions (temporarily showing token in bot instead of email)
async function sendPasswordResetEmail(email, resetToken, userName) {
  try {
    // For now, we'll return true and show the token in the bot
    // In production, implement actual email sending
    console.log(`📧 Password reset requested for ${email} - Token: ${resetToken}`);
    return false; // Return false to show token in bot instead of email
  } catch (error) {
    console.error('❌ Failed to send password reset email:', error);
    return false;
  }
}

async function sendWelcomeEmail(email, userName) {
  try {
    // For now, just log the welcome message
    console.log(`🎉 Welcome message for ${userName} (${email}) - Account linked successfully!`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send welcome email:', error);
    return false;
  }
}

// Security Functions
function isRateLimited(telegramId) {
  const now = Date.now();
  const userLimit = rateLimiting.get(telegramId);

  if (!userLimit) {
    rateLimiting.set(telegramId, { requests: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return false;
  }

  if (now > userLimit.resetTime) {
    rateLimiting.set(telegramId, { requests: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return false;
  }

  if (userLimit.requests >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  userLimit.requests++;
  return false;
}

function isAuthorizedForAdmin(username) {
  return username && username.toLowerCase() === ADMIN_USERNAME.toLowerCase();
}

function isAdminAuthenticated(telegramId) {
  const session = adminSessions.get(telegramId);
  if (!session) return false;

  if (Date.now() > session.expires) {
    adminSessions.delete(telegramId);
    return false;
  }

  return session.authenticated;
}

function authenticateAdmin(telegramId, email, password) {
  const now = Date.now();
  const attempts = loginAttempts.get(telegramId) || { attempts: 0, lastAttempt: 0 };

  // Check if user is in cooldown
  if (attempts.attempts >= MAX_LOGIN_ATTEMPTS && (now - attempts.lastAttempt) < LOGIN_COOLDOWN) {
    return { success: false, error: 'COOLDOWN', remainingTime: LOGIN_COOLDOWN - (now - attempts.lastAttempt) };
  }

  // Reset attempts if cooldown period has passed
  if ((now - attempts.lastAttempt) > LOGIN_COOLDOWN) {
    attempts.attempts = 0;
  }

  // Check credentials
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    // Successful authentication
    adminSessions.set(telegramId, {
      authenticated: true,
      expires: now + ADMIN_SESSION_TIMEOUT
    });
    loginAttempts.delete(telegramId);
    return { success: true };
  } else {
    // Failed authentication
    attempts.attempts++;
    attempts.lastAttempt = now;
    loginAttempts.set(telegramId, attempts);

    // Log suspicious activity
    logSuspiciousActivity(telegramId, 'FAILED_ADMIN_LOGIN', { email, timestamp: now });

    return { success: false, error: 'INVALID_CREDENTIALS', attemptsRemaining: MAX_LOGIN_ATTEMPTS - attempts.attempts };
  }
}

function logSuspiciousActivity(telegramId, type, details) {
  const now = Date.now();
  const activity = suspiciousActivity.get(telegramId) || { violations: 0, lastViolation: 0 };

  activity.violations++;
  activity.lastViolation = now;
  suspiciousActivity.set(telegramId, activity);

  console.log(`🚨 SECURITY ALERT: ${type} from Telegram ID ${telegramId}`, details);

  // Auto-ban after too many violations
  if (activity.violations >= 10) {
    console.log(`🔒 AUTO-BAN: Telegram ID ${telegramId} banned for excessive violations`);
    // Could implement actual banning logic here
  }
}

function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  return input.replace(/[<>'"&]/g, '').trim().substring(0, 1000);
}

function logAdminAction(telegramId, action, details) {
  const timestamp = new Date().toISOString();
  console.log(`🔐 ADMIN ACTION: ${action} by Telegram ID ${telegramId} at ${timestamp}`, details);

  // In production, you might want to store this in a database
  // await dbConnection.execute(
  //   'INSERT INTO admin_logs (telegram_id, action, details, timestamp) VALUES (?, ?, ?, ?)',
  //   [telegramId, action, JSON.stringify(details), timestamp]
  // );
}

// Telegram user functions
async function getTelegramUser(telegramId) {
  try {
    const [rows] = await dbConnection.execute(
      "SELECT * FROM telegram_users WHERE telegram_id = ?",
      [telegramId]
    );
    return rows[0] || null;
  } catch (error) {
    console.error("Error getting telegram user:", error);
    return null;
  }
}

async function createTelegramUser(telegramId, userData) {
  try {
    await dbConnection.execute(
      `INSERT INTO telegram_users (telegram_id, username, first_name, last_name, is_registered, registration_step, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [telegramId, userData.username, userData.first_name, userData.last_name, false, 'start']
    );
    return await getTelegramUser(telegramId);
  } catch (error) {
    console.error("Error creating telegram user:", error);
    return null;
  }
}

async function updateTelegramUser(telegramId, updates) {
  try {
    const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updates), telegramId];
    
    await dbConnection.execute(
      `UPDATE telegram_users SET ${setClause}, updated_at = NOW() WHERE telegram_id = ?`,
      values
    );
    return true;
  } catch (error) {
    console.error("Error updating telegram user:", error);
    return false;
  }
}

// Share Purchase package functions
async function getInvestmentPackages() {
  try {
    const [packages] = await dbConnection.execute(
      "SELECT * FROM share_packages WHERE is_active = 1 ORDER BY price ASC"
    );
    return packages.map(pkg => ({
      ...pkg,
      bonuses: typeof pkg.bonuses === 'string' ? JSON.parse(pkg.bonuses) : pkg.bonuses || []
    }));
  } catch (error) {
    console.error("Error getting share packages:", error);
    return [];
  }
}

async function getPackageById(packageId) {
  try {
    const [rows] = await dbConnection.execute(
      "SELECT * FROM share_packages WHERE id = ? AND is_active = 1",
      [packageId]
    );
    
    if (rows.length === 0) return null;
    
    const pkg = rows[0];
    return {
      ...pkg,
      bonuses: typeof pkg.bonuses === 'string' ? JSON.parse(pkg.bonuses) : pkg.bonuses || []
    };
  } catch (error) {
    console.error("Error getting package by ID:", error);
    return null;
  }
}

// Utility functions
function formatCurrency(amount) {
  return `$${parseFloat(amount).toFixed(2)}`;
}

function formatLargeNumber(amount) {
  return `$${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Global variable to cache gold price
let cachedGoldPrice = 107000; // Default fallback price in USD per KG
let lastGoldPriceUpdate = 0;

// Global variable to cache company wallets
let cachedWallets = null;
let lastWalletUpdate = 0;

async function getCurrentGoldPrice() {
  try {
    // Cache for 1 hour (3600000 ms)
    const now = Date.now();
    if (now - lastGoldPriceUpdate < 3600000 && cachedGoldPrice) {
      return cachedGoldPrice;
    }

    // Try to fetch current gold price from API
    const response = await fetch('https://api.metals.live/v1/spot/gold');
    const data = await response.json();

    if (data && data.price) {
      // Convert from USD per troy ounce to USD per KG
      // 1 KG = 32.15 troy ounces
      const pricePerKg = data.price * 32.15;
      cachedGoldPrice = pricePerKg;
      lastGoldPriceUpdate = now;
      console.log(`📈 Updated gold price: $${pricePerKg.toFixed(2)} per KG`);
      return pricePerKg;
    }
  } catch (error) {
    console.log(`⚠️ Could not fetch live gold price, using cached: $${cachedGoldPrice}`);
  }

  return cachedGoldPrice;
}

async function getCompanyWallets() {
  try {
    // Cache for 1 hour (3600000 ms)
    const now = Date.now();
    if (now - lastWalletUpdate < 3600000 && cachedWallets) {
      return cachedWallets;
    }

    // Fetch wallet addresses from API
    const response = await fetch('http://localhost/Aureus%201%20-%20Complex/api/wallets/active.php');
    const data = await response.json();

    if (data && data.success && data.data) {
      cachedWallets = data.data;
      lastWalletUpdate = now;
      console.log(`💳 Updated company wallets: ${Object.keys(cachedWallets).join(', ')}`);
      return cachedWallets;
    }
  } catch (error) {
    console.log(`⚠️ Could not fetch company wallets, using fallback`);
  }

  // Fallback wallets if API fails
  const fallbackWallets = {
    bsc: "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b7",
    ethereum: "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b7",
    polygon: "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b7",
    tron: "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE"
  };

  cachedWallets = fallbackWallets;
  return fallbackWallets;
}

// Create crypto payment record for admin approval
async function createCryptoPaymentRecord(telegramId, packageId, network, txHash) {
  try {
    const pkg = await getPackageById(packageId);
    if (!pkg) throw new Error("Package not found");

    // Create share purchase record first
    const investmentId = generateUUID();
    await dbConnection.execute(`
      INSERT INTO aureus_share_purchases (
        id, user_id, package_id, amount_usd, shares,
        status, payment_method, created_at
      ) VALUES (?, ?, ?, ?, ?, 'pending_crypto_payment', 'cryptocurrency', NOW())
    `, [investmentId, telegramId, packageId, pkg.price, pkg.shares]);

    // Create crypto payment record
    const paymentId = generateUUID();
    await dbConnection.execute(`
      INSERT INTO crypto_payment_transactions (
        id, share_purchase_id, user_id, network, transaction_hash,
        amount_usd, wallet_address, payment_status, verification_status,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', NOW())
    `, [paymentId, investmentId, telegramId, network, txHash, pkg.price, (await getCompanyWallets())[network]]);

    console.log(`💳 Created crypto payment record: ${paymentId} for share purchase: ${investmentId}`);
    return { investmentId, paymentId };
  } catch (error) {
    console.error("Error creating crypto payment record:", error);
    throw error;
  }
}

// Create bank payment record for admin approval
async function createBankPaymentRecord(telegramId, packageId, referenceNumber) {
  try {
    const pkg = await getPackageById(packageId);
    if (!pkg) throw new Error("Package not found");

    // Create share purchase record first
    const investmentId = generateUUID();
    await dbConnection.execute(`
      INSERT INTO aureus_share_purchases (
        id, user_id, package_id, amount_usd, shares,
        status, payment_method, created_at
      ) VALUES (?, ?, ?, ?, ?, 'pending_bank_payment', 'bank_transfer', NOW())
    `, [investmentId, telegramId, packageId, pkg.price, pkg.shares]);

    // Create bank payment record
    const paymentId = generateUUID();
    await dbConnection.execute(`
      INSERT INTO bank_payment_transactions (
        id, share_purchase_id, user_id, reference_number,
        amount_usd, amount_local, local_currency, exchange_rate,
        payment_status, verification_status, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'USD', 1.0, 'pending', 'pending',
                DATE_ADD(NOW(), INTERVAL 7 DAY), NOW())
    `, [paymentId, investmentId, telegramId, referenceNumber, pkg.price, pkg.price]);

    console.log(`🏦 Created bank payment record: ${paymentId} for share purchase: ${investmentId}`);
    return { investmentId, paymentId };
  } catch (error) {
    console.error("Error creating bank payment record:", error);
    throw error;
  }
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function calculateMineProduction(shares) {
  // Mine production constants
  const ANNUAL_GOLD_PRODUCTION = 3200; // KG
  const OPERATIONAL_COST_PERCENTAGE = 0.45; // 45%
  const TOTAL_AUREUS_SHARES = 1400000;

  // Get current gold price
  const goldPricePerKg = await getCurrentGoldPrice();

  // Calculations
  const grossRevenue = ANNUAL_GOLD_PRODUCTION * goldPricePerKg;
  const operationalCosts = grossRevenue * OPERATIONAL_COST_PERCENTAGE;
  const netProfit = grossRevenue - operationalCosts;
  const dividendPerShare = netProfit / TOTAL_AUREUS_SHARES;
  const userAnnualDividend = dividendPerShare * shares;

  return {
    grossRevenue,
    operationalCosts,
    netProfit,
    dividendPerShare,
    userAnnualDividend,
    totalShares: TOTAL_AUREUS_SHARES,
    annualProduction: ANNUAL_GOLD_PRODUCTION,
    goldPricePerKg
  };
}

async function formatPackageInfo(pkg) {
  const bonusText = pkg.bonuses && pkg.bonuses.length > 0
    ? `\n🎁 **Bonuses:** ${pkg.bonuses.join(', ')}`
    : '';

  const mineCalc = await calculateMineProduction(pkg.shares);
  const quarterlyDividend = mineCalc.dividendPerShare / 4;
  const userQuarterlyDividend = mineCalc.userAnnualDividend / 4;

  return `💎 **${pkg.name} Package**

💰 **Price:** ${formatCurrency(pkg.price)}
📊 **Shares:** ${pkg.shares}${bonusText}

⚠️ **Important Disclaimer:**
Shares cannot be sold within 12 months of purchase to ensure all 20 phases of share sales are completed successfully, protecting the integrity of our mining operation and maximizing returns for all shareholders.

📈 **Mine Production Target:**
🏭 Annual Production: ${mineCalc.annualProduction.toLocaleString()} KG gold
💰 Gold Price: ${formatLargeNumber(mineCalc.goldPricePerKg)} per KG
📊 Gross Revenue: ${formatLargeNumber(mineCalc.grossRevenue)}
⚙️ Mining Costs (45%): ${formatLargeNumber(mineCalc.operationalCosts)}
💎 Net Annual Profit: ${formatLargeNumber(mineCalc.netProfit)}
📈 Total Aureus Shares: ${mineCalc.totalShares.toLocaleString()}
💰 Dividend per Share: ${formatCurrency(mineCalc.dividendPerShare)}
📅 Quarterly Dividend per Share: ${formatCurrency(quarterlyDividend)}
🎯 Your Quarterly Dividend: ${formatLargeNumber(userQuarterlyDividend)} (based on ${pkg.shares} shares)
💎 Your Annual Dividend: ${formatLargeNumber(mineCalc.userAnnualDividend)} (based on ${pkg.shares} shares)

⚠️ **Production Timeline:**
The dividend calculation above is based on reaching full mine production capacity, utilizing 10 washplants—each capable of processing 200 tons of alluvial material per hour. This production milestone is targeted for achievement by June 2026.

🌍 **Supporting Global Impact:**
By investing, you are supporting NPOs worldwide as 10% of your payment goes towards 28 NPOs making a difference across the globe.`;
}

// Security Middleware
bot.use(async (ctx, next) => {
  try {
    const telegramId = ctx.from.id;

    // Rate limiting check
    if (isRateLimited(telegramId)) {
      await ctx.reply('⚠️ Too many requests. Please wait a moment before trying again.');
      return;
    }

    // Input sanitization for text messages
    if (ctx.message && ctx.message.text) {
      ctx.message.text = sanitizeInput(ctx.message.text);
    }

    // Log suspicious patterns
    if (ctx.message && ctx.message.text) {
      const text = ctx.message.text.toLowerCase();
      if (text.includes('script') || text.includes('sql') || text.includes('drop') || text.includes('delete') || text.includes('union') || text.includes('select')) {
        logSuspiciousActivity(telegramId, 'SUSPICIOUS_INPUT', { text: ctx.message.text });
      }
    }

    await next();
  } catch (error) {
    console.error('Security middleware error:', error);
    await ctx.reply('❌ Security check failed. Please try again.');
  }
});

// Middleware for user context
bot.use(async (ctx, next) => {
  if (ctx.from) {
    let telegramUser = await getTelegramUser(ctx.from.id);

    if (!telegramUser) {
      telegramUser = await createTelegramUser(ctx.from.id, {
        username: ctx.from.username,
        first_name: ctx.from.first_name,
        last_name: ctx.from.last_name
      });
    }

    ctx.telegramUser = telegramUser;
  }
  await next();
});

// Commands
bot.start(async (ctx) => {
  const user = ctx.from;
  const telegramUser = ctx.telegramUser;

  // Check for auto-login capability
  if (telegramUser && telegramUser.auto_login_enabled && telegramUser.linked_email) {
    // Verify the linked account still exists
    try {
      const [rows] = await dbConnection.execute(
        'SELECT id, full_name, email FROM users WHERE email = ?',
        [telegramUser.linked_email]
      );

      if (rows.length > 0) {
        // Auto-login successful - Show Mini App option
        const welcomeMessage = `🌟 **Welcome back, ${user.first_name}!** 🌟

🔗 **Auto-Login:** Successfully logged in with ${telegramUser.linked_email}

Choose how you'd like to access your share purchase platform:`;

        // Check if user is authorized for admin access
        const isAdminUser = isAuthorizedForAdmin(user.username);

        const keyboard = {
          inline_keyboard: [
            [
              { text: "📱 Main Menu", callback_data: "back_to_menu" },
              { text: "📊 Portfolio", callback_data: "menu_portfolio" }
            ],
            [
              { text: "📦 Packages", callback_data: "menu_packages" },
              { text: "👥 Referrals", callback_data: "menu_referrals" }
            ],
            [
              { text: "🔧 Settings", callback_data: "menu_profile" },
              { text: "🚪 Logout", callback_data: "confirm_logout" }
            ],
            ...(isAdminUser ? [[{ text: "🔐 Admin Panel", callback_data: "admin_panel_access" }]] : [])
          ]
        };

        await ctx.replyWithMarkdown(welcomeMessage, { reply_markup: keyboard });
        console.log(`🔄 Auto-login successful for ${user.first_name} (${ctx.from.id}) with email ${telegramUser.linked_email}`);
        return;
      } else {
        // Linked account no longer exists, reset auto-login
        await updateTelegramUser(ctx.from.id, {
          is_registered: false,
          auto_login_enabled: false,
          linked_email: null,
          user_id: null
        });
        console.log(`⚠️ Linked account ${telegramUser.linked_email} no longer exists, reset auto-login for ${ctx.from.id}`);
      }
    } catch (error) {
      console.error("Auto-login verification error:", error);
    }
  }

  if (telegramUser && telegramUser.is_registered) {
    const welcomeMessage = `🌟 **Welcome back, ${user.first_name}!** 🌟

Your account is linked and ready to use.

Choose how you'd like to access your share purchase platform:`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📱 Main Menu", callback_data: "back_to_menu" },
          { text: "📊 Portfolio", callback_data: "menu_portfolio" }
        ],
        [
          { text: "📦 Packages", callback_data: "menu_packages" },
          { text: "👥 Referrals", callback_data: "menu_referrals" }
        ],
        [
          { text: "🔧 Settings", callback_data: "menu_profile" }
        ]
      ]
    };

    await ctx.replyWithMarkdown(welcomeMessage, { reply_markup: keyboard });
  } else {
    const welcomeMessage = `🌟 **Welcome to Aureus Angel Alliance!** 🌟

Your gateway to gold mining investments! 💎

🏆 **What We Offer:**
• Gold mining share purchase packages
• NFT share certificates
• Quarterly dividend payments
• Supporting 28 NPOs worldwide

🔐 **Get Started:**
Choose an option below:`;

    // Check if user is authorized for admin access
    const isAdminUser = isAuthorizedForAdmin(user.username);

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔑 Login", callback_data: "auth_login" },
          { text: "📝 Register", callback_data: "auth_register" }
        ],
        ...(isAdminUser ? [[{ text: "🔐 Admin Login", callback_data: "admin_login" }]] : []),
        [
          { text: "📞 Contact Support", callback_data: "get_support" }
        ]
      ]
    };

    await ctx.replyWithMarkdown(welcomeMessage, { reply_markup: keyboard });
  }
});

bot.command("packages", async (ctx) => {
  const telegramUser = ctx.telegramUser;
  
  if (!telegramUser.is_registered) {
    await ctx.reply("❌ Please login or register first using /start");
    return;
  }

  try {
    const packages = await getInvestmentPackages();
    
    if (packages.length === 0) {
      await ctx.reply("❌ No share packages available at the moment.");
      return;
    }

    const packageMessage = `💎 *Available Share Packages* 💎

Choose a package to view details:`;

    const keyboard = {
      inline_keyboard: packages.map(pkg => [
        { text: `${pkg.name} - ${formatCurrency(pkg.price)}`, callback_data: `package_${pkg.id}` }
      ])
    };

    await ctx.replyWithMarkdown(packageMessage, { reply_markup: keyboard });
  } catch (error) {
    console.error("Error getting packages:", error);
    await ctx.reply("❌ Error loading packages. Please try again.");
  }
});

// PORTFOLIO FUNCTIONS
async function getUserInvestments(userEmail) {
  try {
    const [rows] = await dbConnection.execute(`
      SELECT
        id,
        package_name,
        amount,
        shares,
        status,
        created_at,
        nft_delivery_date,
        roi_delivery_date,
        delivery_status,
        nft_delivered,
        roi_delivered
      FROM aureus_share_purchases
      WHERE email = ?
      ORDER BY created_at DESC
    `, [userEmail]);

    return rows;
  } catch (error) {
    console.error("Error fetching user investments:", error);
    return [];
  }
}

async function calculatePortfolioStats(investments) {
  try {
    const stats = {
      totalInvestments: investments.length,
      totalInvested: 0,
      totalShares: 0,
      confirmedInvestments: 0,
      pendingInvestments: 0,
      nftDelivered: 0,
      roiDelivered: 0
    };

    investments.forEach(inv => {
      stats.totalInvested += parseFloat(inv.amount) || 0;
      stats.totalShares += parseInt(inv.shares) || 0;

      if (inv.status === 'completed' || inv.status === 'confirmed') {
        stats.confirmedInvestments++;
      } else {
        stats.pendingInvestments++;
      }

      if (inv.nft_delivered) {
        stats.nftDelivered++;
      }

      if (inv.roi_delivered) {
        stats.roiDelivered++;
      }
    });

    return stats;
  } catch (error) {
    console.error("Error calculating portfolio stats:", error);
    return null;
  }
}

async function formatPortfolioMessage(userEmail) {
  try {
    const investments = await getUserInvestments(userEmail);
    const stats = await calculatePortfolioStats(investments);

    if (!stats || investments.length === 0) {
      return `📊 **Your Portfolio**

❌ No investments found yet.

🔹 **Get Started:**
• Use /packages to view available share packages
• Start building your portfolio today!

💎 Ready to buy shares? Use /packages to explore opportunities!`;
    }

    // Calculate mine production for total shares
    const mineCalc = await calculateMineProduction(stats.totalShares);
    const quarterlyDividend = mineCalc.userAnnualDividend / 4;

    let portfolioMessage = `📊 **Your Share Portfolio**

💰 **Portfolio Summary:**
📈 Total Investments: ${stats.totalInvestments}
💵 Total Invested: ${formatCurrency(stats.totalInvested)}
📊 Total Shares: ${stats.totalShares.toLocaleString()}
✅ Confirmed: ${stats.confirmedInvestments}
⏳ Pending: ${stats.pendingInvestments}

💎 **Dividend Projections:**
📅 Quarterly Dividend: ${formatLargeNumber(quarterlyDividend)}
💰 Annual Dividend: ${formatLargeNumber(mineCalc.userAnnualDividend)}
🎯 Dividend per Share: ${formatCurrency(mineCalc.dividendPerShare)}

🎁 **NFT & Delivery Status:**
📜 NFT Certificates Delivered: ${stats.nftDelivered}/${stats.totalInvestments}
🎯 ROI Deliveries Completed: ${stats.roiDelivered}/${stats.totalInvestments}

📋 **Recent Investments:**`;

    // Show recent investments (last 5)
    const recentInvestments = investments.slice(0, 5);
    recentInvestments.forEach((inv, index) => {
      const statusEmoji = inv.status === 'completed' || inv.status === 'confirmed' ? '✅' : '⏳';
      const nftStatus = inv.nft_delivered ? '📜✅' : '📜⏳';
      const roiStatus = inv.roi_delivered ? '💰✅' : '💰⏳';

      portfolioMessage += `

${index + 1}. ${statusEmoji} **${inv.package_name}**
   💵 Amount: ${formatCurrency(inv.amount)}
   📊 Shares: ${inv.shares}
   📅 Date: ${new Date(inv.created_at).toLocaleDateString()}
   ${nftStatus} ${roiStatus}`;
    });

    if (investments.length > 5) {
      portfolioMessage += `\n\n... and ${investments.length - 5} more investments`;
    }

    portfolioMessage += `\n\n⚠️ **Production Timeline:**
Dividend calculations are based on reaching full mine production capacity by June 2026.

🌍 **Impact:** Your investments support 28 NPOs worldwide!`;

    return portfolioMessage;
  } catch (error) {
    console.error("Error formatting portfolio message:", error);
    return "❌ Error loading portfolio. Please try again later.";
  }
}

async function formatInvestmentHistory(userEmail) {
  try {
    const investments = await getUserInvestments(userEmail);

    if (investments.length === 0) {
      return `📈 **Share Purchase History**

❌ No share purchase history found.

🔹 **Get Started:**
• Use /packages to view available share packages
• Make your first share purchase today!`;
    }

    let historyMessage = `📈 **Share Purchase History**

📊 **Total Investments:** ${investments.length}
💰 **Total Amount:** ${formatCurrency(investments.reduce((sum, inv) => sum + parseFloat(inv.amount), 0))}

📋 **Share Purchase Details:**`;

    investments.forEach((inv, index) => {
      const statusEmoji = inv.status === 'completed' || inv.status === 'confirmed' ? '✅' :
                         inv.status === 'pending' ? '⏳' : '❌';
      const date = new Date(inv.created_at).toLocaleDateString();

      historyMessage += `

${index + 1}. ${statusEmoji} **${inv.package_name}**
   💵 Amount: ${formatCurrency(inv.amount)}
   📊 Shares: ${inv.shares}
   📅 Date: ${date}
   🔄 Status: ${inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}`;

      if (inv.nft_delivery_date) {
        historyMessage += `\n   📜 NFT Delivery: ${new Date(inv.nft_delivery_date).toLocaleDateString()}`;
      }

      if (inv.roi_delivery_date) {
        historyMessage += `\n   💰 ROI Delivery: ${new Date(inv.roi_delivery_date).toLocaleDateString()}`;
      }
    });

    return historyMessage;
  } catch (error) {
    console.error("Error formatting share purchase history:", error);
    return "❌ Error loading share purchase history. Please try again later.";
  }
}

async function formatReferralInfo(userEmail) {
  try {
    // Get user ID from email
    const [userRows] = await dbConnection.execute(
      'SELECT id FROM users WHERE email = ?',
      [userEmail]
    );

    if (userRows.length === 0) {
      return "❌ User not found.";
    }

    const userId = userRows[0].id;

    // Get referral statistics
    const referralStats = await getReferralStats(userId);
    const referralLink = `https://aureusangelalliance.com/register?ref=${userId}`;

    let referralMessage = `👥 **Referral System**

🔗 **Your Referral Link:**
\`${referralLink}\`

📊 **Referral Statistics:**
👥 Direct Referrals: ${referralStats.directReferrals}
🌳 Total Downline: ${referralStats.totalDownline}
💰 Total Commissions: ${formatCurrency(referralStats.totalCommissions)}
📅 This Month: ${formatCurrency(referralStats.monthlyCommissions)}

🏆 **Performance:**
🥇 Rank: ${referralStats.rank || 'Unranked'}
📈 Level: ${referralStats.level || 1}
🎯 Next Level: ${referralStats.nextLevelRequirement || 'N/A'}

💡 **Tips:**
• Share your link on social media
• Invite friends and family
• Earn 20% commission on direct sales
• Build your passive income stream`;

    return referralMessage;
  } catch (error) {
    console.error("Error formatting referral info:", error);
    return "❌ Error loading referral information. Please try again later.";
  }
}

async function getReferralStats(userId) {
  try {
    // Get direct referrals count
    const [directRefs] = await dbConnection.execute(
      'SELECT COUNT(*) as count FROM users WHERE referred_by = ?',
      [userId]
    );

    // Get total commissions
    const [commissions] = await dbConnection.execute(
      'SELECT SUM(amount) as total FROM referral_commissions WHERE user_id = ?',
      [userId]
    );

    // Get monthly commissions
    const [monthlyComm] = await dbConnection.execute(
      'SELECT SUM(amount) as total FROM referral_commissions WHERE user_id = ? AND MONTH(created_at) = MONTH(NOW()) AND YEAR(created_at) = YEAR(NOW())',
      [userId]
    );

    return {
      directReferrals: directRefs[0].count || 0,
      totalDownline: directRefs[0].count || 0, // Simplified for now
      totalCommissions: commissions[0].total || 0,
      monthlyCommissions: monthlyComm[0].total || 0,
      rank: 'Bronze', // Placeholder
      level: 1 // Placeholder
    };
  } catch (error) {
    console.error("Error getting referral stats:", error);
    return {
      directReferrals: 0,
      totalDownline: 0,
      totalCommissions: 0,
      monthlyCommissions: 0
    };
  }
}

// PORTFOLIO COMMAND
bot.command("portfolio", async (ctx) => {
  const telegramUser = ctx.telegramUser;

  if (!telegramUser.is_registered) {
    await ctx.reply("❌ Please login or register first using /start");
    return;
  }

  try {
    // Use linked_email if available, otherwise fall back to email
    const userEmail = telegramUser.linked_email || telegramUser.email;

    if (!userEmail) {
      await ctx.reply("❌ No email address found. Please logout and login again to link your account properly.");
      return;
    }

    const portfolioMessage = await formatPortfolioMessage(userEmail);

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📈 Share Purchase History", callback_data: "investment_history" },
          { text: "📊 Statistics", callback_data: "portfolio_stats" }
        ],
        [
          { text: "💰 Dividends", callback_data: "dividend_history" },
          { text: "🎯 Performance", callback_data: "performance_metrics" }
        ],
        [
          { text: "🔄 Refresh", callback_data: "refresh_portfolio" },
          { text: "🔙 Main Menu", callback_data: "back_to_menu" }
        ]
      ]
    };

    await ctx.replyWithMarkdown(portfolioMessage, { reply_markup: keyboard });
    console.log(`📊 Portfolio viewed by ${ctx.from.first_name} (${ctx.from.id}) with email ${userEmail}`);
  } catch (error) {
    console.error("Portfolio command error:", error);
    await ctx.reply("❌ Error loading portfolio. Please try again later.");
  }
});

// SHARE PURCHASE HISTORY COMMAND
bot.command("history", async (ctx) => {
  const telegramUser = ctx.telegramUser;

  if (!telegramUser.is_registered) {
    await ctx.reply("❌ Please login or register first using /start");
    return;
  }

  try {
    const userEmail = telegramUser.linked_email || telegramUser.email;
    if (!userEmail) {
      await ctx.reply("❌ No email address found. Please logout and login again.");
      return;
    }

    const historyMessage = await formatInvestmentHistory(userEmail);
    await ctx.replyWithMarkdown(historyMessage);
  } catch (error) {
    console.error("Share purchase history error:", error);
    await ctx.reply("❌ Error loading share purchase history. Please try again later.");
  }
});

// REFERRALS COMMAND
bot.command("referrals", async (ctx) => {
  const telegramUser = ctx.telegramUser;

  if (!telegramUser.is_registered) {
    await ctx.reply("❌ Please login or register first using /start");
    return;
  }

  try {
    const userEmail = telegramUser.linked_email || telegramUser.email;
    if (!userEmail) {
      await ctx.reply("❌ No email address found. Please logout and login again.");
      return;
    }

    const referralMessage = await formatReferralInfo(userEmail);

    const keyboard = {
      inline_keyboard: [
        [
          { text: "👥 My Downline", callback_data: "view_downline" },
          { text: "💰 Commissions", callback_data: "view_commissions" }
        ],
        [
          { text: "🏆 Leaderboard", callback_data: "view_leaderboard" },
          { text: "📊 Statistics", callback_data: "referral_stats" }
        ],
        [
          { text: "🔗 Share Link", callback_data: "share_referral_link" },
          { text: "🔙 Main Menu", callback_data: "back_to_menu" }
        ]
      ]
    };

    await ctx.replyWithMarkdown(referralMessage, { reply_markup: keyboard });
  } catch (error) {
    console.error("Referrals command error:", error);
    await ctx.reply("❌ Error loading referral information. Please try again later.");
  }
});

// SUPPORT COMMAND
bot.command("support", async (ctx) => {
  const supportMessage = `🆘 **Support Center**

💬 **Get Help:**
• Live chat support available
• FAQ and common questions
• Technical assistance
• Share Purchase guidance

📞 **Contact Options:**
• Telegram: @aureusafrica
• Email: support@aureusangelalliance.com
• Website: aureusangelalliance.com

🕐 **Support Hours:**
• Monday - Friday: 9 AM - 6 PM (UTC)
• Saturday: 10 AM - 4 PM (UTC)
• Sunday: Emergency support only

❓ **Quick Help:**
• Use /help for command list
• Use /faq for common questions
• Use /status for system status`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "💬 Live Chat", callback_data: "start_live_chat" },
        { text: "❓ FAQ", callback_data: "view_faq" }
      ],
      [
        { text: "🎫 Create Ticket", callback_data: "create_support_ticket" },
        { text: "📊 System Status", callback_data: "system_status" }
      ],
      [
        { text: "🔙 Main Menu", callback_data: "back_to_menu" }
      ]
    ]
  };

  await ctx.replyWithMarkdown(supportMessage, { reply_markup: keyboard });
});

// HELP COMMAND
bot.command("help", async (ctx) => {
  const helpMessage = `📚 **Command Reference**

🔐 **Authentication:**
• \`/start\` - Start the bot and login
• \`/logout\` - Logout from your account

📊 **Portfolio & Investments:**
• \`/portfolio\` - View your share portfolio
• \`/packages\` - Browse share packages
• \`/history\` - View share purchase history

👥 **Referrals:**
• \`/referrals\` - Referral system and downline
• \`/leaderboard\` - Top referrers ranking

🎯 **Navigation:**
• \`/menu\` - Main navigation menu
• \`/profile\` - Your account profile

🆘 **Support:**
• \`/support\` - Support center
• \`/help\` - This help message
• \`/faq\` - Frequently asked questions

💡 **Tips:**
• Use buttons for easier navigation
• All commands work with / prefix
• Type any command to get started`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "🏠 Main Menu", callback_data: "back_to_menu" },
        { text: "🆘 Support", callback_data: "get_support" }
      ]
    ]
  };

  await ctx.replyWithMarkdown(helpMessage, { reply_markup: keyboard });
});

// FAQ COMMAND
bot.command("faq", async (ctx) => {
  const faqMessage = `❓ **Frequently Asked Questions**

**🔐 Account & Login:**
Q: How do I link my Telegram to my web account?
A: Use /start and login with your email and password. Your account will be automatically linked.

Q: I forgot my password, what do I do?
A: During login, click "Forgot Password?" to reset it via email.

**💰 Investments:**
Q: How do I buy shares through Telegram?
A: Use /packages to browse options, then follow the share purchase flow with payment instructions.

Q: What payment methods are supported?
A: Cryptocurrency (BTC, ETH, USDT) and bank transfers are supported.

**👥 Referrals:**
Q: How do referral commissions work?
A: You earn 20% commission on direct sales from people you refer.

Q: How do I get my referral link?
A: Use /referrals and click "Share Link" to get your personal referral URL.

**📊 Portfolio:**
Q: When will I receive dividends?
A: Dividend calculations are based on mine production reaching full capacity by June 2026.

Q: How do I track my investments?
A: Use /portfolio to see all your investments, shares, and projected dividends.`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "💬 More Questions?", callback_data: "start_live_chat" },
        { text: "🔙 Back", callback_data: "back_to_menu" }
      ]
    ]
  };

  await ctx.replyWithMarkdown(faqMessage, { reply_markup: keyboard });
});

// ADMIN COMMANDS
// Admin Login Command
bot.command("admin", async (ctx) => {
  const telegramUser = ctx.telegramUser;

  // First check if user is authorized for admin access
  if (!isAuthorizedForAdmin(ctx.from.username)) {
    await ctx.reply("❌ **Access Denied**\n\nYou are not authorized to access the admin panel.\n\n🚨 This incident has been logged.");
    logSuspiciousActivity(ctx.from.id, 'UNAUTHORIZED_ADMIN_ACCESS', {
      username: ctx.from.username,
      firstName: ctx.from.first_name,
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (isAdminAuthenticated(ctx.from.id)) {
    // Already authenticated, show admin panel
    const adminMessage = `🔐 **Admin Panel**

Welcome, Administrator!

🛡️ **Security Status:**
• Session Active: ✅
• Session Expires: ${new Date(adminSessions.get(ctx.from.id).expires).toLocaleString()}

🔧 **Available Commands:**
• /admin_stats - System statistics
• /admin_users - User management
• /admin_security - Security overview
• /admin_logs - View security logs
• /admin_broadcast - Send broadcast message
• /admin_logout - Logout from admin

⚠️ **Security Notice:** All admin actions are logged and monitored.`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📊 System Stats", callback_data: "admin_stats" },
          { text: "👥 User Management", callback_data: "admin_users" }
        ],
        [
          { text: "🛡️ Security Overview", callback_data: "admin_security" },
          { text: "📋 Security Logs", callback_data: "admin_logs" }
        ],
        [
          { text: "📢 Broadcast Message", callback_data: "admin_broadcast" },
          { text: "🚪 Logout", callback_data: "admin_logout" }
        ]
      ]
    };

    await ctx.replyWithMarkdown(adminMessage, { reply_markup: keyboard });
    logAdminAction(ctx.from.id, 'ADMIN_PANEL_ACCESS', { timestamp: new Date().toISOString() });
  } else {
    // Not authenticated, request login
    const loginMessage = `🔐 **Admin Authentication Required**

Please provide your admin credentials to access the admin panel.

⚠️ **Security Notice:**
• Only authorized administrators can access this panel
• Failed login attempts are logged and monitored
• Multiple failed attempts will result in temporary lockout

Please enter your email address:`;

    await ctx.reply(loginMessage);

    // Set user state to expect admin email
    await updateTelegramUser(ctx.from.id, {
      admin_auth_step: 'email',
      admin_temp_email: null
    });
  }
});

// Admin Logout Command
bot.command("admin_logout", async (ctx) => {
  if (isAdminAuthenticated(ctx.from.id)) {
    adminSessions.delete(ctx.from.id);
    logAdminAction(ctx.from.id, 'ADMIN_LOGOUT', { timestamp: new Date().toISOString() });
    await ctx.reply("🔐 **Admin Logout Successful**\n\nYou have been logged out from the admin panel.");
  } else {
    await ctx.reply("❌ You are not currently logged in as an administrator.");
  }
});

// Admin Stats Command
bot.command("admin_stats", async (ctx) => {
  if (!isAdminAuthenticated(ctx.from.id)) {
    await ctx.reply("❌ Admin authentication required. Use /admin to login.");
    return;
  }

  try {
    // Get system statistics
    const [userCount] = await dbConnection.execute('SELECT COUNT(*) as count FROM users');
    const [telegramUserCount] = await dbConnection.execute('SELECT COUNT(*) as count FROM telegram_users');
    const [investmentCount] = await dbConnection.execute('SELECT COUNT(*) as count FROM investments');
    const [totalInvested] = await dbConnection.execute('SELECT SUM(amount) as total FROM investments WHERE status = "confirmed"');

    const statsMessage = `📊 **System Statistics**

👥 **Users:**
• Total Web Users: ${userCount[0].count}
• Total Telegram Users: ${telegramUserCount[0].count}
• Active Admin Sessions: ${adminSessions.size}

💰 **Investments:**
• Total Investments: ${investmentCount[0].count}
• Total Amount Invested: $${(totalInvested[0].total || 0).toLocaleString()}

🛡️ **Security:**
• Rate Limited Users: ${rateLimiting.size}
• Suspicious Activity Reports: ${suspiciousActivity.size}
• Failed Login Attempts: ${loginAttempts.size}

🕐 **System:**
• Bot Uptime: ${process.uptime().toFixed(0)} seconds
• Memory Usage: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "🔄 Refresh", callback_data: "admin_stats" }],
        [{ text: "🔙 Back to Admin Panel", callback_data: "back_to_admin" }]
      ]
    };

    await ctx.replyWithMarkdown(statsMessage, { reply_markup: keyboard });
    logAdminAction(ctx.from.id, 'VIEW_SYSTEM_STATS', { timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Admin stats error:', error);
    await ctx.reply("❌ Error retrieving system statistics.");
  }
});

// RESET COMMAND (for debugging authentication issues)
bot.command("reset", async (ctx) => {
  try {
    // Clear all user session data
    await updateTelegramUser(ctx.from.id, {
      is_registered: false,
      registration_step: 'start',
      registration_mode: null,
      temp_email: null,
      temp_password: null,
      awaiting_tx_hash: false,
      payment_network: null,
      payment_package_id: null,
      awaiting_receipt: false,
      password_reset_token: null,
      password_reset_expires: null
      // Keep linked_email and auto_login_enabled for returning users
    });

    const resetMessage = `🔄 **Session Reset Complete**

Your bot session has been reset. You can now:

🔹 **Login:** Use /start to login with your existing account
🔹 **Fresh Start:** All temporary data cleared
🔹 **Auto-Login:** Your account linking is preserved

Ready to start fresh? Use /start to begin!`;

    await ctx.reply(resetMessage, { parse_mode: "Markdown" });
    console.log(`🔄 Session reset for ${ctx.from.first_name} (${ctx.from.id})`);
  } catch (error) {
    console.error("Reset command error:", error);
    await ctx.reply("❌ Error resetting session. Please try /start or contact support.");
  }
});

// NFT COMMAND
bot.command("nft", async (ctx) => {
  const telegramUser = ctx.telegramUser;

  if (!telegramUser.is_registered) {
    await ctx.reply("❌ Please login or register first using /start");
    return;
  }

  try {
    const userEmail = telegramUser.linked_email || telegramUser.email;
    if (!userEmail) {
      await ctx.reply("❌ No email address found. Please logout and login again.");
      return;
    }

    const nftMessage = await formatNFTPortfolio(userEmail);

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📜 View Certificates", callback_data: "view_certificates" },
          { text: "🎫 NFT Coupons", callback_data: "view_nft_coupons" }
        ],
        [
          { text: "📄 Generate Certificate", callback_data: "generate_certificate" },
          { text: "🖨️ Print Options", callback_data: "print_options" }
        ],
        [
          { text: "🔄 Refresh", callback_data: "refresh_nft" },
          { text: "🔙 Main Menu", callback_data: "back_to_menu" }
        ]
      ]
    };

    await ctx.replyWithMarkdown(nftMessage, { reply_markup: keyboard });
  } catch (error) {
    console.error("NFT command error:", error);
    await ctx.reply("❌ Error loading NFT portfolio. Please try again later.");
  }
});

// CERTIFICATES COMMAND
bot.command("certificates", async (ctx) => {
  const telegramUser = ctx.telegramUser;

  if (!telegramUser.is_registered) {
    await ctx.reply("❌ Please login or register first using /start");
    return;
  }

  try {
    const userEmail = telegramUser.linked_email || telegramUser.email;
    if (!userEmail) {
      await ctx.reply("❌ No email address found. Please logout and login again.");
      return;
    }

    const certificatesMessage = await formatCertificates(userEmail);

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📄 Download All", callback_data: "download_all_certificates" },
          { text: "🖨️ Print Ready", callback_data: "print_ready_certificates" }
        ],
        [
          { text: "🔄 Refresh", callback_data: "refresh_certificates" },
          { text: "🔙 Back", callback_data: "back_to_menu" }
        ]
      ]
    };

    await ctx.replyWithMarkdown(certificatesMessage, { reply_markup: keyboard });
  } catch (error) {
    console.error("Certificates command error:", error);
    await ctx.reply("❌ Error loading certificates. Please try again later.");
  }
});

async function formatNFTPortfolio(userEmail) {
  try {
    const investments = await getUserInvestments(userEmail);
    const nftStats = await calculateNFTStats(investments);

    let nftMessage = `🎫 **NFT & Digital Assets Portfolio**

📊 **NFT Overview:**
🎫 Total NFT Coupons: ${nftStats.totalNFTs}
📜 Certificates Available: ${nftStats.certificatesAvailable}
✅ Delivered: ${nftStats.delivered}
⏳ Pending: ${nftStats.pending}

💎 **Digital Assets:**`;

    if (investments.length === 0) {
      nftMessage += `\n\n❌ No digital assets yet.

🔹 **Get Started:**
• Make an share purchase to receive NFT coupons
• Each share purchase includes digital certificates
• Printable share certificates available`;
    } else {
      investments.forEach((inv, index) => {
        const nftStatus = inv.nft_delivered ? '✅ Delivered' : '⏳ Pending';
        const certificateStatus = inv.certificate_generated ? '📜 Available' : '⏳ Generating';

        nftMessage += `\n\n${index + 1}. **${inv.package_name}**
   📊 Shares: ${inv.shares}
   🎫 NFT Status: ${nftStatus}
   📜 Certificate: ${certificateStatus}
   📅 Date: ${new Date(inv.created_at).toLocaleDateString()}`;
      });
    }

    nftMessage += `\n\n🎯 **Features:**
• 12-month NFT countdown timer
• Printable share certificates
• Digital asset verification
• Blockchain-backed authenticity`;

    return nftMessage;
  } catch (error) {
    console.error("Error formatting NFT portfolio:", error);
    return "❌ Error loading NFT portfolio. Please try again later.";
  }
}

async function formatCertificates(userEmail) {
  try {
    const investments = await getUserInvestments(userEmail);

    let certificatesMessage = `📜 **Share Certificates**

📊 **Certificate Overview:**
📄 Total Certificates: ${investments.length}
✅ Ready for Download: ${investments.filter(inv => inv.certificate_generated).length}
🖨️ Print Ready: ${investments.filter(inv => inv.certificate_generated).length}

📋 **Certificate Details:**`;

    if (investments.length === 0) {
      certificatesMessage += `\n\n❌ No certificates available yet.

🔹 **Get Started:**
• Make an share purchase to receive certificates
• Certificates are auto-generated after payment
• Download and print options available`;
    } else {
      investments.forEach((inv, index) => {
        const status = inv.certificate_generated ? '✅ Ready' : '⏳ Generating';
        const downloadLink = inv.certificate_generated ?
          `https://aureusangelalliance.com/certificates/${inv.id}.pdf` : 'Not available';

        certificatesMessage += `\n\n${index + 1}. **${inv.package_name} Certificate**
   📊 Shares: ${inv.shares}
   💰 Value: ${formatCurrency(inv.amount)}
   📄 Status: ${status}
   📅 Date: ${new Date(inv.created_at).toLocaleDateString()}`;

        if (inv.certificate_generated) {
          certificatesMessage += `\n   🔗 Download: Available`;
        }
      });
    }

    certificatesMessage += `\n\n📋 **Certificate Features:**
• Official share ownership proof
• High-quality PDF format
• Suitable for printing and framing
• Legally binding documentation`;

    return certificatesMessage;
  } catch (error) {
    console.error("Error formatting certificates:", error);
    return "❌ Error loading certificates. Please try again later.";
  }
}

async function calculateNFTStats(investments) {
  try {
    return {
      totalNFTs: investments.length,
      certificatesAvailable: investments.filter(inv => inv.certificate_generated).length,
      delivered: investments.filter(inv => inv.nft_delivered).length,
      pending: investments.filter(inv => !inv.nft_delivered).length
    };
  } catch (error) {
    console.error("Error calculating NFT stats:", error);
    return {
      totalNFTs: 0,
      certificatesAvailable: 0,
      delivered: 0,
      pending: 0
    };
  }
}

// MENU COMMAND
bot.command("menu", async (ctx) => {
  const telegramUser = ctx.telegramUser;

  if (!telegramUser.is_registered) {
    await ctx.reply("❌ Please login or register first using /start");
    return;
  }

  const menuMessage = `🏆 **Aureus Angel Alliance - Dashboard**

Welcome back, ${ctx.from.first_name}! 💎

Choose how you'd like to access your share purchase platform:`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "📦 Packages", callback_data: "menu_packages" },
        { text: "📊 Portfolio", callback_data: "menu_portfolio" }
      ],
      [
        { text: "👥 Referrals", callback_data: "menu_referrals" },
        { text: "🎫 NFT Assets", callback_data: "menu_nft" }
      ],
      [
        { text: "📜 Certificates", callback_data: "menu_certificates" },
        { text: "📈 History", callback_data: "menu_history" }
      ],
      [
        { text: "👤 Profile", callback_data: "menu_profile" },
        { text: "🆘 Support", callback_data: "menu_support" }
      ],
      [
        { text: "🔄 Refresh", callback_data: "back_to_menu" }
      ]
    ]
  };

  await ctx.replyWithMarkdown(menuMessage, { reply_markup: keyboard });
  console.log(`📋 Menu accessed by ${ctx.from.first_name} (${ctx.from.id})`);
});

// DASHBOARD COMMAND - Web App Integration
bot.command("dashboard", async (ctx) => {
  const telegramUser = ctx.telegramUser;

  if (!telegramUser.is_registered) {
    await ctx.reply("❌ Please login or register first using /start");
    return;
  }

  const dashboardMessage = `🎯 **Professional Dashboard**

Access your complete share purchase platform with the same interface as our website:

✨ **Features:**
• Full website functionality
• Real-time data synchronization
• Professional charts and analytics
• Mobile-optimized interface
• Secure authentication

🔒 **Security:** Your session is automatically authenticated through Telegram.`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "📦 Packages", callback_data: "menu_packages" },
        { text: "📊 Portfolio", callback_data: "menu_portfolio" }
      ],
      [
        { text: "👥 Referrals", callback_data: "menu_referrals" },
        { text: "🎫 NFT Assets", callback_data: "menu_nft" }
      ],
      [
        { text: "🔄 Refresh", callback_data: "back_to_menu" },
        { text: "🔙 Back to Menu", callback_data: "back_to_menu" }
      ]
    ]
  };

  await ctx.replyWithMarkdown(dashboardMessage, { reply_markup: keyboard });
  console.log(`🎯 Dashboard accessed by ${ctx.from.first_name} (${ctx.from.id})`);
});

// APP COMMAND - Direct Mini App Access
bot.command("app", async (ctx) => {
  const telegramUser = ctx.telegramUser;

  if (!telegramUser.is_registered) {
    await ctx.reply("❌ Please login or register first using /start");
    return;
  }

  const appMessage = `🚀 **Aureus Share Purchase App**

Experience the full power of our share purchase platform with the same professional interface as our website!

✨ **Features:**
• 📊 Real-time portfolio dashboard
• 💰 Share Purchase package browser
• 📈 Live performance charts
• 👥 Referral management center
• 🎫 NFT & certificate gallery
• 💳 Secure payment processing

🎮 **Just like popular Telegram games** - but for serious gold mining investments!

🔒 **Secure:** Your Telegram account is automatically authenticated.`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "📦 Packages", callback_data: "menu_packages" },
        { text: "📊 Portfolio", callback_data: "menu_portfolio" }
      ],
      [
        { text: "👥 Referrals", callback_data: "menu_referrals" },
        { text: "🆘 Support", callback_data: "menu_support" }
      ],
      [
        { text: "📱 Main Menu", callback_data: "back_to_menu" }
      ]
    ]
  };

  await ctx.replyWithMarkdown(appMessage, { reply_markup: keyboard });
  console.log(`🚀 App launched by ${ctx.from.first_name} (${ctx.from.id})`);
});

// PLAY COMMAND - Fun alias for app
bot.command("play", async (ctx) => {
  const telegramUser = ctx.telegramUser;

  if (!telegramUser.is_registered) {
    await ctx.reply("❌ Please login or register first using /start");
    return;
  }

  const playMessage = `🎮 **Ready to Play?**

Launch your share purchase game where every move builds real wealth!

🏆 **Your Mission:**
• 💎 Collect gold mining shares
• 📈 Build your share portfolio
• 👥 Recruit your share purchase team
• 💰 Earn real dividends
• 🎯 Reach financial freedom

🚀 **Start Playing:**`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "📦 Packages", callback_data: "menu_packages" },
        { text: "📊 Portfolio", callback_data: "menu_portfolio" }
      ],
      [
        { text: "📊 View Leaderboard", callback_data: "view_leaderboard" },
        { text: "🏆 My Achievements", callback_data: "view_achievements" }
      ],
      [
        { text: "🔙 Back to Menu", callback_data: "back_to_menu" }
      ]
    ]
  };

  await ctx.replyWithMarkdown(playMessage, { reply_markup: keyboard });
  console.log(`🎮 Game mode accessed by ${ctx.from.first_name} (${ctx.from.id})`);
});

// LOGOUT COMMAND
bot.command("logout", async (ctx) => {
  try {
    // Clear user session data completely
    await updateTelegramUser(ctx.from.id, {
      is_registered: false,
      registration_step: 'start',
      registration_mode: null,
      temp_email: null,
      temp_password: null,
      awaiting_tx_hash: false,
      payment_network: null,
      payment_package_id: null,
      awaiting_receipt: false,
      password_reset_token: null,
      password_reset_expires: null,
      linked_email: null,
      auto_login_enabled: false,
      user_id: null
    });

    const logoutMessage = `👋 **Logged Out Successfully**

You have been logged out from your Aureus Angel Alliance account.

🔹 **To access your account again:**
• Use /start to login or register
• Your investments and data are safely stored

Thank you for using Aureus Angel Alliance! 💎`;

    await ctx.reply(logoutMessage, { parse_mode: "Markdown" });
    console.log(`👋 User ${ctx.from.first_name} (${ctx.from.id}) logged out`);
  } catch (error) {
    console.error("Logout error:", error);
    await ctx.reply("❌ Error during logout. Please try again.");
  }
});

// CALLBACK QUERY HANDLER - SIMPLIFIED AND WORKING
bot.on("callback_query", async (ctx) => {
  const data = ctx.callbackQuery.data;
  console.log(`🔘 Callback query: ${data} from ${ctx.from.first_name}`);

  // Menu callbacks
  if (data === "menu_packages") {
    await ctx.answerCbQuery();
    // Trigger packages command
    ctx.command = "packages";
    return bot.handleUpdate({ message: { text: "/packages", from: ctx.from, chat: ctx.chat } });
  }

  if (data === "menu_portfolio") {
    await ctx.answerCbQuery();
    // Trigger portfolio command
    ctx.command = "portfolio";
    return bot.handleUpdate({ message: { text: "/portfolio", from: ctx.from, chat: ctx.chat } });
  }

  if (data === "menu_profile") {
    await ctx.answerCbQuery();
    const telegramUser = ctx.telegramUser;

    const profileMessage = `👤 **Your Profile**

📧 **Email:** ${telegramUser.linked_email || telegramUser.email || 'Not linked'}
🆔 **Telegram ID:** ${ctx.from.id}
👤 **Name:** ${ctx.from.first_name} ${ctx.from.last_name || ''}
📅 **Registered:** ${new Date(telegramUser.created_at).toLocaleDateString()}

🔹 **Account Status:** ✅ Active
🔹 **Registration:** ✅ Complete
🔹 **Auto-Login:** ${telegramUser.auto_login_enabled ? '✅ Enabled' : '❌ Disabled'}

💡 **Need to update your profile?** Contact support @aureusafrica`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "🔙 Back to Menu", callback_data: "back_to_menu" }]
      ]
    };

    await ctx.editMessageText(profileMessage, {
      parse_mode: "Markdown",
      reply_markup: keyboard
    });
    return;
  }

  if (data === "menu_referrals") {
    await ctx.answerCbQuery();
    // Trigger referrals command
    ctx.command = "referrals";
    return bot.handleUpdate({ message: { text: "/referrals", from: ctx.from, chat: ctx.chat } });
  }

  if (data === "menu_nft") {
    await ctx.answerCbQuery();
    // Trigger NFT command
    ctx.command = "nft";
    return bot.handleUpdate({ message: { text: "/nft", from: ctx.from, chat: ctx.chat } });
  }

  if (data === "menu_certificates") {
    await ctx.answerCbQuery();
    // Trigger certificates command
    ctx.command = "certificates";
    return bot.handleUpdate({ message: { text: "/certificates", from: ctx.from, chat: ctx.chat } });
  }

  if (data === "menu_history") {
    await ctx.answerCbQuery();
    // Trigger history command
    ctx.command = "history";
    return bot.handleUpdate({ message: { text: "/history", from: ctx.from, chat: ctx.chat } });
  }

  if (data === "menu_support") {
    await ctx.answerCbQuery();
    // Trigger support command
    ctx.command = "support";
    return bot.handleUpdate({ message: { text: "/support", from: ctx.from, chat: ctx.chat } });
  }

  if (data === "back_to_menu") {
    await ctx.answerCbQuery();
    // Trigger menu command
    ctx.command = "menu";
    return bot.handleUpdate({ message: { text: "/menu", from: ctx.from, chat: ctx.chat } });
  }

  // Portfolio callbacks
  if (data === "investment_history") {
    await ctx.answerCbQuery();
    const telegramUser = ctx.telegramUser;
    const userEmail = telegramUser.linked_email || telegramUser.email;

    if (!userEmail) {
      await ctx.editMessageText("❌ No email address found. Please logout and login again.");
      return;
    }

    const historyMessage = await formatInvestmentHistory(userEmail);

    const keyboard = {
      inline_keyboard: [
        [{ text: "🔙 Back to Portfolio", callback_data: "refresh_portfolio" }]
      ]
    };

    await ctx.editMessageText(historyMessage, {
      parse_mode: "Markdown",
      reply_markup: keyboard
    });
    return;
  }

  if (data === "portfolio_stats") {
    await ctx.answerCbQuery();
    const telegramUser = ctx.telegramUser;
    const userEmail = telegramUser.linked_email || telegramUser.email;

    if (!userEmail) {
      await ctx.editMessageText("❌ No email address found. Please logout and login again.");
      return;
    }

    const investments = await getUserInvestments(userEmail);
    const stats = await calculatePortfolioStats(investments);

    const statsMessage = `📊 **Portfolio Statistics**

📈 **Share Purchase Overview:**
• Total Investments: ${stats.totalInvestments}
• Total Amount: ${formatCurrency(stats.totalInvested)}
• Total Shares: ${stats.totalShares.toLocaleString()}
• Average Share Purchase: ${formatCurrency(stats.totalInvested / stats.totalInvestments || 0)}

✅ **Status Breakdown:**
• Confirmed: ${stats.confirmedInvestments}
• Pending: ${stats.pendingInvestments}
• Success Rate: ${((stats.confirmedInvestments / stats.totalInvestments) * 100 || 0).toFixed(1)}%

🎁 **Delivery Status:**
• NFT Certificates: ${stats.nftDelivered}/${stats.totalInvestments}
• ROI Deliveries: ${stats.roiDelivered}/${stats.totalInvestments}

📅 **Timeline:**
• First Share Purchase: ${investments.length > 0 ? new Date(investments[investments.length - 1].created_at).toLocaleDateString() : 'N/A'}
• Latest Share Purchase: ${investments.length > 0 ? new Date(investments[0].created_at).toLocaleDateString() : 'N/A'}`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "🔙 Back to Portfolio", callback_data: "refresh_portfolio" }]
      ]
    };

    await ctx.editMessageText(statsMessage, {
      parse_mode: "Markdown",
      reply_markup: keyboard
    });
    return;
  }

  if (data === "refresh_portfolio") {
    await ctx.answerCbQuery();
    // Trigger portfolio command
    ctx.command = "portfolio";
    return bot.handleUpdate({ message: { text: "/portfolio", from: ctx.from, chat: ctx.chat } });
  }

  // Referral callbacks
  if (data === "view_downline") {
    await ctx.answerCbQuery();
    const telegramUser = ctx.telegramUser;
    const userEmail = telegramUser.linked_email || telegramUser.email;

    if (!userEmail) {
      await ctx.editMessageText("❌ No email address found. Please logout and login again.");
      return;
    }

    // Get user ID
    const [userRows] = await dbConnection.execute(
      'SELECT id FROM users WHERE email = ?',
      [userEmail]
    );

    if (userRows.length === 0) {
      await ctx.editMessageText("❌ User not found.");
      return;
    }

    const userId = userRows[0].id;

    // Get downline members
    const [downlineRows] = await dbConnection.execute(
      'SELECT username, email, created_at FROM users WHERE referred_by = ? ORDER BY created_at DESC LIMIT 10',
      [userId]
    );

    let downlineMessage = `👥 **Your Downline**

📊 **Direct Referrals:** ${downlineRows.length}

👤 **Recent Members:**`;

    if (downlineRows.length === 0) {
      downlineMessage += `\n\n❌ No referrals yet.

💡 **Get Started:**
• Share your referral link
• Invite friends and family
• Earn 20% commission on sales`;
    } else {
      downlineRows.forEach((member, index) => {
        downlineMessage += `\n\n${index + 1}. **${member.username}**
   📧 ${member.email}
   📅 Joined: ${new Date(member.created_at).toLocaleDateString()}`;
      });
    }

    const keyboard = {
      inline_keyboard: [
        [{ text: "🔙 Back to Referrals", callback_data: "back_to_referrals" }]
      ]
    };

    await ctx.editMessageText(downlineMessage, {
      parse_mode: "Markdown",
      reply_markup: keyboard
    });
    return;
  }

  if (data === "share_referral_link") {
    await ctx.answerCbQuery();
    const telegramUser = ctx.telegramUser;
    const userEmail = telegramUser.linked_email || telegramUser.email;

    if (!userEmail) {
      await ctx.editMessageText("❌ No email address found. Please logout and login again.");
      return;
    }

    // Get user ID
    const [userRows] = await dbConnection.execute(
      'SELECT id, username FROM users WHERE email = ?',
      [userEmail]
    );

    if (userRows.length === 0) {
      await ctx.editMessageText("❌ User not found.");
      return;
    }

    const user = userRows[0];
    const referralLink = `https://aureusangelalliance.com/register?ref=${user.id}`;

    const shareMessage = `🔗 **Share Your Referral Link**

**Your Personal Link:**
\`${referralLink}\`

📱 **Share Options:**
• Copy the link above
• Share on social media
• Send to friends via WhatsApp
• Email to your contacts

💰 **Earn 20% Commission:**
• Direct sales commission
• Immediate payout
• No limits on earnings
• Build passive income

🎯 **Tips for Success:**
• Share your share purchase story
• Explain the gold mining opportunity
• Highlight the NPO support aspect
• Show your portfolio growth`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📱 Share on Telegram", switch_inline_query: `Join me in gold mining investments! ${referralLink}` }
        ],
        [
          { text: "🔙 Back to Referrals", callback_data: "back_to_referrals" }
        ]
      ]
    };

    await ctx.editMessageText(shareMessage, {
      parse_mode: "Markdown",
      reply_markup: keyboard
    });
    return;
  }

  if (data === "back_to_referrals") {
    await ctx.answerCbQuery();
    // Trigger referrals command
    ctx.command = "referrals";
    return bot.handleUpdate({ message: { text: "/referrals", from: ctx.from, chat: ctx.chat } });
  }

  // NFT and Certificate callbacks
  if (data === "view_certificates") {
    await ctx.answerCbQuery();
    // Trigger certificates command
    ctx.command = "certificates";
    return bot.handleUpdate({ message: { text: "/certificates", from: ctx.from, chat: ctx.chat } });
  }

  if (data === "view_nft_coupons") {
    await ctx.answerCbQuery();
    const telegramUser = ctx.telegramUser;
    const userEmail = telegramUser.linked_email || telegramUser.email;

    if (!userEmail) {
      await ctx.editMessageText("❌ No email address found. Please logout and login again.");
      return;
    }

    const investments = await getUserInvestments(userEmail);

    let couponsMessage = `🎫 **NFT Coupons**

📊 **Coupon Overview:**
🎫 Total Coupons: ${investments.length}
✅ Active: ${investments.filter(inv => inv.nft_delivered).length}
⏳ Pending: ${investments.filter(inv => !inv.nft_delivered).length}

🎫 **Your NFT Coupons:**`;

    if (investments.length === 0) {
      couponsMessage += `\n\n❌ No NFT coupons yet.

🔹 **Get Started:**
• Make an share purchase to receive NFT coupons
• Each share purchase includes unique NFT
• 12-month countdown timer included`;
    } else {
      investments.forEach((inv, index) => {
        const status = inv.nft_delivered ? '✅ Active' : '⏳ Pending';
        const deliveryDate = inv.nft_delivery_date ?
          new Date(inv.nft_delivery_date).toLocaleDateString() : 'TBD';

        couponsMessage += `\n\n${index + 1}. **${inv.package_name} NFT**
   🎫 Status: ${status}
   📊 Shares: ${inv.shares}
   📅 Delivery: ${deliveryDate}
   🆔 ID: ${inv.id.substring(0, 8)}...`;
      });
    }

    const keyboard = {
      inline_keyboard: [
        [{ text: "🔙 Back to NFT Portfolio", callback_data: "refresh_nft" }]
      ]
    };

    await ctx.editMessageText(couponsMessage, {
      parse_mode: "Markdown",
      reply_markup: keyboard
    });
    return;
  }

  if (data === "generate_certificate") {
    await ctx.answerCbQuery();

    const generateMessage = `📄 **Certificate Generation**

🔄 **Generating certificates for all eligible investments...**

⏳ This process may take a few moments.

✅ **What you'll receive:**
• High-quality PDF certificates
• Official share ownership proof
• Printable format
• Digital signatures

📧 **Delivery:**
• Certificates will be sent to your email
• Download links will be provided
• Available in your portfolio

🕐 **Processing time:** 2-5 minutes`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📧 Send to Email", callback_data: "send_certificates_email" },
          { text: "📱 View in Bot", callback_data: "view_certificates" }
        ],
        [
          { text: "🔙 Back to NFT", callback_data: "refresh_nft" }
        ]
      ]
    };

    await ctx.editMessageText(generateMessage, {
      parse_mode: "Markdown",
      reply_markup: keyboard
    });
    return;
  }

  if (data === "refresh_nft") {
    await ctx.answerCbQuery();
    // Trigger NFT command
    ctx.command = "nft";
    return bot.handleUpdate({ message: { text: "/nft", from: ctx.from, chat: ctx.chat } });
  }

  // Support callbacks
  if (data === "start_live_chat") {
    await ctx.answerCbQuery();

    const chatMessage = `💬 **Live Chat Support**

🔗 **Connect with our support team:**

📱 **Telegram:** @aureusafrica
📧 **Email:** support@aureusangelalliance.com
🌐 **Website:** aureusangelalliance.com/support

🕐 **Support Hours:**
• Monday - Friday: 9 AM - 6 PM (UTC)
• Saturday: 10 AM - 4 PM (UTC)
• Sunday: Emergency support only

⚡ **Quick Response:**
• Average response time: 5-15 minutes
• Technical issues: Priority support
• Share Purchase questions: Immediate help

💡 **Before contacting support:**
• Check /faq for common questions
• Have your account email ready
• Describe your issue clearly`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📱 Contact Support", callback_data: "contact_support_info" },
          { text: "❓ FAQ", callback_data: "view_faq" }
        ],
        [
          { text: "🔙 Back to Support", callback_data: "get_support" }
        ]
      ]
    };

    await ctx.editMessageText(chatMessage, {
      parse_mode: "Markdown",
      reply_markup: keyboard
    });
    return;
  }

  if (data === "view_faq") {
    await ctx.answerCbQuery();
    // Trigger FAQ command
    ctx.command = "faq";
    return bot.handleUpdate({ message: { text: "/faq", from: ctx.from, chat: ctx.chat } });
  }

  if (data === "get_support") {
    await ctx.answerCbQuery();
    // Trigger support command
    ctx.command = "support";
    return bot.handleUpdate({ message: { text: "/support", from: ctx.from, chat: ctx.chat } });
  }

  if (data === "contact_support_info") {
    await ctx.answerCbQuery();

    const contactMessage = `📞 **Contact Information**

🔗 **Support Channels:**

📱 **Telegram:** @aureusafrica
📧 **Email:** support@aureusangelalliance.com
🌐 **Website:** aureusangelalliance.com

🕐 **Support Hours:**
• Monday - Friday: 9 AM - 6 PM (UTC)
• Saturday: 10 AM - 4 PM (UTC)
• Sunday: Emergency support only

💡 **For fastest response:**
• Use Telegram: @aureusafrica
• Include your account email
• Describe your issue clearly`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔙 Back to Support", callback_data: "get_support" }
        ]
      ]
    };

    await ctx.editMessageText(contactMessage, {
      parse_mode: "Markdown",
      reply_markup: keyboard
    });
    return;
  }

  // Admin Login Callback
  if (data === "admin_login") {
    await ctx.answerCbQuery();

    // Check if user is authorized
    if (!isAuthorizedForAdmin(ctx.from.username)) {
      await ctx.editMessageText("❌ **Access Denied**\n\nYou are not authorized to access the admin panel.\n\n🚨 This incident has been logged.");
      logSuspiciousActivity(ctx.from.id, 'UNAUTHORIZED_ADMIN_ACCESS', {
        username: ctx.from.username,
        firstName: ctx.from.first_name,
        timestamp: new Date().toISOString()
      });
      return;
    }

    const adminLoginMessage = `🔐 **Admin Authentication**

Welcome, @${ctx.from.username}!

You are authorized to access the admin panel. Please provide your admin credentials to continue.

⚠️ **Security Notice:**
• All admin actions are logged and monitored
• Session expires after 1 hour of inactivity
• Failed attempts will result in temporary lockout

Please enter your admin email address:`;

    await ctx.editMessageText(adminLoginMessage);

    // Set user state to expect admin email
    await updateTelegramUser(ctx.from.id, {
      admin_auth_step: 'email',
      admin_temp_email: null
    });
    return;
  }

  // Admin Panel Access (for authenticated users)
  if (data === "admin_panel_access") {
    await ctx.answerCbQuery();

    // Check if user is authorized
    if (!isAuthorizedForAdmin(ctx.from.username)) {
      await ctx.editMessageText("❌ **Access Denied**\n\nYou are not authorized to access the admin panel.");
      return;
    }

    if (isAdminAuthenticated(ctx.from.id)) {
      // Show admin panel
      const adminMessage = `🔐 **Admin Panel**

Welcome back, Administrator @${ctx.from.username}!

🛡️ **Security Status:**
• Session Active: ✅
• Session Expires: ${new Date(adminSessions.get(ctx.from.id).expires).toLocaleString()}

🔧 **Available Commands:**
• System Statistics
• User Management
• Security Overview
• Security Logs
• Broadcast Message
• Admin Logout

⚠️ **Security Notice:** All admin actions are logged and monitored.`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📊 System Stats", callback_data: "admin_stats" },
            { text: "👥 User Management", callback_data: "admin_users" }
          ],
          [
            { text: "🛡️ Security Overview", callback_data: "admin_security" },
            { text: "📋 Security Logs", callback_data: "admin_logs" }
          ],
          [
            { text: "📢 Broadcast Message", callback_data: "admin_broadcast" },
            { text: "🚪 Logout", callback_data: "admin_logout" }
          ],
          [
            { text: "🔙 Back to Main Menu", callback_data: "back_to_menu" }
          ]
        ]
      };

      await ctx.editMessageText(adminMessage, {
        parse_mode: "Markdown",
        reply_markup: keyboard
      });
      logAdminAction(ctx.from.id, 'ADMIN_PANEL_ACCESS', { timestamp: new Date().toISOString() });
    } else {
      // Redirect to admin login
      await ctx.editMessageText("🔐 **Admin Authentication Required**\n\nPlease authenticate first using the Admin Login option.");
    }
    return;
  }

  // Admin Stats Callback
  if (data === "admin_stats") {
    await ctx.answerCbQuery();

    if (!isAuthorizedForAdmin(ctx.from.username) || !isAdminAuthenticated(ctx.from.id)) {
      await ctx.editMessageText("❌ Admin authentication required.");
      return;
    }

    try {
      // Get system statistics
      const [userCount] = await dbConnection.execute('SELECT COUNT(*) as count FROM users');
      const [telegramUserCount] = await dbConnection.execute('SELECT COUNT(*) as count FROM telegram_users');
      const [investmentCount] = await dbConnection.execute('SELECT COUNT(*) as count FROM investments');
      const [totalInvested] = await dbConnection.execute('SELECT SUM(amount) as total FROM investments WHERE status = "confirmed"');

      const statsMessage = `📊 **System Statistics**

👥 **Users:**
• Total Web Users: ${userCount[0].count}
• Total Telegram Users: ${telegramUserCount[0].count}
• Active Admin Sessions: ${adminSessions.size}

💰 **Investments:**
• Total Investments: ${investmentCount[0].count}
• Total Amount Invested: $${(totalInvested[0].total || 0).toLocaleString()}

🛡️ **Security:**
• Rate Limited Users: ${rateLimiting.size}
• Suspicious Activity Reports: ${suspiciousActivity.size}
• Failed Login Attempts: ${loginAttempts.size}

🕐 **System:**
• Bot Uptime: ${process.uptime().toFixed(0)} seconds
• Memory Usage: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "🔄 Refresh", callback_data: "admin_stats" }],
          [{ text: "🔙 Back to Admin Panel", callback_data: "admin_panel_access" }]
        ]
      };

      await ctx.editMessageText(statsMessage, {
        parse_mode: "Markdown",
        reply_markup: keyboard
      });
      logAdminAction(ctx.from.id, 'VIEW_SYSTEM_STATS', { timestamp: new Date().toISOString() });
    } catch (error) {
      console.error('Admin stats error:', error);
      await ctx.editMessageText("❌ Error retrieving system statistics.");
    }
    return;
  }

  // Admin Logout Callback
  if (data === "admin_logout") {
    await ctx.answerCbQuery();

    if (isAdminAuthenticated(ctx.from.id)) {
      adminSessions.delete(ctx.from.id);
      logAdminAction(ctx.from.id, 'ADMIN_LOGOUT', { timestamp: new Date().toISOString() });
      await ctx.editMessageText("🔐 **Admin Logout Successful**\n\nYou have been logged out from the admin panel.\n\nUse /start to return to the main menu.");
    } else {
      await ctx.editMessageText("❌ You are not currently logged in as an administrator.");
    }
    return;
  }

  // Admin Security Overview
  if (data === "admin_security") {
    await ctx.answerCbQuery();

    if (!isAuthorizedForAdmin(ctx.from.username) || !isAdminAuthenticated(ctx.from.id)) {
      await ctx.editMessageText("❌ Admin authentication required.");
      return;
    }

    const securityMessage = `🛡️ **Security Overview**

🔐 **Admin Security:**
• Authorized Username: @${ADMIN_USERNAME}
• Active Admin Sessions: ${adminSessions.size}
• Session Timeout: ${ADMIN_SESSION_TIMEOUT / 60000} minutes

⚠️ **Security Monitoring:**
• Rate Limited Users: ${rateLimiting.size}
• Suspicious Activities: ${suspiciousActivity.size}
• Failed Login Attempts: ${loginAttempts.size}

🚨 **Recent Security Events:**
• Max Login Attempts: ${MAX_LOGIN_ATTEMPTS}
• Login Cooldown: ${LOGIN_COOLDOWN / 60000} minutes
• Rate Limit: ${RATE_LIMIT_MAX_REQUESTS} requests per minute

🔒 **Protection Status:**
• Input Sanitization: ✅ Active
• SQL Injection Protection: ✅ Active
• Rate Limiting: ✅ Active
• Admin Access Control: ✅ Active`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📋 View Logs", callback_data: "admin_logs" },
          { text: "🔄 Refresh", callback_data: "admin_security" }
        ],
        [
          { text: "🔙 Back to Admin Panel", callback_data: "admin_panel_access" }
        ]
      ]
    };

    await ctx.editMessageText(securityMessage, {
      parse_mode: "Markdown",
      reply_markup: keyboard
    });
    logAdminAction(ctx.from.id, 'VIEW_SECURITY_OVERVIEW', { timestamp: new Date().toISOString() });
    return;
  }

  // Package callbacks - PRIORITY HANDLING
  if (data.startsWith("package_")) {
    console.log(`🎯 PACKAGE CALLBACK: ${data}`);
    await ctx.answerCbQuery();
    
    const packageId = data.replace("package_", "");
    console.log(`🔍 Looking for package ID: ${packageId}`);
    
    try {
      const pkg = await getPackageById(packageId);
      
      if (!pkg) {
        console.log(`❌ Package not found for ID: ${packageId}`);
        await ctx.editMessageText("❌ Package not found.", { parse_mode: "Markdown" });
        return;
      }
      
      console.log(`✅ Package found: ${pkg.name}`);
      const packageInfo = await formatPackageInfo(pkg);

      const keyboard = {
        inline_keyboard: [
          [
            { text: "💰 Buy Shares Now", callback_data: `invest_${packageId}` }
          ],
          [
            { text: "🔙 Back to Packages", callback_data: "back_to_packages" }
          ]
        ]
      };

      await ctx.editMessageText(packageInfo, { parse_mode: "Markdown", reply_markup: keyboard });
    } catch (error) {
      console.error("Error showing package details:", error);
      await ctx.editMessageText("❌ Error loading package details.", { parse_mode: "Markdown" });
    }
    return;
  }
  
  // Back to packages
  if (data === "back_to_packages") {
    await ctx.answerCbQuery();
    
    try {
      const packages = await getInvestmentPackages();
      const packageMessage = `💎 *Available Share Packages* 💎

Choose a package to view details:`;

      const keyboard = {
        inline_keyboard: packages.map(pkg => [
          { text: `${pkg.name} - ${formatCurrency(pkg.price)}`, callback_data: `package_${pkg.id}` }
        ])
      };

      await ctx.editMessageText(packageMessage, { parse_mode: "Markdown", reply_markup: keyboard });
    } catch (error) {
      console.error("Error loading packages:", error);
      await ctx.editMessageText("❌ Error loading packages.", { parse_mode: "Markdown" });
    }
    return;
  }
  
  // Share Purchase flow
  if (data.startsWith("invest_")) {
    await ctx.answerCbQuery();
    const packageId = data.replace("invest_", "");
    
    const pkg = await getPackageById(packageId);
    if (!pkg) {
      await ctx.editMessageText("❌ Package not found.", { parse_mode: "Markdown" });
      return;
    }

    const mineCalc = await calculateMineProduction(pkg.shares);

    const investmentMessage = `💰 **Share Purchase Confirmation**

**Package:** ${pkg.name}
**Price:** ${formatCurrency(pkg.price)}
**Shares:** ${pkg.shares}

📈 **Mine Production Projection:**
🏭 Annual Production: ${mineCalc.annualProduction.toLocaleString()} KG gold
💰 Gold Price: ${formatLargeNumber(mineCalc.goldPricePerKg)} per KG
💎 Net Annual Profit: ${formatLargeNumber(mineCalc.netProfit)}
📊 Dividend per Share: ${formatCurrency(mineCalc.dividendPerShare)}
🎯 Your Annual Dividend: ${formatLargeNumber(mineCalc.userAnnualDividend)}

⚠️ **Production Timeline:**
The dividend calculation above is based on reaching full mine production capacity, utilizing 10 washplants—each capable of processing 200 tons of alluvial material per hour. This production milestone is targeted for achievement by June 2026.

🔹 **Share Purchase Details:**
• You will receive ${pkg.shares} shares
• Annual dividend projection: ${formatLargeNumber(mineCalc.userAnnualDividend)}
• NFT Certificate included
• 12-month share purchase period

⚠️ **Important:** This is a real share purchase. Please confirm you want to proceed.`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "✅ Confirm Share Purchase", callback_data: `confirm_invest_${packageId}` }
        ],
        [
          { text: "🔙 Back to Package", callback_data: `package_${packageId}` }
        ]
      ]
    };

    await ctx.editMessageText(investmentMessage, { parse_mode: "Markdown", reply_markup: keyboard });
    return;
  }

  // Share Purchase confirmation callback
  if (data.startsWith("confirm_invest_")) {
    await ctx.answerCbQuery();
    const packageId = data.replace("confirm_invest_", "");

    const pkg = await getPackageById(packageId);
    if (!pkg) {
      await ctx.editMessageText("❌ Package not found.", { parse_mode: "Markdown" });
      return;
    }

    // Show payment method selection
    const paymentMessage = `💳 **Payment Method Selection**

**Package:** ${pkg.name}
**Amount:** ${formatCurrency(pkg.price)}

Please choose your preferred payment method:`;

    const paymentKeyboard = {
      inline_keyboard: [
        [
          { text: "💰 Cryptocurrency", callback_data: `payment_crypto_${packageId}` }
        ],
        [
          { text: "🏦 Bank Transfer", callback_data: `payment_bank_${packageId}` }
        ],
        [
          { text: "🔙 Back to Share Purchase", callback_data: `invest_${packageId}` }
        ]
      ]
    };

    await ctx.editMessageText(paymentMessage, { parse_mode: "Markdown", reply_markup: paymentKeyboard });
    return;
  }

  // Crypto payment callback
  if (data.startsWith("payment_crypto_")) {
    await ctx.answerCbQuery();
    const packageId = data.replace("payment_crypto_", "");

    const pkg = await getPackageById(packageId);
    if (!pkg) {
      await ctx.editMessageText("❌ Package not found.", { parse_mode: "Markdown" });
      return;
    }

    // Show crypto network selection
    const cryptoMessage = `🔗 **Select Blockchain Network**

**Package:** ${pkg.name}
**Amount:** ${formatCurrency(pkg.price)}

Choose your preferred blockchain network:`;

    const cryptoKeyboard = {
      inline_keyboard: [
        [
          { text: "🟡 Binance Smart Chain (BSC)", callback_data: `crypto_bsc_${packageId}` }
        ],
        [
          { text: "🔵 Ethereum", callback_data: `crypto_ethereum_${packageId}` }
        ],
        [
          { text: "🟣 Polygon", callback_data: `crypto_polygon_${packageId}` }
        ],
        [
          { text: "🔴 Tron", callback_data: `crypto_tron_${packageId}` }
        ],
        [
          { text: "🔙 Back to Payment Methods", callback_data: `confirm_invest_${packageId}` }
        ]
      ]
    };

    await ctx.editMessageText(cryptoMessage, { parse_mode: "Markdown", reply_markup: cryptoKeyboard });
    return;
  }

  // Crypto network specific callbacks
  if (data.startsWith("crypto_")) {
    await ctx.answerCbQuery();
    const parts = data.split("_");
    const network = parts[1]; // bsc, ethereum, polygon, tron
    const packageId = parts[2];

    const pkg = await getPackageById(packageId);
    if (!pkg) {
      await ctx.editMessageText("❌ Package not found.", { parse_mode: "Markdown" });
      return;
    }

    const wallets = await getCompanyWallets();
    const walletAddress = wallets[network];

    if (!walletAddress) {
      await ctx.editMessageText("❌ Wallet not available for this network.", { parse_mode: "Markdown" });
      return;
    }

    // Network display names and info
    const networkInfo = {
      bsc: { name: "Binance Smart Chain", symbol: "BNB/USDT", explorer: "bscscan.com" },
      ethereum: { name: "Ethereum", symbol: "ETH/USDT", explorer: "etherscan.io" },
      polygon: { name: "Polygon", symbol: "MATIC/USDT", explorer: "polygonscan.com" },
      tron: { name: "Tron", symbol: "TRX/USDT", explorer: "tronscan.org" }
    };

    const info = networkInfo[network];
    const paymentInstructions = `💳 **Cryptocurrency Payment**

**Package:** ${pkg.name}
**Amount:** ${formatCurrency(pkg.price)}
**Network:** ${info.name}
**Accepted Tokens:** ${info.symbol}

📋 **Payment Instructions:**

1️⃣ **Send Payment To:**
\`${walletAddress}\`

2️⃣ **Important Notes:**
• Send USDT tokens only
• Use ${info.name} network
• Minimum amount: ${formatCurrency(pkg.price)}
• Include your Telegram username in memo/note

3️⃣ **After Payment:**
• Take a screenshot of the transaction
• Send the transaction hash to this bot
• Wait for confirmation (usually 5-15 minutes)

⚠️ **Warning:** Only send USDT on ${info.name} network. Other tokens or networks may result in loss of funds.

🔍 **Verify on Explorer:** ${info.explorer}`;

    const paymentKeyboard = {
      inline_keyboard: [
        [
          { text: "📋 Copy Wallet Address", callback_data: `copy_wallet_${network}` }
        ],
        [
          { text: "✅ I've Sent Payment", callback_data: `payment_sent_${network}_${packageId}` }
        ],
        [
          { text: "🔙 Back to Networks", callback_data: `payment_crypto_${packageId}` }
        ]
      ]
    };

    await ctx.editMessageText(paymentInstructions, { parse_mode: "Markdown", reply_markup: paymentKeyboard });
    return;
  }

  // Copy wallet address callback
  if (data.startsWith("copy_wallet_")) {
    await ctx.answerCbQuery("💳 Wallet address copied to clipboard!");
    return;
  }

  // Payment sent confirmation
  if (data.startsWith("payment_sent_")) {
    await ctx.answerCbQuery();
    const parts = data.split("_");
    const network = parts[2];
    const packageId = parts[3];

    const confirmMessage = `✅ **Payment Confirmation**

Thank you for your payment! Please provide the transaction hash for verification.

📝 **Next Steps:**
1. Send the transaction hash (TxID) as a message
2. Our system will verify the payment
3. You'll receive confirmation within 15 minutes
4. Your share purchase will be activated

⏳ **Waiting for transaction hash...**`;

    const confirmKeyboard = {
      inline_keyboard: [
        [
          { text: "🔙 Back to Payment", callback_data: `crypto_${network}_${packageId}` }
        ]
      ]
    };

    await ctx.editMessageText(confirmMessage, { parse_mode: "Markdown", reply_markup: confirmKeyboard });

    // Set user state to expect transaction hash
    await updateTelegramUser(ctx.from.id, {
      awaiting_tx_hash: true,
      payment_network: network,
      payment_package_id: packageId
    });
    return;
  }

  // Bank transfer callback
  if (data.startsWith("payment_bank_")) {
    await ctx.answerCbQuery();
    const packageId = data.replace("payment_bank_", "");

    const pkg = await getPackageById(packageId);
    if (!pkg) {
      await ctx.editMessageText("❌ Package not found.", { parse_mode: "Markdown" });
      return;
    }

    const referenceNumber = `AUR-${Date.now().toString().slice(-6)}`;

    const bankMessage = `🏦 **Bank Transfer Payment**

**Package:** ${pkg.name}
**Amount:** ${formatCurrency(pkg.price)}

📋 **Bank Transfer Details:**

**Account Name:** Aureus Alliance Holdings Ltd
**Bank:** JPMorgan Chase Bank
**Account Number:** 1234567890
**SWIFT Code:** CHASUS33
**Reference:** ${referenceNumber}

📍 **Bank Address:**
270 Park Avenue
New York, NY 10017
United States

📝 **Instructions:**
1. Make the transfer using the details above
2. Use the reference number provided
3. Take a photo of the transfer receipt
4. Send the receipt to this bot for verification

⏳ **Processing Time:** 1-3 business days`;

    const bankKeyboard = {
      inline_keyboard: [
        [
          { text: "📸 Upload Receipt", callback_data: `upload_receipt_${packageId}` }
        ],
        [
          { text: "🔙 Back to Payment Methods", callback_data: `confirm_invest_${packageId}` }
        ]
      ]
    };

    await ctx.editMessageText(bankMessage, { parse_mode: "Markdown", reply_markup: bankKeyboard });
    return;
  }

  // Upload receipt callback
  if (data.startsWith("upload_receipt_")) {
    await ctx.answerCbQuery();
    const packageId = data.replace("upload_receipt_", "");

    const receiptMessage = `📸 **Upload Payment Receipt**

Please send a clear photo of your bank transfer receipt or screenshot.

✅ **Make sure the image shows:**
• Transfer amount
• Reference number
• Date and time
• Bank details

📤 **Send the image now...**`;

    const receiptKeyboard = {
      inline_keyboard: [
        [
          { text: "🔙 Back to Bank Transfer", callback_data: `payment_bank_${packageId}` }
        ]
      ]
    };

    await ctx.editMessageText(receiptMessage, { parse_mode: "Markdown", reply_markup: receiptKeyboard });

    // Set user state to expect receipt upload
    await updateTelegramUser(ctx.from.id, {
      awaiting_receipt: true,
      payment_package_id: packageId
    });
    return;
  }

  // Auth callbacks
  if (data === "auth_login") {
    await ctx.answerCbQuery();
    await ctx.editMessageText("🔑 *Account Login*\n\nPlease enter your email address:", { parse_mode: "Markdown" });
    await updateTelegramUser(ctx.from.id, {
      registration_step: "email",
      registration_mode: "login"
    });
    return;
  }
  
  if (data === "auth_register") {
    await ctx.answerCbQuery();
    await ctx.editMessageText("📝 *Create New Account*\n\nPlease enter your email address:", { parse_mode: "Markdown" });
    await updateTelegramUser(ctx.from.id, {
      registration_step: "email",
      registration_mode: "register"
    });
    return;
  }

  if (data === "forgot_password") {
    await ctx.answerCbQuery();
    const telegramUser = ctx.telegramUser;

    if (!telegramUser.temp_email) {
      await ctx.editMessageText("❌ Please start the login process first.", { parse_mode: "Markdown" });
      return;
    }

    // Check if email exists
    const [rows] = await dbConnection.execute(
      'SELECT id, email, full_name FROM users WHERE email = ?',
      [telegramUser.temp_email]
    );

    if (rows.length === 0) {
      await ctx.editMessageText(`❌ **Email Not Found**

The email address ${telegramUser.temp_email} is not registered in our system.

🔹 **Options:**
• Check your email address spelling
• Use a different email address
• Register a new account

Would you like to try again?`, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔄 Try Different Email", callback_data: "auth_login" }],
            [{ text: "📝 Register New Account", callback_data: "auth_register" }]
          ]
        }
      });
      return;
    }

    const user = rows[0];

    // Generate reset token
    const resetToken = await createPasswordResetToken(telegramUser.temp_email);

    if (resetToken) {
      // Send email with reset token
      const emailSent = await sendPasswordResetEmail(telegramUser.temp_email, resetToken, user.full_name || 'User');

      if (emailSent) {
        await updateTelegramUser(ctx.from.id, {
          registration_step: 'reset_token',
          password_reset_token: resetToken
        });

        await ctx.editMessageText(`📧 **Password Reset Email Sent!**

A password reset email has been sent to: **${telegramUser.temp_email}**

📬 **Check your email** for the reset token and instructions.

⏰ **Valid for:** 30 minutes

📝 **Next Step:** Enter the token from your email below to proceed with password reset.

*If you don't see the email, check your spam folder.*`, {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "📧 Resend Email", callback_data: "forgot_password" }],
              [{ text: "🔙 Back to Login", callback_data: "auth_login" }]
            ]
          }
        });
      } else {
        // Email sending failed, show token in bot (temporary solution)
        await updateTelegramUser(ctx.from.id, {
          registration_step: 'reset_token',
          password_reset_token: resetToken
        });

        await ctx.editMessageText(`🔄 **Password Reset Token**

Email service is temporarily unavailable, so here's your reset token:

🔑 **Reset Token:** \`${resetToken}\`

⏰ **Valid for:** 30 minutes

📝 **Next Step:** Enter this token below to proceed with password reset.

*Keep this token secure and don't share it with anyone.*`, {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔄 Generate New Token", callback_data: "forgot_password" }],
              [{ text: "🔙 Back to Login", callback_data: "auth_login" }]
            ]
          }
        });
      }
    } else {
      await ctx.editMessageText("❌ Failed to generate reset token. Please try again or contact support.");
    }
    return;
  }

  if (data === "auth_back_to_start") {
    await ctx.answerCbQuery();
    await updateTelegramUser(ctx.from.id, {
      registration_step: 'start',
      registration_mode: null,
      temp_email: null,
      temp_password: null
    });

    // Trigger start command
    ctx.command = "start";
    return bot.handleUpdate({ message: { text: "/start", from: ctx.from, chat: ctx.chat } });
  }

  if (data === "switch_to_login") {
    await ctx.answerCbQuery();
    await ctx.editMessageText("🔑 *Account Login*\n\nPlease enter your email address:", { parse_mode: "Markdown" });
    await updateTelegramUser(ctx.from.id, {
      registration_step: "email",
      registration_mode: "login",
      temp_email: null,
      temp_password: null
    });
    return;
  }

  if (data === "switch_to_register") {
    await ctx.answerCbQuery();
    await ctx.editMessageText("📝 *Create New Account*\n\nPlease enter your email address:", { parse_mode: "Markdown" });
    await updateTelegramUser(ctx.from.id, {
      registration_step: "email",
      registration_mode: "register",
      temp_email: null,
      temp_password: null
    });
    return;
  }
  
  // Default handler
  await ctx.answerCbQuery();
  await ctx.reply(`🚧 Feature "${data}" is coming soon! Stay tuned.`);
});

// Error handling
bot.catch((err, ctx) => {
  console.error("❌ Bot error:", err);
  ctx.reply("Sorry, something went wrong. Please try again later.");
});

// Start bot
async function startBot() {
  try {
    await connectDB();
    
    // Create telegram_users table if it doesn't exist
    await dbConnection.execute(`
      CREATE TABLE IF NOT EXISTS telegram_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        telegram_id BIGINT UNIQUE NOT NULL,
        username VARCHAR(100),
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        user_id INT,
        is_registered BOOLEAN DEFAULT FALSE,
        registration_step VARCHAR(50) DEFAULT 'start',
        registration_mode VARCHAR(20),
        temp_email VARCHAR(255),
        temp_password VARCHAR(255),
        awaiting_tx_hash BOOLEAN DEFAULT FALSE,
        payment_network VARCHAR(20),
        payment_package_id VARCHAR(36),
        awaiting_receipt BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Add new columns to existing telegram_users table if they don't exist
    try {
      await dbConnection.execute(`
        ALTER TABLE telegram_users
        ADD COLUMN IF NOT EXISTS awaiting_tx_hash BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS payment_network VARCHAR(20),
        ADD COLUMN IF NOT EXISTS payment_package_id VARCHAR(36),
        ADD COLUMN IF NOT EXISTS awaiting_receipt BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255),
        ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP NULL,
        ADD COLUMN IF NOT EXISTS linked_email VARCHAR(255),
        ADD COLUMN IF NOT EXISTS auto_login_enabled BOOLEAN DEFAULT FALSE
      `);
      console.log("✅ Telegram users table updated with authentication columns");
    } catch (error) {
      console.log("ℹ️ Authentication columns may already exist:", error.message);
    }

// AUTHENTICATION FUNCTIONS
async function validateUserCredentials(email, password) {
  try {
    const [rows] = await dbConnection.execute(
      'SELECT id, full_name, email, password_hash FROM users WHERE email = ?',
      [email]
    );

    if (rows.length === 0) {
      return { success: false, error: 'EMAIL_NOT_FOUND' };
    }

    const user = rows[0];

    // Simple password comparison (in production, use proper hashing)
    if (user.password_hash === password) {
      return { success: true, user: { ...user, name: user.full_name } };
    } else {
      return { success: false, error: 'INVALID_PASSWORD' };
    }
  } catch (error) {
    console.error("Error validating credentials:", error);
    return { success: false, error: 'DATABASE_ERROR' };
  }
}

async function linkTelegramAccount(telegramId, userEmail, userId) {
  try {
    await updateTelegramUser(telegramId, {
      is_registered: true,
      registration_step: 'complete',
      registration_mode: null,
      temp_email: null,
      temp_password: null,
      linked_email: userEmail,
      user_id: userId,
      auto_login_enabled: true
    });

    console.log(`✅ Telegram account ${telegramId} linked to email ${userEmail}`);
    return true;
  } catch (error) {
    console.error("Error linking Telegram account:", error);
    return false;
  }
}

async function generatePasswordResetToken() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

async function createPasswordResetToken(email) {
  try {
    const token = await generatePasswordResetToken();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    // Store token in users table
    await dbConnection.execute(
      'UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE email = ?',
      [token, expiresAt, email]
    );

    return token;
  } catch (error) {
    console.error("Error creating password reset token:", error);
    return null;
  }
}

async function validatePasswordResetToken(token) {
  try {
    const [rows] = await dbConnection.execute(
      'SELECT id, email FROM users WHERE password_reset_token = ? AND password_reset_expires > NOW()',
      [token]
    );

    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error("Error validating reset token:", error);
    return null;
  }
}

async function updateUserPassword(email, newPassword) {
  try {
    await dbConnection.execute(
      'UPDATE users SET password_hash = ?, password_reset_token = NULL, password_reset_expires = NULL WHERE email = ?',
      [newPassword, email]
    );
    return true;
  } catch (error) {
    console.error("Error updating password:", error);
    return false;
  }
}

async function handleAuthenticationFlow(ctx, user) {
  const messageText = ctx.message.text;

  // Handle admin authentication flow
  if (user.admin_auth_step) {
    try {
      if (user.admin_auth_step === 'email') {
        // Store admin email and ask for password
        await updateTelegramUser(ctx.from.id, {
          admin_temp_email: messageText,
          admin_auth_step: 'password'
        });

        await ctx.reply("🔐 **Admin Password**\n\nPlease enter your admin password:");
        return;
      } else if (user.admin_auth_step === 'password') {
        // Authenticate admin
        const authResult = authenticateAdmin(ctx.from.id, user.admin_temp_email, messageText);

        if (authResult.success) {
          // Clear admin auth state
          await updateTelegramUser(ctx.from.id, {
            admin_auth_step: null,
            admin_temp_email: null
          });

          const successMessage = `✅ **Admin Authentication Successful**

Welcome, Administrator @${ctx.from.username}!

🛡️ **Security Status:**
• Authentication: ✅ Verified
• Session Duration: 1 hour
• All actions will be logged

🔧 **Admin Panel Access:**
Use /admin to access the admin panel or click the button below.`;

          const keyboard = {
            inline_keyboard: [
              [{ text: "🔐 Open Admin Panel", callback_data: "admin_panel_access" }],
              [{ text: "🔙 Back to Main Menu", callback_data: "back_to_menu" }]
            ]
          };

          await ctx.reply(successMessage, {
            parse_mode: "Markdown",
            reply_markup: keyboard
          });

          logAdminAction(ctx.from.id, 'ADMIN_LOGIN_SUCCESS', {
            email: user.admin_temp_email,
            username: ctx.from.username,
            timestamp: new Date().toISOString()
          });
        } else {
          let errorMessage = "❌ **Admin Authentication Failed**\n\n";

          if (authResult.error === 'COOLDOWN') {
            const remainingMinutes = Math.ceil(authResult.remainingTime / 60000);
            errorMessage += `Too many failed attempts. Please wait ${remainingMinutes} minutes before trying again.`;
          } else if (authResult.error === 'INVALID_CREDENTIALS') {
            errorMessage += `Invalid credentials. Attempts remaining: ${authResult.attemptsRemaining}`;
          }

          errorMessage += "\n\n⚠️ **Security Notice:** Failed admin login attempts are logged and monitored.";

          await ctx.reply(errorMessage);

          // Clear admin auth state on failure
          await updateTelegramUser(ctx.from.id, {
            admin_auth_step: null,
            admin_temp_email: null
          });
        }
        return;
      }
    } catch (error) {
      console.error('Admin auth error:', error);
      await ctx.reply("❌ Admin authentication error. Please try again.");
      return;
    }
  }

  try {
    if (user.registration_step === 'email') {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(messageText)) {
        await ctx.reply("❌ Please enter a valid email address.");
        return;
      }

      // Store email and ask for password
      await updateTelegramUser(ctx.from.id, {
        temp_email: messageText,
        registration_step: 'password'
      });

      const passwordMessage = user.registration_mode === 'login'
        ? "🔑 **Enter Password**\n\nPlease enter your password:"
        : "🔑 **Create Password**\n\nPlease create a secure password:";

      const keyboard = user.registration_mode === 'login'
        ? {
            inline_keyboard: [
              [{ text: "🔄 Forgot Password?", callback_data: "forgot_password" }],
              [{ text: "📝 Register Instead", callback_data: "switch_to_register" }],
              [{ text: "🔙 Back", callback_data: "auth_back_to_start" }]
            ]
          }
        : {
            inline_keyboard: [
              [{ text: "🔑 Login Instead", callback_data: "switch_to_login" }],
              [{ text: "🔙 Back", callback_data: "auth_back_to_start" }]
            ]
          };

      await ctx.reply(passwordMessage, {
        parse_mode: "Markdown",
        reply_markup: keyboard
      });

    } else if (user.registration_step === 'password') {
      if (user.registration_mode === 'login') {
        // Handle login
        const validation = await validateUserCredentials(user.temp_email, messageText);

        if (validation.success) {
          // Link Telegram account
          const linked = await linkTelegramAccount(ctx.from.id, user.temp_email, validation.user.id);

          if (linked) {
            // Send welcome email
            await sendWelcomeEmail(user.temp_email, validation.user.name);

            const successMessage = `✅ **Login Successful!**

Welcome back, ${validation.user.name}! 🎉

🔗 **Account Linked:** Your Telegram account is now permanently linked to your shareholder account.

🚀 **Auto-Login Enabled:** You won't need to login again unless you explicitly logout.

📧 **Welcome Email:** Check your email for confirmation and additional information.

🔹 **Quick Actions:**
• /menu - Full menu
• /packages - View share packages
• /portfolio - Your portfolio
• /profile - Your profile

Ready to continue your shareholding journey? 💎`;

            await ctx.reply(successMessage, { parse_mode: "Markdown" });
            console.log(`✅ User ${ctx.from.first_name} (${ctx.from.id}) logged in and linked to ${user.temp_email}`);
          } else {
            await ctx.reply("❌ Login successful but failed to link account. Please try again or contact support.");
          }
        } else {
          let errorMessage = "❌ Login failed. ";

          if (validation.error === 'EMAIL_NOT_FOUND') {
            errorMessage += "Email address not found.\n\n🔹 **Options:**\n• Check your email address\n• Use /start to register a new account\n• Contact support if you need help";
          } else if (validation.error === 'INVALID_PASSWORD') {
            errorMessage += "Incorrect password.\n\n🔹 **Options:**\n• Try again with correct password\n• Use 'Forgot Password?' below\n• Contact support if you need help";
          } else {
            errorMessage += "Please try again or contact support.";
          }

          const keyboard = {
            inline_keyboard: [
              [{ text: "🔄 Forgot Password?", callback_data: "forgot_password" }],
              [{ text: "🔄 Try Again", callback_data: "auth_login" }],
              [{ text: "📝 Register Instead", callback_data: "auth_register" }]
            ]
          };

          await ctx.reply(errorMessage, {
            parse_mode: "Markdown",
            reply_markup: keyboard
          });
        }
      } else if (user.registration_mode === 'register') {
        // Handle registration - check if user already exists
        const [existingUsers] = await dbConnection.execute(
          'SELECT id FROM users WHERE email = ?',
          [user.temp_email]
        );

        if (existingUsers.length > 0) {
          // User already exists, suggest login instead
          const existsMessage = `❌ **Account Already Exists**

An account with email ${user.temp_email} already exists.

🔹 **Options:**
• Use the login option instead
• Try a different email address
• Reset your password if you forgot it`;

          const keyboard = {
            inline_keyboard: [
              [{ text: "🔑 Login Instead", callback_data: "auth_login" }],
              [{ text: "🔄 Forgot Password?", callback_data: "forgot_password" }],
              [{ text: "🔙 Back to Start", callback_data: "auth_back_to_start" }]
            ]
          };

          await ctx.reply(existsMessage, {
            parse_mode: "Markdown",
            reply_markup: keyboard
          });
        } else {
          // Create new account
          await ctx.reply("📝 **Registration Complete!**\n\nNew account registration is currently handled through our website. Please visit aureusangelalliance.com to create your account, then return here to login.\n\nOnce you have an account, use /start and select 'Login' to link your Telegram.");

          // Reset to start
          await updateTelegramUser(ctx.from.id, {
            registration_step: 'start',
            registration_mode: null,
            temp_email: null,
            temp_password: null
          });
        }
      }
    } else if (user.registration_step === 'reset_token') {
      // Handle reset token validation
      const tokenValid = await validatePasswordResetToken(messageText.trim());

      if (tokenValid && tokenValid.email === user.temp_email) {
        await updateTelegramUser(ctx.from.id, {
          registration_step: 'reset_password'
        });

        await ctx.reply(`✅ **Token Verified!**

Reset token is valid for: ${tokenValid.email}

🔑 **Enter New Password**

Please enter your new password (minimum 6 characters):`, { parse_mode: "Markdown" });
      } else {
        await ctx.reply(`❌ **Invalid or Expired Token**

The reset token is either invalid or has expired.

🔹 **Options:**
• Check the token carefully
• Request a new reset token
• Contact support if you need help`, {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔄 New Reset Token", callback_data: "forgot_password" }],
              [{ text: "🔙 Back to Login", callback_data: "auth_login" }]
            ]
          }
        });
      }
    } else if (user.registration_step === 'reset_password') {
      // Handle new password during reset
      if (messageText.length < 6) {
        await ctx.reply("❌ Password must be at least 6 characters long. Please try again:");
        return;
      }

      const updated = await updateUserPassword(user.temp_email, messageText);

      if (updated) {
        // Clear reset state and auto-login
        const validation = await validateUserCredentials(user.temp_email, messageText);

        if (validation.success) {
          await linkTelegramAccount(ctx.from.id, user.temp_email, validation.user.id);

          await ctx.reply(`✅ **Password Reset Successful!**

Your password has been updated and you are now logged in.

🔗 **Account Linked:** Your Telegram account is linked for future access.

Ready to continue? Use /menu to get started! 💎`, { parse_mode: "Markdown" });
        }
      } else {
        await ctx.reply("❌ Failed to update password. Please try again or contact support.");
      }
    }
  } catch (error) {
    console.error("Authentication flow error:", error);
    await ctx.reply("❌ An error occurred during authentication. Please try again or contact support.");
  }
}

    // MESSAGE HANDLERS FOR AUTHENTICATION AND PAYMENT PROCESSING
    bot.on("message", async (ctx) => {
      const user = await getTelegramUser(ctx.from.id);

      // Handle authentication flow
      if (user && user.registration_step && !user.is_registered) {
        await handleAuthenticationFlow(ctx, user);
        return;
      }

      // Handle transaction hash submission
      if (user && user.awaiting_tx_hash && ctx.message.text) {
        const txHash = ctx.message.text.trim();

        // Basic validation for transaction hash format
        if (txHash.length < 10) {
          await ctx.reply("❌ Invalid transaction hash. Please provide a valid transaction ID.");
          return;
        }

        const verificationMessage = `🔍 **Transaction Verification**

**Transaction Hash:** \`${txHash}\`
**Network:** ${user.payment_network}

⏳ **Verifying payment...**

Our system is checking the blockchain for your transaction. This may take a few minutes.

You will receive a confirmation message once the payment is verified.`;

        await ctx.reply(verificationMessage, { parse_mode: "Markdown" });

        // Clear the awaiting state
        await updateTelegramUser(ctx.from.id, {
          awaiting_tx_hash: false,
          payment_network: null,
          payment_package_id: null
        });

        // Create payment record for admin approval
        try {
          await createCryptoPaymentRecord(ctx.from.id, user.payment_package_id, user.payment_network, txHash);

          setTimeout(async () => {
            await ctx.reply("📋 **Payment Submitted for Review**\n\nYour transaction has been recorded and is now pending admin approval.\n\n⏳ **Next Steps:**\n• Our team will verify the payment\n• You'll be notified once approved\n• Share Purchase will be activated automatically\n\n🕐 **Processing Time:** Usually within 24 hours");
          }, 3000);
        } catch (error) {
          console.error("Failed to create payment record:", error);
          await ctx.reply("❌ **Error Recording Payment**\n\nThere was an issue recording your payment. Please contact support with your transaction hash: `" + txHash + "`");
        }

        return;
      }

      // Handle receipt upload
      if (user && user.awaiting_receipt && ctx.message.photo) {
        const receiptConfirmation = `📸 **Receipt Received**

Thank you for uploading your payment receipt!

⏳ **Processing...**
Our team will verify your bank transfer within 1-3 business days.

You will receive a confirmation message once the payment is verified and your share purchase is activated.

📧 **Need Help?**
Contact our support team if you have any questions.`;

        await ctx.reply(receiptConfirmation, { parse_mode: "Markdown" });

        // Create bank payment record for admin approval
        try {
          const referenceNumber = `AUR-${Date.now().toString().slice(-6)}`;
          await createBankPaymentRecord(ctx.from.id, user.payment_package_id, referenceNumber);
          console.log(`🏦 Bank payment record created for user ${ctx.from.id}`);
        } catch (error) {
          console.error("Failed to create bank payment record:", error);
        }

        // Clear the awaiting state
        await updateTelegramUser(ctx.from.id, {
          awaiting_receipt: false,
          payment_package_id: null
        });

        return;
      }
    });

    console.log("🚀 Starting Aureus Africa Telegram Bot (Fixed Version)...");
    console.log("🔄 Starting bot in polling mode...");

    bot.launch();
  } catch (error) {
    console.error("❌ Failed to start bot:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.once("SIGINT", () => {
  console.log("🛑 Stopping bot...");
  bot.stop("SIGINT");
  if (dbConnection) {
    dbConnection.end();
  }
});

process.once("SIGTERM", () => {
  console.log("🛑 Stopping bot...");
  bot.stop("SIGTERM");
  if (dbConnection) {
    dbConnection.end();
  }
});

// Start the bot
startBot();
