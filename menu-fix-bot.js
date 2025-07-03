const { Telegraf } = require("telegraf");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
require("dotenv").config();

console.log(" Starting Aureus Africa Telegram Bot - MENU FIX VERSION...");

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

// User authentication functions
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
    const [result] = await dbConnection.execute(
      `INSERT INTO telegram_users (telegram_id, username, first_name, last_name) 
       VALUES (?, ?, ?, ?)`,
      [telegramId, userData.username, userData.first_name, userData.last_name]
    );
    return result.insertId;
  } catch (error) {
    console.error("Error creating telegram user:", error);
    return null;
  }
}

async function updateTelegramUser(telegramId, updates) {
  try {
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(", ");
    const values = Object.values(updates);
    values.push(telegramId);
    
    await dbConnection.execute(
      `UPDATE telegram_users SET ${fields} WHERE telegram_id = ?`,
      values
    );
    return true;
  } catch (error) {
    console.error("Error updating telegram user:", error);
    return false;
  }
}

async function logoutTelegramUser(telegramId) {
  try {
    await dbConnection.execute(
      `UPDATE telegram_users SET 
       user_id = NULL, 
       is_registered = FALSE, 
       registration_step = "start",
       registration_mode = "login",
       temp_email = NULL,
       temp_password = NULL
       WHERE telegram_id = ?`,
      [telegramId]
    );
    
    await dbConnection.execute(
      "DELETE FROM telegram_sessions WHERE telegram_id = ?",
      [telegramId]
    );
    
    return true;
  } catch (error) {
    console.error("Error logging out telegram user:", error);
    return false;
  }
}

async function checkEmailExists(email) {
  try {
    const [rows] = await dbConnection.execute(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );
    return rows.length > 0;
  } catch (error) {
    console.error("Error checking email:", error);
    return false;
  }
}

async function linkTelegramToWebUser(telegramId, email, password) {
  try {
    const [webUsers] = await dbConnection.execute(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );
    
    if (webUsers.length === 0) {
      return { success: false, message: "No account found with this email" };
    }
    
    const webUser = webUsers[0];
    
    const isValidPassword = await bcrypt.compare(password, webUser.password_hash);
    if (!isValidPassword) {
      return { success: false, message: "Invalid password" };
    }
    
    await updateTelegramUser(telegramId, {
      user_id: webUser.id,
      is_registered: true,
      registration_step: "complete"
    });
    
    return { success: true, message: "Account linked successfully!", user: webUser };
  } catch (error) {
    console.error("Error linking accounts:", error);
    return { success: false, message: "Error linking accounts" };
  }
}

async function createNewWebUser(telegramId, email, password, fullName) {
  try {
    const emailExists = await checkEmailExists(email);
    if (emailExists) {
      return { success: false, message: "Email already registered", shouldLogin: true };
    }
    
    const passwordHash = await bcrypt.hash(password, 12);
    
    const [result] = await dbConnection.execute(
      `INSERT INTO users (username, email, password_hash, full_name) 
       VALUES (?, ?, ?, ?)`,
      [email.split("@")[0], email, passwordHash, fullName]
    );
    const userId = result.insertId;
    
    await updateTelegramUser(telegramId, {
      user_id: userId,
      is_registered: true,
      registration_step: "complete"
    });
    
    return { success: true, message: "Account created and linked successfully!", userId };
  } catch (error) {
    console.error("Error creating web user:", error);
    return { success: false, message: "Error creating account" };
  }
}

// Bot middleware for authentication
bot.use(async (ctx, next) => {
  const telegramId = ctx.from.id;
  let telegramUser = await getTelegramUser(telegramId);
  
  if (!telegramUser) {
    await createTelegramUser(telegramId, ctx.from);
    telegramUser = await getTelegramUser(telegramId);
  }
  
  ctx.telegramUser = telegramUser;
  await next();
});

// Logging middleware - MOVED TO TOP
bot.use(async (ctx, next) => {
  const start = Date.now();
  const user = ctx.from;
  const messageText = ctx.message?.text || ctx.callbackQuery?.data || "non-text";
  console.log(` Message from ${user.first_name} (@${user.username}): ${messageText}`);
  
  await next();
  
  const responseTime = Date.now() - start;
  console.log(` Response time: ${responseTime}ms`);
});

// Bot commands
bot.start(async (ctx) => {
  const user = ctx.from;
  const telegramUser = ctx.telegramUser;
  
  console.log(` User started bot: ${user.first_name} (@${user.username}) - Registered: ${telegramUser.is_registered}`);
  
  if (telegramUser.is_registered) {
    const welcomeMessage = ` *Welcome back, ${user.first_name}!* 

Your account is linked and ready to use.

 *Quick Actions:*
 /menu - Full menu
 /profile - Your profile
 /logout - Logout from account

Ready to continue your investment journey? `;
    
    await ctx.replyWithMarkdown(welcomeMessage);
  } else {
    const welcomeMessage = ` *Welcome to Aureus Angel Alliance!* 

Hello ${user.first_name}! I am your personal investment assistant.

To get started, I need to link your Telegram account to our platform.

 *Choose an option:*`;
    
    const keyboard = {
      inline_keyboard: [
        [
          { text: " Login to Existing Account", callback_data: "auth_login" },
          { text: " Create New Account", callback_data: "auth_register" }
        ],
        [
          { text: " Help", callback_data: "auth_help" }
        ]
      ]
    };
    
    await ctx.replyWithMarkdown(welcomeMessage, { reply_markup: keyboard });
  }
});

// Authentication commands
bot.command("login", async (ctx) => {
  const telegramUser = ctx.telegramUser;
  
  if (telegramUser.is_registered) {
    await ctx.reply(" You are already logged in! Use /logout to logout first.");
    return;
  }
  
  await updateTelegramUser(ctx.from.id, { 
    registration_step: "email",
    registration_mode: "login"
  });
  
  await ctx.reply(` *Account Login*

Please enter your email address:`, { parse_mode: "Markdown" });
});

bot.command("register", async (ctx) => {
  const telegramUser = ctx.telegramUser;
  
  if (telegramUser.is_registered) {
    await ctx.reply(" You already have an account! Use /logout to logout first.");
    return;
  }
  
  await updateTelegramUser(ctx.from.id, { 
    registration_step: "email",
    registration_mode: "register"
  });
  
  await ctx.reply(` *Create New Account*

Please enter your email address:`, { parse_mode: "Markdown" });
});

bot.command("logout", async (ctx) => {
  const telegramUser = ctx.telegramUser;
  
  if (!telegramUser.is_registered) {
    await ctx.reply(" You are not logged in!");
    return;
  }
  
  const logoutMessage = ` *Logout Confirmation*

Are you sure you want to logout from your account?`;
  
  const keyboard = {
    inline_keyboard: [
      [
        { text: " Yes, Logout", callback_data: "confirm_logout" },
        { text: " Cancel", callback_data: "cancel_logout" }
      ]
    ]
  };
  
  await ctx.replyWithMarkdown(logoutMessage, { reply_markup: keyboard });
});

// MENU COMMAND - SIMPLIFIED AND FIXED
bot.command("menu", async (ctx) => {
  console.log(` MENU COMMAND RECEIVED from ${ctx.from.first_name} (ID: ${ctx.from.id})`);
  
  try {
    // Check if user is authenticated
    const telegramUser = ctx.telegramUser;
    console.log(` User registration status: ${telegramUser.is_registered}`);
    
    if (!telegramUser.is_registered) {
      console.log(` User not authenticated, sending auth message`);
      await ctx.reply(" Please login or register first using /start");
      return;
    }
    
    console.log(` User authenticated, sending menu...`);
    
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
          { text: " Help & Support", callback_data: "menu_support" },
          { text: " Logout", callback_data: "menu_logout" }
        ]
      ]
    };
    
    await ctx.replyWithMarkdown(menuMessage, { reply_markup: keyboard });
    console.log(` Menu sent successfully to ${ctx.from.first_name}`);
    
  } catch (error) {
    console.error(" MENU ERROR:", error);
    await ctx.reply(" Sorry, there was an error loading the menu. Please try again or contact support.");
  }
});

// Simple test command
bot.command("test", async (ctx) => {
  console.log(` TEST COMMAND from ${ctx.from.first_name}`);
  await ctx.reply(" Test successful! Bot is responding.");
});

// Handle text messages for registration flow
bot.on("text", async (ctx) => {
  const telegramUser = ctx.telegramUser;
  const text = ctx.message.text;
  
  // Skip if user is already registered or message is a command
  if (telegramUser.is_registered || text.startsWith("/")) {
    return;
  }
  
  if (telegramUser.registration_step === "email") {
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(text)) {
      await ctx.reply(" Please enter a valid email address:");
      return;
    }
    
    // Check if email exists
    const emailExists = await checkEmailExists(text);
    const isLoginMode = telegramUser.registration_mode === "login";
    
    await updateTelegramUser(ctx.from.id, { 
      temp_email: text,
      registration_step: "password" 
    });
    
    if (isLoginMode) {
      // User is trying to LOGIN
      if (emailExists) {
        await ctx.reply(` Email: ${text}

 *Account found!*

Please enter your password:`);
      } else {
        // Email doesnt exist but user is trying to login
        const noAccountMessage = ` *No account found with this email*

The email "${text}" is not registered in our system.

 *What would you like to do?*`;
        
        const keyboard = {
          inline_keyboard: [
            [
              { text: " Create New Account", callback_data: "switch_to_register" },
              { text: " Try Different Email", callback_data: "try_different_email" }
            ],
            [
              { text: " Contact Support", callback_data: "contact_support" }
            ]
          ]
        };
        
        await ctx.replyWithMarkdown(noAccountMessage, { reply_markup: keyboard });
        return;
      }
    } else {
      // User is trying to REGISTER
      if (emailExists) {
        // Email exists but user is trying to register
        const existingAccountMessage = ` *Email already registered*

The email "${text}" already has an account.

 *What would you like to do?*`;
        
        const keyboard = {
          inline_keyboard: [
            [
              { text: " Login Instead", callback_data: "switch_to_login" },
              { text: " Try Different Email", callback_data: "try_different_email" }
            ],
            [
              { text: " Forgot Password?", callback_data: "forgot_password" }
            ]
          ]
        };
        
        await ctx.replyWithMarkdown(existingAccountMessage, { reply_markup: keyboard });
        return;
      } else {
        await ctx.reply(` Email: ${text}

 *Creating new account*

Please create a secure password (minimum 8 characters):`);
      }
    }
    
  } else if (telegramUser.registration_step === "password") {
    if (text.length < 8) {
      await ctx.reply(" Password must be at least 8 characters long:");
      return;
    }
    
    // Get updated user data
    const updatedUser = await getTelegramUser(ctx.from.id);
    const isLoginMode = updatedUser.registration_mode === "login";
    
    if (isLoginMode) {
      // LOGIN FLOW
      const linkResult = await linkTelegramToWebUser(
        ctx.from.id, 
        updatedUser.temp_email, 
        text
      );
      
      if (linkResult.success) {
        await ctx.reply(` ${linkResult.message}

Welcome back! Your Telegram account is now linked.

Use /menu to access all features.`);
      } else {
        await ctx.reply(` Incorrect password!

The password you entered is not correct for this email address.

Please try entering your password again:`);
        return; // Stay on password step
      }
    } else {
      // REGISTER FLOW
      const fullName = `${ctx.from.first_name} ${ctx.from.last_name || ""}`.trim();
      const createResult = await createNewWebUser(
        ctx.from.id,
        updatedUser.temp_email,
        text,
        fullName
      );
      
      if (createResult.success) {
        await ctx.reply(` ${createResult.message}

Welcome to Aureus Angel Alliance! Your account is ready.

Use /menu to start investing.`);
      } else {
        await ctx.reply(` ${createResult.message}

Please try again with /register or /login`);
        await updateTelegramUser(ctx.from.id, { 
          registration_step: "start",
          temp_email: null,
          temp_password: null 
        });
        return;
      }
    }
    
    // Clear temporary data
    await updateTelegramUser(ctx.from.id, { 
      temp_email: null,
      temp_password: null 
    });
  }
});

// Callback query handlers
bot.on("callback_query", async (ctx) => {
  const data = ctx.callbackQuery.data;
  console.log(` Callback query: ${data} from ${ctx.from.first_name}`);
  
  if (data === "auth_login") {
    await ctx.answerCbQuery();
    await ctx.editMessageText(" *Account Login*\n\nPlease enter your email address:", { parse_mode: "Markdown" });
    await updateTelegramUser(ctx.from.id, { 
      registration_step: "email",
      registration_mode: "login"
    });
  } else if (data === "auth_register") {
    await ctx.answerCbQuery();
    await ctx.editMessageText(" *Create New Account*\n\nPlease enter your email address:", { parse_mode: "Markdown" });
    await updateTelegramUser(ctx.from.id, { 
      registration_step: "email",
      registration_mode: "register"
    });
  } else if (data === "switch_to_register") {
    await ctx.answerCbQuery();
    await ctx.editMessageText(" *Create New Account*\n\nPlease enter your email address:", { parse_mode: "Markdown" });
    await updateTelegramUser(ctx.from.id, { 
      registration_step: "email",
      registration_mode: "register",
      temp_email: null,
      temp_password: null
    });
  } else if (data === "switch_to_login") {
    await ctx.answerCbQuery();
    await ctx.editMessageText(" *Account Login*\n\nPlease enter your email address:", { parse_mode: "Markdown" });
    await updateTelegramUser(ctx.from.id, { 
      registration_step: "email",
      registration_mode: "login",
      temp_email: null,
      temp_password: null
    });
  } else if (data === "try_different_email") {
    await ctx.answerCbQuery();
    const currentMode = ctx.telegramUser.registration_mode;
    const modeText = currentMode === "login" ? " *Account Login*" : " *Create New Account*";
    await ctx.editMessageText(`${modeText}\n\nPlease enter your email address:`, { parse_mode: "Markdown" });
    await updateTelegramUser(ctx.from.id, { 
      registration_step: "email",
      temp_email: null,
      temp_password: null
    });
  } else if (data === "contact_support") {
    await ctx.answerCbQuery();
    await ctx.editMessageText(` *Contact Support*

If you need help with your account, please contact our support team:

 Email: support@aureusangels.com

Use /start to try again.`, { parse_mode: "Markdown" });
  } else if (data === "forgot_password") {
    await ctx.answerCbQuery();
    await ctx.editMessageText(` *Forgot Password*

To reset your password, please contact our support team:

 Email: support@aureusangels.com

Use /start to try again.`, { parse_mode: "Markdown" });
  } else if (data === "auth_help") {
    await ctx.answerCbQuery();
    const helpMessage = ` *Authentication Help*

 *Login:* If you already have an account
 *Register:* If you are new to Aureus Angel Alliance

Your Telegram account will be securely linked to your investment account.`;
    
    await ctx.editMessageText(helpMessage, { parse_mode: "Markdown" });
  } else if (data === "confirm_logout") {
    await ctx.answerCbQuery();
    
    const success = await logoutTelegramUser(ctx.from.id);
    
    if (success) {
      await ctx.editMessageText(` *Logout Successful*

You have been logged out from your account.

Use /start to login or register again.`, { parse_mode: "Markdown" });
    } else {
      await ctx.editMessageText(" Error during logout. Please try again.", { parse_mode: "Markdown" });
    }
  } else if (data === "cancel_logout") {
    await ctx.answerCbQuery();
    await ctx.editMessageText(" Logout cancelled. You remain logged in.", { parse_mode: "Markdown" });
  } else if (data === "menu_logout") {
    await ctx.answerCbQuery();
    
    const logoutMessage = ` *Logout Confirmation*

Are you sure you want to logout from your account?`;
    
    const keyboard = {
      inline_keyboard: [
        [
          { text: " Yes, Logout", callback_data: "confirm_logout" },
          { text: " Cancel", callback_data: "cancel_logout" }
        ]
      ]
    };
    
    await ctx.editMessageText(logoutMessage, { parse_mode: "Markdown", reply_markup: keyboard });
  } else {
    // Handle other menu callbacks
    await ctx.answerCbQuery();
    await ctx.reply(` Feature "${data}" is coming soon! Stay tuned.`);
  }
});

bot.command("profile", async (ctx) => {
  const telegramUser = ctx.telegramUser;
  
  if (!telegramUser.is_registered) {
    await ctx.reply(" Please login or register first using /start");
    return;
  }
  
  try {
    const [webUsers] = await dbConnection.execute(
      "SELECT * FROM users WHERE id = ?",
      [telegramUser.user_id]
    );
    
    if (webUsers.length === 0) {
      await ctx.reply(" Account not found. Please contact support.");
      return;
    }
    
    const webUser = webUsers[0];
    const profileMessage = ` *Your Profile*

 Email: ${webUser.email}
 Name: ${webUser.full_name || "Not set"}
 Username: ${webUser.username}
 Member since: ${new Date(webUser.created_at).toLocaleDateString()}
 Status: ${webUser.is_active ? "Active" : "Inactive"}

 Telegram: Linked
 Telegram ID: ${ctx.from.id}

Use /logout to unlink your account.`;
    
    await ctx.replyWithMarkdown(profileMessage);
  } catch (error) {
    console.error("Error getting profile:", error);
    await ctx.reply(" Error loading profile. Please try again.");
  }
});

bot.command("testdb", async (ctx) => {
  try {
    await dbConnection.ping();
    await ctx.reply(" Database connection successful!");
  } catch (error) {
    await ctx.reply(` Database error: ${error.message}`);
  }
});

bot.help(async (ctx) => {
  const telegramUser = ctx.telegramUser;
  
  if (!telegramUser.is_registered) {
    const helpMessage = ` *Aureus Africa Bot Help* 

 *Getting Started:*
/start - Begin registration or login
/login - Login to existing account
/register - Create new account

 *Support:*
/help - This help message

Please complete registration to access all features! `;
    
    await ctx.replyWithMarkdown(helpMessage);
  } else {
    const helpMessage = ` *Aureus Africa Bot Help* 

 *Basic Commands:*
/start - Welcome message
/menu - Main navigation menu
/profile - Your profile information
/logout - Logout from account
/help - This help message

Need more help? Contact our support team! `;
    
    await ctx.replyWithMarkdown(helpMessage);
  }
});

// Error handling
bot.catch((err, ctx) => {
  console.error(" Bot error:", err);
  ctx.reply("Sorry, something went wrong. Please try again later.");
});

// Start bot
async function startBot() {
  try {
    console.log(" Testing database connection...");
    const isDbConnected = await connectDatabase();
    
    if (!isDbConnected) {
      throw new Error("Database connection failed");
    }

    console.log(" Starting bot in polling mode...");
    await bot.launch();
    console.log(" Aureus Africa Bot MENU FIX VERSION is running!");
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
