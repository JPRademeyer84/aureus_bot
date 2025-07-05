// Simple test to check if callback handlers are working
const { Telegraf } = require('telegraf');

const bot = new Telegraf('8015476800:AAGMH8HMXRurphYHRQDJdeHLO10ghZVzBt8');

// Test callback handler
bot.on("callback_query", async (ctx) => {
  const data = ctx.callbackQuery.data;
  console.log(`🔘 TEST CALLBACK: ${data} from ${ctx.from.first_name}`);
  
  if (data.startsWith("package_")) {
    console.log(`🎯 PACKAGE CALLBACK DETECTED: ${data}`);
    await ctx.answerCbQuery();
    await ctx.editMessageText(`✅ Package callback working! ID: ${data.replace("package_", "")}`);
  } else {
    await ctx.answerCbQuery();
    await ctx.editMessageText(`Unknown callback: ${data}`);
  }
});

// Simple start command
bot.start(async (ctx) => {
  const keyboard = {
    inline_keyboard: [
      [
        { text: "Test Package 1", callback_data: "package_test1" },
        { text: "Test Package 2", callback_data: "package_test2" }
      ]
    ]
  };
  
  await ctx.reply("Test bot - click a package:", { reply_markup: keyboard });
});

console.log("🧪 Starting test bot...");
bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
