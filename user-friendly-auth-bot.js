const { Telegraf } = require("telegraf");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

console.log(" Starting Aureus Africa Telegram Bot with User-Friendly Authentication...");

// Bot configuration
const BOT_TOKEN = "8015476800:AAGMH8HMXRurphYHRQDJdeHLO10ghZVzBt8";
const JWT_SECRET = "aureus_jwt_secret_2024_telegram_bot_secure";
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

// Check users table structure
async function checkUsersTable() {
  try {
    const [rows] = await dbConnection.execute("DESCRIBE users");
    console.log(" Users table structure:");
    rows.forEach(row => {
      console.log(`  ${row.Field}: ${row.Type} ${row.Key ? `(${row.Key})` : ""}`);
    });
    return rows;
  } catch (error) {
    console.error("Error checking users table:", error);
    return null;
  }
}

// Create bot-specific tables
async function createBotTables() {
  try {
    // First check users table structure
    const usersStructure = await checkUsersTable();
    if (!usersStructure) {
      throw new Error("Could not check users table structure");
    }
    
    // Find the ID field type
    const idField = usersStructure.find(row => row.Field === "id");
    const userIdType = idField ? idField.Type : "VARCHAR(36)";
    
    console.log(` Using user_id type: ${userIdType}`);
    
    // Create telegram_users table without foreign key first
    await dbConnection.execute(`
      CREATE TABLE IF NOT EXISTS telegram_users (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        user_id ${userIdType} NULL,
        telegram_id BIGINT UNIQUE NOT NULL,
        username VARCHAR(255),
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE,
        is_registered BOOLEAN DEFAULT FALSE,
        registration_step ENUM("start", "email", "password", "complete") DEFAULT "start",
        registration_mode ENUM("login", "register") DEFAULT "login",
        temp_email VARCHAR(255),
        temp_password VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_telegram_id (telegram_id),
        INDEX idx_user_id (user_id),
        INDEX idx_registration_step (registration_step)
      )
    `);

    // Create telegram_sessions table
    await dbConnection.execute(`
      CREATE TABLE IF NOT EXISTS telegram_sessions (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        telegram_id BIGINT NOT NULL,
        session_data TEXT,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_telegram_id (telegram_id),
        INDEX idx_expires_at (expires_at)
      )
    `);

    console.log(" Bot-specific database tables created successfully");
  } catch (error) {
    console.error(" Failed to create bot tables:", error);
    throw error;
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
    
    // Clear any sessions
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
    // Check if web user exists
    const [webUsers] = await dbConnection.execute(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );
    
    if (webUsers.length === 0) {
      return { success: false, message: "No account found with this email" };
    }
    
    const webUser = webUsers[0];
    
    // Verify password
    const isValidPassword = await bcrypt.compare(password, webUser.password_hash);
    if (!isValidPassword) {
      return { success: false, message: "Invalid password" };
    }
    
    // Link accounts
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
    // Check if email already exists
    const emailExists = await checkEmailExists(email);
    if (emailExists) {
      return { success: false, message: "Email already registered", shouldLogin: true };
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Check if users table uses UUID or INT for ID
    const [usersStructure] = await dbConnection.execute("DESCRIBE users");
    const idField = usersStructure.find(row => row.Field === "id");
    const isUUID = idField.Type.includes("varchar") || idField.Type.includes("char");
    
    let userId;
    if (isUUID) {
      userId = uuidv4();
      await dbConnection.execute(
        `INSERT INTO users (id, username, email, password_hash, full_name) 
         VALUES (?, ?, ?, ?, ?)`,
        [userId, email.split("@")[0], email, passwordHash, fullName]
      );
    } else {
      // Auto-increment ID
      const [result] = await dbConnection.execute(
        `INSERT INTO users (username, email, password_hash, full_name) 
         VALUES (?, ?, ?, ?)`,
        [email.split("@")[0], email, passwordHash, fullName]
      );
      userId = result.insertId;
    }
    
    // Link to telegram user
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
    // Create new telegram user record
    await createTelegramUser(telegramId, ctx.from);
    telegramUser = await getTelegramUser(telegramId);
  }
  
  ctx.telegramUser = telegramUser;
  await next();
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
 /portfolio - View your investments
 /invest - Make new investment
 /payments - Payment methods
 /menu - Full menu
 /profile - Your profile
 /logout - Logout from account

Ready to continue your investment journey? `;
    
    await ctx.replyWithMarkdown(welcomeMessage);
  } else {
    const welcomeMessage = ` *Welcome to Aureus Angel Alliance!* 

Hello ${user.first_name}! I am your personal investment assistant.

To get started, I need to link your Telegram account to our platform.

 *Choose an option:*
 If you already have an account: /login
 If you are new: /register

This ensures secure access to your investments and portfolio. `;
    
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

Are you sure you want to logout from your account?

This will unlink your Telegram account from the platform. You will need to login again to access your investments.`;
  
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
    
    await updateTelegramUser(ctx.from.id, { temp_password: text });
    
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

 *What would you like to do?*

 Try entering your password again
 Use /login to start over
 Contact support if you forgot your password`);
        
        await updateTelegramUser(ctx.from.id, { 
          registration_step: "password" // Stay on password step
        });
        return;
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
 Live Chat: Available on our website
 WhatsApp: +27 XX XXX XXXX

Use /start to try again.`, { parse_mode: "Markdown" });
  } else if (data === "forgot_password") {
    await ctx.answerCbQuery();
    await ctx.editMessageText(` *Forgot Password*

To reset your password, please contact our support team:

 Email: support@aureusangels.com
 Live Chat: Available on our website

They will help you reset your password securely.

Use /start to try again.`, { parse_mode: "Markdown" });
  } else if (data === "auth_help") {
    await ctx.answerCbQuery();
    const helpMessage = ` *Authentication Help*

 *Login:* If you already have an account on our website
 *Register:* If you are new to Aureus Angel Alliance

Your Telegram account will be securely linked to your investment account for easy access.

Need more help? Contact support: /support`;
    
    await ctx.editMessageText(helpMessage, { parse_mode: "Markdown" });
  } else if (data === "confirm_logout") {
    await ctx.answerCbQuery();
    
    const success = await logoutTelegramUser(ctx.from.id);
    
    if (success) {
      await ctx.editMessageText(` *Logout Successful*

You have been logged out from your account.

Your Telegram account is now unlinked from the platform.

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

Are you sure you want to logout from your account?

This will unlink your Telegram account from the platform. You will need to login again to access your investments.`;
    
    const keyboard = {
      inline_keyboard: [
        [
          { text: " Yes, Logout", callback_data: "confirm_logout" },
          { text: " Cancel", callback_data: "cancel_logout" }
        ]
      ]
    };
    
    await ctx.editMessageText(logoutMessage, { parse_mode: "Markdown", reply_markup: keyboard });
  }
});

// Other commands (protected - require authentication)
const requireAuth = (handler) => {
  return async (ctx) => {
    if (!ctx.telegramUser.is_registered) {
      await ctx.reply(" Please login or register first using /start");
      return;
    }
    await handler(ctx);
  };
};

bot.command("menu", requireAuth(async (ctx) => {
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
}));

bot.command("profile", requireAuth(async (ctx) => {
  const telegramUser = ctx.telegramUser;
  
  // Get web user details
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
}));

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

 *Investment Commands:*
/packages - View investment packages
/invest - Start investment process
/portfolio - View your investments

 *Support:*
/support - Contact support

Need more help? Contact our support team! `;
    
    await ctx.replyWithMarkdown(helpMessage);
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
      throw new Error("Database connection failed");
    }

    console.log(" Creating bot-specific database tables...");
    await createBotTables();

    console.log(" Starting bot in polling mode...");
    await bot.launch();
    console.log(" Aureus Africa Bot with User-Friendly Authentication is running!");
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
