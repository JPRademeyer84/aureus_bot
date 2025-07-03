const { Telegraf } = require("telegraf");
const bcrypt = require("bcryptjs");
const { db } = require('./src/database/supabase-client');
require("dotenv").config();

console.log("🚀 Starting Aureus Africa Telegram Bot with Supabase...");

// Bot configuration
const BOT_TOKEN = "8015476800:AAGMH8HMXRurphYHRQDJdeHLO10ghZVzBt8";

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

function formatPackageDetails(pkg) {
  const bonusList = Array.isArray(pkg.bonuses) 
    ? pkg.bonuses.map(bonus => `  • ${bonus}`).join('\n')
    : '  • No bonuses available';

  return `💎 **${pkg.name}**

📝 ${pkg.description}

💰 **Investment:** ${formatCurrency(pkg.price)}
📊 **Shares:** ${pkg.shares}
📈 **ROI:** ${pkg.roi}%
${pkg.annual_dividends ? `💵 Annual Dividends: ${formatCurrency(pkg.annual_dividends)}\n` : ''}${pkg.quarter_dividends ? `💰 Quarterly Dividends: ${formatCurrency(pkg.quarter_dividends)}\n` : ''}
🎁 **Bonuses:**
${bonusList}`;
}

function formatInvestmentSummary(investment) {
  const packageName = investment.investment_packages?.name || 'Unknown Package';
  return `📦 **${packageName}**
💰 Amount: ${formatCurrency(investment.amount)}
📊 Shares: ${investment.shares}
📅 Date: ${new Date(investment.created_at).toLocaleDateString()}
🔄 Status: ${investment.status.charAt(0).toUpperCase() + investment.status.slice(1)}`;
}

function formatPortfolioStats(stats) {
  return `📊 **Portfolio Overview**

💼 Total Investments: ${stats.total_investments}
💰 Total Amount: ${formatCurrency(stats.total_amount)}
📊 Total Shares: ${stats.total_shares}
🔄 Active: ${stats.active_investments}
✅ Completed: ${stats.completed_investments}
📈 Estimated ROI: ${formatCurrency(stats.estimated_roi)}`;
}

// Authentication functions
async function linkTelegramToWebUser(telegramId, email, password) {
  try {
    const webUser = await db.getUserByEmail(email);
    
    if (!webUser) {
      return { success: false, message: "No account found with this email" };
    }
    
    const isValidPassword = await bcrypt.compare(password, webUser.password_hash);
    if (!isValidPassword) {
      return { success: false, message: "Invalid password" };
    }
    
    // Link telegram user to web user
    const updated = await db.updateTelegramUser(telegramId, {
      user_id: webUser.id,
      is_registered: true,
      registration_step: "completed",
      temp_email: null,
      temp_password: null
    });
    
    if (updated) {
      return { success: true, message: "Account linked successfully!", user: webUser };
    } else {
      return { success: false, message: "Failed to link account" };
    }
  } catch (error) {
    console.error("Error linking telegram to web user:", error);
    return { success: false, message: "An error occurred during login" };
  }
}

async function registerNewUser(telegramId, email, password, fullName) {
  try {
    const emailExists = await db.checkEmailExists(email);
    if (emailExists) {
      return { success: false, message: "Email already registered" };
    }
    
    const passwordHash = await bcrypt.hash(password, 12);
    
    const newUser = await db.createUser({
      username: email.split("@")[0],
      email: email,
      password_hash: passwordHash,
      full_name: fullName
    });
    
    if (!newUser) {
      return { success: false, message: "Failed to create account" };
    }
    
    // Link telegram user to new web user
    const updated = await db.updateTelegramUser(telegramId, {
      user_id: newUser.id,
      is_registered: true,
      registration_step: "completed",
      temp_email: null,
      temp_password: null
    });
    
    if (updated) {
      return { success: true, message: "Account created and linked successfully!", user: newUser };
    } else {
      return { success: false, message: "Account created but failed to link" };
    }
  } catch (error) {
    console.error("Error registering new user:", error);
    return { success: false, message: "An error occurred during registration" };
  }
}

// Bot commands
bot.start(async (ctx) => {
  const user = ctx.from;
  console.log(`👤 New user started bot: ${user.first_name} (@${user.username})`);
  
  // Get or create telegram user
  let telegramUser = await db.getTelegramUser(user.id);
  if (!telegramUser) {
    telegramUser = await db.createTelegramUser(user.id, {
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name
    });
  }
  
  const welcomeMessage = `🌟 *Welcome to Aureus Angel Alliance!* 

Hello ${user.first_name}! I am your personal investment assistant.

💎 *What I can help you with:*
📦 View investment packages
💰 Make investments  
📊 Track your portfolio
💳 Manage payments
👥 Access referral system
🏆 Generate certificates

🚀 *Getting Started:*
Use /menu to see all available options
Use /help for detailed information

Ready to start your investment journey? 🎯`;
  
  await ctx.replyWithMarkdown(welcomeMessage);
});

bot.help(async (ctx) => {
  const helpMessage = `🔍 *Aureus Africa Bot Help* 

🔹 *Basic Commands:*
/start - Welcome message
/menu - Main navigation menu
/help - This help message
/testdb - Test database connection

🔹 *Investment Commands:*
/packages - View investment packages
/portfolio - View your investments

🔹 *Account Commands:*
/profile - View your profile
/logout - Logout from account

🔹 *Support:*
Need help? Contact our support team! 💬`;
  
  await ctx.replyWithMarkdown(helpMessage);
});

bot.command("menu", async (ctx) => {
  const menuMessage = `🎯 *Main Menu* 

Choose an option below:`;
  
  const keyboard = {
    inline_keyboard: [
      [
        { text: "💰 Investment", callback_data: "menu_investment" },
        { text: "📊 Portfolio", callback_data: "menu_portfolio" }
      ],
      [
        { text: "💳 Payments", callback_data: "menu_payments" },
        { text: "👥 Referrals", callback_data: "menu_referrals" }
      ],
      [
        { text: "🏆 NFT & Certificates", callback_data: "menu_nft" },
        { text: "👤 Profile", callback_data: "menu_profile" }
      ],
      [
        { text: "❓ Help & Support", callback_data: "menu_support" }
      ]
    ]
  };
  
  await ctx.replyWithMarkdown(menuMessage, { reply_markup: keyboard });
});

// Test database command
bot.command("testdb", async (ctx) => {
  try {
    const isConnected = await db.testConnection();
    if (isConnected) {
      await ctx.reply("✅ Supabase database connection successful!");
    } else {
      await ctx.reply("❌ Supabase database connection failed!");
    }
  } catch (error) {
    await ctx.reply(`❌ Database error: ${error.message}`);
  }
});

// Packages command
bot.command("packages", async (ctx) => {
  try {
    const packages = await db.getInvestmentPackages();
    
    if (packages.length === 0) {
      await ctx.reply("📦 No investment packages available at the moment.");
      return;
    }
    
    let packagesMessage = "💎 *Available Investment Packages*\n\n";
    
    packages.forEach((pkg, index) => {
      packagesMessage += `${index + 1}. ${formatPackageDetails(pkg)}\n\n`;
    });
    
    packagesMessage += "💡 Use /menu to start investing!";
    
    await ctx.replyWithMarkdown(packagesMessage);
  } catch (error) {
    console.error("Error getting packages:", error);
    await ctx.reply("❌ Error loading investment packages. Please try again later.");
  }
});

// Error handling
bot.catch((err, ctx) => {
  console.error("🚨 Bot error:", err);
  ctx.reply("Sorry, something went wrong. Please try again later.");
});

// Logging middleware
bot.use(async (ctx, next) => {
  const start = Date.now();
  const user = ctx.from;
  console.log(`📨 Message from ${user.first_name} (@${user.username}): ${ctx.message?.text || "non-text"}`);
  
  await next();
  
  const responseTime = Date.now() - start;
  console.log(`⚡ Response time: ${responseTime}ms`);
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
    console.log("✅ Aureus Africa Bot is running with Supabase!");
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
