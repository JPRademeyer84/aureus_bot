const fs = require('fs');
const path = require('path');

// Terminology mapping for replacement
const terminologyMap = {
  // Basic terms
  'investment': 'share purchase',
  'Investment': 'Share Purchase',
  'INVESTMENT': 'SHARE PURCHASE',
  'invest': 'buy shares',
  'Invest': 'Buy Shares',
  'INVEST': 'BUY SHARES',
  'investor': 'shareholder',
  'Investor': 'Shareholder',
  'INVESTOR': 'SHAREHOLDER',
  'investors': 'shareholders',
  'Investors': 'Shareholders',
  'INVESTORS': 'SHAREHOLDERS',
  
  // Compound terms
  'investment packages': 'share packages',
  'Investment packages': 'Share packages',
  'Investment Packages': 'Share Packages',
  'INVESTMENT PACKAGES': 'SHARE PACKAGES',
  'investment portfolio': 'share portfolio',
  'Investment portfolio': 'Share portfolio',
  'Investment Portfolio': 'Share Portfolio',
  'INVESTMENT PORTFOLIO': 'SHARE PORTFOLIO',
  'investment amount': 'share purchase amount',
  'Investment amount': 'Share purchase amount',
  'Investment Amount': 'Share Purchase Amount',
  'INVESTMENT AMOUNT': 'SHARE PURCHASE AMOUNT',
  'investment account': 'shareholder account',
  'Investment account': 'Shareholder account',
  'Investment Account': 'Shareholder Account',
  'INVESTMENT ACCOUNT': 'SHAREHOLDER ACCOUNT',
  'investment history': 'share purchase history',
  'Investment history': 'Share purchase history',
  'Investment History': 'Share Purchase History',
  'INVESTMENT HISTORY': 'SHARE PURCHASE HISTORY',
  'investment breakdown': 'share purchase breakdown',
  'Investment breakdown': 'Share purchase breakdown',
  'Investment Breakdown': 'Share Purchase Breakdown',
  'INVESTMENT BREAKDOWN': 'SHARE PURCHASE BREAKDOWN',
  'investment journey': 'shareholding journey',
  'Investment journey': 'Shareholding journey',
  'Investment Journey': 'Shareholding Journey',
  'INVESTMENT JOURNEY': 'SHAREHOLDING JOURNEY',
  'investment risks': 'share purchase risks',
  'Investment risks': 'Share purchase risks',
  'Investment Risks': 'Share Purchase Risks',
  'INVESTMENT RISKS': 'SHARE PURCHASE RISKS',
  'investment communications': 'shareholder communications',
  'Investment communications': 'Shareholder communications',
  'Investment Communications': 'Shareholder Communications',
  'INVESTMENT COMMUNICATIONS': 'SHAREHOLDER COMMUNICATIONS',
  
  // Specific phrases
  'gold mining investment': 'gold mining share purchase',
  'Gold mining investment': 'Gold mining share purchase',
  'Gold Mining Investment': 'Gold Mining Share Purchase',
  'GOLD MINING INVESTMENT': 'GOLD MINING SHARE PURCHASE',
  'mining investment': 'mining share purchase',
  'Mining investment': 'Mining share purchase',
  'Mining Investment': 'Mining Share Purchase',
  'MINING INVESTMENT': 'MINING SHARE PURCHASE',
  'premium investment': 'premium share purchase',
  'Premium investment': 'Premium share purchase',
  'Premium Investment': 'Premium Share Purchase',
  'PREMIUM INVESTMENT': 'PREMIUM SHARE PURCHASE',
  'custom investment': 'custom share purchase',
  'Custom investment': 'Custom share purchase',
  'Custom Investment': 'Custom Share Purchase',
  'CUSTOM INVESTMENT': 'CUSTOM SHARE PURCHASE',
  'flexible investment': 'flexible share purchase',
  'Flexible investment': 'Flexible share purchase',
  'Flexible Investment': 'Flexible Share Purchase',
  'FLEXIBLE INVESTMENT': 'FLEXIBLE SHARE PURCHASE',
  
  // Action phrases
  'start investing': 'start buying shares',
  'Start investing': 'Start buying shares',
  'Start Investing': 'Start Buying Shares',
  'START INVESTING': 'START BUYING SHARES',
  'ready to invest': 'ready to buy shares',
  'Ready to invest': 'Ready to buy shares',
  'Ready to Invest': 'Ready to Buy Shares',
  'READY TO INVEST': 'READY TO BUY SHARES',
  'invest now': 'buy shares now',
  'Invest now': 'Buy shares now',
  'Invest Now': 'Buy Shares Now',
  'INVEST NOW': 'BUY SHARES NOW',
  
  // Commission related
  'on their investments': 'on their share purchases',
  'on your investments': 'on your share purchases',
  'investment made': 'share purchase made',
  'Investment made': 'Share purchase made',
  'investments made': 'share purchases made',
  'Investments made': 'Share purchases made',
  'future investments': 'future share purchases',
  'Future investments': 'Future share purchases',
  
  // Database and technical terms (comments only, not table names)
  'investment_packages': 'share_packages',
  'aureus_investments': 'aureus_share_purchases',
  'investment_id': 'share_purchase_id',
  'investment_phases': 'share_purchase_phases'
};

function replaceTerminology(content) {
  let updatedContent = content;
  
  // Sort by length (longest first) to avoid partial replacements
  const sortedTerms = Object.keys(terminologyMap).sort((a, b) => b.length - a.length);
  
  for (const oldTerm of sortedTerms) {
    const newTerm = terminologyMap[oldTerm];
    
    // Use word boundaries for whole word replacement
    const regex = new RegExp(`\\b${oldTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
    updatedContent = updatedContent.replace(regex, newTerm);
  }
  
  return updatedContent;
}

function updateFile(filePath) {
  try {
    console.log(`📝 Processing: ${filePath}`);
    
    const content = fs.readFileSync(filePath, 'utf8');
    const updatedContent = replaceTerminology(content);
    
    if (content !== updatedContent) {
      fs.writeFileSync(filePath, updatedContent, 'utf8');
      console.log(`✅ Updated: ${filePath}`);
      return true;
    } else {
      console.log(`⏭️ No changes needed: ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

// Files to update
const filesToUpdate = [
  'aureus-bot-complete.js',
  'fixed-investment-bot.js',
  'telegram.md',
  'update-schema.sql'
];

console.log('🔄 Starting terminology update process...');
console.log('📋 Replacing "investment" terminology with "share purchase" terminology\n');

let totalUpdated = 0;

for (const file of filesToUpdate) {
  if (fs.existsSync(file)) {
    if (updateFile(file)) {
      totalUpdated++;
    }
  } else {
    console.log(`⚠️ File not found: ${file}`);
  }
}

console.log(`\n🎉 Terminology update completed!`);
console.log(`📊 Files updated: ${totalUpdated}/${filesToUpdate.length}`);
console.log('\n📋 Summary of changes:');
console.log('✅ "Investment" → "Share Purchase"');
console.log('✅ "Invest" → "Buy Shares"');
console.log('✅ "Investor" → "Shareholder"');
console.log('✅ "Investment packages" → "Share packages"');
console.log('✅ "Investment portfolio" → "Share portfolio"');
console.log('✅ All related compound terms updated');
console.log('\n🚀 Ready for commission system overhaul!');
