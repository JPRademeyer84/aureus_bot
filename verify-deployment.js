// Pre-deployment verification for web authentication
const fs = require('fs');

console.log('🔍 Pre-Deployment Verification for Web Authentication\n');

// Check if the main bot file exists and has the required functions
const botFile = 'aureus-bot-new.js';
if (fs.existsSync(botFile)) {
  console.log('✅ Bot file exists:', botFile);
  
  const botContent = fs.readFileSync(botFile, 'utf8');
  
  // Check for web authentication command
  if (botContent.includes("bot.command('webauth'")) {
    console.log('✅ /webauth command handler found');
  } else {
    console.log('❌ /webauth command handler missing');
  }
  
  // Check for confirmation handlers
  if (botContent.includes('handleConfirmWebAuth')) {
    console.log('✅ Confirmation handler found');
  } else {
    console.log('❌ Confirmation handler missing');
  }
  
  if (botContent.includes('handleCancelWebAuth')) {
    console.log('✅ Cancellation handler found');
  } else {
    console.log('❌ Cancellation handler missing');
  }
  
  // Check for callback routing
  if (botContent.includes("confirm_webauth:")) {
    console.log('✅ Confirm callback routing found');
  } else {
    console.log('❌ Confirm callback routing missing');
  }
  
  if (botContent.includes("cancel_webauth:")) {
    console.log('✅ Cancel callback routing found');
  } else {
    console.log('❌ Cancel callback routing missing');
  }
  
} else {
  console.log('❌ Bot file not found:', botFile);
}

// Check package.json for dependencies
if (fs.existsSync('package.json')) {
  console.log('✅ package.json exists');
  
  const packageContent = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  const requiredDeps = ['telegraf', '@supabase/supabase-js', 'bcryptjs', 'dotenv'];
  requiredDeps.forEach(dep => {
    if (packageContent.dependencies && packageContent.dependencies[dep]) {
      console.log(`✅ Dependency found: ${dep}`);
    } else {
      console.log(`❌ Dependency missing: ${dep}`);
    }
  });
} else {
  console.log('❌ package.json not found');
}

// Check railway configuration
if (fs.existsSync('railway.toml')) {
  console.log('✅ Railway configuration exists');
  
  const railwayContent = fs.readFileSync('railway.toml', 'utf8');
  if (railwayContent.includes('aureus-bot-new.js')) {
    console.log('✅ Railway configured to start correct bot file');
  } else {
    console.log('❌ Railway start command may be incorrect');
  }
} else {
  console.log('❌ railway.toml not found');
}

console.log('\n📋 Next Steps:');
console.log('1. Create auth_tokens table in Supabase (see RAILWAY_DEPLOYMENT_GUIDE.md)');
console.log('2. Push to git: git push origin main');
console.log('3. Monitor Railway deployment logs');
console.log('4. Test /webauth command with live bot');

console.log('\n🚨 IMPORTANT: Create the database table BEFORE pushing to Railway!');
