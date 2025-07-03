const { Telegraf } = require("telegraf");
const mysql = require("mysql2/promise");
require("dotenv").config();

console.log(" Starting Aureus Africa Telegram Bot...");

// Bot configuration
const BOT_TOKEN = "8015476800:AAGMH8HMXRurphYHRQDJdeHLO10ghZVzBt8";
const DB_CONFIG = {
  host: "localhost",
  port: 3506,
  user: "root", 
  password: "",
  database: "aureus_angels"
};

console.log(` Database: ${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}`);

// Create bot instance
const bot = new Telegraf(BOT_TOKEN);

// Database connection
let dbConnection = null;

async function connectDatabase() {
  try {
    dbConnection = await mysql.createConnection(DB_CONFIG);
    console.log(" Database connected successfully!");
    return true;
  } catch (error) {
    console.error(" Database connection failed:", error.message);
    return false;
  }
}

// Test database connection
async function testDatabase() {
  try {
    if (!dbConnection) {
      await connectDatabase();
    }
    await dbConnection.ping();
    console.log(" Database ping successful");
    return true;
  } catch (error) {
    console.error(" Database ping failed:", error.message);
    return false;
  }
}

// Bot commands
bot.start(async (ctx) => {
  const user = ctx.from;
  console.log(` New user started bot: ${user.first_name} (@${user.username})`);
  
  const welcomeMessage = ` *Welcome to Aureus Angel Alliance!* 

Hello ${user.first_name}! I am your personal investment assistant.

 *What I can help you with:*
 View investment packages
 Make investments  
 Track your portfolio
 Manage payments
 Access referral system
 Generate certificates

 *Getting Started:*
Use /menu to see all available options
Use /help for detailed information

Ready to start your investment journey? `;
  
  await ctx.replyWithMarkdown(welcomeMessage);
});

bot.help(async (ctx) => {
  const helpMessage = ` *Aureus Africa Bot Help* 

 *Basic Commands:*
/start - Welcome message
/menu - Main navigation menu
/help - This help message
/testdb - Test database connection

 *Investment Commands:*
/packages - View investment packages
/invest - Start investment process
/portfolio - View your investments

 *Support:*
/support - Contact support

Need more help? Contact our support team! `;
  
  await ctx.replyWithMarkdown(helpMessage);
});

bot.command("menu", async (ctx) => {
  const menuMessage = ` *Main Menu* 

Choose an option below:`;
  
  const keyboard = {
    inline_keyboard: [
      [
        { text: " Investment", callback_data: "menu_investment" },
        { text: " Portfolio", callback_data: "menu_portfolio" }
      ],
      [
        { text: " Payments", callback_data: "menu_payments" },
        { text: " Referrals", callback_data: "menu_referrals" }
      ],
      [
        { text: " NFT & Certificates", callback_data: "menu_nft" },
        { text: " Profile", callback_data: "menu_profile" }
      ],
      [
        { text: " Help & Support", callback_data: "menu_support" }
      ]
    ]
  };
  
  await ctx.replyWithMarkdown(menuMessage, { reply_markup: keyboard });
});

// Test database command
bot.command("testdb", async (ctx) => {
  try {
    const isConnected = await testDatabase();
    if (isConnected) {
      await ctx.reply(" Database connection successful!");
    } else {
      await ctx.reply(" Database connection failed!");
    }
  } catch (error) {
    await ctx.reply(` Database error: ${error.message}`);
  }
});

// Error handling
bot.catch((err, ctx) => {
  console.error(" Bot error:", err);
  ctx.reply("Sorry, something went wrong. Please try again later.");
});

// Logging middleware
bot.use(async (ctx, next) => {
  const start = Date.now();
  const user = ctx.from;
  console.log(` Message from ${user.first_name} (@${user.username}): ${ctx.message?.text || "non-text"}`);
  
  await next();
  
  const responseTime = Date.now() - start;
  console.log(` Response time: ${responseTime}ms`);
});

// Start bot
async function startBot() {
  try {
    console.log(" Testing database connection...");
    const isDbConnected = await connectDatabase();
    
    if (!isDbConnected) {
      console.log(" Database connection failed, but starting bot anyway...");
    }

    console.log(" Starting bot in polling mode...");
    await bot.launch();
    console.log(" Aureus Africa Bot is running!");
    console.log(` Bot username: @aureus_africa_bot`);
  } catch (error) {
    console.error(" Failed to start bot:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.once("SIGINT", () => {
  console.log(" Stopping bot...");
  bot.stop("SIGINT");
  if (dbConnection) {
    dbConnection.end();
  }
});

process.once("SIGTERM", () => {
  console.log(" Stopping bot...");
  bot.stop("SIGTERM");
  if (dbConnection) {
    dbConnection.end();
  }
});

// Start the bot
startBot();
