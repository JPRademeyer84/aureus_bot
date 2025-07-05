console.log("🔧 Step 1: Starting minimal test...");

try {
  console.log("🔧 Step 2: Importing Telegraf...");
  const { Telegraf } = require("telegraf");
  console.log("✅ Step 2: Telegraf imported successfully");

  console.log("🔧 Step 3: Creating bot instance...");
  const BOT_TOKEN = "8015476800:AAGMH8HMXRurphYHRQDJdeHLO10ghZVzBt8";
  const bot = new Telegraf(BOT_TOKEN);
  console.log("✅ Step 3: Bot instance created");

  console.log("🔧 Step 4: Adding start handler...");
  bot.start(async (ctx) => {
    console.log("📨 Received start command!");
    await ctx.reply("Hello from minimal test bot!");
  });
  console.log("✅ Step 4: Start handler added");

  console.log("🔧 Step 5: Launching bot...");
  bot.launch().then(() => {
    console.log("✅ Step 5: Bot launched successfully!");
  }).catch((error) => {
    console.error("❌ Step 5: Launch failed:", error);
  });

  console.log("🔧 Step 6: Setup complete, waiting for messages...");

} catch (error) {
  console.error("❌ Error in setup:", error);
}
