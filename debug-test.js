console.log("Starting debug test...");
try {
  console.log("Requiring telegraf...");
  const { Telegraf } = require("telegraf");
  console.log("Telegraf loaded successfully");
  
  console.log("Creating bot instance...");
  const bot = new Telegraf("8015476800:AAGMH8HMXRurphYHRQDJdeHLO10ghZVzBt8");
  console.log("Bot instance created");
  
  bot.start((ctx) => {
    console.log("Start command received");
    ctx.reply("Hello! Bot is working!");
  });
  
  console.log("Launching bot...");
  bot.launch().then(() => {
    console.log("Bot launched successfully!");
  }).catch((error) => {
    console.error("Bot launch failed:", error);
  });
  
} catch (error) {
  console.error("Error:", error);
}
