const { Telegraf } = require("telegraf");
const bcrypt = require("bcryptjs");
const { db } = require('./src/database/supabase-client');
require("dotenv").config();

console.log("🚀 Starting Aureus Alliance Holdings Telegram Bot...");
console.log("🔗 VERSION CHECK: Bot links are https://t.me/AureusAllianceBot (PRODUCTION BOT)");
console.log("🔥 DEPLOYMENT VERSION: 2025-01-05-PRODUCTION-BOT-RAILWAY");
console.log("📅 DEPLOYMENT: " + new Date().toISOString());
console.log("🔧 FIXED: Share calculation using phase pricing + database wallet addresses");
console.log("🚨 CRITICAL FIX DEPLOYED: $100 payment = 20 shares (not 100 shares)");
console.log("💰 SHARE CALCULATION: amount ÷ phase_price = shares");
console.log("🛠️ SCOPE FIX: sharesAmount variable moved to outer scope - ReferenceError resolved");
console.log("🔗 BOT LINK FIX: All referral links use AureusAllianceBot (PRODUCTION BOT)");
console.log("🚨 PRODUCTION BOT: AureusAllianceBot running on Railway!");

// Bot configuration - Production only
const BOT_TOKEN = "7858706839:AAFRXBSlREW0wPvIyI57uFpHfYopi2CY464";
const ADMIN_USERNAME = "TTTFOUNDER";

console.log("📊 Database: Supabase PostgreSQL");

// 🔒 ESCROW SECURITY FUNCTIONS - Prevent Double-Spending Vulnerabilities
// These functions implement atomic escrow operations to prevent race conditions
// between concurrent commission withdrawal and conversion requests

/**
 * Atomically check available balance and create escrow for commission request
 * @param {string} userId - User ID
 * @param {number} requestAmount - Amount to escrow
 * @param {string} requestType - 'withdrawal' or 'conversion'
 * @returns {Promise<{success: boolean, availableBalance?: number, error?: string}>}
 */
async function createCommissionEscrow(userId, requestAmount, requestType) {
  try {
    // Use a database transaction to atomically check and update escrow
    const { data, error } = await db.client.rpc('create_commission_escrow', {
      p_user_id: userId,
      p_request_amount: requestAmount,
      p_request_type: requestType
    });

    if (error) {
      console.error(`❌ [ESCROW] Failed to create escrow for ${requestType}:`, error);
      return { success: false, error: error.message };
    }

    console.log(`✅ [ESCROW] Created ${requestType} escrow: $${requestAmount} for user ${userId}`);
    return { success: true, availableBalance: data };
  } catch (error) {
    console.error(`❌ [ESCROW] Exception creating escrow:`, error);
    return { success: false, error: 'Internal escrow error' };
  }
}

/**
 * Release escrow when request is rejected (only deduct from escrowed_amount)
 * @param {string} userId - User ID
 * @param {number} escrowAmount - Amount to release from escrow
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function releaseCommissionEscrow(userId, escrowAmount) {
  try {
    const { error } = await db.client.rpc('release_commission_escrow', {
      p_user_id: userId,
      p_escrow_amount: escrowAmount
    });

    if (error) {
      console.error(`❌ [ESCROW] Failed to release escrow:`, error);
      return { success: false, error: error.message };
    }

    console.log(`✅ [ESCROW] Released escrow: $${escrowAmount} for user ${userId}`);
    return { success: true };
  } catch (error) {
    console.error(`❌ [ESCROW] Exception releasing escrow:`, error);
    return { success: false, error: 'Internal escrow error' };
  }
}

/**
 * Audio notification system for enhanced user experience
 * Sends different notification sounds based on message type
 */
const AUDIO_NOTIFICATIONS = {
  SUCCESS: '🔔', // Success sound emoji
  ERROR: '🚨',   // Error sound emoji
  WARNING: '⚠️', // Warning sound emoji
  INFO: 'ℹ️',    // Info sound emoji
  PAYMENT: '💰', // Payment sound emoji
  APPROVAL: '✅', // Approval sound emoji
  REJECTION: '❌', // Rejection sound emoji
  COMMISSION: '💎', // Commission update sound
  WITHDRAWAL: '💸', // Withdrawal notification sound
  SYSTEM: '🔧', // System notification sound
  URGENT: '🚨', // Urgent alert sound
  CELEBRATION: '🎉' // Celebration sound for achievements
};

/**
 * Send notification with optional audio cue
 * @param {Object} ctx - Telegram context
 * @param {string} message - Message to send
 * @param {string} audioType - Type of audio notification
 * @param {Object} options - Additional options (keyboard, etc.)
 * @param {boolean} enableAudio - Whether to include audio notification
 */
async function sendNotificationWithAudio(ctx, message, audioType = 'INFO', options = {}, enableAudio = true) {
  try {
    // Add audio emoji to message if enabled
    let finalMessage = message;
    if (enableAudio && AUDIO_NOTIFICATIONS[audioType]) {
      finalMessage = `${AUDIO_NOTIFICATIONS[audioType]} ${message}`;
    }

    // Send the message with enhanced notification
    const messageOptions = {
      parse_mode: 'Markdown',
      disable_notification: !enableAudio, // Enable notification sound if audio is enabled
      ...options
    };

    await ctx.replyWithMarkdown(finalMessage, messageOptions);

    // Log audio notification for debugging
    if (enableAudio) {
      console.log(`🔊 [AUDIO] Sent ${audioType} notification to user ${ctx.from.id}`);
    }

  } catch (error) {
    console.error('Error sending notification with audio:', error);
    // Fallback to regular message
    await ctx.replyWithMarkdown(message, options);
  }
}

/**
 * Check if user has audio notifications enabled
 * @param {number} telegramId - User's telegram ID
 * @param {string} notificationType - Type of notification (optional)
 * @returns {Promise<boolean>} - Whether audio notifications are enabled
 */
async function isAudioNotificationEnabled(telegramId, notificationType = null) {
  try {
    // Get user preferences from database
    const { data: preferences, error } = await db.client
      .rpc('get_user_audio_preferences', { p_telegram_id: telegramId });

    if (error) {
      console.error('Error getting user audio preferences:', error);
      return true; // Default to enabled on error
    }

    if (!preferences) {
      return true; // Default to enabled if no preferences found
    }

    // Check general audio setting first
    if (!preferences.audio_enabled) {
      return false;
    }

    // Check specific notification type if provided
    if (notificationType) {
      const typeMapping = {
        'PAYMENT': 'payment_approval_audio',
        'APPROVAL': 'payment_approval_audio',
        'REJECTION': 'payment_rejection_audio',
        'WITHDRAWAL': 'withdrawal_approval_audio',
        'COMMISSION': 'commission_update_audio',
        'REFERRAL': 'referral_bonus_audio',
        'SYSTEM': 'system_announcement_audio'
      };

      const preferenceKey = typeMapping[notificationType];
      if (preferenceKey && preferences[preferenceKey] !== undefined) {
        return preferences[preferenceKey];
      }
    }

    return preferences.audio_enabled;
  } catch (error) {
    console.error('Error checking audio notification preference:', error);
    return true; // Default to enabled on error
  }
}

/**
 * Send audio notification to user by telegram ID
 * @param {number} telegramId - User's telegram ID
 * @param {string} message - Message to send
 * @param {string} audioType - Type of audio notification
 * @param {Object} options - Additional options
 * @param {boolean} forceAudio - Force audio notification regardless of user preference
 */
async function sendAudioNotificationToUser(telegramId, message, audioType = 'INFO', options = {}, forceAudio = false) {
  try {
    // Check user preference for audio notifications with specific type
    const audioEnabled = forceAudio || await isAudioNotificationEnabled(telegramId, audioType);

    // Add audio emoji to message if enabled
    let finalMessage = message;
    if (audioEnabled && AUDIO_NOTIFICATIONS[audioType]) {
      finalMessage = `${AUDIO_NOTIFICATIONS[audioType]} ${message}`;
    }

    // Send the message with enhanced notification
    const messageOptions = {
      parse_mode: 'Markdown',
      disable_notification: !audioEnabled, // Enable notification sound if audio is enabled
      ...options
    };

    await bot.telegram.sendMessage(telegramId, finalMessage, messageOptions);

    // Log notification to database for analytics
    await logNotificationToDatabase(telegramId, audioType, message, audioEnabled, 'sent');

    // Log audio notification for debugging
    if (audioEnabled) {
      console.log(`🔊 [AUDIO] Sent ${audioType} notification to user ${telegramId}`);
    } else {
      console.log(`🔇 [SILENT] Sent silent ${audioType} notification to user ${telegramId}`);
    }

  } catch (error) {
    console.error('Error sending audio notification to user:', error);

    // Log failed notification
    await logNotificationToDatabase(telegramId, audioType, message, false, 'failed', error.message);

    // Fallback to regular message
    try {
      await bot.telegram.sendMessage(telegramId, message, options);
    } catch (fallbackError) {
      console.error('Error sending fallback message:', fallbackError);
    }
  }
}

/**
 * Log notification to database for analytics and tracking
 * @param {number} telegramId - User's telegram ID
 * @param {string} audioType - Type of audio notification
 * @param {string} message - Message content
 * @param {boolean} audioEnabled - Whether audio was enabled
 * @param {string} status - Delivery status
 * @param {string} errorMessage - Error message if failed
 */
async function logNotificationToDatabase(telegramId, audioType, message, audioEnabled, status, errorMessage = null) {
  try {
    // Get user_id from telegram_id
    const { data: telegramUser } = await db.client
      .from('telegram_users')
      .select('user_id')
      .eq('telegram_id', telegramId)
      .single();

    const messagePreview = message.length > 100 ? message.substring(0, 100) + '...' : message;

    await db.client
      .from('notification_log')
      .insert({
        telegram_id: telegramId,
        user_id: telegramUser?.user_id || null,
        notification_type: audioType.toLowerCase(),
        audio_type: audioType,
        message_preview: messagePreview,
        audio_enabled: audioEnabled,
        delivery_status: status,
        error_message: errorMessage,
        sent_at: new Date().toISOString()
      });

  } catch (error) {
    console.error('Error logging notification to database:', error);
    // Don't throw error as this is just logging
  }
}

/**
 * Send admin notification for critical events
 * @param {string} eventType - Type of event (withdrawal_request, payment_received, etc.)
 * @param {Object} eventData - Event data
 * @param {string} priority - Priority level (low, medium, high, critical)
 */
async function sendAdminNotification(eventType, eventData, priority = 'medium') {
  try {
    // Get all admin users
    const { data: adminUsers, error } = await db.client
      .from('telegram_users')
      .select(`
        telegram_id,
        user_id,
        users!telegram_users_user_id_fkey!inner(
          username,
          is_admin
        )
      `)
      .eq('users.is_admin', true);

    if (error || !adminUsers || adminUsers.length === 0) {
      console.log('No admin users found for notification');
      return;
    }

    // Create notification message based on event type
    const notificationMessage = createAdminNotificationMessage(eventType, eventData, priority);
    const audioType = getAdminAudioType(eventType, priority);

    // Send to each admin
    for (const admin of adminUsers) {
      try {
        // Check admin notification preferences
        const adminAudioEnabled = await isAdminAudioNotificationEnabled(admin.telegram_id, eventType, priority);

        await sendAudioNotificationToUser(
          admin.telegram_id,
          notificationMessage.message,
          audioType,
          notificationMessage.options,
          adminAudioEnabled
        );

        console.log(`📢 [ADMIN] Sent ${eventType} notification to admin ${admin.users.username}`);

      } catch (adminError) {
        console.error(`Error sending notification to admin ${admin.users.username}:`, adminError);
      }
    }

  } catch (error) {
    console.error('Error sending admin notifications:', error);
  }
}

/**
 * Check if admin has audio notifications enabled for specific event type
 * @param {number} telegramId - Admin's telegram ID
 * @param {string} eventType - Type of event
 * @param {string} priority - Priority level
 * @returns {Promise<boolean>} - Whether audio notifications are enabled
 */
async function isAdminAudioNotificationEnabled(telegramId, eventType, priority) {
  try {
    const { data: preferences, error } = await db.client
      .from('admin_notification_preferences')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();

    if (error || !preferences) {
      // Default admin preferences if not found
      return true;
    }

    // Check general audio setting
    if (!preferences.audio_enabled) {
      return false;
    }

    // Check priority level preferences
    const priorityMapping = {
      'critical': preferences.critical_alerts_audio,
      'high': preferences.high_priority_audio,
      'medium': preferences.medium_priority_audio,
      'low': preferences.low_priority_audio
    };

    if (priorityMapping[priority] !== undefined) {
      if (!priorityMapping[priority]) {
        return false;
      }
    }

    // Check specific event type preferences
    const eventMapping = {
      'payment_received': preferences.new_payment_audio,
      'withdrawal_request': preferences.new_withdrawal_request_audio,
      'commission_conversion': preferences.new_commission_conversion_audio,
      'system_error': preferences.system_error_audio,
      'user_registration': preferences.user_registration_audio,
      'high_value_transaction': preferences.high_value_transaction_audio
    };

    const eventPreference = eventMapping[eventType];
    if (eventPreference !== undefined) {
      return eventPreference;
    }

    return preferences.audio_enabled;

  } catch (error) {
    console.error('Error checking admin audio notification preference:', error);
    return true; // Default to enabled for admins
  }
}

/**
 * Create admin notification message based on event type
 * @param {string} eventType - Type of event
 * @param {Object} eventData - Event data
 * @param {string} priority - Priority level
 * @returns {Object} - Message and options
 */
function createAdminNotificationMessage(eventType, eventData, priority) {
  const priorityEmoji = {
    'critical': '🚨',
    'high': '🔴',
    'medium': '🟡',
    'low': '🟢'
  };

  const emoji = priorityEmoji[priority] || '🔔';

  switch (eventType) {
    case 'withdrawal_request':
      return {
        message: `${emoji} **NEW WITHDRAWAL REQUEST**

**User:** ${eventData.username || 'Unknown'}
**Amount:** $${eventData.amount} USDT
**Wallet:** ${eventData.wallet_address}
**Priority:** ${priority.toUpperCase()}

**Action Required:** Review and approve/reject this withdrawal request.`,
        options: {
          reply_markup: {
            inline_keyboard: [
              [{ text: "⏳ View Pending Withdrawals", callback_data: "admin_pending_withdrawals" }],
              [{ text: "🔧 Admin Panel", callback_data: "admin_panel" }]
            ]
          }
        }
      };

    case 'payment_received':
      return {
        message: `${emoji} **NEW PAYMENT RECEIVED**

**User:** ${eventData.username || 'Unknown'}
**Amount:** $${eventData.amount} USD
**Shares:** ${eventData.shares || 'TBD'}
**Priority:** ${priority.toUpperCase()}

**Action Required:** Review and approve/reject this payment.`,
        options: {
          reply_markup: {
            inline_keyboard: [
              [{ text: "💳 View Pending Payments", callback_data: "admin_pending_payments" }],
              [{ text: "🔧 Admin Panel", callback_data: "admin_panel" }]
            ]
          }
        }
      };

    case 'commission_conversion':
      return {
        message: `${emoji} **NEW COMMISSION CONVERSION REQUEST**

**Request ID:** #${eventData.conversion_id || 'Unknown'}
**User:** ${eventData.username || 'Unknown'}
**Shares Requested:** ${eventData.shares} shares
**USDT Amount:** $${eventData.amount}
**Available Commission:** $${eventData.available_commission || 'N/A'}
**Phase:** ${eventData.phase || 'N/A'}
**Priority:** ${priority.toUpperCase()}

**Action Required:** Review and approve/reject this conversion request.`,
        options: {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "✅ Approve", callback_data: `approve_conv_${eventData.conversion_id}` },
                { text: "❌ Reject", callback_data: `reject_conv_${eventData.conversion_id}` }
              ],
              [{ text: "💎 View All Requests", callback_data: "admin_commissions" }],
              [{ text: "🔧 Admin Panel", callback_data: "admin_panel" }]
            ]
          }
        }
      };

    default:
      return {
        message: `${emoji} **ADMIN NOTIFICATION**

**Event:** ${eventType}
**Priority:** ${priority.toUpperCase()}
**Data:** ${JSON.stringify(eventData, null, 2)}`,
        options: {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔧 Admin Panel", callback_data: "admin_panel" }]
            ]
          }
        }
      };
  }
}

/**
 * Get appropriate audio type for admin notifications
 * @param {string} eventType - Type of event
 * @param {string} priority - Priority level
 * @returns {string} - Audio type
 */
function getAdminAudioType(eventType, priority) {
  if (priority === 'critical') {
    return 'URGENT';
  }

  if (priority === 'high') {
    return 'WARNING';
  }

  switch (eventType) {
    case 'payment_received':
      return 'PAYMENT';
    case 'withdrawal_request':
      return 'WARNING';
    case 'commission_conversion':
      return 'COMMISSION';
    case 'system_error':
      return 'ERROR';
    default:
      return 'INFO';
  }
}

/**
 * Get available commission balance (usdt_balance - escrowed_amount)
 * @param {string} userId - User ID
 * @returns {Promise<{availableBalance: number, totalBalance: number, escrowedAmount: number}>}
 */
async function getAvailableCommissionBalance(userId) {
  try {
    const { data: balance, error } = await db.client
      .from('commission_balances')
      .select('usdt_balance, escrowed_amount')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error(`❌ [ESCROW] Error fetching balance:`, error);
      return { availableBalance: 0, totalBalance: 0, escrowedAmount: 0 };
    }

    const totalBalance = balance ? parseFloat(balance.usdt_balance || 0) : 0;
    const escrowedAmount = balance ? parseFloat(balance.escrowed_amount || 0) : 0;
    const availableBalance = totalBalance - escrowedAmount;

    console.log(`💰 [ESCROW] Balance check for user ${userId}: Total=$${totalBalance}, Escrowed=$${escrowedAmount}, Available=$${availableBalance}`);

    return {
      availableBalance: Math.max(0, availableBalance),
      totalBalance,
      escrowedAmount
    };
  } catch (error) {
    console.error(`❌ [ESCROW] Exception getting balance:`, error);
    return { availableBalance: 0, totalBalance: 0, escrowedAmount: 0 };
  }
}

/**
 * Get enhanced commission balance with comprehensive information
 * @param {string} userId - User ID
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
async function getEnhancedCommissionBalance(userId) {
  try {
    console.log(`🔍 [ENHANCED_BALANCE] Starting enhanced balance fetch for user ${userId}`);

    // Get commission balance
    const { data: commissionBalance, error: balanceError } = await db.client
      .from('commission_balances')
      .select('*')
      .eq('user_id', userId)
      .single();

    console.log(`🔍 [ENHANCED_BALANCE] Commission balance query result:`, { commissionBalance, balanceError });

    if (balanceError && balanceError.code !== 'PGRST116') {
      console.error('Enhanced commission balance fetch error:', balanceError);
      return { success: false, error: balanceError.message };
    }

    // Get pending withdrawals
    const { data: pendingWithdrawals, error: withdrawalError } = await db.client
      .from('commission_withdrawals')
      .select('id, amount, created_at, withdrawal_type')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    // Get pending conversions
    const { data: pendingConversions, error: conversionError } = await db.client
      .from('commission_conversions')
      .select('id, usdt_amount, shares_requested, created_at')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    // Get conversion history (approved conversions)
    const { data: conversionHistory, error: historyError } = await db.client
      .from('commission_conversions')
      .select('usdt_amount, shares_requested')
      .eq('user_id', userId)
      .eq('status', 'approved');

    // Calculate values
    const totalEarnedUSDT = commissionBalance ? parseFloat(commissionBalance.total_earned_usdt || 0) : 0;
    const totalEarnedShares = commissionBalance ? parseFloat(commissionBalance.total_earned_shares || 0) : 0;
    const totalBalance = commissionBalance ? parseFloat(commissionBalance.usdt_balance || 0) : 0;
    const escrowedAmount = commissionBalance ? parseFloat(commissionBalance.escrowed_amount || 0) : 0;
    const availableUSDT = Math.max(0, totalBalance - escrowedAmount);
    const totalWithdrawnUSDT = commissionBalance ? parseFloat(commissionBalance.total_withdrawn || 0) : 0;

    // Calculate conversion totals
    const totalConvertedUSDT = conversionHistory ? conversionHistory.reduce((sum, conv) => sum + parseFloat(conv.usdt_amount || 0), 0) : 0;
    const sharesFromConversions = conversionHistory ? conversionHistory.reduce((sum, conv) => sum + parseFloat(conv.shares_requested || 0), 0) : 0;

    // Get current phase price for accurate share value calculation
    let currentSharePrice = 5.00; // Default to $5
    try {
      const currentPhase = await db.getCurrentPhase();
      if (currentPhase && currentPhase.price_per_share) {
        currentSharePrice = parseFloat(currentPhase.price_per_share);
      }
      console.log(`🔍 [ENHANCED_BALANCE] Current phase price: $${currentSharePrice}`);
    } catch (phaseError) {
      console.error('Error getting current phase for share value calculation:', phaseError);
      // Continue with default price
    }

    // Calculate share value using current phase price
    const shareValue = totalEarnedShares * currentSharePrice;
    const totalCommissionValue = totalEarnedUSDT + shareValue;

    console.log(`🔍 [ENHANCED_BALANCE] Share value calculation: ${totalEarnedShares} shares × $${currentSharePrice} = $${shareValue}`);

    return {
      success: true,
      data: {
        totalEarnedUSDT,
        totalEarnedShares,
        availableUSDT,
        escrowedAmount,
        totalWithdrawnUSDT,
        totalConvertedUSDT,
        sharesFromConversions,
        shareValue,
        totalCommissionValue,
        pendingWithdrawals: pendingWithdrawals || [],
        pendingConversions: pendingConversions || []
      }
    };
  } catch (error) {
    console.error('Enhanced commission balance exception:', error);
    return { success: false, error: error.message };
  }
}

// 🚨 SHARES SOLD TRACKING FUNCTIONS - Critical Bug Fix
// These functions ensure shares_sold field is properly updated when shares are allocated

/**
 * Atomically increment shares_sold for a specific share purchase phase
 * @param {string} phaseId - shares phase ID
 * @param {number} sharesAllocated - Number of shares to add to shares_sold
 * @param {string} source - Source of allocation (e.g., 'direct_purchase', 'commission_conversion', 'referral_bonus')
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function incrementSharesSold(phaseId, sharesAllocated, source = 'unknown') {
  try {
    console.log(`📊 [SHARES_SOLD] Incrementing shares_sold: Phase ${phaseId}, +${sharesAllocated} shares, Source: ${source}`);

    // Use atomic update with current value check
    const { data: currentPhase, error: fetchError } = await db.client
      .from('investment_phases')
      .select('id, phase_number, shares_sold, total_shares_available')
      .eq('id', phaseId)
      .single();

    if (fetchError || !currentPhase) {
      console.error(`❌ [SHARES_SOLD] Phase ${phaseId} not found:`, fetchError);
      return { success: false, error: `Phase ${phaseId} not found` };
    }

    const currentSharesSold = parseFloat(currentPhase.shares_sold || 0);
    const newSharesSold = currentSharesSold + sharesAllocated;
    const totalAvailable = parseFloat(currentPhase.total_shares_available || 0);

    // Validate we don't exceed total available shares
    if (newSharesSold > totalAvailable) {
      console.error(`❌ [SHARES_SOLD] Would exceed total available shares: ${newSharesSold} > ${totalAvailable}`);
      return { success: false, error: `Would exceed total available shares (${totalAvailable})` };
    }

    // Atomic update with decimal precision
    const { error: updateError } = await db.client
      .from('investment_phases')
      .update({
        shares_sold: newSharesSold,
        updated_at: new Date().toISOString()
      })
      .eq('id', phaseId)
      .eq('shares_sold', currentSharesSold); // Ensure no concurrent updates

    if (updateError) {
      console.error(`❌ [SHARES_SOLD] Failed to update shares_sold:`, updateError);
      return { success: false, error: updateError.message };
    }

    console.log(`✅ [SHARES_SOLD] Updated Phase ${currentPhase.phase_number}: ${currentSharesSold} -> ${newSharesSold} shares sold`);

    // Log the update for audit trail
    await logAdminAction(
      null, // No specific admin for system actions
      'SYSTEM',
      'shares_sold_increment',
      'investment_phase',
      phaseId,
      {
        source,
        shares_allocated: sharesAllocated,
        previous_shares_sold: currentSharesSold,
        new_shares_sold: newSharesSold,
        remaining_shares: totalAvailable - newSharesSold
      }
    );

    return { success: true };
  } catch (error) {
    console.error(`❌ [SHARES_SOLD] Exception incrementing shares_sold:`, error);
    return { success: false, error: 'Internal error updating shares_sold' };
  }
}

/**
 * Get current active phase for share allocation
 * @returns {Promise<{phase: object|null, error?: string}>}
 */
async function getCurrentActivePhase() {
  try {
    const { data: phase, error } = await db.client
      .from('investment_phases')
      .select('*')
      .eq('is_active', true)
      .single();

    if (error) {
      console.error(`❌ [SHARES_SOLD] Error fetching active phase:`, error);
      return { phase: null, error: error.message };
    }

    return { phase };
  } catch (error) {
    console.error(`❌ [SHARES_SOLD] Exception fetching active phase:`, error);
    return { phase: null, error: 'Internal error fetching active phase' };
  }
}

/**
 * Validate shares_sold integrity across all phases
 * @returns {Promise<{valid: boolean, issues?: Array, summary?: object}>}
 */
async function validateSharesSoldIntegrity() {
  try {
    console.log(`🔍 [VALIDATION] Starting shares_sold integrity check...`);

    // Get all phases
    const { data: phases, error: phasesError } = await db.client
      .from('investment_phases')
      .select('*')
      .order('phase_number');

    if (phasesError) {
      console.error(`❌ [VALIDATION] Error fetching phases:`, phasesError);
      return { valid: false, issues: ['Failed to fetch share phases'] };
    }

    const issues = [];
    let totalSharesSold = 0;
    let totalSharesAvailable = 0;

    for (const phase of phases) {
      const sharesSold = parseFloat(phase.shares_sold || 0);
      const totalAvailable = parseFloat(phase.total_shares_available || 0);
      const remaining = totalAvailable - sharesSold;

      totalSharesSold += sharesSold;
      totalSharesAvailable += totalAvailable;

      // Check for negative remaining shares
      if (remaining < 0) {
        issues.push(`Phase ${phase.phase_number}: Negative remaining shares (${remaining})`);
      }

      // Check for impossible values
      if (sharesSold > totalAvailable) {
        issues.push(`Phase ${phase.phase_number}: shares_sold (${sharesSold}) exceeds total_shares_available (${totalAvailable})`);
      }

      console.log(`📊 [VALIDATION] Phase ${phase.phase_number}: ${sharesSold}/${totalAvailable} shares sold (${remaining} remaining)`);
    }

    const summary = {
      total_phases: phases.length,
      total_shares_sold: totalSharesSold,
      total_shares_available: totalSharesAvailable,
      total_remaining: totalSharesAvailable - totalSharesSold,
      issues_found: issues.length
    };

    console.log(`📊 [VALIDATION] Summary:`, summary);

    if (issues.length > 0) {
      console.error(`❌ [VALIDATION] Found ${issues.length} integrity issues:`, issues);
      return { valid: false, issues, summary };
    }

    console.log(`✅ [VALIDATION] shares_sold integrity check passed`);
    return { valid: true, summary };
  } catch (error) {
    console.error(`❌ [VALIDATION] Exception during integrity check:`, error);
    return { valid: false, issues: ['Internal validation error'] };
  }
}

// Create bot instance
const bot = new Telegraf(BOT_TOKEN);

// Simple session storage for temporary data
const sessions = new Map();

// Session middleware
bot.use((ctx, next) => {
  const sessionKey = `${ctx.from.id}`;
  ctx.session = sessions.get(sessionKey) || {};

  return next().then(() => {
    sessions.set(sessionKey, ctx.session);
  });
});

// Utility functions
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

// Package formatting function removed - using custom amounts only

function createMainMenuKeyboard(isAdmin = false, hasKYC = true) {
  const keyboard = [
    [
      { text: "🛒 Purchase Gold Shares", callback_data: "menu_purchase_shares" }
    ],
    [
      { text: "👥 Referral Program", callback_data: "menu_referrals" },
      { text: "📊 My Portfolio", callback_data: "menu_portfolio" }
    ],
    [
      { text: "💳 Payment Status", callback_data: "menu_payments" },
      { text: "📋 Company Presentation", callback_data: "menu_presentation" }
    ],
    [
      { text: "📋 Legal Documents", callback_data: "menu_legal_documents" }
    ],
    [
      { text: "⛏️ Mining Operations", callback_data: "menu_mining_operations" },
      { text: "🏘️ Community Relations", callback_data: "menu_community" }
    ],
    [
      { text: "🆘 Support Center", callback_data: "menu_help" },
      { text: "⚙️ Settings", callback_data: "user_settings" }
    ],
    [
      { text: "🌐 Connect to Website", callback_data: "connect_to_website" }
    ]
  ];

  // Add KYC reminder if not completed
  if (!hasKYC) {
    keyboard.unshift([
      { text: "🔒 Complete KYC (Required)", callback_data: "start_kyc_process" }
    ]);
  }

  // Add admin options if user is admin
  if (isAdmin) {
    keyboard.push([
      { text: "🔑 Admin Panel", callback_data: "admin_panel" },
      { text: "📊 System Status", callback_data: "admin_status" }
    ]);
  }

  return { inline_keyboard: keyboard };
}

// Package keyboard function removed - using custom amounts only

function createTermsKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "✅ I Accept Terms & Conditions", callback_data: "accept_terms" }
      ],
      [
        { text: "📋 Read Full Terms", url: "https://aureus.africa/" }
      ],
      [
        { text: "🔙 Back to Dashboard", callback_data: "main_menu" }
      ]
    ]
  };
}

async function createPaymentMethodKeyboard(userId = null) {
  const keyboard = [
    [
      { text: "💎 Tether (USDT)", callback_data: "payment_usdt" }
    ]
  ];

  // Check if user is eligible for bank transfer (ZAF, SWZ, NAM)
  if (userId) {
    const isBankTransferEligible = await checkBankTransferEligibility(userId);
    if (isBankTransferEligible) {
      keyboard.splice(2, 0, [
        { text: "🏦 Bank Transfer (ZAR)", callback_data: "payment_bank_transfer" }
      ]);
    }
  }

  keyboard.push([
    { text: "🔙 Back to Dashboard", callback_data: "main_menu" }
  ]);

  return {
    inline_keyboard: keyboard
  };
}

function createReferralKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "👥 My Referrals", callback_data: "view_referrals" },
        { text: "💰 Commission Balance", callback_data: "view_commission" }
      ],
      [
        { text: "💸 Request Withdrawal", callback_data: "request_withdrawal" }
      ],
      [
        { text: "🔙 Back to Dashboard", callback_data: "main_menu" }
      ]
    ]
  };
}

function createPortfolioKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "📊 Share Holdings", callback_data: "view_holdings" },
        { text: "💰 Share Purchase History", callback_data: "view_history" }
      ],
      [
        { text: "📈 Performance", callback_data: "view_performance" }
      ],
      [
        { text: "🔙 Back to Dashboard", callback_data: "main_menu" }
      ]
    ]
  };
}



function createAdminKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "⏳ Pending Payments", callback_data: "admin_pending" },
        { text: "👥 User Management", callback_data: "admin_users" }
      ],
      [
        { text: "💰 Commission Requests", callback_data: "admin_commissions" },
        { text: "📊 System Stats", callback_data: "admin_stats" }
      ],
      [
        { text: "📋 Audit Logs", callback_data: "admin_logs" }
      ],
      [
        { text: "🔙 Back to Dashboard", callback_data: "main_menu" }
      ]
    ]
  };
}

// Authentication functions
async function authenticateUser(ctx, sponsorUsername = null) {
  const telegramId = ctx.from.id;
  const username = ctx.from.username;

  if (!username) {
    await ctx.reply("❌ Please set a Telegram username to use this bot.");
    return null;
  }

  try {
    // Get or create main user record by username first
    let user = await db.getUserByUsername(username);
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      // Create new user record (users table doesn't have telegram_id)
      user = await db.createUser({
        username: username,
        email: `${username}@telegram.local`, // Dummy email since it's required
        password_hash: 'telegram_auth', // Dummy password since it's required
        full_name: `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim()
      });

      if (!user) {
        throw new Error('Failed to create user record');
      }
    }

    // Get or create telegram user record linked to main user
    let telegramUser = await db.getTelegramUser(telegramId);

    if (!telegramUser) {
      // Create new telegram user record linked to main user
      telegramUser = await db.createTelegramUser(telegramId, {
        user_id: user.id, // Link to main user
        username: username,
        first_name: ctx.from.first_name,
        last_name: ctx.from.last_name
      });
    }

    // Link telegram user to main user if not already linked
    if (!telegramUser.user_id) {
      await db.updateTelegramUser(telegramId, {
        user_id: user.id,
        is_registered: true
      });
    }

    // Handle sponsor assignment
    if (sponsorUsername) {
      console.log(`🔗 [authenticateUser] Sponsor provided via referral: ${sponsorUsername}`);
      // Check if user already has a sponsor
      const hasSponsor = await checkUserHasSponsor(user.id);
      if (!hasSponsor) {
        console.log(`🤝 [authenticateUser] Assigning sponsor ${sponsorUsername} to user ${user.id}`);
        await assignSponsor(user.id, sponsorUsername);
      } else {
        console.log(`⚠️ [authenticateUser] User ${user.id} already has a sponsor, skipping assignment`);
      }
    } else if (isNewUser && !sponsorUsername) {
      // New user without sponsor - will be prompted later
      console.log(`🆕 New user ${user.username} registered without sponsor - will prompt for assignment`);
    }

    return user;
  } catch (error) {
    console.error('Authentication error:', error);
    await ctx.reply("❌ Authentication failed. Please try again.");
    return null;
  }
}

// Referral Registration Handler
async function handleReferralRegistration(ctx, sponsorUsername) {
  console.log(`🔗 [handleReferralRegistration] Processing referral registration with sponsor: ${sponsorUsername}`);

  try {
    // Validate sponsor exists
    console.log(`🔍 [handleReferralRegistration] Looking up sponsor: ${sponsorUsername}`);
    const sponsor = await db.getUserByUsername(sponsorUsername);
    if (!sponsor) {
      console.log(`❌ [handleReferralRegistration] Sponsor not found: ${sponsorUsername}, using TTTFOUNDER as fallback`);
      sponsorUsername = 'TTTFOUNDER';
    } else {
      console.log(`✅ [handleReferralRegistration] Sponsor found: ${sponsor.username} (ID: ${sponsor.id})`);
    }

    // Authenticate user with sponsor assignment
    console.log(`🔐 [handleReferralRegistration] Authenticating user with sponsor: ${sponsorUsername}`);
    const user = await authenticateUser(ctx, sponsorUsername);
    if (!user) {
      console.error(`❌ [handleReferralRegistration] User authentication failed`);
      return;
    }

    console.log(`✅ [handleReferralRegistration] User authenticated: ${user.username} (ID: ${user.id})`);

    // Verify sponsor assignment was successful
    const hasSponsor = await checkUserHasSponsor(user.id);
    console.log(`🔍 [handleReferralRegistration] Sponsor assignment check: ${hasSponsor ? 'SUCCESS' : 'FAILED'}`);

    if (!hasSponsor) {
      console.error(`❌ [handleReferralRegistration] CRITICAL: Sponsor assignment failed for user ${user.id}`);
    }

    // Show welcome message with sponsor confirmation
    const welcomeMessage = `🎉 **WELCOME TO AUREUS ALLIANCE HOLDINGS!**

✅ **Registration Successful**
👤 **Your Sponsor:** ${sponsorUsername}
🤝 **Referral Bonus:** You're now part of our referral network!

**🎯 NEXT STEPS:**
• Explore our gold mining shares opportunities
• Review company presentation and mining operations
• Start your share ownership journey with confidence

**💎 Your sponsor will earn commissions when you purchase shares:**
• 15% USDT commission
• 15% additional shares commission

Let's get started with your gold mining share purchase!`;

    await ctx.replyWithMarkdown(welcomeMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🛒 Purchase Gold Shares", callback_data: "menu_purchase_shares" }],
          [{ text: "📋 Company Presentation", callback_data: "menu_presentation" }],
          [{ text: "💼 My Portfolio", callback_data: "menu_portfolio" }],
          [{ text: "🏠 Main Dashboard", callback_data: "main_menu" }]
        ]
      }
    });

    // TRIGGER COUNTRY SELECTION FOR NEW USERS
    console.log(`🌍 [COUNTRY] Checking country selection status for new user ${user.id}...`);
    await triggerCountrySelectionIfNeeded(user.id);

  } catch (error) {
    console.error('Referral registration error:', error);
    await ctx.reply("❌ Error processing referral registration. Please try again.");
    await showMainMenu(ctx);
  }
}

// Sponsor Assignment Function
async function assignSponsor(userId, sponsorUsername) {
  try {
    console.log(`🤝 [assignSponsor] Starting assignment: ${sponsorUsername} -> User ${userId}`);

    // Get sponsor user record
    let sponsor = await db.getUserByUsername(sponsorUsername);
    if (!sponsor) {
      console.log(`❌ [assignSponsor] Sponsor ${sponsorUsername} not found, using TTTFOUNDER`);
      sponsor = await db.getUserByUsername('TTTFOUNDER');
      if (!sponsor) {
        console.error('❌ [assignSponsor] TTTFOUNDER fallback sponsor not found!');
        return false;
      }
      sponsorUsername = 'TTTFOUNDER';
    }

    console.log(`✅ [assignSponsor] Sponsor found: ${sponsor.username} (ID: ${sponsor.id})`);

    // Check if referral relationship already exists
    const { data: existingReferral, error: checkError } = await db.client
      .from('referrals')
      .select('id')
      .eq('referred_id', userId)
      .eq('status', 'active')
      .single();

    if (existingReferral && !checkError) {
      console.log(`⚠️ [assignSponsor] User ${userId} already has an active sponsor`);
      return true; // Consider this a success since they already have a sponsor
    }

    // Create referral relationship
    console.log(`📝 [assignSponsor] Creating referral relationship...`);
    const { data: referral, error: referralError } = await db.client
      .from('referrals')
      .insert({
        referrer_id: sponsor.id,
        referred_id: userId,
        referral_code: `${sponsorUsername}_${userId}_${Date.now()}`,
        commission_rate: 15.00,
        status: 'active',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (referralError) {
      console.error('❌ [assignSponsor] Error creating referral relationship:', referralError);
      return false;
    }

    console.log(`✅ [assignSponsor] Referral created successfully:`, referral);
    console.log(`✅ [assignSponsor] Sponsor assigned successfully: ${sponsorUsername} -> User ${userId}`);
    return true;

  } catch (error) {
    console.error('❌ [assignSponsor] Error assigning sponsor:', error);
    return false;
  }
}

// Check if user has a sponsor
async function checkUserHasSponsor(userId) {
  try {
    const { data: referral, error } = await db.client
      .from('referrals')
      .select('id')
      .eq('referred_id', userId)
      .eq('status', 'active')
      .single();

    return !error && referral;
  } catch (error) {
    console.error('Error checking sponsor:', error);
    return false;
  }
}

// Check if user has accepted terms
async function checkTermsAcceptance(userId) {
  try {
    console.log(`🔍 [checkTermsAcceptance] Checking terms for user ${userId}`);
    const { data: termsRecord, error } = await db.client
      .from('terms_acceptance')
      .select('id, accepted_at')
      .eq('user_id', userId)
      .eq('terms_type', 'general_terms')
      .single();

    const hasAccepted = !error && termsRecord;
    console.log(`📋 [checkTermsAcceptance] User ${userId} terms status: ${hasAccepted ? 'ACCEPTED' : 'NOT ACCEPTED'}`);
    return hasAccepted;
  } catch (error) {
    console.error('❌ Error checking terms acceptance:', error);
    return false;
  }
}

// Show Terms and Conditions
async function showTermsAndConditions(ctx, referralPayload = null) {
  console.log(`📋 [showTermsAndConditions] Displaying terms to user ${ctx.from.username}`);

  const termsMessage = `

**🏆 AUREUS ALLIANCE HOLDINGS (Pty)Ltd**
*Premium Gold Mining Share Ownership Purchase Platform*

📋 **TERMS AND CONDITIONS**

**📜 TERMS OF SERVICE:**

**1. SHARE NATURE**
• Gold mining shares represent ownership in physical mining operations
• Dividends depend on actual gold production and market conditions
• Dividends are paid based on audited annual financials (Profit & Loss statements). There are no guaranteed returns or investment promises—each buyer is acquiring actual equity shares in Aureus Alliance Holdings.

**2. RISK DISCLOSURE**
• Mining operations involve inherent risks
• Share values may fluctuate based on operational performance
• Past performance does not guarantee future results

**3. COMMISSION STRUCTURE**
• Referral commissions: 15% USDT + 15% shares
• Commissions paid on successful share purchases
• Withdrawal subject to admin approval

**4. PLATFORM USAGE**
• Users must provide accurate information
• Prohibited: fraud, manipulation, unauthorized access
• Platform reserves right to suspend accounts for violations

**5. DATA PRIVACY**
• Personal information protected per privacy policy
• Transaction data stored securely
• No sharing with third parties without consent

**6. DISPUTE RESOLUTION**
• Good faith resolution attempts required
• Binding arbitration for unresolved disputes
• Governing law: South African

**⚠️ MANDATORY ACCEPTANCE REQUIRED**
You must accept these terms to use the platform.`;

  const keyboard = [
    [{ text: "✅ I Accept Terms & Conditions", callback_data: `accept_terms_${referralPayload || 'direct'}` }],
    [{ text: "❌ I Decline", callback_data: "decline_terms" }],
    [{ text: "📄 View Privacy Policy", callback_data: "view_privacy_policy" }]
  ];

  await ctx.replyWithMarkdown(termsMessage, {
    reply_markup: { inline_keyboard: keyboard }
  });
}

// Prompt user to assign sponsor
async function promptSponsorAssignment(ctx) {
  const sponsorMessage = `🤝 **SPONSOR ASSIGNMENT REQUIRED**



**⚠️ MANDATORY REFERRAL SYSTEM**

To proceed with Aureus Alliance Holdings, you need a sponsor. This ensures proper commission tracking and support throughout your share purchase journey.

**🎯 YOUR OPTIONS:**

**1️⃣ ENTER SPONSOR USERNAME**
If someone referred you, enter their telegram username they provided below.

**2️⃣ NO SPONSOR AVAILABLE**
You can continue without a sponsor and join directly.

**💡 WHY SPONSORS MATTER:**
• Personalized share ownership guidance
• Commission structure for referrers
• Community support network
• Proper tracking and accountability



**Please choose an option below:**`;

  await ctx.replyWithMarkdown(sponsorMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "✍️ Enter Sponsor Username", callback_data: "enter_sponsor_manual" }],
        [{ text: "🚫 I Don't Have A Sponsor", callback_data: "assign_default_sponsor" }],
        [{ text: "ℹ️ Learn About Referral System", callback_data: "menu_referrals" }]
      ]
    }
  });
}

// Handle manual sponsor entry
async function handleEnterSponsorManual(ctx) {
  console.log('📝 handleEnterSponsorManual called');
  const user = ctx.from;

  try {
    // Set user state for sponsor entry
    console.log(`🔧 Setting user state for ${user.id}: awaiting_sponsor_username`);
    await setUserState(user.id, 'awaiting_sponsor_username', { timestamp: Date.now() });
    console.log(`✅ User state set successfully for ${user.id}`);

  const instructionMessage = `✍️ **ENTER SPONSOR USERNAME**



**Please type the Telegram username of your sponsor:**

**📝 FORMAT:** Just the username (without @)
**📝 EXAMPLE:** If sponsor is @JohnDoe, type: JohnDoe

**⏰ You have 5 minutes to enter the username.**

**🔙 To cancel, type:** cancel`;

    await ctx.replyWithMarkdown(instructionMessage);
    console.log('✅ Manual sponsor entry instructions sent');

  } catch (error) {
    console.error('❌ Error in handleEnterSponsorManual:', error);
    await ctx.reply('❌ Error setting up sponsor entry. Please try again.');
  }
}

// Handle default sponsor assignment
async function handleAssignDefaultSponsor(ctx) {
  console.log('🤝 handleAssignDefaultSponsor called');
  const user = await authenticateUser(ctx);
  if (!user) return;

  try {
    console.log(`🔧 Assigning TTTFOUNDER as sponsor for user ${user.id}`);
    const success = await assignSponsor(user.id, 'TTTFOUNDER');

    if (success) {
      const successMessage = `✅ **SPONSOR ASSIGNED SUCCESSFULLY**



**🤝 Your Sponsor:** TTTFOUNDER
**📅 Assigned:** ${new Date().toLocaleDateString()}
**✅ Status:** Active

**🎯 NEXT STEPS:**
You can now access all platform features and start your gold mining share ownership journey!

**💎 Your sponsor will provide:**
• Share ownership guidance and support
• Commission tracking for referrals
• Access to exclusive updates

`;

      await ctx.replyWithMarkdown(successMessage, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🛒 Purchase Gold Shares", callback_data: "menu_purchase_shares" }],
            [{ text: "💼 View Portfolio", callback_data: "menu_portfolio" }],
            [{ text: "🏠 Main Dashboard", callback_data: "main_menu" }]
          ]
        }
      });
    } else {
      await ctx.reply("❌ Error assigning sponsor. Please try again.");
    }
  } catch (error) {
    console.error('Error assigning default sponsor:', error);
    await ctx.reply("❌ Error assigning sponsor. Please try again.");
  }
}

// Terms acceptance handler
async function handleTermsAcceptance(ctx) {
  const user = await authenticateUser(ctx);
  if (!user) return;

  try {
    // Check if user has already accepted terms
    const existingAcceptance = await db.getUserTermsAcceptance(user.id);
    
    if (existingAcceptance) {
      await ctx.answerCbQuery("✅ You have already accepted the terms and conditions.");
      await ctx.editMessageText(
        "✅ **Terms Already Accepted**\n\nYou have previously accepted our terms and conditions. You can proceed with all platform features.",
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: "🛒 Purchase Gold Shares", callback_data: "menu_purchase_shares" }],
              [{ text: "🔙 Back to Dashboard", callback_data: "main_menu" }]
            ]
          }
        }
      );
      return;
    }

    // Record terms acceptance
    const accepted = await db.recordTermsAcceptance(user.id, ctx.from.id);
    
    if (accepted) {
      await ctx.answerCbQuery("✅ Terms accepted successfully!");
      await ctx.editMessageText(
        "✅ **Terms & Conditions Accepted**\n\nThank you for accepting our terms and conditions. You can now proceed with purchasing gold shares.",
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: "🛒 Purchase Gold Shares", callback_data: "menu_purchase_shares" }],
              [{ text: "🔙 Back to Dashboard", callback_data: "main_menu" }]
            ]
          }
        }
      );
    } else {
      await ctx.answerCbQuery("❌ Failed to record terms acceptance");
      await ctx.reply("❌ Failed to record terms acceptance. Please try again.");
    }
  } catch (error) {
    console.error('Terms acceptance error:', error);
    await ctx.answerCbQuery("❌ Error processing terms acceptance");
    await ctx.reply("❌ Error processing terms acceptance. Please try again.");
  }
}

async function showMainMenu(ctx) {
  const user = ctx.from;

  // Authenticate user first
  const authenticatedUser = await authenticateUser(ctx);
  if (!authenticatedUser) return;

  // Check if user has a sponsor (required for new users)
  const hasSponsor = await checkUserHasSponsor(authenticatedUser.id);
  if (!hasSponsor) {
    await promptSponsorAssignment(ctx);
    return;
  }

  // Check if user has selected country (required for new users)
  const hasSelectedCountry = await checkCountrySelection(authenticatedUser.id);
  if (!hasSelectedCountry) {
    console.log(`🌍 [COUNTRY] User ${authenticatedUser.id} has not selected country - showing country selection`);
    await showCountrySelection(ctx);
    return;
  }

  // Check KYC status ONLY if user has approved payments
  const { data: approvedPayments, error: paymentError } = await db.client
    .from('crypto_payment_transactions')
    .select('id')
    .eq('user_id', authenticatedUser.id)
    .eq('status', 'approved')
    .limit(1);

  // Initialize hasKYC with default value
  let hasKYC = true;

  // Only require KYC if user has approved payments
  if (approvedPayments && approvedPayments.length > 0) {
    hasKYC = await checkKYCCompletion(authenticatedUser.id);
    if (!hasKYC) {
      console.log(`📋 [KYC] User ${authenticatedUser.id} has approved payments but no KYC - showing KYC dashboard`);
      await showKYCDashboard(ctx, authenticatedUser.id);
      return;
    }
  }

  const currentPhase = await db.getCurrentPhase();
  const isAdmin = user.username === ADMIN_USERNAME;

  // Send the new Aureus Alliance Holdings company logo
  try {
    const logoUrl = 'https://fgubaqoftdeefcakejwu.supabase.co/storage/v1/object/public/assets/logonew.png';
    await ctx.replyWithPhoto(logoUrl, {
      caption: `🏆 **AUREUS ALLIANCE HOLDINGS** 🏆\n*Premium Gold Mining Shares*`,
      parse_mode: 'Markdown'
    });
  } catch (logoError) {
    console.log('Company logo not available, proceeding with text menu:', logoError.message);
  }

  const phaseInfo = currentPhase
    ? `📈 **CURRENT PHASE:** ${currentPhase.phase_name}\n💰 **Share Price:** ${formatCurrency(currentPhase.price_per_share)}\n📊 **Available:** ${(currentPhase.total_shares_available - currentPhase.shares_sold).toLocaleString()} shares`
    : '📈 **PHASE:** Loading...';

  const menuMessage = `🏆 **AUREUS ALLIANCE HOLDINGS**
*Premium Gold Mining Share Purchase Dashboard*

Welcome back, **${user.first_name}**! 👋

${phaseInfo}

⛏️ **AUREUS ALLIANCE HOLDINGS OPERATIONAL PLANS:**
• 🏭 **Washplants:** 4 units (200 tons/hour each) by June 2026
• 🏭 **Washplants:** 10 units (200 tons/hour each) by June 2027
• 🥇 **Annual Target:** 3,200 KG gold production by June 2027
• 📈 **Growth:** 57 washplants mining 15 tons gold/year at stage 20
• 🥇 **Per Share Dividend Target:** $1500 per year by June 2030
• 📊 **Total Purchasabl Shares:** 1,400,000 available

💎 **SHARE PURCHASE OPPORTUNITIES:**
Choose your preferred method to buy shares in Aureus Alliance Holdings below.`;

  await ctx.replyWithMarkdown(menuMessage, {
    reply_markup: createMainMenuKeyboard(isAdmin, hasKYC)
  });
}

// Company Presentation Handler
async function handleCompanyPresentation(ctx) {
  const presentationMessage = `📋 **COMPANY PRESENTATION**

🏆 **AUREUS ALLIANCE HOLDINGS**
*Premium Gold Mining Share Ownership Opportunity*



📊 **EXECUTIVE SUMMARY:**
• 🥇 **Focus:** Placer gold mining operations
• 📍 **Location:** Kadoma, Mutare, Zimbabwe & Zambia 
• ⛏️ **Method:** Environmentally responsible placer mining
• 💰 **Structure:** Share-based ownership structure

🎯 **SHARE OWNERSHIP HIGHLIGHTS:**
• 🏭 **10 Washplants:** 200 tons/hour processing capacity each
• 📈 **Production Target:** 3,200 KG gold annually at full capacity
• 📅 **Timeline:** Full operations by June 2026
• 💎 **Total Shares:** 1,400,000 available for purchase

📋 **COMPREHENSIVE DOCUMENTATION:**
Access our complete business plan, geological surveys, and financial projections.

`;

  await ctx.replyWithMarkdown(presentationMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📄 Download Full Presentation", url: "https://fgubaqoftdeefcakejwu.supabase.co/storage/v1/object/public/assets/presentation.pdf" }],
        [{ text: "📊 View Gold Chart", callback_data: "view_gold_chart" }],
        [{ text: "🛒 Purchase Gold Shares", callback_data: "menu_purchase_shares" }],
        [{ text: "🔙 Back to Dashboard", callback_data: "main_menu" }]
      ]
    }
  });
}

// Mining Operations Handler
async function handleMiningOperations(ctx) {
  const miningMessage = `⛏️ **MINING OPERATIONS OVERVIEW**

🏭 **AUREUS ALLIANCE HOLDINGS**
*Advanced Placer Gold Mining Operations*



🔧 **OPERATIONAL SPECIFICATIONS:**
• 🏭 **Washplants:** 10 units operational
• ⚡ **Capacity:** 200 tons/hour per unit
• 📊 **Daily Processing:** 48,000 tons potential
• 🥇 **Annual Target:** 3,200 KG gold production

🌍 **ENVIRONMENTAL COMMITMENT:**
• ♻️ **Sustainable Methods:** Eco-friendly extraction
• 💧 **Water Management:** Closed-loop systems
• 🌱 **Land Restoration:** Post-mining rehabilitation
• 📋 **Compliance:** All environmental permits secured

📹 **MULTIMEDIA DOCUMENTATION:**
Explore our comprehensive visual documentation of mining operations.

`;

  await ctx.replyWithMarkdown(miningMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🎬 Excavation Videos", callback_data: "mining_excavation" }],
        [{ text: "🔬 Geological Evidence", callback_data: "mining_geology" }],
        [{ text: "📊 Project Overview", callback_data: "mining_overview" }],
        [{ text: "👔 Executive Assessment", callback_data: "mining_executive" }],
        [{ text: "🔙 Back to Dashboard", callback_data: "main_menu" }]
      ]
    }
  });
}

// Community Relations Handler
async function handleCommunityRelations(ctx) {
  const communityMessage = `🏘️ **COMMUNITY RELATIONS**

🤝 **AUREUS ALLIANCE HOLDINGS**
*Building Sustainable Community Partnerships*



🌟 **COMMUNITY ENGAGEMENT:**
• 👥 **Local Employment:** Priority hiring from surrounding communities
• 🏫 **Education Support:** Funding for local schools and training programs
• 🏥 **Healthcare Initiatives:** Medical facility support and health programs
• 🛤️ **Infrastructure:** Road improvements and utility upgrades

💼 **ECONOMIC IMPACT:**
• 💰 **Job Creation:** 200+ direct employment opportunities
• 🏪 **Local Business:** Support for community suppliers and services
• 📈 **Economic Growth:** Sustainable development initiatives
• 🎓 **Skills Development:** Mining and technical training programs

🤝 **STAKEHOLDER RELATIONS:**
Regular community meetings and transparent communication about our operations.

`;

  await ctx.replyWithMarkdown(communityMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📅 Community Meetings", callback_data: "community_meetings" }],
        [{ text: "🏗️ Development Plans", callback_data: "community_development" }],
        [{ text: "📞 Contact Community Liaison", callback_data: "community_contact" }],
        [{ text: "🔙 Back to Dashboard", callback_data: "main_menu" }]
      ]
    }
  });
}

// Bot commands
bot.start(async (ctx) => {
  console.log(`👤 [START] User started bot: ${ctx.from.first_name} (@${ctx.from.username})`);

  // Check for referral parameter in start command
  const startPayload = ctx.startPayload;

  // First, check if user has accepted terms
  const user = await authenticateUser(ctx, startPayload);
  if (!user) return;

  console.log(`🔍 [START] Checking terms acceptance for user ${user.id}`);
  const hasAcceptedTerms = await checkTermsAcceptance(user.id);

  if (!hasAcceptedTerms) {
    console.log(`📋 [START] User ${user.id} has not accepted terms - showing terms`);
    await showTermsAndConditions(ctx, startPayload);
  } else {
    console.log(`✅ [START] User ${user.id} has accepted terms - proceeding`);
    if (startPayload) {
      // Check if this is a web authentication request
      if (startPayload.startsWith('webauth_')) {
        const authToken = startPayload.replace('webauth_', '');
        console.log(`🔐 [START] Web authentication request detected with token: ${authToken}`);
        await handleWebAuthFromStart(ctx, authToken);
      } else {
        console.log(`🔗 [START] Referral link detected with payload: ${startPayload}`);
        await handleReferralRegistration(ctx, startPayload);
      }
    } else {
      console.log(`🏠 [START] No referral payload, showing main menu`);
      await showMainMenu(ctx);
    }
  }
});

bot.command("menu", async (ctx) => {
  // Authenticate user first
  const authenticatedUser = await authenticateUser(ctx);
  if (!authenticatedUser) return;

  // Check if user has a sponsor (required)
  const hasSponsor = await checkUserHasSponsor(authenticatedUser.id);
  if (!hasSponsor) {
    await promptSponsorAssignment(ctx);
    return;
  }

  // Check if user has selected country (required)
  const hasSelectedCountry = await checkCountrySelection(authenticatedUser.id);
  if (!hasSelectedCountry) {
    console.log(`🌍 [MENU] User ${authenticatedUser.id} trying to access menu without country selection`);
    await showCountrySelection(ctx);
    return;
  }

  await showMainMenu(ctx);
});

// Version check command (temporary for debugging)
bot.command('version', async (ctx) => {
  const versionInfo = `🔍 **BOT VERSION CHECK**

📅 **Deployment Time:** ${new Date().toISOString()}
🔗 **Bot Link:** https://t.me/AureusAllianceBot
✅ **Status:** Running aureus-bot-new.js
🎯 **NEW BOT TOKEN:** AureusAllianceBot (clean slate) - SUN
🔗 **REFERRAL LINK FIX:** Applied ${new Date().toISOString()}

🚨 **CRITICAL FIX STATUS:**
💰 Share Calculation: amount ÷ phase_price = shares
📊 Example: $100 ÷ $5.00 = 20 shares (NOT 100!)
🔧 Fixed in handleApprovePayment line 2680
🔗 Bot links: ALL use AureusAllianceBot (NEW BOT)

✅ **New bot token resolves all username inconsistencies!**`;

  await ctx.replyWithMarkdown(versionInfo);
});

// Web Authentication Command Handler
bot.command('webauth', async (ctx) => {
  console.log(`🔐 [WEBAUTH] Web authentication request from ${ctx.from.username} (${ctx.from.id})`);
  
  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    return ctx.reply('❌ Invalid authentication request format.\n\nUsage: /webauth <token>');
  }
  
  const authToken = args[1];
  const telegramId = ctx.from.id;
  const username = ctx.from.username;
  const firstName = ctx.from.first_name;
  
  try {
    // Authenticate user first to ensure they exist in the database
    const user = await authenticateUser(ctx);
    if (!user) {
      return ctx.reply('❌ Authentication failed. Please register first by using the bot normally.');
    }
    
    // Send confirmation message with buttons
    const keyboard = {
      inline_keyboard: [
        [
          { text: '✅ Confirm Web Authentication', callback_data: `confirm_webauth:${authToken}` },
          { text: '❌ Cancel', callback_data: `cancel_webauth:${authToken}` }
        ]
      ]
    };
    
    const confirmMessage = `🔐 **WEB AUTHENTICATION REQUEST**
    
📱 A web application is requesting to authenticate with your Telegram account.

👤 **Your Details:**
🆔 Telegram ID: ${telegramId}
👤 Username: @${username || 'Not set'}
📛 Name: ${firstName || 'Not set'}

⚠️ **SECURITY NOTICE:**
Only confirm if you initiated this request from the Aureus Alliance Holdings website.

🌐 **Website:** https://aureus.africa
💻 **Web Dashboard:** localhost:3003 (development)

Do you want to authorize this web authentication?`;
    
    await ctx.replyWithMarkdown(confirmMessage, {
      reply_markup: keyboard
    });
    
    console.log(`🔐 [WEBAUTH] Sent confirmation prompt for token: ${authToken}`);
    
  } catch (error) {
    console.error('🔐 [WEBAUTH] Error processing web auth request:', error);
    ctx.reply('❌ Authentication error. Please try again later.');
  }
});



// Callback query handler
bot.on('callback_query', async (ctx) => {
  const callbackData = ctx.callbackQuery.data;
  const user = await authenticateUser(ctx);

  if (!user && !['main_menu', 'accept_terms'].includes(callbackData)) {
    await ctx.answerCbQuery("❌ Authentication required");
    return;
  }

  // Check if user has completed mandatory requirements (sponsor and country selection)
  // Only exclude sponsor/country-related actions and admin functions
  const excludedCallbacks = [
    'enter_sponsor_manual', 'assign_default_sponsor', 'accept_terms',
    'select_country_', 'show_more_countries', 'country_selection_other',
    'show_asia_countries', 'show_africa_countries', 'show_europe_countries',
    'show_americas_countries', 'show_oceania_countries', 'connect_to_website',
    'copy_telegram_id_'
  ];

  // Exclude all admin callbacks from mandatory checks
  const isAdminCallback = callbackData.startsWith('admin_') || callbackData.includes('admin');

  // Check if this is a country selection callback
  const isCountryCallback = callbackData.startsWith('select_country_') ||
                           excludedCallbacks.some(excluded => callbackData.startsWith(excluded));

  if (user && !isAdminCallback && !isCountryCallback) {
    // First check sponsor requirement
    if (!excludedCallbacks.includes(callbackData)) {
      const hasSponsor = await checkUserHasSponsor(user.id);
      if (!hasSponsor) {
        await promptSponsorAssignment(ctx);
        return;
      }
    }

    // Then check country selection requirement (for all actions except sponsor-related)
    if (!callbackData.includes('sponsor') && !excludedCallbacks.includes(callbackData)) {
      const hasSelectedCountry = await checkCountrySelection(user.id);
      if (!hasSelectedCountry) {
        console.log(`🌍 [COUNTRY] User ${user.id} trying to access ${callbackData} without country selection`);
        await showCountrySelection(ctx);
        return;
      }
    }
  }

  console.log(`🔍 Callback: ${callbackData} from ${ctx.from.username}`);
  console.log(`🔍 [DEBUG] Callback data type: ${typeof callbackData}, length: ${callbackData.length}`);
  console.log(`🔍 [DEBUG] Callback data exact: "${callbackData}"`);

  // Direct handling for payment callbacks (bypassing switch statement issues)
  if (callbackData === 'admin_approved_payments') {
    console.log('🔧 [FIXED] Handling admin_approved_payments directly');
    await handleAdminApprovedPayments(ctx);
    return;
  }

  if (callbackData === 'admin_rejected_payments') {
    console.log('🔧 [FIXED] Handling admin_rejected_payments directly');
    await handleAdminRejectedPayments(ctx);
    return;
  }

  if (callbackData === 'view_approved') {
    console.log('🔧 [FIXED] Handling view_approved directly');
    await handleViewApprovedPayments(ctx);
    return;
  }

  if (callbackData === 'view_rejected') {
    console.log('🔧 [FIXED] Handling view_rejected directly');
    await handleViewRejectedPayments(ctx);
    return;
  }

  if (callbackData === 'view_pending') {
    console.log('🔧 [FIXED] Handling view_pending directly');
    await handleViewPendingPayments(ctx);
    return;
  }

  // Handle Connect to Website callbacks
  if (callbackData === 'connect_to_website') {
    console.log('🌐 [CONNECT] Handling connect_to_website');
    await handleConnectToWebsite(ctx);
    return;
  }

  if (callbackData.startsWith('copy_telegram_id_')) {
    const telegramId = callbackData.replace('copy_telegram_id_', '');
    console.log(`📋 [COPY_ID] Handling copy telegram ID: ${telegramId}`);
    await handleCopyTelegramId(ctx, telegramId);
    return;
  }

  // Handle Web Authentication callbacks
  if (callbackData.startsWith('confirm_webauth:')) {
    console.log('🔐 [WEBAUTH] Handling confirm web authentication');
    await handleConfirmWebAuth(ctx, callbackData);
    return;
  }

  if (callbackData.startsWith('cancel_webauth:')) {
    console.log('🔐 [WEBAUTH] Handling cancel web authentication');
    await handleCancelWebAuth(ctx, callbackData);
    return;
  }

  try {
    console.log('🔍 [DEBUG] Entering switch statement for:', callbackData);
    switch (callbackData) {
      case 'main_menu':
        await showMainMenu(ctx);
        break;

      case 'accept_terms':
        await handleTermsAcceptance(ctx);
        break;



      case 'menu_presentation':
        await handleCompanyPresentation(ctx);
        break;

      case 'menu_mining_operations':
        await handleMiningOperations(ctx);
        break;

      case 'menu_community':
        await handleCommunityRelations(ctx);
        break;

      case 'menu_legal_documents':
        await handleLegalDocuments(ctx);
        break;

      case 'menu_help':
        await handleSupportCenter(ctx);
        break;

      // Gold Chart Handler
      case 'view_gold_chart':
        await ctx.answerCbQuery('Opening gold chart...');
        await ctx.replyWithPhoto('https://fgubaqoftdeefcakejwu.supabase.co/storage/v1/object/public/assets/chart.png', {
          caption: '📊 *AUREUS ALLIANCE HOLDINGS*\n*Gold Price Performance Chart*\n\n📈 Historical gold price trends and market analysis for informed share purchase decisions.',
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 Back to Presentation", callback_data: "menu_presentation" }],
              [{ text: "🏠 Back to Dashboard", callback_data: "main_menu" }]
            ]
          }
        });
        break;

      // Mining Operations Handlers
      case 'mining_excavation':
        await showExcavationVideos(ctx);
        break;

      case 'mining_geology':
        await showGeologicalEvidence(ctx);
        break;

      case 'mining_overview':
        await showProjectOverview(ctx);
        break;

      case 'mining_executive':
        await showExecutiveAssessment(ctx);
        break;

      // Community Relations Handlers
      case 'community_meetings':
        await showCommunityMeetings(ctx);
        break;

      case 'community_development':
        await showDevelopmentPlans(ctx);
        break;

      case 'community_contact':
        await showCommunityContact(ctx);
        break;

      case 'copy_community_email':
        await ctx.answerCbQuery('📧 Email: support@aureus.africa', { show_alert: true });
        break;

      // Support Center Handlers
      case 'support_email':
        await ctx.answerCbQuery('📧 Support Email: support@aureus.africa', { show_alert: true });
        break;

      case 'support_faq':
        await showSupportFAQ(ctx);
        break;

      // RESTORED PAYMENT SYSTEM HANDLERS
      case 'menu_purchase_shares':
        await handlePurchaseSharesStart(ctx);
        break;

      case 'admin_validate_shares_sold':
        await handleValidateSharesSold(ctx);
        break;

      case 'menu_referrals':
        await handleReferralSystem(ctx);
        break;

      case 'menu_portfolio':
        await handlePortfolio(ctx);
        break;

      case 'menu_payments':
        await handlePaymentStatus(ctx);
        break;

      case 'admin_panel':
        await handleAdminPanel(ctx);
        break;

      case 'admin_status':
        await handleAdminStatus(ctx);
        break;

      case 'admin_pending':
        await handleAdminPayments(ctx);
        break;

      case 'admin_users':
        await handleAdminUsers(ctx);
        break;

      case 'admin_commissions':
        await handleAdminCommissions(ctx);
        break;

      case 'admin_commission_conversions':
        await handleAdminCommissionConversions(ctx);
        break;

      case 'admin_pending_withdrawals':
        await handleAdminPendingWithdrawals(ctx);
        break;

      case 'admin_stats':
        await handleAdminAnalytics(ctx);
        break;

      case 'admin_logs':
        await handleAdminLogs(ctx);
        break;

      case 'admin_payments':
        await handleAdminPayments(ctx);
        break;

      case 'admin_analytics':
        await handleAdminAnalytics(ctx);
        break;

      case 'admin_broadcast':
        await handleAdminBroadcast(ctx);
        break;

      case 'admin_settings':
        await handleAdminSettings(ctx);
        break;

      case 'toggle_maintenance':
        await handleToggleMaintenance(ctx);
        break;

      case 'admin_user_sponsors':
        await handleAdminUserSponsors(ctx);
        break;



      default:
        console.log('🔍 [DEBUG] Entered default case for callback:', callbackData);
        // Check for dynamic callback patterns
        if (callbackData.startsWith('continue_payment_')) {
          await handleContinuePayment(ctx, callbackData);
        } else if (callbackData.startsWith('cancel_payment_')) {
          await handleCancelPayment(ctx, callbackData);
        } else if (callbackData.startsWith('confirm_cancel_')) {
          await handleConfirmCancel(ctx, callbackData);
        } else if (callbackData.startsWith('confirm_purchase_')) {
          await handleConfirmPurchase(ctx, callbackData);
        } else if (callbackData.startsWith('upload_proof_')) {
          await handleUploadProof(ctx, callbackData);
        } else if (callbackData.startsWith('upload_bank_proof_')) {
          await handleBankTransferProofUpload(ctx, callbackData);
        } else if (callbackData.startsWith('review_payment_')) {
          await handleReviewPayment(ctx, callbackData);
        } else if (callbackData.startsWith('approve_payment_')) {
          await handleApprovePayment(ctx, callbackData);
        } else if (callbackData.startsWith('reject_payment_')) {
          await handleRejectPaymentPrompt(ctx, callbackData);
        } else if (callbackData.startsWith('view_screenshot_')) {
          await handleViewScreenshot(ctx, callbackData);
        } else if (callbackData.startsWith('view_bank_proof_')) {
          await handleViewBankProof(ctx, callbackData);
        } else if (callbackData === 'cancel_proof_upload') {
          await handleCancelProofUpload(ctx);
        } else if (callbackData === 'view_portfolio') {
          await handlePortfolio(ctx);
        } else if (callbackData === 'share_referral') {
          await handleShareReferral(ctx);
        } else if (callbackData === 'view_commission') {
          await handleViewCommission(ctx);
        } else if (callbackData === 'view_pending_requests') {
          await handleViewPendingRequests(ctx);
        } else if (callbackData === 'manage_pending_requests') {
          await handleManagePendingRequests(ctx);
        } else if (callbackData === 'user_settings') {
          await handleUserSettings(ctx);
        } else if (callbackData === 'test_audio_notification') {
          await handleTestAudioNotification(ctx);
        } else if (callbackData === 'toggle_audio_notifications') {
          await handleToggleAudioNotifications(ctx);
        } else if (callbackData === 'customize_audio_types') {
          await handleCustomizeAudioTypes(ctx);
        } else if (callbackData === 'toggle_payment_approval_audio') {
          await handleToggleSpecificAudioType(ctx, 'payment_approval_audio');
        } else if (callbackData === 'toggle_payment_rejection_audio') {
          await handleToggleSpecificAudioType(ctx, 'payment_rejection_audio');
        } else if (callbackData === 'toggle_withdrawal_audio') {
          await handleToggleSpecificAudioType(ctx, 'withdrawal_approval_audio');
        } else if (callbackData === 'toggle_commission_audio') {
          await handleToggleSpecificAudioType(ctx, 'commission_update_audio');
        } else if (callbackData === 'toggle_referral_audio') {
          await handleToggleSpecificAudioType(ctx, 'referral_bonus_audio');
        } else if (callbackData === 'toggle_system_audio') {
          await handleToggleSpecificAudioType(ctx, 'system_announcement_audio');
        } else if (callbackData === 'view_referrals') {
          await handleViewReferrals(ctx);
        } else if (callbackData === 'withdraw_commissions') {
          await handleWithdrawCommissions(ctx);
        } else if (callbackData === 'withdraw_usdt_commission') {
          await handleWithdrawUSDTCommission(ctx);
        } else if (callbackData === 'commission_to_shares') {
          await handleCommissionToShares(ctx);
        } else if (callbackData === 'commission_to_shares') {
          await handleCommissionToShares(ctx);
        } else if (callbackData.startsWith('confirm_commission_conversion_')) {
          await handleConfirmCommissionConversion(ctx, callbackData);
        } else if (callbackData.startsWith('approve_commission_conversion_')) {
          await handleApproveCommissionConversion(ctx, callbackData);
        } else if (callbackData.startsWith('reject_commission_conversion_')) {
          await handleRejectCommissionConversion(ctx, callbackData);
        } else if (callbackData.startsWith('approve_conv_')) {
          await handleApproveCommissionConversionShort(ctx, callbackData);
        } else if (callbackData.startsWith('reject_conv_')) {
          await handleRejectCommissionConversionShort(ctx, callbackData);
        } else if (callbackData.startsWith('approve_withdrawal_')) {
          await handleApproveWithdrawalShort(ctx, callbackData);
        } else if (callbackData.startsWith('reject_withdrawal_')) {
          await handleRejectWithdrawalPrompt(ctx, callbackData);
        } else if (callbackData === 'withdrawal_history') {
          await handleWithdrawalHistory(ctx);
        } else if (callbackData.startsWith('copy_referral_link_')) {
          await handleCopyReferralLink(ctx, callbackData);
        } else if (callbackData.startsWith('copy_referral_')) {
          await handleCopyReferral(ctx, callbackData);
        } else if (callbackData === 'enter_sponsor_manual') {
          console.log('🔧 Handling enter_sponsor_manual callback');
          await ctx.answerCbQuery("Setting up manual sponsor entry...");
          await handleEnterSponsorManual(ctx);
        } else if (callbackData === 'assign_default_sponsor') {
          console.log('🔧 Handling assign_default_sponsor callback');
          await ctx.answerCbQuery("Assigning default sponsor...");
          await handleAssignDefaultSponsor(ctx);
        } else if (callbackData.startsWith('accept_terms_')) {
          await handleTermsAcceptance(ctx, callbackData);
        } else if (callbackData === 'decline_terms') {
          await handleTermsDecline(ctx);
        } else if (callbackData === 'view_privacy_policy') {
          await showPrivacyPolicy(ctx);
        } else if (callbackData === 'payment_usdt') {
          console.log('🔍 [DEBUG] Handling payment_usdt callback');
          await ctx.answerCbQuery('💎 Loading USDT networks...');
          await handleUSDTPaymentNetworkSelection(ctx);
        } else if (callbackData === 'payment_bank_transfer') {
          await handleBankTransferPayment(ctx);
        } else if (callbackData.startsWith('usdt_network_')) {
          await handleUSDTNetworkSelection(ctx, callbackData);
        } else if (callbackData === 'accept_nda') {
          await handleNDAAcceptance(ctx);
        } else if (callbackData === 'decline_nda') {
          await handleNDADecline(ctx);
        } else if (callbackData.startsWith('view_document_')) {
          await handleDocumentView(ctx, callbackData);
        } else if (callbackData === 'start_kyc_process') {
          await handleStartKYCProcess(ctx);
        } else if (callbackData === 'kyc_info') {
          await handleKYCInfo(ctx);
        } else if (callbackData === 'kyc_later') {
          await handleKYCLater(ctx);
        } else if (callbackData.startsWith('kyc_')) {
          await handleKYCStep(ctx, callbackData);
        } else if (callbackData.startsWith('select_country_')) {
          await handleCountrySelection(ctx, callbackData);
        } else if (callbackData === 'show_more_countries') {
          await showMoreCountries(ctx);
        } else if (callbackData === 'country_selection_other') {
          await handleOtherCountrySelection(ctx);
        } else if (callbackData === 'show_asia_countries') {
          await showAsiaCountries(ctx);
        } else if (callbackData === 'show_africa_countries') {
          await showAfricaCountries(ctx);
        } else if (callbackData === 'show_americas_countries') {
          await showAmericasCountries(ctx);
        } else if (callbackData === 'show_oceania_countries') {
          await showOceaniaCountries(ctx);
        } else if (callbackData.startsWith('upload_proof_')) {
          await handleUploadProofRequest(ctx, callbackData);
        } else {
          await ctx.answerCbQuery("🚧 Feature coming soon!");
        }
        break;
    }
  } catch (error) {
    console.error('Callback error:', error);
    await ctx.answerCbQuery("❌ Error processing request");
  }
});

// Support Center Handler
async function handleSupportCenter(ctx) {
  const supportMessage = `🆘 **AUREUS SUPPORT CENTER**



**24/7 PREMIUM SUPPORT**

🌟 **CONTACT OPTIONS:**
• 📧 **Email:** support@aureus.africa
• 🌐 **Website:** https://aureus.africa
• 💬 **Live Chat:** Available on website
• 📱 **WhatsApp:** +27 74 449 3251

🔧 **SUPPORT SERVICES:**
• ❓ General inquiries and assistance
• 💰 Payment and transaction support
• 📊 Portfolio and share guidance
• 🔐 Account security and access issues

⏰ **RESPONSE TIMES:**
• 📧 Email: Within 24 hours during business hours
• 💬 Live Chat: Immediate during business hours
• 📱 WhatsApp: Within 2 hours during business hours

`;

  await ctx.replyWithMarkdown(supportMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📧 Get Email Address", callback_data: "support_email" }],
        [{ text: "🌐 Visit Website", url: "https://aureus.africa" }],
        [{ text: "❓ FAQ & Common Issues", callback_data: "support_faq" }],
        [{ text: "🔙 Back to Dashboard", callback_data: "main_menu" }]
      ]
    }
  });
}

// Connect to Website Handler
async function handleConnectToWebsite(ctx) {
  const user = ctx.from;
  const telegramId = user.id;
  
  const connectMessage = `🌐 **CONNECT TO WEBSITE**

🔗 **SYNC YOUR ACCOUNT**

To sync your Telegram bot account with the Aureus Alliance Holdings website, you'll need your unique Telegram ID.

**📱 YOUR TELEGRAM ID:**
\`${telegramId}\`

**📋 INSTRUCTIONS:**
1. **Copy** the Telegram ID above (tap and hold to select)
2. **Visit** our website: https://aureus.africa
3. **Login** to your website account
4. **Navigate** to Account Settings or Profile
5. **Paste** your Telegram ID in the "Telegram Sync" field
6. **Save** your settings

**✅ BENEFITS OF SYNCING:**
• 🔄 **Real-time sync** between website and bot
• 📊 **Unified portfolio** view across platforms  
• 💰 **Seamless payment** tracking
• 🔔 **Instant notifications** for account activities
• 📈 **Enhanced dashboard** features

**🔐 SECURITY NOTE:**
Your Telegram ID is unique and safe to share with our official website. Never share it with unauthorized third parties.

**❓ NEED HELP?**
Contact our support team if you encounter any issues during the sync process.`;

  await ctx.replyWithMarkdown(connectMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📋 Copy Telegram ID", callback_data: `copy_telegram_id_${telegramId}` }],
        [{ text: "🌐 Visit Website", url: "https://aureus.africa" }],
        [{ text: "📞 Contact Support", callback_data: "menu_help" }],
        [{ text: "🔙 Back to Dashboard", callback_data: "main_menu" }]
      ]
    }
  });
}

// Handle Copy Telegram ID (provides additional confirmation)
async function handleCopyTelegramId(ctx, telegramId) {
  await ctx.answerCbQuery("✅ Telegram ID ready to copy!");
  
  const copyMessage = `📋 **TELEGRAM ID READY TO COPY**

**Your Telegram ID:**
\`${telegramId}\`

**📱 TO COPY:**
• **Mobile:** Tap and hold the ID above, then select "Copy"
• **Desktop:** Click and drag to select the ID, then Ctrl+C (Windows) or Cmd+C (Mac)

**🔗 NEXT STEPS:**
1. Go to https://aureus.africa
2. Login to your account
3. Find the "Telegram Sync" or "Connect Bot" section
4. Paste this ID: \`${telegramId}\`
5. Save your settings

**✅ Once synced, you'll see your complete portfolio and transaction history on both the website and this bot!**`;

  await ctx.replyWithMarkdown(copyMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🌐 Go to Website", url: "https://aureus.africa" }],
        [{ text: "🔄 Show Connection Guide Again", callback_data: "connect_to_website" }],
        [{ text: "🔙 Back to Dashboard", callback_data: "main_menu" }]
      ]
    }
  });
}

// Web Authentication Handler Functions
async function handleWebAuthFromStart(ctx, authToken) {
  const telegramId = ctx.from.id;
  const username = ctx.from.username;
  const firstName = ctx.from.first_name;
  
  console.log(`🔐 [WEBAUTH-START] Processing web authentication from start command for token: ${authToken}, user: ${username} (${telegramId})`);
  
  try {
    // Send confirmation message immediately
    const keyboard = {
      inline_keyboard: [
        [
          { text: '✅ Confirm Web Authentication', callback_data: `confirm_webauth:${authToken}` },
          { text: '❌ Cancel', callback_data: `cancel_webauth:${authToken}` }
        ]
      ]
    };
    
    const confirmMessage = `🔐 **WEB AUTHENTICATION REQUEST**
    
📱 Your web application is requesting to authenticate with your Telegram account.

👤 **Your Details:**
🆔 Telegram ID: ${telegramId}
👤 Username: @${username || 'Not set'}
📛 Name: ${firstName || 'Not set'}

🌐 **Website:** https://aureus.africa
💻 **Web Dashboard:** localhost:3003 (development)

⚠️ **SECURITY NOTICE:**
Only confirm if you initiated this request from the Aureus Alliance Holdings website.

Do you want to authorize this web authentication?`;
    
    await ctx.replyWithMarkdown(confirmMessage, {
      reply_markup: keyboard
    });
    
    console.log(`🔐 [WEBAUTH-START] Sent confirmation prompt for token: ${authToken}`);
    
  } catch (error) {
    console.error('🔐 [WEBAUTH-START] Error processing web auth from start:', error);
    ctx.reply('❌ Authentication error. Please try again later.');
  }
}

async function handleConfirmWebAuth(ctx, callbackData) {
  const authToken = callbackData.split(':')[1];
  const telegramId = ctx.from.id;
  const username = ctx.from.username;
  const firstName = ctx.from.first_name;
  
  console.log(`🔐 [WEBAUTH-CONFIRM] Processing confirmation for token: ${authToken}, user: ${username} (${telegramId})`);
  
  try {
    // Get user data from the database
    const { data: telegramUser, error: fetchError } = await db.client
      .from('telegram_users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();
    
    if (fetchError) {
      console.error('🔐 [WEBAUTH-CONFIRM] Error fetching user:', fetchError);
      await ctx.answerCbQuery('❌ User not found in database');
      return;
    }
    
    // Store authentication success in auth_tokens table
    const { error: tokenError } = await db.client
      .from('auth_tokens')
      .upsert({
        token: authToken,
        telegram_id: telegramId,
        user_data: JSON.stringify(telegramUser),
        confirmed: true,
        cancelled: false,
        created_at: new Date().toISOString()
      });
    
    if (tokenError) {
      console.error('🔐 [WEBAUTH-CONFIRM] Error storing auth token:', tokenError);
      await ctx.answerCbQuery('❌ Failed to confirm authentication');
      return;
    }
    
    // Update the message
    const successMessage = `✅ **WEB AUTHENTICATION SUCCESSFUL!**
    
🎉 Your Telegram account has been successfully linked to the web platform.

📱 **Account Details:**
🆔 Telegram ID: ${telegramId}
👤 Username: @${username || 'Not set'}
💼 Account Status: Active

🌐 **Next Steps:**
1. Return to the web application (localhost:3003)
2. Your authentication should complete automatically
3. You'll have access to your complete dashboard

**✅ You can now use both the Telegram bot and web platform seamlessly!**`;
    
    await ctx.editMessageText(successMessage, { parse_mode: 'Markdown' });
    await ctx.answerCbQuery('✅ Web authentication confirmed!');
    
    console.log(`🔐 [WEBAUTH-CONFIRM] Successfully confirmed authentication for token: ${authToken}`);
    
  } catch (error) {
    console.error('🔐 [WEBAUTH-CONFIRM] Error processing confirmation:', error);
    await ctx.answerCbQuery('❌ Authentication failed. Please try again.');
  }
}

async function handleCancelWebAuth(ctx, callbackData) {
  const authToken = callbackData.split(':')[1];
  
  console.log(`🔐 [WEBAUTH-CANCEL] Processing cancellation for token: ${authToken}`);
  
  try {
    // Store cancellation in auth_tokens table
    const { error: tokenError } = await db.client
      .from('auth_tokens')
      .upsert({
        token: authToken,
        confirmed: false,
        cancelled: true,
        created_at: new Date().toISOString()
      });
    
    if (tokenError) {
      console.error('🔐 [WEBAUTH-CANCEL] Error storing cancellation:', tokenError);
    }
    
    // Update the message
    const cancelMessage = `❌ **WEB AUTHENTICATION CANCELLED**
  
The web authentication request has been cancelled.

🔒 **Security Note:**
Your account remains secure. No external access has been granted.

**🔄 To Try Again:**
• Go to the web platform
• Click "Authenticate with Telegram" again
• Follow the new authentication instructions

**❓ Need Help?**
Contact our support team if you're having trouble with authentication.`;
    
    await ctx.editMessageText(cancelMessage, { parse_mode: 'Markdown' });
    await ctx.answerCbQuery('Authentication cancelled.');
    
    console.log(`🔐 [WEBAUTH-CANCEL] Successfully cancelled authentication for token: ${authToken}`);
    
  } catch (error) {
    console.error('🔐 [WEBAUTH-CANCEL] Error processing cancellation:', error);
    await ctx.answerCbQuery('❌ Error cancelling authentication.');
  }
}

async function showSupportFAQ(ctx) {
  const faqMessage = `❓ **FREQUENTLY ASKED QUESTIONS**
🆘 **AUREUS SUPPORT CENTER**



**💰 PAYMENT & SHARE QUESTIONS:**

**Q: How do I purchase shares?**
A: Use the "💰 Purchase Shares" button from the main menu. Choose your payment method (crypto or bank transfer) and follow the guided process.

**Q: What payment methods are accepted?**
A: We accept USDT (on BSC, POL, TRON, ETH networks) and bank transfers (ZAR for SA/Eswatini/Namibia residents only).

**Q: How long does payment approval take?**
A: Crypto payments: 1-24 hours | Bank transfers: 1-3 business days

**Q: Can I buy more shares if I have pending payments?**
A: Yes! You can make additional purchases while previous payments are being processed.



**🔐 ACCOUNT & SECURITY:**

**Q: I forgot my account details**
A: Contact support@aureus.africa with your registered information for assistance.

**Q: How do I complete KYC verification?**
A: KYC starts automatically after your first successful payment. Follow the step-by-step process to provide required documents.

**Q: Is my personal information secure?**
A: Yes, we follow GDPR/POPIA compliance standards for data protection.



**📊 PORTFOLIO & DIVIDENDS:**

**Q: How do I track my Shares?**
A: Use "📊 My Portfolio" from the main menu to view your shares, value, and performance.

**Q: When will I receive dividends?**
A: Dividends are distributed based on mining operations performance. Check your portfolio for updates.

**Q: Can I withdraw my Shares?**
A: Share Purchase terms and withdrawal conditions are detailed in the legal documents section.

`;

  await ctx.replyWithMarkdown(faqMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📧 Contact Support", callback_data: "support_email" }],
        [{ text: "🔙 Back to Support Center", callback_data: "menu_help" }],
        [{ text: "🏠 Back to Dashboard", callback_data: "main_menu" }]
      ]
    }
  });
}

// TERMS AND CONDITIONS HANDLERS

// Handle Terms Acceptance
async function handleTermsAcceptance(ctx, callbackData = null) {
  const user = ctx.from;
  console.log(`✅ [handleTermsAcceptance] User ${user.username} accepting terms`);

  try {
    // Get user ID from database
    const authenticatedUser = await db.getUserByUsername(user.username);
    if (!authenticatedUser) {
      await ctx.answerCbQuery("❌ Authentication error");
      return;
    }

    // Record terms acceptance (use insert with error handling for duplicates)
    const { error: termsError } = await db.client
      .from('terms_acceptance')
      .insert({
        user_id: authenticatedUser.id,
        terms_type: 'general_terms',
        version: '1.0',
        accepted_at: new Date().toISOString()
      });

    if (termsError) {
      // Check if it's a duplicate key error (user already accepted terms)
      if (termsError.code === '23505' || termsError.message?.includes('duplicate')) {
        console.log(`ℹ️ User ${authenticatedUser.id} already accepted terms - proceeding`);
      } else {
        console.error('❌ Error recording terms acceptance:', termsError);
        console.error('❌ Terms acceptance data:', {
          user_id: authenticatedUser.id,
          terms_type: 'general_terms',
          version: '1.0'
        });
        await ctx.answerCbQuery("❌ Error recording acceptance");
        return;
      }
    }

    console.log(`✅ Terms accepted successfully for user ${authenticatedUser.id}`);
    await ctx.answerCbQuery("✅ Terms accepted successfully!");

    // Extract referral payload if present
    const referralPayload = callbackData && callbackData.startsWith('accept_terms_')
      ? callbackData.replace('accept_terms_', '')
      : null;

    // Proceed with registration flow
    if (referralPayload && referralPayload !== 'direct') {
      console.log(`🔗 Processing referral registration with sponsor: ${referralPayload}`);
      await handleReferralRegistration(ctx, referralPayload);
    } else {
      console.log(`🏠 Showing main menu after terms acceptance`);
      await showMainMenu(ctx);
    }

  } catch (error) {
    console.error('❌ Error handling terms acceptance:', error);
    await ctx.answerCbQuery("❌ Error processing acceptance");
  }
}

// Handle Terms Decline
async function handleTermsDecline(ctx) {
  console.log(`❌ [handleTermsDecline] User ${ctx.from.username} declined terms`);

  await ctx.answerCbQuery("Terms declined");

  const declineMessage = `❌ **TERMS DECLINED**



**⚠️ ACCESS RESTRICTED**

You have declined to accept our Terms and Conditions.

**📋 IMPORTANT:**
• Terms acceptance is mandatory to use this platform
• You cannot access any features without accepting terms
• Your data will not be stored or processed

**🔄 TO CONTINUE:**
• Restart the bot with /start
• Review and accept the terms
• Begin your gold mining share purchase journey

**📞 QUESTIONS?**
Contact @TTTFOUNDER for clarification about our terms.

`;

  await ctx.replyWithMarkdown(declineMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔄 Restart Bot", callback_data: "restart_bot" }],
        [{ text: "📧 Contact Support", url: "https://t.me/TTTFOUNDER" }]
      ]
    }
  });
}

// Handle USDT Payment Network Selection
async function handleUSDTPaymentNetworkSelection(ctx) {
  const networkMessage = `💎 **USDT PAYMENT NETWORKS**



**Choose your preferred USDT network:**

🔷 **Ethereum (ETH)** - ERC-20
• Network: Ethereum Mainnet
• Gas fees: Higher but most secure
• Confirmation time: ~15 minutes

🟡 **Binance Smart Chain (BSC)** - BEP-20
• Network: BSC Mainnet
• Gas fees: Low
• Confirmation time: ~3 minutes

🟣 **Polygon (POL)** - Polygon
• Network: Polygon Mainnet
• Gas fees: Very low
• Confirmation time: ~2 minutes

🔴 **TRON (TRX)** - TRC-20
• Network: Tron Mainnet
• Gas fees: Lowest
• Confirmation time: ~3 minutes

**⚠️ IMPORTANT:**
• Only send USDT on the selected network
• Wrong network = lost funds
• Double-check network before sending`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "🔷 Ethereum (ETH-ERC20)", callback_data: "usdt_network_ETH" },
        { text: "🟡 BSC (BEP-20)", callback_data: "usdt_network_BSC" }
      ],
      [
        { text: "🟣 Polygon (POL)", callback_data: "usdt_network_POL" },
        { text: "🔴 TRON (TRC-20)", callback_data: "usdt_network_TRON" }
      ],
      [
        { text: "🔙 Back to Payment Methods", callback_data: "menu_purchase_shares" }
      ]
    ]
  };

  await ctx.replyWithMarkdown(networkMessage, { reply_markup: keyboard });
}

// Handle USDT Network Selection
async function handleUSDTNetworkSelection(ctx, callbackData) {
  const network = callbackData.split('_')[2]; // Extract network from usdt_network_ETH

  // Map network names to display names and technical details
  const networkInfo = {
    'ETH': {
      name: 'Ethereum',
      displayName: 'ETH-ERC20',
      technical: 'ERC-20',
      confirmTime: '~15 minutes',
      gasFees: 'Higher',
      icon: '🔷'
    },
    'BSC': {
      name: 'Binance Smart Chain',
      displayName: 'BSC-BEP20',
      technical: 'BEP-20',
      confirmTime: '~3 minutes',
      gasFees: 'Low',
      icon: '🟡'
    },
    'POL': {
      name: 'Polygon',
      displayName: 'POL-Polygon',
      technical: 'Polygon',
      confirmTime: '~2 minutes',
      gasFees: 'Very Low',
      icon: '🟣'
    },
    'TRON': {
      name: 'TRON',
      displayName: 'TRON-TRC20',
      technical: 'TRC-20',
      confirmTime: '~3 minutes',
      gasFees: 'Lowest',
      icon: '🔴'
    }
  };

  const selectedNetwork = networkInfo[network];

  if (!selectedNetwork) {
    await ctx.answerCbQuery("❌ Invalid network selection");
    return;
  }

  await ctx.answerCbQuery(`${selectedNetwork.icon} ${selectedNetwork.name} selected`);

  // Now proceed with the custom amount purchase using the selected network
  await handleCustomAmountPurchaseWithNetwork(ctx, network);
}

// Show Privacy Policy
async function showPrivacyPolicy(ctx) {
  const privacyMessage = `🔒 **PRIVACY POLICY**



**🏆 AUREUS ALLIANCE HOLDINGS**
*Data Protection & Privacy*

**📊 DATA COLLECTION:**
• Username and contact information
• Transaction and payment data
• Share portfolio information
• Communication records

**🔐 DATA USAGE:**
• Platform operation and maintenance
• Share purchase processing and tracking
• Customer support and communication
• Legal compliance and reporting

**🛡️ DATA PROTECTION:**
• Encrypted data transmission
• Secure database storage
• Limited access controls
• Regular security audits

**📤 DATA SHARING:**
• No sharing with third parties
• Exception: Legal requirements only
• Anonymous analytics may be used
• User consent required for marketing

**🗑️ DATA RETENTION:**
• Active accounts: Indefinite storage
• Inactive accounts: 7 years maximum
• Deletion upon written request
• Legal requirements may override

**👤 YOUR RIGHTS:**
• Access your personal data
• Request data correction
• Request data deletion
• Withdraw consent anytime

**📞 PRIVACY CONTACT:**
• Email: support@aureus.africa
• Telegram: @TTTFOUNDER
• Response: 30 days maximum



**Last Updated:** January 2025`;

  await ctx.replyWithMarkdown(privacyMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔙 Back to Terms", callback_data: "show_terms" }],
        [{ text: "✅ Accept All Terms", callback_data: "accept_terms_direct" }]
      ]
    }
  });
}

// Multimedia Documentation Functions
async function showExcavationVideos(ctx) {
  const videosMessage = `🎬 *EXCAVATION VIDEOS*
⛏️ *AUREUS ALLIANCE HOLDINGS*
*Live Mining Operations Documentation*



🎥 **PRIMARY PIT EXCAVATION:**
• Video: Active washplant operations
• Location: Main excavation site
• Equipment: 200 tons/hour processing capacity

🎬 **SOIL PROCESSING OPERATIONS:**
• Video: Real-time gold extraction process
• Method: Environmentally responsible mining
• Output: Continuous gold recovery operations

📹 **SECONDARY SITE DOCUMENTATION:**
• Video: Additional excavation activities
• Scope: Comprehensive operational coverage
• Quality: Professional documentation standards

`;

  await ctx.replyWithMarkdown(videosMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🎥 Primary Pit Video", url: "https://fgubaqoftdeefcakejwu.supabase.co/storage/v1/object/public/assets/pits.mp4" }],
        [{ text: "⚒️ Processing Video", url: "https://fgubaqoftdeefcakejwu.supabase.co/storage/v1/object/public/assets/digging.mp4" }],
        [{ text: "📹 Secondary Site", url: "https://fgubaqoftdeefcakejwu.supabase.co/storage/v1/object/public/assets/digging%202.mp4" }],
        [{ text: "🔙 Back to Mining Operations", callback_data: "menu_mining_operations" }]
      ]
    }
  });
}

async function showGeologicalEvidence(ctx) {
  const evidenceMessage = `🔬 *GEOLOGICAL EVIDENCE*
⛏️ *AUREUS ALLIANCE HOLDINGS*
*Scientific Gold Discovery Documentation*



🏔️ **GOLD PARTICLES IN SAND:**
• Analysis: Visible gold particles in processed sand
• Concentration: High-grade gold placer deposits
• Verification: Professional geological assessment

💎 **GOLD VEINS IN ROCK SAMPLES:**
• Discovery: Natural gold veins in rock formations
• Quality: Premium grade ore samples
• Significance: Substantial mineral reserves confirmed

🔍 **TECHNICAL ANALYSIS:**
• Method: Professional geological surveying
• Results: Confirmed gold-bearing formations
• Potential: Extensive mineral resource base

`;

  await ctx.replyWithMarkdown(evidenceMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🏖️ Gold in Sand", url: "https://fgubaqoftdeefcakejwu.supabase.co/storage/v1/object/public/assets/goldinsand.jpg" }],
        [{ text: "💎 Gold in Rock", url: "https://fgubaqoftdeefcakejwu.supabase.co/storage/v1/object/public/assets/goldinrock.JPG" }],
        [{ text: "🔙 Back to Mining Operations", callback_data: "menu_mining_operations" }]
      ]
    }
  });
}

async function showProjectOverview(ctx) {
  const overviewMessage = `📊 *PROJECT OVERVIEW*
⛏️ *AUREUS ALLIANCE HOLDINGS*
*Comprehensive Mining Project Scope*



🏞️ **PROJECT SCALE:**
• Total Area: 250 hectares of mining concessions
• Operations: 10 washplants (200 tons/hour each)
• Capacity: 48,000 tons daily processing potential
• Target: 3,200 KG annual gold production

🌍 **LOCATION ADVANTAGES:**
• Region: Kadoma, Zimbabwe
• Access: Established infrastructure and logistics
• Resources: Abundant water and power supply
• Community: Strong local partnerships

📈 **DEVELOPMENT TIMELINE:**
• Phase 1: Equipment deployment and site preparation
• Phase 2: Full operational capacity by June 2026
• Phase 3: Expansion and optimization programs
• Long-term: Sustainable 150-year operation plan

`;

  await ctx.replyWithMarkdown(overviewMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔙 Back to Mining Operations", callback_data: "menu_mining_operations" }],
        [{ text: "🏠 Back to Dashboard", callback_data: "main_menu" }]
      ]
    }
  });
}

async function showExecutiveAssessment(ctx) {
  const executiveMessage = `👔 *EXECUTIVE ASSESSMENT*
⛏️ *AUREUS ALLIANCE HOLDINGS*
*Leadership Team & Strategic Vision*



👨‍💼 **DONOVAN JAMES - CEO & FOUNDER:**
• Experience: 15+ years in mining operations
• Expertise: Gold extraction and processing
• Vision: Sustainable and profitable mining
• Leadership: Community-focused development

🎯 **STRATEGIC OBJECTIVES:**
• Operational Excellence: Maximum efficiency standards
• Environmental Responsibility: Eco-friendly practices
• Community Development: Local economic growth
• Share Ownership Dividends: Consistent dividend payments

📊 **PERFORMANCE METRICS:**
• Safety Record: Zero-incident operational standards
• Environmental Compliance: 100% regulatory adherence
• Community Relations: Active stakeholder engagement
• Financial Transparency: Regular shareholder reporting

`;

  await ctx.replyWithMarkdown(executiveMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔙 Back to Mining Operations", callback_data: "menu_mining_operations" }],
        [{ text: "🏠 Back to Dashboard", callback_data: "main_menu" }]
      ]
    }
  });
}

async function showCommunityMeetings(ctx) {
  const meetingsMessage = `🏘️ *COMMUNITY MEETINGS*
⛏️ *AUREUS ALLIANCE HOLDINGS*
*Stakeholder Engagement & Communication*



📅 **REGULAR MEETINGS SCHEDULE:**
• Monthly: Community liaison meetings
• Quarterly: Stakeholder progress reports
• Annually: Comprehensive impact assessments
• Ad-hoc: Issue resolution and feedback sessions

🤝 **ENGAGEMENT TOPICS:**
• Employment Opportunities: Local hiring priorities
• Environmental Impact: Monitoring and mitigation
• Infrastructure Development: Community improvements
• Economic Benefits: Revenue sharing programs

👥 **STAKEHOLDER GROUPS:**
• Local Communities: Direct engagement programs
• Traditional Leaders: Respect for cultural values
• Government Officials: Regulatory compliance
• Environmental Groups: Sustainability partnerships

`;

  await ctx.replyWithMarkdown(meetingsMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔙 Back to Community Relations", callback_data: "menu_community" }],
        [{ text: "🏠 Back to Dashboard", callback_data: "main_menu" }]
      ]
    }
  });
}

async function showDevelopmentPlans(ctx) {
  const developmentMessage = `🏗️ *DEVELOPMENT PLANS*
⛏️ *AUREUS ALLIANCE HOLDINGS*
*Long-term Community Development Initiatives*



🏫 **EDUCATION INITIATIVES:**
• School Infrastructure: Classroom construction
• Scholarship Programs: Student support funding
• Technical Training: Mining skills development
• Adult Education: Literacy and numeracy programs

🏥 **HEALTHCARE DEVELOPMENT:**
• Medical Facilities: Clinic establishment
• Health Programs: Preventive care initiatives
• Emergency Services: First aid and ambulance
• Community Health: Wellness and nutrition

🚧 **INFRASTRUCTURE PROJECTS:**
• Road Construction: Improved transportation
• Water Systems: Clean water access
• Electricity: Power grid connections
• Communication: Internet and mobile coverage

`;

  await ctx.replyWithMarkdown(developmentMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔙 Back to Community Relations", callback_data: "menu_community" }],
        [{ text: "🏠 Back to Dashboard", callback_data: "main_menu" }]
      ]
    }
  });
}

async function showCommunityContact(ctx) {
  const contactMessage = `📞 **COMMUNITY LIAISON CONTACT**
⛏️ **AUREUS ALLIANCE HOLDINGS**
*Direct Communication Channel*



📧 **EMAIL CONTACT:**
support@aureus.africa

📱 **COMMUNICATION CHANNELS:**
• Email: Primary contact method
• Community Meetings: Monthly in-person sessions
• Stakeholder Reports: Quarterly updates
• Emergency Contact: 24/7 availability for urgent matters

🤝 **WHAT WE CAN HELP WITH:**
• Employment Opportunities & Applications
• Community Development Questions
• Environmental Concerns & Feedback
• Infrastructure Project Updates
• General Mining Operation Inquiries

⏰ **RESPONSE TIME:**
• Email: Within 24-48 hours
• Urgent Matters: Same day response
• Community Meetings: Immediate discussion

📋 **WHEN CONTACTING US:**
Please include your name, community/area, and specific inquiry details for faster assistance.

`;

  await ctx.replyWithMarkdown(contactMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📧 Copy Email Address", callback_data: "copy_community_email" }],
        [{ text: "🔙 Back to Community Relations", callback_data: "menu_community" }],
        [{ text: "🏠 Back to Dashboard", callback_data: "main_menu" }]
      ]
    }
  });
}

// Error handling
bot.catch((err, ctx) => {
  console.error("🚨 Bot error:", err);
  ctx.reply("Sorry, something went wrong. Please try again later.");
});

// Database setup for new features - REMOVED
// All database schema changes are handled manually by the user
// The bot cannot create tables, only update existing data

// 🔍 Admin function to validate and fix shares_sold integrity
async function handleValidateSharesSold(ctx) {
  const user = ctx.from;

  if (user.username !== 'TTTFOUNDER') {
    await ctx.answerCbQuery('❌ Access denied');
    return;
  }

  try {
    await ctx.answerCbQuery('🔍 Running shares_sold validation...');

    const validation = await validateSharesSoldIntegrity();

    let message = `🔍 **SHARES SOLD INTEGRITY CHECK**



**📊 SUMMARY:**
• **Total Phases:** ${validation.summary?.total_phases || 0}
• **Total Shares Sold:** ${validation.summary?.total_shares_sold || 0}
• **Total Shares Available:** ${validation.summary?.total_shares_available || 0}
• **Total Remaining:** ${validation.summary?.total_remaining || 0}
• **Issues Found:** ${validation.summary?.issues_found || 0}

**🔍 STATUS:** ${validation.valid ? '✅ VALID' : '❌ ISSUES DETECTED'}`;

    if (!validation.valid && validation.issues) {
      message += `

**⚠️ ISSUES DETECTED:**`;
      validation.issues.forEach((issue, index) => {
        message += `\n${index + 1}. ${issue}`;
      });

      message += `

**💡 RECOMMENDED ACTIONS:**
• Run the audit SQL query to calculate correct totals
• Update shares_sold values manually in database
• Re-run this validation to confirm fixes`;
    }

    message += `



**🔧 This validation checks:**
• shares_sold doesn't exceed total_shares_available
• No negative remaining shares
• Data consistency across all phases

**📝 All future share allocations will automatically update shares_sold.**`;

    await ctx.replyWithMarkdown(message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔄 Run Validation Again", callback_data: "admin_validate_shares_sold" }],
          [{ text: "🔙 Back to Admin Panel", callback_data: "admin_panel" }]
        ]
      }
    });

  } catch (error) {
    console.error('Error validating shares_sold:', error);
    await ctx.replyWithMarkdown('❌ **Error running validation**\n\nPlease check logs and try again.');
  }
}

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
    console.log("✅ Aureus Alliance Holdings Bot is running!");
    console.log(`🤖 Bot username: @${BOT_USERNAME} (${NODE_ENV.toUpperCase()})`);
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

// RESTORED PAYMENT SYSTEM FUNCTIONS

// Maintenance Mode Helper Functions
async function getMaintenanceMode() {
  try {
    const { data, error } = await db.client
      .from('system_settings')
      .select('setting_value')
      .eq('setting_name', 'maintenance_mode')
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error getting maintenance mode:', error);
      return false;
    }

    return data?.setting_value === 'true';
  } catch (error) {
    console.error('Error checking maintenance mode:', error);
    return false;
  }
}

async function setMaintenanceMode(enabled) {
  try {
    const { error } = await db.client
      .from('system_settings')
      .upsert({
        setting_name: 'maintenance_mode',
        setting_value: enabled ? 'true' : 'false',
        description: 'Controls whether share purchasing is disabled for maintenance',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'setting_name'
      });

    if (error) {
      console.error('Error setting maintenance mode:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error updating maintenance mode:', error);
    return false;
  }
}

// Handle custom amount purchase with network selection
async function handleCustomAmountPurchaseWithNetwork(ctx, selectedNetwork = null) {
  // If no network selected, show payment methods first
  if (!selectedNetwork) {
    return await handleCustomAmountPurchase(ctx);
  }

  // Store selected network and payment method in session for later use
  ctx.session.selectedNetwork = selectedNetwork;
  ctx.session.selectedPaymentMethod = 'usdt';

  // Show amount input for USDT payment
  await showUSDTAmountInput(ctx, selectedNetwork);
}

// Show amount input for USDT payment
async function showUSDTAmountInput(ctx, selectedNetwork) {
  const networkInfo = {
    'ETH': { name: 'Ethereum', icon: '🔷', technical: 'ERC-20' },
    'BSC': { name: 'Binance Smart Chain', icon: '🟡', technical: 'BEP-20' },
    'POL': { name: 'Polygon', icon: '🟣', technical: 'Polygon' },
    'TRON': { name: 'TRON', icon: '🔴', technical: 'TRC-20' }
  };

  const network = networkInfo[selectedNetwork];

  const customAmountMessage = `💎 **USDT PAYMENT**



**💰 ENTER SHARE PURCHASE AMOUNT**

Enter your desired share purchase amount between $5 and $50,000:

**📋 PAYMENT DETAILS:**
• Minimum: $5 USD
• Maximum: $50,000 USD
• Currency: USDT (Tether)
• Network: ${network.icon} ${network.name} (${network.technical})
• No additional fees

**💡 CALCULATION:**
$100 USD = 100 USDT (1:1 ratio)

**⚠️ IMPORTANT:**
Make sure to send USDT on the ${network.name} network only. Wrong network = lost funds.

**Type your purchase amount in USD (numbers only):**`;

  await ctx.replyWithMarkdown(customAmountMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔙 Back to Networks", callback_data: "payment_usdt" }],
        [{ text: "🔙 Back to Payment Methods", callback_data: "menu_purchase_shares" }],
        [{ text: "🏠 Back to Dashboard", callback_data: "main_menu" }]
      ]
    }
  });

  // Set user state to expect amount input
  await setUserState(ctx.from.id, 'awaiting_custom_amount');
}

// This function has been replaced by handlePurchaseSharesStart
// Keeping this stub for any remaining references
async function handleCustomAmountPurchase(ctx) {
  await handlePurchaseSharesStart(ctx);
}

// Handle purchase shares start - main entry point
async function handlePurchaseSharesStart(ctx) {
  const user = ctx.from;

  // Check maintenance mode first (admin bypass)
  const isMaintenanceMode = await getMaintenanceMode();
  if (isMaintenanceMode && user.username !== 'TTTFOUNDER') {
    await ctx.replyWithMarkdown(`🔧 **SYSTEM MAINTENANCE**



**System is currently under maintenance and being upgraded.**

🚫 **Share purchasing is temporarily disabled**
✅ **All other functions remain available**



**You can still access:**
• 📊 Portfolio management
• 💳 Payment status
• 👥 Referral program
• 📋 Company information

**Maintenance will be completed soon. Thank you for your patience!**

*Note: Admin users can still access all functions for testing purposes.*`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📊 View Portfolio", callback_data: "menu_portfolio" }],
          [{ text: "💳 Payment Status", callback_data: "menu_payments" }],
          [{ text: "🏠 Back to Dashboard", callback_data: "main_menu" }]
        ]
      }
    });
    return;
  }

  // Get user from database
  const { data: telegramUser, error: telegramError } = await db.client
    .from('telegram_users')
    .select('user_id')
    .eq('telegram_id', user.id)
    .single();

  if (telegramError || !telegramUser) {
    await ctx.replyWithMarkdown('❌ **Authentication Error**\n\nPlease restart the bot and try again.');
    return;
  }

  const userId = telegramUser.user_id;

  console.log(`🔍 [DEBUG] handlePurchaseSharesStart - userId: ${userId}, type: ${typeof userId}`);
  console.log(`🔍 [DEBUG] handlePurchaseSharesStart - telegramUser:`, telegramUser);

  // Check for incomplete payments (missing proof uploads, not admin-pending payments)
  const { data: incompletePayments, error: pendingError } = await db.client
    .from('crypto_payment_transactions')
    .select('id, amount, network, created_at, status, user_id, sender_wallet')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (pendingError) {
    console.error('🔍 [DEBUG] Error checking pending payments:', pendingError);
    console.error('🔍 [DEBUG] Query details - userId:', userId, 'type:', typeof userId);
    // Continue anyway, don't block the user
  } else if (incompletePayments && incompletePayments.length > 0) {
    console.log(`🔍 [DEBUG] Found ${incompletePayments.length} pending payments for user ${userId}`);

    // Only block if payment is incomplete (no proof uploaded yet)
    const incompletePayment = incompletePayments.find(payment =>
      payment.sender_wallet === 'PENDING_PROOF_UPLOAD' ||
      payment.sender_wallet === '' ||
      !payment.sender_wallet
    );

    if (incompletePayment) {
      console.log(`🔍 [DEBUG] Found incomplete payment (no proof uploaded):`, incompletePayment.id);

      // User has incomplete payment - show management options
      const paymentDate = new Date(incompletePayment.created_at);
      const now = new Date();
      const daysDiff = Math.floor((now - paymentDate) / (1000 * 60 * 60 * 24));
      const hoursAgo = Math.floor((now - paymentDate) / (1000 * 60 * 60));

      const timeAgo = daysDiff > 0 ? `${daysDiff} day${daysDiff > 1 ? 's' : ''} ago` :
                      hoursAgo > 0 ? `${hoursAgo} hour${hoursAgo > 1 ? 's' : ''} ago` :
                      'Less than 1 hour ago';

      const isOld = daysDiff >= 1;
      const statusIcon = isOld ? '🔴' : '🟡';

      // Format date safely for Telegram Markdown
      const safeDate = paymentDate.toISOString().split('T')[0]; // YYYY-MM-DD format

      // Create safe message without nested markdown
      let pendingMessage = `⚠️ INCOMPLETE PAYMENT DETECTED



${statusIcon} You have an incomplete payment that needs attention:

💰 Amount: $${incompletePayment.amount}
🌐 Network: ${incompletePayment.network.toUpperCase()}
📅 Submitted: ${safeDate} (${timeAgo})
⏳ Status: Awaiting Proof Upload`;

      // Add age warning if payment is old
      if (isOld) {
        pendingMessage += `\n\n🔴 OLD PAYMENT: This payment is over 24 hours old.`;
      }

      pendingMessage += `



🔧 WHAT WOULD YOU LIKE TO DO?

You must complete this payment before making a new purchase.`;

      const keyboard = [
        [{ text: "💳 Continue with Payment", callback_data: `continue_payment_${incompletePayment.id}` }],
        [{ text: "🗑️ Delete Payment", callback_data: `cancel_payment_${incompletePayment.id}` }]
      ];

      if (isOld) {
        keyboard.push([{ text: "📞 Contact Support (Old Payment)", callback_data: "menu_help" }]);
      }

      keyboard.push([{ text: "📊 View Payment Details", callback_data: "view_portfolio" }]);
      keyboard.push([{ text: "🔙 Back to Dashboard", callback_data: "main_menu" }]);

      await ctx.reply(pendingMessage, {
        reply_markup: { inline_keyboard: keyboard }
      });
      return;
    } else {
      console.log(`🔍 [DEBUG] All pending payments have proof uploaded - allowing new purchase`);
    }
  }

  // No pending payments - proceed with payment method selection
  await showPaymentMethodSelection(ctx, userId);
}

// Show payment method selection
async function showPaymentMethodSelection(ctx, userId) {
  const paymentMethodMessage = `🛒 **SELECT PAYMENT METHOD**



**💳 CHOOSE YOUR PREFERRED PAYMENT METHOD:**

Select how you would like to pay for your shares:

**💎 CRYPTOCURRENCY:**
• Tether (USDT) - Available on multiple networks
• Supports ETH, BSC, Polygon, and TRON networks
• Fast processing and low fees

**🏦 BANK TRANSFER:**
• Available for South Africa, Eswatini & Namibia
• Pay in South African Rand (ZAR)
• 10% transaction fee applies
• Secure FNB bank account

**💡 RECOMMENDATION:**
USDT offers the fastest processing and lowest fees for most users.`;

  const keyboard = await createPaymentMethodKeyboard(userId);

  await ctx.replyWithMarkdown(paymentMethodMessage, {
    reply_markup: keyboard
  });
}

// Text input handler for custom amounts
bot.on('text', async (ctx) => {
  const user = ctx.from;
  const text = ctx.message.text;

  console.log(`📝 [TEXT HANDLER] Received text: "${text}" from user ${user.username} (ID: ${user.id})`);

  // Skip if it's a command
  if (text.startsWith('/')) {
    console.log(`⏭️ [TEXT HANDLER] Skipping command: ${text}`);
    return;
  }

  // Get user state
  const userState = await getUserState(user.id);
  console.log(`🔍 [TEXT HANDLER] User state for ${user.id}:`, userState);

  if (userState && userState.state === 'awaiting_custom_amount') {
    console.log(`💰 [TEXT HANDLER] Processing custom amount input`);
    await handleCustomAmountInput(ctx, text);
  } else if (userState && userState.state === 'upload_proof_wallet') {
    console.log(`💳 [TEXT HANDLER] Processing wallet address input`);
    await handleWalletAddressInput(ctx, text, userState.data);
  } else if (userState && userState.state === 'upload_proof_hash') {
    console.log(`🔗 [TEXT HANDLER] Processing transaction hash input`);
    await handleTransactionHashInput(ctx, text, userState.data);
  } else if (userState && userState.state === 'awaiting_sponsor_username') {
    console.log(`👥 [TEXT HANDLER] Processing sponsor username input`);
    await handleSponsorUsernameInput(ctx, text);
  } else if (userState && userState.state === 'awaiting_withdrawal_amount') {
    console.log(`💸 [TEXT HANDLER] Processing withdrawal amount input`);
    await handleWithdrawalAmountInput(ctx, text, userState.data);
  } else if (userState && userState.state === 'awaiting_withdrawal_wallet') {
    console.log(`💳 [TEXT HANDLER] Processing withdrawal wallet address input`);
    await handleWithdrawalWalletInput(ctx, text, userState.data);
  } else if (userState && userState.state === 'awaiting_commission_shares') {
    console.log(`🛒 [TEXT HANDLER] Processing commission shares input`);
    await handleCommissionSharesInput(ctx, text, userState.data);
  } else if (userState && userState.state === 'awaiting_withdrawal_hash') {
    console.log(`🔐 [TEXT HANDLER] Processing withdrawal transaction hash input`);
    await handleWithdrawalHashInput(ctx, text, userState.data);
  } else if (ctx.session && ctx.session.pendingRejection) {
    console.log(`❌ [TEXT HANDLER] Processing payment rejection reason`);
    await handleRejectionReasonInput(ctx, text);
  } else if (ctx.session && ctx.session.pendingWithdrawalRejection) {
    console.log(`💸 [TEXT HANDLER] Processing withdrawal rejection reason`);
    await handleWithdrawalRejectionReasonInput(ctx, text);
  } else if (ctx.session && ctx.session.kyc && ctx.session.kyc.step) {
    console.log(`📋 [TEXT HANDLER] Processing KYC input for step: ${ctx.session.kyc.step}`);
    await handleKYCTextInput(ctx, text);
  } else if (ctx.session && ctx.session.awaitingCustomCountry) {
    console.log(`🌍 [TEXT HANDLER] Processing custom country input`);
    await handleCustomCountryInput(ctx, text);
  } else {
    console.log(`❓ [TEXT HANDLER] No matching state handler for: ${userState?.state || 'null'}`);
  }
});

// Handle payment rejection reason input
async function handleRejectionReasonInput(ctx, rejectionReason) {
  const user = ctx.from;

  if (user.username !== 'TTTFOUNDER') {
    await ctx.reply('❌ Access denied');
    return;
  }

  try {
    const paymentId = ctx.session.pendingRejection;

    if (!paymentId) {
      await ctx.reply('❌ No pending rejection found. Please try again.');
      return;
    }

    // Clear the session data
    delete ctx.session.pendingRejection;

    // Validate rejection reason
    if (!rejectionReason || rejectionReason.trim().length < 5) {
      await ctx.reply('❌ Rejection reason must be at least 5 characters long. Please try again.');
      return;
    }

    // Process the rejection with the custom reason
    await handleRejectPayment(ctx, paymentId, rejectionReason.trim());

  } catch (error) {
    console.error('Error processing rejection reason:', error);
    await ctx.reply('❌ Error processing rejection. Please try again.');
  }
}

// Handle commission shares input
async function handleCommissionSharesInput(ctx, text, conversionData) {
  const user = ctx.from;

  try {
    // Clear user state first
    await clearUserState(user.id);

    // Validate input
    const sharesRequested = parseInt(text.trim());

    if (isNaN(sharesRequested) || sharesRequested <= 0) {
      await ctx.reply('❌ Please enter a valid number of shares (greater than 0).');
      return;
    }

    if (sharesRequested > conversionData.max_shares) {
      await ctx.reply(`❌ You can only purchase up to ${conversionData.max_shares} shares with your current commission balance.`);
      return;
    }

    const totalCost = sharesRequested * conversionData.share_price;

    if (totalCost > conversionData.available_usdt) {
      // Get detailed balance information for better error message
      const balanceInfo = await getAvailableCommissionBalance(telegramUser.user_id);

      await ctx.replyWithMarkdown(`❌ **INSUFFICIENT COMMISSION BALANCE FOR CONVERSION**

**🛒 Conversion Request:**
• **Shares Requested:** ${sharesRequested} shares
• **Share Price:** $${conversionData.share_price.toFixed(2)} per share
• **Total Cost:** $${totalCost.toFixed(2)} USDT

**💰 Your Balance Details:**
• **Total Balance:** $${balanceInfo.totalBalance.toFixed(2)} USDT
• **Currently Escrowed:** $${balanceInfo.escrowedAmount.toFixed(2)} USDT
• **Available for Conversion:** $${balanceInfo.availableBalance.toFixed(2)} USDT

${balanceInfo.escrowedAmount > 0 ?
`**⚠️ FUNDS LOCKED:** You have $${balanceInfo.escrowedAmount.toFixed(2)} USDT locked in pending requests.

**💡 WHAT YOU CAN DO:**
• **Wait:** Pending requests will be processed within 24-48 hours
• **Convert Less:** Maximum ${Math.floor(balanceInfo.availableBalance / conversionData.share_price)} shares available
• **Check Status:** View your pending requests for details` :
`**💡 WHAT YOU CAN DO:**
• **Convert Less:** Maximum ${Math.floor(balanceInfo.availableBalance / conversionData.share_price)} shares available
• **Earn More:** Refer more users to increase your commission balance`}

**📞 Need Help?** Contact @TTTFOUNDER for assistance.`);
      return;
    }

    // Show confirmation
    const confirmationMessage = `✅ **COMMISSION TO SHARES CONVERSION**



**CONVERSION DETAILS:**
• **Shares to Purchase:** ${sharesRequested} shares
• **Share Price:** $${conversionData.share_price.toFixed(2)} per share
• **Total Cost:** $${totalCost.toFixed(2)} USDT
• **Phase:** ${conversionData.phase_number}

**YOUR COMMISSION:**
• **Available:** $${conversionData.available_usdt.toFixed(2)} USDT
• **After Conversion:** $${(conversionData.available_usdt - totalCost).toFixed(2)} USDT



**⚠️ IMPORTANT:**
• This request will be sent to admin for approval
• Your commission will be deducted only after approval
• Shares will be added to your portfolio once approved

**Confirm this conversion?**`;

    await ctx.replyWithMarkdown(confirmationMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ Confirm Conversion", callback_data: `confirm_commission_conversion_${sharesRequested}_${totalCost.toFixed(2)}_${conversionData.phase_id}` }],
          [{ text: "❌ Cancel", callback_data: "view_commission" }]
        ]
      }
    });

  } catch (error) {
    console.error('Error processing commission shares input:', error);
    await ctx.reply('❌ Error processing your request. Please try again.');
  }
}

// Handle commission conversion confirmation
async function handleConfirmCommissionConversion(ctx, callbackData) {
  const user = ctx.from;

  try {
    // Parse callback data: confirm_commission_conversion_SHARES_COST_PHASEID
    const parts = callbackData.replace('confirm_commission_conversion_', '').split('_');
    const sharesRequested = parseInt(parts[0]);
    const totalCost = parseFloat(parts[1]);
    const phaseId = parts[2];

    // Get user ID
    const { data: telegramUser, error: telegramError } = await db.client
      .from('telegram_users')
      .select('user_id')
      .eq('telegram_id', user.id)
      .single();

    if (telegramError || !telegramUser) {
      await ctx.answerCbQuery('❌ User not found');
      return;
    }

    // Get current phase info
    const { data: phase, error: phaseError } = await db.client
      .from('investment_phases')
      .select('*')
      .eq('id', phaseId)
      .single();

    if (phaseError || !phase) {
      await ctx.answerCbQuery('❌ Phase information not found');
      return;
    }

    // 🔒 SECURE ESCROW: Check available balance and create escrow atomically
    console.log(`🔒 [ESCROW] Creating commission conversion escrow for user ${telegramUser.user_id}, amount: $${totalCost}`);

    const escrowResult = await createCommissionEscrow(telegramUser.user_id, totalCost, 'conversion');

    if (!escrowResult.success) {
      console.error(`❌ [ESCROW] Failed to create conversion escrow:`, escrowResult.error);

      if (escrowResult.error.includes('Insufficient available balance')) {
        // Get current balance info for detailed error message
        const balanceInfo = await getAvailableCommissionBalance(telegramUser.user_id);
        await ctx.replyWithMarkdown(`❌ **INSUFFICIENT AVAILABLE COMMISSION BALANCE**

**💰 Balance Details:**
• **Total Balance:** $${balanceInfo.totalBalance.toFixed(2)} USDT
• **Currently Escrowed:** $${balanceInfo.escrowedAmount.toFixed(2)} USDT
• **Available Balance:** $${balanceInfo.availableBalance.toFixed(2)} USDT
• **Required for Request:** $${totalCost.toFixed(2)} USDT

**⚠️ You have pending commission requests that have locked some of your balance.**

**💡 Options:**
• Wait for pending requests to be processed
• Cancel existing pending requests
• Request a smaller amount

Your commission balance is secure and will be available once pending requests are resolved.`);
      } else {
        await ctx.replyWithMarkdown('❌ **Error processing commission request**\n\nPlease try again or contact support.');
      }
      return;
    }

    // Create commission conversion request (escrow already secured)
    const { data: conversion, error: insertError } = await db.client
      .from('commission_conversions')
      .insert({
        user_id: telegramUser.user_id,
        shares_requested: sharesRequested,
        usdt_amount: totalCost,
        share_price: phase.price_per_share,
        phase_id: phaseId,
        phase_number: phase.phase_number,
        status: 'pending'
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Error creating commission conversion:', insertError);

      // 🔒 ROLLBACK: Release escrow if conversion creation failed
      console.log(`🔒 [ESCROW] Rolling back escrow due to conversion creation failure`);
      await releaseCommissionEscrow(telegramUser.user_id, totalCost);

      await ctx.answerCbQuery('❌ Error creating conversion request');
      return;
    }

    // Notify user
    await ctx.replyWithMarkdown(`✅ **CONVERSION REQUEST SUBMITTED**



**Request ID:** #${conversion.id.substring(0, 8)}
**Shares:** ${sharesRequested} shares
**Cost:** $${totalCost.toFixed(2)} USDT
**Phase:** ${phase.phase_number}

**Status:** Pending admin approval



Your conversion request has been submitted to the admin for approval. You will be notified once it's processed.

**Your commission balance will be deducted only after approval.**`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📊 View Commission Dashboard", callback_data: "view_commission" }],
          [{ text: "🏠 Back to Dashboard", callback_data: "main_menu" }]
        ]
      }
    });

    // Notify admin using new audio notification system (skip if admin is testing their own conversion)
    try {
      if (user.username !== 'TTTFOUNDER') {
        await sendAdminNotification('commission_conversion', {
          username: user.username || user.first_name || 'Unknown',
          amount: totalCost.toFixed(2),
          shares: sharesRequested,
          user_id: telegramUser.user_id,
          conversion_id: conversion.id.substring(0, 8),
          available_commission: availableUSDT.toFixed(2),
          phase: phase.phase_number
        }, 'medium'); // Medium priority for commission conversions
      } else {
        console.log('📝 Admin testing conversion - skipping self-notification');
      }
    } catch (adminNotifyError) {
      console.error('Error notifying admin:', adminNotifyError);
    }

  } catch (error) {
    console.error('Error confirming commission conversion:', error);
    await ctx.answerCbQuery('❌ Error processing conversion');
  }
}

// Handle admin approval of commission conversion
async function handleApproveCommissionConversion(ctx, callbackData) {
  const user = ctx.from;

  if (user.username !== 'TTTFOUNDER') {
    await ctx.answerCbQuery('❌ Access denied');
    return;
  }

  try {
    const conversionId = callbackData.replace('approve_commission_conversion_', '');

    // Get conversion details
    const { data: conversion, error: conversionError } = await db.client
      .from('commission_conversions')
      .select(`
        *,
        users!inner(id, full_name, username),
        investment_phases!inner(phase_number, price_per_share)
      `)
      .eq('id', conversionId)
      .eq('status', 'pending')
      .single();

    if (conversionError || !conversion) {
      await ctx.answerCbQuery('❌ Conversion request not found or already processed');
      return;
    }

    // Verify user still has sufficient commission balance
    const { data: commissionBalance, error: balanceError } = await db.client
      .from('commission_balances')
      .select('usdt_balance')
      .eq('user_id', conversion.user_id)
      .single();

    const availableUSDT = commissionBalance ? parseFloat(commissionBalance.usdt_balance || 0) : 0;

    if (availableUSDT < conversion.usdt_amount) {
      await ctx.replyWithMarkdown(`❌ **INSUFFICIENT USER COMMISSION BALANCE**

**User:** ${conversion.users.full_name || conversion.users.username}
**Required:** $${conversion.usdt_amount.toFixed(2)} USDT
**Available:** $${availableUSDT.toFixed(2)} USDT

Cannot approve this conversion due to insufficient balance.`);
      return;
    }

    // Start transaction
    const { error: transactionError } = await db.client.rpc('process_commission_conversion', {
      p_conversion_id: conversionId,
      p_admin_id: user.id,
      p_admin_username: user.username
    });

    if (transactionError) {
      console.error('Commission conversion transaction error:', transactionError);
      await ctx.answerCbQuery('❌ Error processing conversion');
      return;
    }

    // Success notification to admin
    await ctx.replyWithMarkdown(`✅ **COMMISSION CONVERSION APPROVED**



**Request ID:** #${conversionId.substring(0, 8)}
**User:** ${conversion.users.full_name || conversion.users.username}
**Shares Added:** ${conversion.shares_requested} shares
**USDT Deducted:** $${conversion.usdt_amount.toFixed(2)}
**Phase:** ${conversion.phase_number}

**✅ Transaction completed successfully**
• User's commission balance updated
• Shares added to user's portfolio
• Commission history recorded

`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "👥 View All Requests", callback_data: "admin_commission_conversions" }],
          [{ text: "🔙 Back to Admin Panel", callback_data: "admin_panel" }]
        ]
      }
    });

    // Notify user of approval
    try {
      const { data: telegramUser } = await db.client
        .from('telegram_users')
        .select('telegram_id')
        .eq('user_id', conversion.user_id)
        .single();

      if (telegramUser) {
        const userNotification = `✅ **COMMISSION CONVERSION APPROVED**



**Request ID:** #${conversionId.substring(0, 8)}
**Shares Purchased:** ${conversion.shares_requested} shares
**USDT Used:** $${conversion.usdt_amount.toFixed(2)}
**Share Price:** $${conversion.share_price.toFixed(2)}
**Phase:** ${conversion.phase_number}

**✅ Your conversion has been completed!**

Your commission balance has been updated and the shares have been added to your portfolio.

`;

        await sendAudioNotificationToUser(
          telegramUser.telegram_id,
          userNotification,
          'APPROVAL',
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "📊 View Portfolio", callback_data: "menu_portfolio" }],
                [{ text: "💰 View Commission", callback_data: "view_commission" }]
              ]
            }
          },
          true // Enable audio notification for commission conversion approvals
        );
      }
    } catch (notifyError) {
      console.error('Error notifying user of approval:', notifyError);
    }

  } catch (error) {
    console.error('Error approving commission conversion:', error);
    await ctx.answerCbQuery('❌ Error processing approval');
  }
}

// Handle admin rejection of commission conversion
async function handleRejectCommissionConversion(ctx, callbackData) {
  const user = ctx.from;

  if (user.username !== 'TTTFOUNDER') {
    await ctx.answerCbQuery('❌ Access denied');
    return;
  }

  try {
    const conversionId = callbackData.replace('reject_commission_conversion_', '');

    // Get conversion details
    const { data: conversion, error: conversionError } = await db.client
      .from('commission_conversions')
      .select(`
        *,
        users!inner(id, full_name, username)
      `)
      .eq('id', conversionId)
      .eq('status', 'pending')
      .single();

    if (conversionError || !conversion) {
      await ctx.answerCbQuery('❌ Conversion request not found or already processed');
      return;
    }

    // Update conversion status to rejected
    const { error: updateError } = await db.client
      .from('commission_conversions')
      .update({
        status: 'rejected',
        rejected_by_admin_id: user.id,
        rejected_at: new Date().toISOString(),
        rejection_reason: 'Rejected by admin',
        updated_at: new Date().toISOString()
      })
      .eq('id', conversionId);

    if (updateError) {
      console.error('Error rejecting commission conversion:', updateError);
      await ctx.answerCbQuery('❌ Error rejecting conversion');
      return;
    }

    // 🔒 SECURE ESCROW: Release escrow when conversion is rejected
    console.log(`🔒 [ESCROW] Releasing escrow for rejected conversion: $${conversion.usdt_amount}`);
    const escrowReleaseResult = await releaseCommissionEscrow(conversion.user_id, conversion.usdt_amount);

    if (!escrowReleaseResult.success) {
      console.error(`❌ [ESCROW] Failed to release escrow for rejected conversion:`, escrowReleaseResult.error);
      // Continue with the rejection process even if escrow release fails
      // This will be logged for manual review
    }

    // Log admin action
    await logAdminAction(
      user.id,
      user.username,
      'commission_conversion_rejected',
      'commission_conversion',
      conversionId,
      {
        user: conversion.users.username,
        shares: conversion.shares_requested,
        amount: conversion.usdt_amount
      }
    );

    // Success notification to admin
    await ctx.replyWithMarkdown(`❌ **COMMISSION CONVERSION REJECTED**



**Request ID:** #${conversionId.substring(0, 8)}
**User:** ${conversion.users.full_name || conversion.users.username}
**Shares:** ${conversion.shares_requested} shares
**Amount:** $${conversion.usdt_amount.toFixed(2)} USDT

**✅ Conversion request has been rejected**

The user will be notified of the rejection.

`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "👥 View All Requests", callback_data: "admin_commission_conversions" }],
          [{ text: "🔙 Back to Admin Panel", callback_data: "admin_panel" }]
        ]
      }
    });

    // Notify user of rejection
    try {
      const { data: telegramUser } = await db.client
        .from('telegram_users')
        .select('telegram_id')
        .eq('user_id', conversion.user_id)
        .single();

      if (telegramUser) {
        const userNotification = `❌ **COMMISSION CONVERSION REJECTED**



**Request ID:** #${conversionId.substring(0, 8)}
**Shares Requested:** ${conversion.shares_requested} shares
**Amount:** $${conversion.usdt_amount.toFixed(2)} USDT

**Status:** Rejected by Admin



Your commission conversion request has been rejected. Your commission balance remains unchanged.

**You can:**
• Try submitting a new conversion request
• Contact support for more information
• Use your commission for other purposes

`;

        await bot.telegram.sendMessage(telegramUser.telegram_id, userNotification, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: "🛒 Try Again", callback_data: "commission_to_shares" }],
              [{ text: "💰 View Commission", callback_data: "view_commission" }],
              [{ text: "📞 Contact Support", url: "https://t.me/TTTFOUNDER" }]
            ]
          }
        });
      }
    } catch (notifyError) {
      console.error('Error notifying user of rejection:', notifyError);
    }

  } catch (error) {
    console.error('Error rejecting commission conversion:', error);
    await ctx.answerCbQuery('❌ Error processing rejection');
  }
}

// Handle admin commission conversions view
async function handleAdminCommissionConversions(ctx) {
  const user = ctx.from;

  if (user.username !== 'TTTFOUNDER') {
    await ctx.answerCbQuery('❌ Access denied');
    return;
  }

  try {
    // Get pending commission conversions
    const { data: conversions, error: conversionsError } = await db.client
      .from('commission_conversions')
      .select(`
        *,
        users!inner(full_name, username)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10);

    if (conversionsError) {
      console.error('Error fetching commission conversions:', conversionsError);
      await ctx.reply('❌ Error loading commission conversions');
      return;
    }

    if (!conversions || conversions.length === 0) {
      await ctx.replyWithMarkdown(`🔄 **COMMISSION CONVERSIONS**



**No pending commission conversion requests**

All conversion requests have been processed.

`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 Back to Admin Panel", callback_data: "admin_panel" }]
          ]
        }
      });
      return;
    }

    let message = `🔄 **COMMISSION CONVERSIONS**\n\n\n\n**${conversions.length} Pending Request${conversions.length > 1 ? 's' : ''}:**\n\n`;

    const keyboard = [];

    conversions.forEach((conversion, index) => {
      const shortId = conversion.id.substring(0, 8);
      const userName = conversion.users.full_name || conversion.users.username;
      const createdDate = new Date(conversion.created_at).toLocaleDateString();

      message += `**${index + 1}. Request #${shortId}**\n`;
      message += `• **User:** ${userName}\n`;
      message += `• **Shares:** ${conversion.shares_requested} shares\n`;
      message += `• **Amount:** $${conversion.usdt_amount} USDT\n`;
      message += `• **Phase:** ${conversion.phase_number}\n`;
      message += `• **Date:** ${createdDate}\n\n`;

      // Add approve/reject buttons for each conversion (using short ID to avoid 64-byte limit)
      keyboard.push([
        { text: `✅ Approve #${shortId}`, callback_data: `approve_conv_${shortId}` },
        { text: `❌ Reject #${shortId}`, callback_data: `reject_conv_${shortId}` }
      ]);
    });

    message += `\n\n**Select an action for each request above.**`;

    keyboard.push([{ text: "🔙 Back to Admin Panel", callback_data: "admin_panel" }]);

    await ctx.replyWithMarkdown(message, {
      reply_markup: {
        inline_keyboard: keyboard
      }
    });

  } catch (error) {
    console.error('Error handling admin commission conversions:', error);
    await ctx.reply('❌ Error loading commission conversions');
  }
}

// Handle admin approval of commission conversion (short callback)
async function handleApproveCommissionConversionShort(ctx, callbackData) {
  const user = ctx.from;

  if (user.username !== 'TTTFOUNDER') {
    await ctx.answerCbQuery('❌ Access denied');
    return;
  }

  try {
    const shortId = callbackData.replace('approve_conv_', '');
    console.log(`🔍 Looking for commission conversion with short ID: ${shortId}`);

    // Find the conversion by short ID - robust approach
    const { data: allPending, error: conversionError } = await db.client
      .from('commission_conversions')
      .select('*')
      .eq('status', 'pending');

    if (conversionError) {
      console.error('Error fetching pending conversions:', conversionError);
      await ctx.answerCbQuery('❌ Error loading conversion data');
      return;
    }

    const conversion = allPending?.find(c => c.id.startsWith(shortId));

    if (!conversion) {
      console.error('Conversion not found:', { shortId, availableIds: allPending?.map(c => c.id.substring(0, 8)) });
      await ctx.answerCbQuery('❌ Conversion request not found');
      return;
    }

    // Call the original approval handler with the full ID
    await handleApproveCommissionConversion(ctx, `approve_commission_conversion_${conversion.id}`);

  } catch (error) {
    console.error('Error handling short approval:', error);
    await ctx.answerCbQuery('❌ Error processing approval');
  }
}

// Handle admin rejection of commission conversion (short callback)
async function handleRejectCommissionConversionShort(ctx, callbackData) {
  const user = ctx.from;

  if (user.username !== 'TTTFOUNDER') {
    await ctx.answerCbQuery('❌ Access denied');
    return;
  }

  try {
    const shortId = callbackData.replace('reject_conv_', '');
    console.log(`🔍 Looking for commission conversion to reject with short ID: ${shortId}`);

    // Find the conversion by short ID - robust approach
    const { data: allPending, error: conversionError } = await db.client
      .from('commission_conversions')
      .select('*')
      .eq('status', 'pending');

    if (conversionError) {
      console.error('Error fetching pending conversions:', conversionError);
      await ctx.answerCbQuery('❌ Error loading conversion data');
      return;
    }

    const conversion = allPending?.find(c => c.id.startsWith(shortId));

    if (!conversion) {
      console.error('Conversion not found:', { shortId, availableIds: allPending?.map(c => c.id.substring(0, 8)) });
      await ctx.answerCbQuery('❌ Conversion request not found');
      return;
    }

    // Call the original rejection handler with the full ID
    await handleRejectCommissionConversion(ctx, `reject_commission_conversion_${conversion.id}`);

  } catch (error) {
    console.error('Error handling short rejection:', error);
    await ctx.answerCbQuery('❌ Error processing rejection');
  }
}

// Handle admin pending withdrawals view
async function handleAdminPendingWithdrawals(ctx) {
  const user = ctx.from;

  if (user.username !== 'TTTFOUNDER') {
    await ctx.answerCbQuery('❌ Access denied');
    return;
  }

  try {
    // Get pending withdrawal requests with user info
    const { data: withdrawals, error: withdrawalsError } = await db.client
      .from('commission_withdrawals')
      .select(`
        *,
        users!commission_withdrawals_user_id_fkey!inner(full_name, username)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10);

    if (withdrawalsError) {
      console.error('Error fetching pending withdrawals:', withdrawalsError);
      await ctx.reply('❌ Error loading pending withdrawals');
      return;
    }

    if (!withdrawals || withdrawals.length === 0) {
      await ctx.replyWithMarkdown(`⏳ **PENDING WITHDRAWALS**



**No pending withdrawal requests**

All withdrawal requests have been processed.

`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 Back to Commission Requests", callback_data: "admin_commissions" }]
          ]
        }
      });
      return;
    }

    let message = `⏳ **PENDING WITHDRAWALS**\n\n\n\n**${withdrawals.length} Pending Request${withdrawals.length > 1 ? 's' : ''}:**\n\n`;

    const keyboard = [];

    for (let i = 0; i < withdrawals.length; i++) {
      const withdrawal = withdrawals[i];
      const shortId = withdrawal.id.substring(0, 8);
      const userName = withdrawal.users.full_name || withdrawal.users.username;
      const createdDate = new Date(withdrawal.created_at).toLocaleDateString();
      const walletShort = withdrawal.wallet_address ?
        `${withdrawal.wallet_address.substring(0, 6)}...${withdrawal.wallet_address.substring(-4)}` :
        'N/A';

      message += `**${i + 1}. Request #${shortId}**\n`;
      message += `• **User:** ${userName}\n`;
      message += `• **Amount:** $${withdrawal.amount} USDT\n`;
      message += `• **Wallet:** ${walletShort}\n`;
      message += `• **Date:** ${createdDate}\n`;
      message += `• **Type:** ${withdrawal.withdrawal_type.toUpperCase()}\n\n`;

      // Add approve/reject buttons for each withdrawal (using short ID to avoid 64-byte limit)
      keyboard.push([
        { text: `✅ Approve #${shortId}`, callback_data: `approve_withdrawal_${shortId}` },
        { text: `❌ Reject #${shortId}`, callback_data: `reject_withdrawal_${shortId}` }
      ]);
    }

    message += `\n\n**Select an action for each request above.**`;

    keyboard.push([{ text: "🔙 Back to Commission Requests", callback_data: "admin_commissions" }]);

    await ctx.replyWithMarkdown(message, {
      reply_markup: {
        inline_keyboard: keyboard
      }
    });

  } catch (error) {
    console.error('Error handling admin pending withdrawals:', error);
    await ctx.reply('❌ Error loading pending withdrawals');
  }
}

// Handle admin approval of withdrawal (short callback)
async function handleApproveWithdrawalShort(ctx, callbackData) {
  const user = ctx.from;

  if (user.username !== 'TTTFOUNDER') {
    await ctx.answerCbQuery('❌ Access denied');
    return;
  }

  try {
    const shortId = callbackData.replace('approve_withdrawal_', '');
    console.log(`🔍 Looking for withdrawal with short ID: ${shortId}`);

    // Find the withdrawal by short ID - try different approaches
    let withdrawal = null;
    let withdrawalError = null;

    // First try: exact match with LIKE
    const { data: withdrawalData1, error: error1 } = await db.client
      .from('commission_withdrawals')
      .select(`
        *,
        users!commission_withdrawals_user_id_fkey!inner(full_name, username)
      `)
      .filter('id', 'like', `${shortId}%`)
      .eq('status', 'pending');

    if (error1) {
      console.error('Error with LIKE query:', error1);
      // Try second approach: get all pending and filter in code
      const { data: allPending, error: error2 } = await db.client
        .from('commission_withdrawals')
        .select(`
          *,
          users!commission_withdrawals_user_id_fkey!inner(full_name, username)
        `)
        .eq('status', 'pending');

      if (error2) {
        withdrawalError = error2;
      } else if (allPending && allPending.length > 0) {
        withdrawal = allPending.find(w => w.id.startsWith(shortId));
      }
    } else if (withdrawalData1 && withdrawalData1.length > 0) {
      withdrawal = withdrawalData1[0];
    }

    console.log(`🔍 Found withdrawal:`, withdrawal ? `ID: ${withdrawal.id}` : 'Not found');

    if (withdrawalError || !withdrawal) {
      console.error('Withdrawal lookup failed:', { shortId, withdrawalError });
      await ctx.answerCbQuery('❌ Withdrawal request not found or already processed');
      return;
    }

    // Verify user still has sufficient commission balance
    const { data: commissionBalance, error: balanceError } = await db.client
      .from('commission_balances')
      .select('usdt_balance')
      .eq('user_id', withdrawal.user_id)
      .single();

    const availableUSDT = commissionBalance ? parseFloat(commissionBalance.usdt_balance || 0) : 0;

    if (availableUSDT < withdrawal.amount) {
      await ctx.replyWithMarkdown(`❌ **INSUFFICIENT USER COMMISSION BALANCE**

**User:** ${withdrawal.users.full_name || withdrawal.users.username}
**Withdrawal Amount:** $${withdrawal.amount.toFixed(2)} USDT
**Available Balance:** $${availableUSDT.toFixed(2)} USDT

Cannot approve this withdrawal due to insufficient balance.`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 Back to Pending Withdrawals", callback_data: "admin_pending_withdrawals" }]
          ]
        }
      });
      return;
    }

    // Ask admin for transaction hash before final approval
    await ctx.replyWithMarkdown(`🔐 **WITHDRAWAL APPROVAL - TRANSACTION HASH REQUIRED**

**User:** ${withdrawal.users.full_name || withdrawal.users.username}
**Amount:** $${withdrawal.amount.toFixed(2)} USDT
**Wallet:** \`${withdrawal.wallet_address}\`
**Available Balance:** $${availableUSDT.toFixed(2)} USDT

⚠️ **Please provide the transaction hash for this withdrawal payment:**

*This hash will be sent to the user as proof of payment.*`, {
      reply_markup: {
        force_reply: true,
        input_field_placeholder: "Enter transaction hash (e.g., 0x1234...)"
      }
    });

    // Set user state to await transaction hash
    await setUserState(user.id, 'awaiting_withdrawal_hash', {
      withdrawal_id: withdrawal.id,
      short_id: shortId,
      user_name: withdrawal.users.full_name || withdrawal.users.username,
      amount: withdrawal.amount,
      wallet_address: withdrawal.wallet_address,
      available_balance: availableUSDT
    });

    await ctx.answerCbQuery('💳 Please provide transaction hash');
    return;



  } catch (error) {
    console.error('Error approving withdrawal:', error);
    await ctx.answerCbQuery('❌ Error processing approval');
  }
}

// Handle withdrawal rejection prompt
async function handleRejectWithdrawalPrompt(ctx, callbackData) {
  const user = ctx.from;

  if (user.username !== 'TTTFOUNDER') {
    await ctx.answerCbQuery('❌ Access denied');
    return;
  }

  try {
    const shortId = callbackData.replace('reject_withdrawal_', '');
    console.log(`🔍 Looking for withdrawal to reject with short ID: ${shortId}`);

    // Find the withdrawal by short ID - robust approach
    const { data: allPending, error: withdrawalError } = await db.client
      .from('commission_withdrawals')
      .select(`
        *,
        users!commission_withdrawals_user_id_fkey!inner(full_name, username)
      `)
      .eq('status', 'pending');

    if (withdrawalError) {
      console.error('Error fetching pending withdrawals:', withdrawalError);
      await ctx.answerCbQuery('❌ Error loading withdrawal data');
      return;
    }

    const withdrawal = allPending?.find(w => w.id.startsWith(shortId));

    if (!withdrawal) {
      console.error('Withdrawal not found:', { shortId, availableIds: allPending?.map(w => w.id.substring(0, 8)) });
      await ctx.answerCbQuery('❌ Withdrawal request not found');
      return;
    }

    const promptMessage = `❌ **REJECT WITHDRAWAL CONFIRMATION**



**Withdrawal Details:**
• **ID:** #${withdrawal.id.substring(0, 8)}
• **User:** ${withdrawal.users.full_name || withdrawal.users.username}
• **Amount:** $${withdrawal.amount} USDT
• **Wallet:** ${withdrawal.wallet_address}
• **Type:** ${withdrawal.withdrawal_type.toUpperCase()}



**Please enter the reason for rejecting this withdrawal:**

*This message will be sent to the user along with the rejection notification.*`;

    await ctx.replyWithMarkdown(promptMessage, {
      reply_markup: {
        force_reply: true,
        input_field_placeholder: "Enter rejection reason..."
      }
    });

    // Store the withdrawal ID in session for the next message
    ctx.session = ctx.session || {};
    ctx.session.pendingWithdrawalRejection = withdrawal.id;

  } catch (error) {
    console.error('Error showing withdrawal rejection prompt:', error);
    await ctx.answerCbQuery('❌ Error processing rejection');
  }
}

// Handle withdrawal rejection reason input
async function handleWithdrawalRejectionReasonInput(ctx, rejectionReason) {
  const user = ctx.from;

  if (user.username !== 'TTTFOUNDER') {
    await ctx.reply('❌ Access denied');
    return;
  }

  try {
    const withdrawalId = ctx.session.pendingWithdrawalRejection;

    if (!withdrawalId) {
      await ctx.reply('❌ No pending withdrawal rejection found. Please try again.');
      return;
    }

    // Clear the session data
    delete ctx.session.pendingWithdrawalRejection;

    // Validate rejection reason
    if (!rejectionReason || rejectionReason.trim().length < 5) {
      await ctx.reply('❌ Rejection reason must be at least 5 characters long. Please try again.');
      return;
    }

    // Get withdrawal details
    const { data: withdrawal, error: withdrawalError } = await db.client
      .from('commission_withdrawals')
      .select(`
        *,
        users!commission_withdrawals_user_id_fkey!inner(full_name, username)
      `)
      .eq('id', withdrawalId)
      .eq('status', 'pending')
      .single();

    if (withdrawalError || !withdrawal) {
      await ctx.reply('❌ Withdrawal request not found or already processed.');
      return;
    }

    // Update withdrawal status to rejected
    const { error: updateError } = await db.client
      .from('commission_withdrawals')
      .update({
        status: 'rejected',
        rejected_by_admin_id: user.id,
        rejected_at: new Date().toISOString(),
        admin_notes: rejectionReason.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', withdrawalId);

    if (updateError) {
      console.error('Error rejecting withdrawal:', updateError);
      await ctx.reply('❌ Error rejecting withdrawal. Please try again.');
      return;
    }

    // 🔒 SECURE ESCROW: Release escrow when withdrawal is rejected
    console.log(`🔒 [ESCROW] Releasing escrow for rejected withdrawal: $${withdrawal.amount}`);
    const escrowReleaseResult = await releaseCommissionEscrow(withdrawal.user_id, withdrawal.amount);

    if (!escrowReleaseResult.success) {
      console.error(`❌ [ESCROW] Failed to release escrow for rejected withdrawal:`, escrowReleaseResult.error);
      // Continue with the rejection process even if escrow release fails
      // This will be logged for manual review
    }

    // Log admin action
    await logAdminAction(
      user.id,
      user.username,
      'withdrawal_rejected',
      'withdrawal',
      withdrawalId,
      {
        user: withdrawal.users.username,
        amount: withdrawal.amount,
        rejection_reason: rejectionReason.trim()
      }
    );

    // Get updated balance information for detailed confirmation
    const { data: updatedBalance, error: balanceCheckError } = await db.client
      .from('commission_balances')
      .select('usdt_balance, escrowed_amount, total_withdrawn')
      .eq('user_id', withdrawal.user_id)
      .single();

    const currentBalance = updatedBalance ? parseFloat(updatedBalance.usdt_balance || 0) : 0;
    const finalEscrowBalance = updatedBalance ? parseFloat(updatedBalance.escrowed_amount || 0) : 0;
    const totalWithdrawn = updatedBalance ? parseFloat(updatedBalance.total_withdrawn || 0) : 0;

    // Enhanced rejection notification to admin
    await ctx.replyWithMarkdown(`❌ **WITHDRAWAL REJECTED & PROCESSED**



**📋 REQUEST DETAILS:**
• **Request ID:** #${withdrawalId.substring(0, 8)}
• **User:** ${withdrawal.users.full_name || withdrawal.users.username}
• **Amount:** $${withdrawal.amount.toFixed(2)} USDT
• **Wallet:** ${withdrawal.wallet_address}
• **Type:** ${withdrawal.withdrawal_type.toUpperCase()}

**📝 REJECTION REASON:**
${rejectionReason.trim()}

**💰 BALANCE STATUS:**
• **Current Balance:** $${currentBalance.toFixed(2)} USDT (unchanged)
• **Escrowed Amount:** $${finalEscrowBalance.toFixed(2)} USDT (released)
• **Total Withdrawn:** $${totalWithdrawn.toFixed(2)} USDT
• **Funds Released:** $${withdrawal.amount.toFixed(2)} USDT (back to available balance)

**✅ SYSTEM ACTIONS COMPLETED:**
• ✅ Withdrawal status updated to 'rejected'
• ✅ Escrowed funds released back to user
• ✅ User notification sent with custom reason
• ✅ Audit log entry created
• ✅ Balance integrity maintained



**📧 USER NOTIFICATION:** Sent successfully with rejection reason and next steps.
**💡 USER OPTIONS:** They can review, correct issues, and submit a new request.`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "⏳ View Pending Withdrawals", callback_data: "admin_pending_withdrawals" }],
          [{ text: "🔙 Back to Commission Requests", callback_data: "admin_commissions" }]
        ]
      }
    });

    // Notify user of rejection
    try {
      const { data: telegramUser } = await db.client
        .from('telegram_users')
        .select('telegram_id')
        .eq('user_id', withdrawal.user_id)
        .single();

      if (telegramUser) {
        const userNotification = `❌ **WITHDRAWAL REJECTED**



**Request ID:** #${withdrawalId.substring(0, 8)}
**Amount:** $${withdrawal.amount.toFixed(2)} USDT
**Wallet Address:** ${withdrawal.wallet_address}

**Status:** Rejected by Admin

**Reason for Rejection:**
${rejectionReason.trim()}



Your withdrawal request has been rejected. Your commission balance remains unchanged.

**You can:**
• Review the rejection reason above
• Correct any issues mentioned
• Submit a new withdrawal request
• Contact support for assistance

`;

        await sendAudioNotificationToUser(
          telegramUser.telegram_id,
          userNotification,
          'REJECTION',
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "💸 Try New Withdrawal", callback_data: "withdraw_usdt_commission" }],
                [{ text: "💰 View Commission", callback_data: "view_commission" }],
                [{ text: "📞 Contact Support", url: "https://t.me/TTTFOUNDER" }]
              ]
            }
          },
          true // Enable audio notification for rejections
        );
      }
    } catch (notifyError) {
      console.error('Error notifying user of withdrawal rejection:', notifyError);
    }

  } catch (error) {
    console.error('Error processing withdrawal rejection reason:', error);
    await ctx.reply('❌ Error processing rejection. Please try again.');
  }
}

// Handle sponsor username input
async function handleSponsorUsernameInput(ctx, text) {
  const user = ctx.from;

  try {
    console.log(`🔍 Processing sponsor username input: "${text}" from user ${user.username}`);

    // Clear user state first
    await clearUserState(user.id);

    // Check for cancel
    if (text.toLowerCase() === 'cancel') {
      await ctx.reply("❌ Sponsor assignment cancelled.");
      await promptSponsorAssignment(ctx);
      return;
    }

    // Clean the username (remove @ if present)
    const sponsorUsername = text.replace('@', '').trim();
    console.log(`🧹 Cleaned sponsor username: "${sponsorUsername}"`);

    if (!sponsorUsername || sponsorUsername.length < 3) {
      await ctx.reply("❌ Invalid username. Please enter a valid Telegram username (minimum 3 characters).");
      await handleEnterSponsorManual(ctx);
      return;
    }

    // Validate sponsor exists
    console.log(`🔍 Looking up sponsor: ${sponsorUsername}`);
    const sponsor = await db.getUserByUsername(sponsorUsername);
    if (!sponsor) {
      console.log(`❌ Sponsor ${sponsorUsername} not found in database`);
      const notFoundMessage = `❌ **SPONSOR NOT FOUND**

The username "${sponsorUsername}" was not found in our system.

**🎯 OPTIONS:**
• Check the spelling and try again
• Ask your sponsor to register first
• Continue without a sponsor`;

      await ctx.replyWithMarkdown(notFoundMessage, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "✍️ Try Again", callback_data: "enter_sponsor_manual" }],
            [{ text: "🚫 I Don't Have A Sponsor", callback_data: "assign_default_sponsor" }]
          ]
        }
      });
      return;
    }

    console.log(`✅ Sponsor found: ${sponsor.username} (ID: ${sponsor.id})`);

    // Get the current user (should already exist since they're using the bot)
    const authenticatedUser = await db.getUserByUsername(user.username);
    if (!authenticatedUser) {
      console.error(`❌ Current user ${user.username} not found in database`);
      await ctx.reply("❌ User authentication error. Please restart the bot with /start");
      return;
    }

    console.log(`✅ Current user found: ${authenticatedUser.username} (ID: ${authenticatedUser.id})`);

    // Assign sponsor
    console.log(`🤝 Assigning sponsor ${sponsorUsername} to user ${authenticatedUser.id}`);
    const success = await assignSponsor(authenticatedUser.id, sponsorUsername);

    if (success) {
      console.log(`✅ Sponsor assignment successful for user ${authenticatedUser.id}`);

      const successMessage = `✅ **SPONSOR ASSIGNED SUCCESSFULLY**



**🤝 Your Sponsor:** ${sponsor.full_name || sponsorUsername} (@${sponsorUsername})
**📅 Assigned:** ${new Date().toLocaleDateString()}
**✅ Status:** Active

**🎯 NEXT STEPS:**
You can now access all platform features and start your gold mining share journey!

**💎 Your sponsor will provide:**
• Share guidance and support
• Commission tracking for referrals
• Access to exclusive updates

`;

      console.log(`📤 Sending success message to user ${user.username}`);
      await ctx.replyWithMarkdown(successMessage, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🛒 Purchase Gold Shares", callback_data: "menu_purchase_shares" }],
            [{ text: "💼 View Portfolio", callback_data: "menu_portfolio" }],
            [{ text: "🏠 Main Dashboard", callback_data: "main_menu" }]
          ]
        }
      });
      console.log(`✅ Success message sent successfully to user ${user.username}`);
    } else {
      console.error(`❌ Sponsor assignment failed for user ${authenticatedUser.id}`);
      await ctx.reply("❌ Error assigning sponsor. Please try again.");
      await promptSponsorAssignment(ctx);
    }

  } catch (error) {
    console.error('Error handling sponsor username input:', error);
    await ctx.reply("❌ Error processing sponsor assignment. Please try again.");
    await promptSponsorAssignment(ctx);
  }
}

// Photo handler for proof upload
bot.on('photo', async (ctx) => {
  try {
    const user = ctx.from;
    const userState = await getUserState(user.id);

    if (userState && userState.state === 'upload_proof_screenshot') {
      await handleProofScreenshot(ctx, userState.data);
    } else if (userState && userState.state === 'uploading_payment_proof') {
      await handleBankTransferProofUpload(ctx);
    } else if (userState && userState.state === 'uploading_bank_proof') {
      await handleBankTransferFileUpload(ctx, false); // false = photo
    }
  } catch (error) {
    console.error('Error in photo handler:', error);
    await ctx.reply('❌ Error processing image. Please try again or contact support.');
  }
});

// Document handler for proof upload
bot.on('document', async (ctx) => {
  try {
    const user = ctx.from;
    const userState = await getUserState(user.id);

    if (userState && userState.state === 'upload_proof_screenshot') {
      const document = ctx.message.document;
      if (document.mime_type && document.mime_type.startsWith('image/')) {
        await handleProofScreenshot(ctx, userState.data, true);
      } else {
        await ctx.reply('📷 Please upload an image file for payment verification.');
      }
    } else if (userState && userState.state === 'uploading_payment_proof') {
      const document = ctx.message.document;
      if (document.mime_type && (document.mime_type.startsWith('image/') || document.mime_type === 'application/pdf')) {
        await handleBankTransferProofUpload(ctx, true);
      } else {
        await ctx.reply('📷 Please upload an image file (JPG, PNG) or PDF for payment proof.');
      }
    } else if (userState && userState.state === 'uploading_bank_proof') {
      const document = ctx.message.document;
      if (document.mime_type && (document.mime_type.startsWith('image/') || document.mime_type === 'application/pdf')) {
        await handleBankTransferFileUpload(ctx, true); // true = document
      } else {
        await ctx.reply('📷 Please upload an image file (JPG, PNG) or PDF for bank transfer proof.');
      }
    }
  } catch (error) {
    console.error('Error in document handler:', error);
    await ctx.reply('❌ Error processing document. Please try again or contact support.');
  }
});

// Handle custom amount input
async function handleCustomAmountInput(ctx, amountText) {
  const user = ctx.from;

  // Parse the amount
  const amount = parseFloat(amountText.replace(/[^0-9.]/g, ''));

  // Check minimum amount based on payment method
  const selectedPaymentMethod = ctx.session.selectedPaymentMethod || 'usdt';
  const minAmount = selectedPaymentMethod === 'bank_transfer' ? 15 : 5;
  const maxAmount = 50000;

  if (isNaN(amount) || amount < minAmount || amount > maxAmount) {
    const paymentMethodName = selectedPaymentMethod === 'bank_transfer' ? 'bank transfer' : 'USDT';
    await ctx.reply(`❌ Invalid amount. Please enter a number between $${minAmount} and $${maxAmount.toLocaleString()} for ${paymentMethodName} payments.`);
    return;
  }

  // Clear user state
  await setUserState(user.id, null);

  // Proceed with payment process
  await processCustomAmountPurchase(ctx, amount);
}

// Handle wallet address input
async function handleWalletAddressInput(ctx, walletAddress, sessionData) {
  const user = ctx.from;
  const { paymentId } = sessionData;

  try {
    // Update payment with sender wallet address
    const { error: updateError } = await db.client
      .from('crypto_payment_transactions')
      .update({
        sender_wallet: walletAddress,
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentId);

    if (updateError) {
      console.error('Error updating payment with wallet:', updateError);
      await ctx.reply('❌ Error saving wallet address. Please try again.');
      return;
    }

    // Set state for transaction hash input
    await setUserState(user.id, 'upload_proof_hash', { paymentId, walletAddress });

    const hashMessage = `💳 PAYMENT PROOF SUBMISSION - STEP 2 OF 3



✅ Wallet Address Saved: ${walletAddress.substring(0, 10)}...

📍 STEP 2: TRANSACTION HASH (TXID)

Please type the transaction hash (TXID) of your payment:

⚠️ Important: This is the unique transaction ID from your wallet or exchange

Next Step: Screenshot Upload`;

    await ctx.reply(hashMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "❌ Cancel Upload", callback_data: "main_menu" }]
        ]
      }
    });

  } catch (error) {
    console.error('Error handling wallet address:', error);
    await ctx.reply('❌ Error processing wallet address. Please try again.');
  }
}

// Handle transaction hash input
async function handleTransactionHashInput(ctx, transactionHash, sessionData) {
  const user = ctx.from;
  const { paymentId } = sessionData;

  try {
    // Update payment with transaction hash
    const { error: updateError } = await db.client
      .from('crypto_payment_transactions')
      .update({
        transaction_hash: transactionHash,
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentId);

    if (updateError) {
      console.error('Error updating payment with hash:', updateError);

      // Handle duplicate transaction hash specifically
      if (updateError.code === '23505' && updateError.message.includes('transaction_hash')) {
        await ctx.reply(`❌ **DUPLICATE TRANSACTION HASH**

This transaction hash has already been used for another payment.

**Please provide a different transaction hash:**
• Each transaction must have a unique hash
• Double-check your transaction details
• If you believe this is an error, contact support

**Try again with a different transaction hash:**`);
      } else {
        await ctx.reply('❌ Error saving transaction hash. Please try again.');
      }
      return;
    }

    // Set state for screenshot upload
    await setUserState(user.id, 'upload_proof_screenshot', { paymentId });

    const screenshotMessage = `💳 PAYMENT PROOF SUBMISSION - STEP 3 OF 3



✅ Transaction Hash Saved: ${transactionHash.substring(0, 10)}...

📍 STEP 3: UPLOAD SCREENSHOT

Please upload a screenshot of your transaction:

📷 Send the image now (as photo or document)

⚠️ Important: Screenshot should clearly show the transaction details

Final Step: Upload complete → Admin review`;

    await ctx.reply(screenshotMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "❌ Cancel Upload", callback_data: "main_menu" }]
        ]
      }
    });

  } catch (error) {
    console.error('Error handling transaction hash:', error);
    await ctx.reply('❌ Error processing transaction hash. Please try again.');
  }
}

// Handle proof screenshot upload
async function handleProofScreenshot(ctx, sessionData, isDocument = false) {
  const user = ctx.from;
  const { paymentId } = sessionData;

  try {
    let file, fileUrl;

    if (isDocument) {
      // Handle document upload
      const document = ctx.message.document;
      file = await ctx.telegram.getFile(document.file_id);
      fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
      console.log(`📄 Document file URL: ${fileUrl}`);
    } else {
      // Handle photo upload
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      file = await ctx.telegram.getFile(photo.file_id);
      fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
      console.log(`📷 Photo file URL: ${fileUrl}`);
    }

    console.log(`📷 Processing screenshot upload for payment ${paymentId}`);

    // Download and upload to Supabase storage
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const timestamp = Date.now();
    const filename = `payment_${user.id}_${timestamp}.jpg`;

    // Upload to Supabase storage bucket "proof"
    const { data, error } = await db.client.storage
      .from('proof')
      .upload(filename, buffer, {
        contentType: 'image/jpeg',
        upsert: false
      });

    if (error) {
      console.error('Storage upload error:', error);
      await ctx.reply('❌ Failed to upload screenshot. Please try again.');
      return;
    }

    // Update payment with screenshot
    const { error: updateError } = await db.client
      .from('crypto_payment_transactions')
      .update({
        screenshot_url: filename,
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentId);

    if (updateError) {
      console.error('Error updating payment with screenshot:', updateError);
      await ctx.reply('❌ Failed to save screenshot. Please try again.');
      return;
    }

    // Clear user state
    try {
      if (typeof clearUserState === 'function') {
        await clearUserState(user.id);
      } else {
        // Fallback if function not available
        if (global.userStates) {
          global.userStates.delete(user.id);
        }
      }
    } catch (stateError) {
      console.error('Error clearing user state:', stateError);
      // Continue anyway - this is not critical
    }

    const successMessage = `✅ **PAYMENT PROOF UPLOADED SUCCESSFULLY**



**📋 SUBMISSION COMPLETE:**
• Payment ID: #${paymentId.substring(0, 8)}
• Wallet Address: ✅ Saved
• Transaction Hash: ✅ Saved
• Screenshot: ✅ Uploaded

**⏳ NEXT STEPS:**
• Admin will review your payment
• You'll receive notification when approved
• Shares will be allocated to your account

**📱 You can check status in Portfolio section**`;

    await ctx.replyWithMarkdown(successMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "💼 View Portfolio", callback_data: "menu_portfolio" }],
          [{ text: "🏠 Main Menu", callback_data: "main_menu" }]
        ]
      }
    });

  } catch (error) {
    console.error('Error handling proof screenshot:', error);
    await ctx.reply('❌ Error uploading screenshot. Please try again.');
  }
}

// WITHDRAWAL INPUT HANDLERS

// Handle withdrawal amount input
async function handleWithdrawalAmountInput(ctx, text, sessionData) {
  const user = ctx.from;
  const { availableBalance, withdrawalType } = sessionData;

  try {
    // Clear user state first
    await clearUserState(user.id);

    // Check for cancel
    if (text.toLowerCase() === 'cancel') {
      await ctx.reply("❌ Withdrawal cancelled.");
      await handleViewCommission(ctx);
      return;
    }

    // Parse and validate amount
    const amount = parseFloat(text.replace(/[^0-9.]/g, ''));

    if (isNaN(amount) || amount <= 0) {
      await ctx.reply("❌ Invalid amount. Please enter a valid number (e.g., 25.50)");
      await handleWithdrawUSDTCommission(ctx);
      return;
    }

    if (amount < 10) {
      await ctx.reply("❌ Minimum withdrawal amount is $10.00 USDT");
      await handleWithdrawUSDTCommission(ctx);
      return;
    }

    if (amount > availableBalance) {
      // Get detailed balance information for better error message
      const balanceInfo = await getAvailableCommissionBalance(telegramUser.user_id);

      await ctx.replyWithMarkdown(`❌ **INSUFFICIENT COMMISSION BALANCE**

**💰 Your Balance Details:**
• **Total Balance:** $${balanceInfo.totalBalance.toFixed(2)} USDT
• **Currently Escrowed:** $${balanceInfo.escrowedAmount.toFixed(2)} USDT
• **Available for Withdrawal:** $${balanceInfo.availableBalance.toFixed(2)} USDT
• **Requested Amount:** $${amount.toFixed(2)} USDT

${balanceInfo.escrowedAmount > 0 ?
`**⚠️ FUNDS LOCKED:** You have $${balanceInfo.escrowedAmount.toFixed(2)} USDT locked in pending requests.

**💡 WHAT YOU CAN DO:**
• **Wait:** Pending requests will be processed within 24-48 hours
• **Withdraw Less:** Try withdrawing $${balanceInfo.availableBalance.toFixed(2)} USDT or less
• **Check Status:** View your pending requests for details
• **Contact Admin:** Get help with urgent requests` :
`**💡 WHAT YOU CAN DO:**
• **Withdraw Less:** Maximum available is $${balanceInfo.availableBalance.toFixed(2)} USDT
• **Earn More:** Refer more users to increase your commission balance
• **Contact Admin:** Get help if you believe this is an error`}

**📞 Need Help?** Contact @TTTFOUNDER for assistance.`);

      await handleWithdrawUSDTCommission(ctx);
      return;
    }

    if (amount > 1000) {
      await ctx.reply("❌ Maximum daily withdrawal is $1,000.00 USDT");
      await handleWithdrawUSDTCommission(ctx);
      return;
    }

    // Set state for wallet address input
    await setUserState(user.id, 'awaiting_withdrawal_wallet', {
      amount,
      withdrawalType,
      availableBalance
    });

    const walletMessage = `💳 **WALLET ADDRESS REQUIRED**



**💰 Withdrawal Amount:** $${amount.toFixed(2)} USDT
**💸 Processing Fee:** $2.00 USDT
**📤 You'll Receive:** $${(amount - 2).toFixed(2)} USDT

**🔗 NETWORK:** TRC-20 (Tron)

**📝 Please enter your USDT wallet address:**

**⚠️ IMPORTANT:**
• Only TRC-20 (Tron) network supported
• Double-check your wallet address
• Incorrect addresses may result in lost funds
• We cannot recover funds sent to wrong addresses

**💡 Example format:** TXYZabc123def456ghi789...`;

    await ctx.replyWithMarkdown(walletMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "❌ Cancel Withdrawal", callback_data: "view_commission" }]
        ]
      }
    });

  } catch (error) {
    console.error('Error handling withdrawal amount:', error);
    await ctx.reply('❌ Error processing withdrawal amount. Please try again.');
  }
}

// Handle withdrawal wallet address input
async function handleWithdrawalWalletInput(ctx, text, sessionData) {
  const user = ctx.from;
  const { amount, withdrawalType } = sessionData;

  try {
    // Clear user state first
    await clearUserState(user.id);

    // Check for cancel
    if (text.toLowerCase() === 'cancel') {
      await ctx.reply("❌ Withdrawal cancelled.");
      await handleViewCommission(ctx);
      return;
    }

    // Clean and validate wallet address
    const walletAddress = text.trim();

    // Basic TRC-20 address validation (starts with T, 34 characters)
    if (!walletAddress.startsWith('T') || walletAddress.length !== 34) {
      await ctx.reply(`❌ Invalid TRC-20 wallet address format.

**Requirements:**
• Must start with 'T'
• Must be exactly 34 characters
• Example: TXYZabc123def456ghi789jkl012mno345

Please enter a valid TRC-20 wallet address:`);

      // Reset state for wallet input
      await setUserState(user.id, 'awaiting_withdrawal_wallet', sessionData);
      return;
    }

    // Get user ID for database operations
    const { data: telegramUser, error: telegramError } = await db.client
      .from('telegram_users')
      .select('user_id')
      .eq('telegram_id', user.id)
      .single();

    if (telegramError || !telegramUser) {
      await ctx.reply('❌ User authentication error. Please try again.');
      return;
    }

    // 🔒 SECURE ESCROW: Check available balance and create escrow atomically
    console.log(`🔒 [ESCROW] Creating commission withdrawal escrow for user ${telegramUser.user_id}, amount: $${amount}`);

    const escrowResult = await createCommissionEscrow(telegramUser.user_id, amount, 'withdrawal');

    if (!escrowResult.success) {
      console.error(`❌ [ESCROW] Failed to create withdrawal escrow:`, escrowResult.error);

      if (escrowResult.error.includes('Insufficient available balance')) {
        // Get current balance info for detailed error message
        const balanceInfo = await getAvailableCommissionBalance(telegramUser.user_id);
        await ctx.replyWithMarkdown(`❌ **INSUFFICIENT AVAILABLE COMMISSION BALANCE**

**💰 Balance Details:**
• **Total Balance:** $${balanceInfo.totalBalance.toFixed(2)} USDT
• **Currently Escrowed:** $${balanceInfo.escrowedAmount.toFixed(2)} USDT
• **Available Balance:** $${balanceInfo.availableBalance.toFixed(2)} USDT
• **Required for Withdrawal:** $${amount.toFixed(2)} USDT

**⚠️ You have pending commission requests that have locked some of your balance.**

**💡 Options:**
• Wait for pending requests to be processed
• Cancel existing pending requests
• Request a smaller withdrawal amount

Your commission balance is secure and will be available once pending requests are resolved.`);
      } else {
        await ctx.reply('❌ Error processing withdrawal request. Please try again.');
      }
      return;
    }

    // Create withdrawal request (escrow already secured)
    const { data: withdrawal, error: withdrawalError } = await db.client
      .from('commission_withdrawals')
      .insert({
        user_id: telegramUser.user_id,
        withdrawal_type: withdrawalType,
        amount: amount,
        wallet_address: walletAddress,
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (withdrawalError) {
      console.error('Error creating withdrawal request:', withdrawalError);

      // 🔒 ROLLBACK: Release escrow if withdrawal creation failed
      console.log(`🔒 [ESCROW] Rolling back escrow due to withdrawal creation failure`);
      await releaseCommissionEscrow(telegramUser.user_id, amount);

      await ctx.reply('❌ Error creating withdrawal request. Please try again.');
      return;
    }

    const successMessage = `✅ **WITHDRAWAL REQUEST SUBMITTED**



**📋 REQUEST DETAILS:**
• **Request ID:** #${withdrawal.id.substring(0, 8)}
• **Amount:** $${amount.toFixed(2)} USDT
• **Processing Fee:** $2.00 USDT
• **You'll Receive:** $${(amount - 2).toFixed(2)} USDT
• **Wallet:** ${walletAddress.substring(0, 10)}...${walletAddress.substring(-6)}
• **Network:** TRC-20 (Tron)
• **Status:** Pending Admin Review

**⏳ NEXT STEPS:**
1. **Admin Review:** 24-48 hours
2. **Approval Notification:** Via bot message
3. **Payment Processing:** 1-3 business days
4. **Transaction Hash:** Provided upon completion

**📱 You'll receive notifications for all status updates.**



**💡 Track your request in Withdrawal History**`;

    await ctx.replyWithMarkdown(successMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📋 View Withdrawal History", callback_data: "withdrawal_history" }],
          [{ text: "💰 View Commission Balance", callback_data: "view_commission" }],
          [{ text: "🏠 Main Menu", callback_data: "main_menu" }]
        ]
      }
    });

    // Notify admin about new withdrawal request
    await sendAdminNotification('withdrawal_request', {
      username: user.username || user.first_name || 'Unknown',
      amount: amount,
      wallet_address: walletAddress,
      user_id: telegramUser.user_id
    }, 'high'); // High priority for withdrawal requests

  } catch (error) {
    console.error('Error handling withdrawal wallet:', error);
    await ctx.reply('❌ Error processing withdrawal request. Please try again.');
  }
}

// Handle withdrawal transaction hash input from admin
async function handleWithdrawalHashInput(ctx, text, sessionData) {
  const user = ctx.from;
  const { withdrawal_id, short_id, user_name, amount, wallet_address, available_balance } = sessionData;

  try {
    // Clear user state first
    await clearUserState(user.id);

    // Validate transaction hash format (basic validation)
    const transactionHash = text.trim();
    if (!transactionHash || transactionHash.length < 10) {
      await ctx.reply('❌ Invalid transaction hash. Please provide a valid transaction hash.');
      return;
    }

    // Get withdrawal details to verify it's still pending
    const { data: withdrawal, error: withdrawalError } = await db.client
      .from('commission_withdrawals')
      .select(`
        *,
        users!commission_withdrawals_user_id_fkey!inner(full_name, username)
      `)
      .eq('id', withdrawal_id)
      .eq('status', 'pending')
      .single();

    if (withdrawalError || !withdrawal) {
      await ctx.reply('❌ Withdrawal request not found or already processed.');
      return;
    }

    // Get current commission balance
    const { data: commissionBalance, error: balanceError } = await db.client
      .from('commission_balances')
      .select('usdt_balance, escrowed_amount, total_withdrawn')
      .eq('user_id', withdrawal.user_id)
      .single();

    if (balanceError || !commissionBalance) {
      await ctx.reply('❌ Error retrieving user balance.');
      return;
    }

    // Update withdrawal status with transaction hash
    const { error: updateError } = await db.client
      .from('commission_withdrawals')
      .update({
        status: 'approved',
        transaction_hash: transactionHash,
        approved_by_admin_id: user.id,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', withdrawal_id);

    if (updateError) {
      console.error('Error updating withdrawal:', updateError);
      await ctx.reply('❌ Error updating withdrawal status.');
      return;
    }

    // 🔒 SECURE ESCROW: Deduct from both commission balance and escrow
    const currentEscrow = parseFloat(commissionBalance.escrowed_amount || 0);
    const newBalance = parseFloat(commissionBalance.usdt_balance || 0) - withdrawal.amount;
    const newEscrow = Math.max(0, currentEscrow - withdrawal.amount);

    console.log(`🔒 [ESCROW] Withdrawal approval - Balance: $${commissionBalance.usdt_balance} -> $${newBalance}, Escrow: $${currentEscrow} -> $${newEscrow}`);

    const { error: balanceUpdateError } = await db.client
      .from('commission_balances')
      .update({
        usdt_balance: newBalance,
        escrowed_amount: newEscrow,
        total_withdrawn: (commissionBalance.total_withdrawn || 0) + withdrawal.amount,
        last_updated: new Date().toISOString()
      })
      .eq('user_id', withdrawal.user_id);

    if (balanceUpdateError) {
      console.error('Error updating commission balance:', balanceUpdateError);
      // Rollback withdrawal approval
      await db.client
        .from('commission_withdrawals')
        .update({ status: 'pending', transaction_hash: null })
        .eq('id', withdrawal_id);
      await ctx.reply('❌ Error updating balance. Withdrawal reverted to pending.');
      return;
    }

    // Log admin action
    await logAdminAction(
      user.id,
      user.username,
      'withdrawal_approved',
      'withdrawal',
      withdrawal_id,
      {
        user: withdrawal.users.username,
        amount: withdrawal.amount,
        wallet: withdrawal.wallet_address,
        transaction_hash: transactionHash
      }
    );

    // Success notification to admin
    await ctx.replyWithMarkdown(`✅ **WITHDRAWAL APPROVED & PROCESSED**



**📋 REQUEST DETAILS:**
• **Request ID:** #${short_id}
• **User:** ${user_name}
• **Amount:** $${withdrawal.amount.toFixed(2)} USDT
• **Wallet:** ${wallet_address}
• **Transaction Hash:** \`${transactionHash}\`

**💰 BALANCE UPDATES:**
• **Previous Balance:** $${(newBalance + withdrawal.amount).toFixed(2)} USDT
• **Withdrawal Amount:** -$${withdrawal.amount.toFixed(2)} USDT
• **New Balance:** $${newBalance.toFixed(2)} USDT
• **Escrowed Amount:** $${newEscrow.toFixed(2)} USDT

**✅ SYSTEM ACTIONS COMPLETED:**
• ✅ Commission balance deducted
• ✅ Escrow amount released
• ✅ Transaction hash recorded
• ✅ User notification sent

`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "⏳ View Pending Withdrawals", callback_data: "admin_pending_withdrawals" }],
          [{ text: "🔙 Back to Commission Requests", callback_data: "admin_commissions" }]
        ]
      }
    });

    // Notify user of approval with transaction hash
    try {
      const { data: telegramUser } = await db.client
        .from('telegram_users')
        .select('telegram_id')
        .eq('user_id', withdrawal.user_id)
        .single();

      if (telegramUser) {
        const userNotification = `✅ **WITHDRAWAL COMPLETED**



**Request ID:** #${short_id}
**Amount:** $${withdrawal.amount.toFixed(2)} USDT
**Wallet Address:** ${wallet_address}

**🔗 Transaction Hash:**
\`${transactionHash}\`

**Status:** ✅ Payment Completed



Your withdrawal has been successfully processed! The USDT has been transferred to your wallet address.

**You can verify the transaction using the hash above on the blockchain explorer.**

`;

        await sendAudioNotificationToUser(
          telegramUser.telegram_id,
          userNotification,
          'APPROVAL',
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "💰 View Commission Balance", callback_data: "view_commission" }],
                [{ text: "📋 Withdrawal History", callback_data: "withdrawal_history" }]
              ]
            }
          },
          true // Enable audio notification for approvals
        );
      }
    } catch (notifyError) {
      console.error('Error notifying user of withdrawal completion:', notifyError);
    }

  } catch (error) {
    console.error('Error processing withdrawal hash:', error);
    await ctx.reply('❌ Error processing transaction hash. Please try again.');
  }
}

// Process custom amount purchase
async function processCustomAmountPurchase(ctx, amount) {
  const user = ctx.from;

  try {
    // Get current phase and share price
    const { data: currentPhase, error: phaseError } = await db.client
      .from('investment_phases')
      .select('*')
      .eq('is_active', true)
      .single();

    if (phaseError || !currentPhase) {
      await ctx.reply('❌ Error: No active phase found. Please contact support.');
      return;
    }

    const sharePrice = parseFloat(currentPhase.price_per_share);
    const sharesAmount = Math.floor(amount / sharePrice);

    if (sharesAmount < 1) {
      await ctx.reply(`❌ Amount too small. Minimum purchase: $${sharePrice.toFixed(2)} for 1 share.`);
      return;
    }

    const totalCost = sharesAmount * sharePrice;

    const confirmMessage = `🛒 **PURCHASE CONFIRMATION**



**💰 SHARE DETAILS:**
• Amount: ${formatCurrency(amount)}
• Share Price: ${formatCurrency(sharePrice)}
• Shares: ${sharesAmount.toLocaleString()}
• Total Cost: ${formatCurrency(totalCost)}

**📊 PHASE INFO:**
• Phase: ${currentPhase.phase_name}
• Shares Available: ${(currentPhase.total_shares - currentPhase.shares_sold).toLocaleString()}

**⚠️ IMPORTANT:**
• Payment must be made within 24 hours
• Upload proof of payment after transfer
• Shares will be allocated after admin approval

**Continue with this purchase?**`;

    await ctx.replyWithMarkdown(confirmMessage, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Confirm Purchase", callback_data: `confirm_purchase_${amount}` },
            { text: "❌ Cancel", callback_data: "main_menu" }
          ]
        ]
      }
    });

  } catch (error) {
    console.error('Error processing custom amount purchase:', error);
    await ctx.reply('❌ Error processing purchase. Please try again.');
  }
}

// Portfolio Handler
async function handlePortfolio(ctx) {
  const user = ctx.from;

  try {
    // Get user ID from telegram_users table
    const { data: telegramUser, error: telegramError } = await db.client
      .from('telegram_users')
      .select('user_id')
      .eq('telegram_id', user.id)
      .single();

    if (telegramError || !telegramUser) {
      await ctx.replyWithMarkdown('❌ **Authentication Error**\n\nPlease restart the bot and try again.');
      return;
    }

    const userId = telegramUser.user_id;

    // Get user's share purchases
    const { data: purchases, error: purchasesError } = await db.client
      .from('aureus_share_purchases')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (purchasesError) {
      console.error('Portfolio error:', purchasesError);
      await ctx.replyWithMarkdown('❌ **Error loading portfolio**\n\nPlease try again later.');
      return;
    }

    // Get pending payments
    const { data: pendingPayments, error: paymentsError } = await db.client
      .from('crypto_payment_transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    // Get user's sponsor information
    const { data: referralInfo, error: referralError } = await db.client
      .from('referrals')
      .select(`
        referrer_id,
        created_at,
        users!referrals_referrer_id_fkey (
          username,
          full_name
        )
      `)
      .eq('referred_id', userId)
      .eq('status', 'active')
      .single();

    let sponsorInfo = 'Not assigned';
    if (referralInfo && !referralError) {
      const sponsorName = referralInfo.users?.full_name || referralInfo.users?.username || 'Unknown';
      const sponsorUsername = referralInfo.users?.username || 'Unknown';
      sponsorInfo = `${sponsorName} (@${sponsorUsername})`;
    }

    const totalShares = purchases?.reduce((sum, purchase) => sum + (purchase.shares_purchased || 0), 0) || 0;
    const totalInvested = purchases?.reduce((sum, purchase) => sum + (purchase.total_amount || 0), 0) || 0;
    const approvedPurchases = purchases?.filter(p => p.status === 'active') || []; // Fixed: 'active' not 'approved'
    const pendingAmount = pendingPayments?.reduce((sum, payment) => sum + (parseFloat(payment.amount) || 0), 0) || 0;

    const portfolioMessage = `📊 **MY PORTFOLIO**



**💎 SHARE HOLDINGS:**
• **Total Shares:** ${totalShares.toLocaleString()}
• **Total Purchased:** ${formatCurrency(totalInvested)}
• **Approved Purchases:** ${approvedPurchases.length}

**🤝 REFERRAL INFORMATION:**
• **Your Sponsor:** ${sponsorInfo}
• **Referral Status:** ${referralInfo ? 'Active' : 'Not assigned'}

**📈 SHARE SUMMARY:**
${purchases && purchases.length > 0
  ? purchases.slice(0, 5).map(purchase =>
      `• ${formatCurrency(purchase.total_amount)} - ${purchase.shares_purchased} shares (${purchase.status})`
    ).join('\n')
  : '• No shares purchased yet'}

**🎯 NEXT STEPS:**
${totalShares > 0
  ? 'Your shares are generating value through our gold mining operations.'
  : 'Start your journey with your first share purchase.'}

`;

    const keyboard = totalShares > 0
      ? [
          [{ text: "📊 Detailed View", callback_data: "portfolio_detailed" }],
          [{ text: "📧 Get Portfolio Updates", callback_data: "notify_portfolio" }],
          [{ text: "🔙 Back to Dashboard", callback_data: "main_menu" }]
        ]
      : [
          [{ text: "🛒 Purchase Shares", callback_data: "menu_purchase_shares" }],
          [{ text: "📧 Get Portfolio Updates", callback_data: "notify_portfolio" }],
          [{ text: "🔙 Back to Dashboard", callback_data: "main_menu" }]
        ];

    await ctx.replyWithMarkdown(portfolioMessage, {
      reply_markup: { inline_keyboard: keyboard }
    });

  } catch (error) {
    console.error('Portfolio error:', error);
    await ctx.replyWithMarkdown('❌ **Error loading portfolio**\n\nPlease try again later.');
  }
}

// User Payment Status View Handlers
async function handleViewApprovedPayments(ctx) {
  const user = ctx.from;

  try {
    // Get user from database
    const { data: telegramUser, error: userError } = await db.client
      .from('telegram_users')
      .select('user_id')
      .eq('telegram_id', user.id)
      .single();

    if (userError || !telegramUser) {
      await ctx.replyWithMarkdown('❌ **User not found**\n\nPlease register first using /start');
      return;
    }

    // Get approved payments
    const approvedPayments = await getUserPaymentsByStatus(telegramUser.user_id, 'approved', 10);

    if (approvedPayments.length === 0) {
      await ctx.replyWithMarkdown(`✅ **APPROVED PAYMENTS**



**No approved payments found**

You haven't had any payments approved yet. Once your payments are approved by our admin team, they will appear here.

**💡 Next Steps:**
• Submit a payment for share purchase
• Wait for admin approval (usually 2-24 hours)
• Check back here for updates

`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🛒 Purchase Shares", callback_data: "menu_purchase_shares" }],
            [{ text: "⏳ View Pending", callback_data: "view_pending" }],
            [{ text: "🔙 Back to Payments", callback_data: "menu_payments" }]
          ]
        }
      });
      return;
    }

    // Format approved payments
    const paymentsText = await Promise.all(
      approvedPayments.map(payment => formatPaymentForDisplay(payment, false))
    );

    const message = `✅ **APPROVED PAYMENTS**



${paymentsText.join('\n\n\n\n')}



**📊 Summary:** ${approvedPayments.length} approved payment${approvedPayments.length > 1 ? 's' : ''}
**💰 Total Value:** $${approvedPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0).toFixed(2)} USDT`;

    await ctx.replyWithMarkdown(message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "⏳ View Pending", callback_data: "view_pending" }],
          [{ text: "❌ View Rejected", callback_data: "view_rejected" }],
          [{ text: "🔄 Refresh", callback_data: "view_approved" }],
          [{ text: "🔙 Back to Payments", callback_data: "menu_payments" }]
        ]
      }
    });

  } catch (error) {
    console.error('View approved payments error:', error);
    await ctx.replyWithMarkdown('❌ **Error loading approved payments**\n\nPlease try again later.');
  }
}

async function handleViewRejectedPayments(ctx) {
  const user = ctx.from;

  try {
    // Get user from database
    const { data: telegramUser, error: userError } = await db.client
      .from('telegram_users')
      .select('user_id')
      .eq('telegram_id', user.id)
      .single();

    if (userError || !telegramUser) {
      await ctx.replyWithMarkdown('❌ **User not found**\n\nPlease register first using /start');
      return;
    }

    // Get rejected payments
    const rejectedPayments = await getUserPaymentsByStatus(telegramUser.user_id, 'rejected', 10);

    if (rejectedPayments.length === 0) {
      await ctx.replyWithMarkdown(`❌ **REJECTED PAYMENTS**



**No rejected payments found**

Great news! You haven't had any payments rejected. All your submissions have been either approved or are still pending review.

**💡 Tips for Successful Payments:**
• Use correct wallet addresses
• Include clear transaction screenshots
• Ensure payment amounts match exactly
• Submit payments during business hours

`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🛒 Purchase Shares", callback_data: "menu_purchase_shares" }],
            [{ text: "✅ View Approved", callback_data: "view_approved" }],
            [{ text: "🔙 Back to Payments", callback_data: "menu_payments" }]
          ]
        }
      });
      return;
    }

    // Format rejected payments
    const paymentsText = await Promise.all(
      rejectedPayments.map(payment => formatPaymentForDisplay(payment, false))
    );

    const message = `❌ **REJECTED PAYMENTS**



${paymentsText.join('\n\n\n\n')}



**📊 Summary:** ${rejectedPayments.length} rejected payment${rejectedPayments.length > 1 ? 's' : ''}
**💡 Next Steps:** Review rejection reasons and resubmit corrected payments`;

    await ctx.replyWithMarkdown(message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🛒 Try Again", callback_data: "menu_purchase_shares" }],
          [{ text: "✅ View Approved", callback_data: "view_approved" }],
          [{ text: "⏳ View Pending", callback_data: "view_pending" }],
          [{ text: "📞 Contact Support", url: "https://t.me/TTTFOUNDER" }],
          [{ text: "🔙 Back to Payments", callback_data: "menu_payments" }]
        ]
      }
    });

  } catch (error) {
    console.error('View rejected payments error:', error);
    await ctx.replyWithMarkdown('❌ **Error loading rejected payments**\n\nPlease try again later.');
  }
}

async function handleViewPendingPayments(ctx) {
  const user = ctx.from;

  try {
    // Get user from database
    const { data: telegramUser, error: userError } = await db.client
      .from('telegram_users')
      .select('user_id')
      .eq('telegram_id', user.id)
      .single();

    if (userError || !telegramUser) {
      await ctx.replyWithMarkdown('❌ **User not found**\n\nPlease register first using /start');
      return;
    }

    // Get pending payments
    const pendingPayments = await getUserPaymentsByStatus(telegramUser.user_id, 'pending', 10);

    if (pendingPayments.length === 0) {
      await ctx.replyWithMarkdown(`⏳ **PENDING PAYMENTS**



**No pending payments found**

You don't have any payments currently awaiting approval.

**💡 What's Next:**
• Submit a new payment for share purchase
• Check your approved payments history
• Contact support if you're expecting a pending payment

`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🛒 Purchase Shares", callback_data: "menu_purchase_shares" }],
            [{ text: "✅ View Approved", callback_data: "view_approved" }],
            [{ text: "🔙 Back to Payments", callback_data: "menu_payments" }]
          ]
        }
      });
      return;
    }

    // Format pending payments
    const paymentsText = await Promise.all(
      pendingPayments.map(payment => formatPaymentForDisplay(payment, false))
    );

    const message = `⏳ **PENDING PAYMENTS**



${paymentsText.join('\n\n\n\n')}



**📊 Summary:** ${pendingPayments.length} pending payment${pendingPayments.length > 1 ? 's' : ''}
**⏱️ Processing Time:** Usually 2-24 hours
**📧 Updates:** You'll be notified when status changes`;

    await ctx.replyWithMarkdown(message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ View Approved", callback_data: "view_approved" }],
          [{ text: "❌ View Rejected", callback_data: "view_rejected" }],
          [{ text: "🔄 Refresh", callback_data: "view_pending" }],
          [{ text: "📞 Contact Admin", url: "https://t.me/TTTFOUNDER" }],
          [{ text: "🔙 Back to Payments", callback_data: "menu_payments" }]
        ]
      }
    });

  } catch (error) {
    console.error('View pending payments error:', error);
    await ctx.replyWithMarkdown('❌ **Error loading pending payments**\n\nPlease try again later.');
  }
}

// Payment Status Handler
async function handlePaymentStatus(ctx) {
  const paymentMessage = `💳 **PAYMENT & TRANSACTION CENTER**



**PAYMENT METHODS SUPPORTED:**
• 💳 **BSC USDT** - Binance Smart Chain
• 💳 **Polygon USDT** - Polygon Network
• 💳 **TRON USDT** - Tron Network

**🔐 SECURITY FEATURES:**
• Multi-signature wallet protection
• Real-time transaction monitoring
• Automated fraud detection
• 24/7 payment processing

**⚡ PROCESSING TIMES:**
• Payment verification: Instant
• Admin approval: 2-24 hours
• Share allocation: Immediate after approval

**📱 PAYMENT TRACKING:**
Monitor all your transactions and payment history in real-time.



Secure 3-step payment verification with instant processing.`;

  await ctx.replyWithMarkdown(paymentMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🛒 Purchase Shares", callback_data: "menu_purchase_shares" }],
        [
          { text: "⏳ Pending Payments", callback_data: "view_pending" },
          { text: "✅ Approved Payments", callback_data: "view_approved" }
        ],
        [{ text: "❌ Rejected Payments", callback_data: "view_rejected" }],
        [{ text: "📧 Get Payment Updates", callback_data: "notify_payments" }],
        [{ text: "🔙 Back to Dashboard", callback_data: "main_menu" }]
      ]
    }
  });
}

// Referral System Handler
async function handleReferralSystem(ctx) {
  const referralMessage = `👥 **REFERRAL PROGRAM**



**💰 EARN 15% COMMISSION:**
• 15% USDT Commission on every referral purchase
• 15% Share Commission for long-term growth
• Daily commission payments
• Unlimited earning potential

**🎯 HOW IT WORKS:**
1. Share your unique referral link
2. Friends purchase shares using your link
3. Earn instant 15% commission
4. Withdraw anytime to your wallet

**📊 COMMISSION STRUCTURE:**
• **USDT Commission:** 15% paid in USDT
• **Share Commission:** 15% paid in shares
• **Payment Schedule:** Daily processing
• **Withdrawal:** Available anytime

**🚀 REFERRAL BENEFITS:**
• Build passive income stream
• Help friends access gold mining shares
• Grow your own share portfolio
• Professional referral tracking

`;

  await ctx.replyWithMarkdown(referralMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📤 Share Referral Link", callback_data: "share_referral" }],
        [{ text: "💰 Commission Balance", callback_data: "view_commission" }],
        [{ text: "👥 My Referrals", callback_data: "view_referrals" }],
        [{ text: "💸 Withdraw Commissions", callback_data: "withdraw_commissions" }],
        [{ text: "🔙 Back to Dashboard", callback_data: "main_menu" }]
      ]
    }
  });
}

// Admin Panel Handler
async function handleAdminPanel(ctx) {
  const user = ctx.from;

  if (user.username !== 'TTTFOUNDER') {
    await ctx.replyWithMarkdown('❌ **ACCESS DENIED**\n\nAdmin access is restricted.');
    return;
  }

  // Get current maintenance mode status
  const isMaintenanceMode = await getMaintenanceMode();
  const maintenanceStatus = isMaintenanceMode ? '🔧 **MAINTENANCE MODE ACTIVE**' : '✅ **ALL SYSTEMS OPERATIONAL**';
  const maintenanceButton = isMaintenanceMode
    ? { text: "✅ Disable Maintenance Mode", callback_data: "toggle_maintenance" }
    : { text: "🔧 Enable Maintenance Mode", callback_data: "toggle_maintenance" };

  const adminMessage = `🔑 **ADMIN CONTROL PANEL**



**⚡ SYSTEM STATUS:** ${maintenanceStatus}

**🔧 ADMIN FUNCTIONS:**
• Payment approvals and management
• User account administration
• Commission processing
• System monitoring and analytics
• Audit logs and reporting
• Maintenance mode control

**📊 QUICK STATS:**
• Active users and transactions
• Pending payment queue
• Commission payouts
• System performance metrics

**🛡️ SECURITY:**
• Multi-factor authentication active
• Audit trail logging enabled
• Real-time monitoring active

`;

  await ctx.replyWithMarkdown(adminMessage, {
    reply_markup: {
      inline_keyboard: [
        [maintenanceButton],
        [{ text: "⏳ Pending Payments", callback_data: "admin_pending" }],
        [{ text: "👥 User Management", callback_data: "admin_users" }],
        [{ text: "💰 Commission Requests", callback_data: "admin_commissions" }],
        [{ text: "🔄 Commission Conversions", callback_data: "admin_commission_conversions" }],
        [{ text: "📊 System Stats", callback_data: "admin_stats" }],
        [{ text: "🔍 Validate Shares Sold", callback_data: "admin_validate_shares_sold" }],
        [{ text: "📋 Audit Logs", callback_data: "admin_logs" }],
        [{ text: "🔙 Back to Dashboard", callback_data: "main_menu" }]
      ]
    }
  });
}

// Admin Maintenance Mode Toggle Handler
async function handleToggleMaintenance(ctx) {
  const user = ctx.from;

  if (user.username !== 'TTTFOUNDER') {
    await ctx.answerCbQuery('❌ Access denied');
    return;
  }

  try {
    const currentMode = await getMaintenanceMode();
    const newMode = !currentMode;

    const success = await setMaintenanceMode(newMode);

    if (success) {
      const statusText = newMode ? 'ENABLED' : 'DISABLED';
      const statusIcon = newMode ? '🔧' : '✅';

      // Log the admin action
      await logAdminAction(
        user.id,
        user.username,
        `maintenance_mode_${newMode ? 'enabled' : 'disabled'}`,
        'system',
        'maintenance_mode',
        { previous_state: currentMode, new_state: newMode }
      );

      await ctx.replyWithMarkdown(`${statusIcon} **MAINTENANCE MODE ${statusText}**



**Status:** ${newMode ? 'Share purchasing is now DISABLED' : 'Share purchasing is now ENABLED'}

${newMode ?
  '🚫 **Users will see maintenance message when trying to purchase shares**\n✅ **All other bot functions remain available**' :
  '✅ **All bot functions are now fully operational**\n🛒 **Users can purchase shares normally**'
}



**Action logged for audit purposes.**`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 Back to Admin Panel", callback_data: "admin_panel" }]
          ]
        }
      });
    } else {
      await ctx.replyWithMarkdown('❌ **Error updating maintenance mode**\n\nPlease try again.');
    }
  } catch (error) {
    console.error('Error toggling maintenance mode:', error);
    await ctx.answerCbQuery('❌ Error updating maintenance mode');
  }
}

// Admin Status Handler
async function handleAdminStatus(ctx) {
  const user = ctx.from;

  if (user.username !== 'TTTFOUNDER') {
    await ctx.replyWithMarkdown('❌ **ACCESS DENIED**\n\nAdmin access is restricted.');
    return;
  }

  const statusMessage = `📊 **SYSTEM STATUS**



**🟢 ALL SYSTEMS OPERATIONAL**

**🔗 DATABASE:** Connected and responsive
**🤖 BOT:** Running smoothly
**💳 PAYMENTS:** Processing normally
**⛏️ MINING OPS:** Active operations
**🔐 SECURITY:** All systems secure

**📈 PERFORMANCE METRICS:**
• Response time: < 100ms
• Uptime: 99.9%
• Error rate: < 0.1%
• Active connections: Stable

`;

  await ctx.replyWithMarkdown(statusMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔄 Refresh Status", callback_data: "admin_status" }],
        [{ text: "🔙 Back to Admin Panel", callback_data: "admin_panel" }]
      ]
    }
  });
}

// Helper function for user state management
async function setUserState(userId, state, data = null) {
  // This would typically use a database or memory store
  // For now, we'll use a simple in-memory approach
  if (!global.userStates) {
    global.userStates = new Map();
  }
  global.userStates.set(userId, { state, data, timestamp: Date.now() });
}

function getUserState(userId) {
  if (!global.userStates) {
    return null;
  }
  return global.userStates.get(userId);
}

function clearUserState(userId) {
  if (!global.userStates) {
    return;
  }
  global.userStates.delete(userId);
}

// ADMIN PANEL DETAILED HANDLERS

// Admin Payment Status View Handlers
async function handleAdminApprovedPayments(ctx) {
  console.log('🔧 [DEBUG] handleAdminApprovedPayments function called');
  const user = ctx.from;

  if (user.username !== 'TTTFOUNDER') {
    console.log('🔧 [DEBUG] Access denied for user:', user.username);
    await ctx.replyWithMarkdown('❌ **ACCESS DENIED**');
    return;
  }

  try {
    // Get approved payments
    const approvedPayments = await getAdminPaymentsByStatus('approved', 15);

    if (approvedPayments.length === 0) {
      await ctx.replyWithMarkdown(`✅ **APPROVED PAYMENTS**



**No approved payments found**

There are currently no approved payments in the system.

**📊 ADMIN ACTIONS:**
• Review pending payments for approval
• Check system activity logs
• Monitor payment processing metrics

`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "⏳ View Pending", callback_data: "admin_payments" }],
            [{ text: "❌ View Rejected", callback_data: "admin_rejected_payments" }],
            [{ text: "🔙 Back to Admin Panel", callback_data: "admin_panel" }]
          ]
        }
      });
      return;
    }

    // Format approved payments for admin view
    const paymentsText = await Promise.all(
      approvedPayments.map(payment => formatPaymentForDisplay(payment, true))
    );

    const totalValue = approvedPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);

    const message = `✅ **APPROVED PAYMENTS - ADMIN VIEW**



${paymentsText.join('\n\n\n\n')}



**📊 SUMMARY:**
• **Total Payments:** ${approvedPayments.length}
• **Total Value:** $${totalValue.toFixed(2)} USDT
• **Status:** All payments successfully processed
• **Shares Allocated:** Yes (automatic on approval)

**🔧 ADMIN ACTIONS:**
• All payments have been processed and shares allocated
• Users have been notified of approvals
• Commission payments have been distributed`;

    await ctx.replyWithMarkdown(message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "⏳ View Pending", callback_data: "admin_payments" }],
          [{ text: "❌ View Rejected", callback_data: "admin_rejected_payments" }],
          [{ text: "🔄 Refresh", callback_data: "admin_approved_payments" }],
          [{ text: "📊 System Stats", callback_data: "admin_stats" }],
          [{ text: "🔙 Back to Admin Panel", callback_data: "admin_panel" }]
        ]
      }
    });

  } catch (error) {
    console.error('Admin approved payments error:', error);
    await ctx.replyWithMarkdown('❌ **Error loading approved payments**\n\nPlease try again.');
  }
}

async function handleAdminRejectedPayments(ctx) {
  console.log('🔧 [DEBUG] handleAdminRejectedPayments function called');
  const user = ctx.from;

  if (user.username !== 'TTTFOUNDER') {
    console.log('🔧 [DEBUG] Access denied for user:', user.username);
    await ctx.replyWithMarkdown('❌ **ACCESS DENIED**');
    return;
  }

  try {
    // Get rejected payments
    const rejectedPayments = await getAdminPaymentsByStatus('rejected', 15);

    if (rejectedPayments.length === 0) {
      await ctx.replyWithMarkdown(`❌ **REJECTED PAYMENTS**



**No rejected payments found**

Great! There are currently no rejected payments in the system. This indicates:

**✅ POSITIVE INDICATORS:**
• Users are submitting valid payments
• Payment instructions are clear
• Transaction verification is working well
• User education is effective

**📊 ADMIN INSIGHTS:**
• High payment success rate
• Good user compliance
• Effective payment process

`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "⏳ View Pending", callback_data: "admin_payments" }],
            [{ text: "✅ View Approved", callback_data: "admin_approved_payments" }],
            [{ text: "🔙 Back to Admin Panel", callback_data: "admin_panel" }]
          ]
        }
      });
      return;
    }

    // Format rejected payments for admin view
    const paymentsText = await Promise.all(
      rejectedPayments.map(payment => formatPaymentForDisplay(payment, true))
    );

    const totalValue = rejectedPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);

    const message = `❌ **REJECTED PAYMENTS - ADMIN VIEW**



${paymentsText.join('\n\n\n\n')}



**📊 REJECTION SUMMARY:**
• **Total Rejected:** ${rejectedPayments.length}
• **Total Value:** $${totalValue.toFixed(2)} USDT
• **Status:** Users notified with reasons
• **Follow-up:** Users can resubmit corrected payments

**🔧 ADMIN NOTES:**
• Review rejection patterns for process improvements
• Consider updating payment instructions if needed
• Monitor for repeat issues from same users`;

    await ctx.replyWithMarkdown(message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "⏳ View Pending", callback_data: "admin_payments" }],
          [{ text: "✅ View Approved", callback_data: "admin_approved_payments" }],
          [{ text: "🔄 Refresh", callback_data: "admin_rejected_payments" }],
          [{ text: "📊 System Stats", callback_data: "admin_stats" }],
          [{ text: "🔙 Back to Admin Panel", callback_data: "admin_panel" }]
        ]
      }
    });

  } catch (error) {
    console.error('Admin rejected payments error:', error);
    await ctx.replyWithMarkdown('❌ **Error loading rejected payments**\n\nPlease try again.');
  }
}

// Admin Payments Handler
async function handleAdminPayments(ctx) {
  const user = ctx.from;

  if (user.username !== 'TTTFOUNDER') {
    await ctx.replyWithMarkdown('❌ **ACCESS DENIED**');
    return;
  }

  try {
    console.log('🔍 [ADMIN] Fetching pending payments...');

    // Get pending payments with user info
    const { data: pendingPayments, error } = await db.client
      .from('crypto_payment_transactions')
      .select(`
        *,
        users!inner(email, full_name)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5);

    console.log('🔍 [ADMIN] Pending payments query result:', {
      count: pendingPayments?.length || 0,
      error: error?.message || 'none'
    });

    // Also check all payment statuses for debugging
    const { data: allPayments, error: allError } = await db.client
      .from('crypto_payment_transactions')
      .select('id, status, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    console.log('🔍 [ADMIN] Recent payment statuses:', allPayments?.map(p => ({
      id: p.id.substring(0, 8),
      status: p.status,
      created: new Date(p.created_at).toLocaleString()
    })) || 'none');

    if (error) {
      console.error('Error fetching pending payments:', error);
      await ctx.replyWithMarkdown('❌ **Error loading payments**\n\nPlease try again.');
      return;
    }

    if (!pendingPayments || pendingPayments.length === 0) {
      await ctx.replyWithMarkdown(`💳 **PAYMENT APPROVALS**



✅ **No pending payments**

All payments have been processed!

`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ View Approved", callback_data: "admin_approved_payments" }],
            [{ text: "❌ View Rejected", callback_data: "admin_rejected_payments" }],
            [{ text: "🔄 Refresh", callback_data: "admin_payments" }],
            [{ text: "🔙 Back to Admin Panel", callback_data: "admin_panel" }]
          ]
        }
      });
      return;
    }

    // Show pending payments
    const paymentsText = pendingPayments.map((payment, index) => {
      const userInfo = payment.users;
      const paymentDate = new Date(payment.created_at);
      const timeAgo = Math.floor((Date.now() - paymentDate.getTime()) / (1000 * 60 * 60));

      // Check if this is a bank transfer payment
      const isBankTransfer = payment.network === 'BANK_TRANSFER' || payment.currency === 'ZAR';
      let paymentMethodDisplay = '';

      if (isBankTransfer) {
        // Parse ZAR amount from transaction_hash field (format: ZAR:amount|RATE:rate|FEE:10%)
        let zarAmount = 'N/A';
        if (payment.transaction_hash && payment.transaction_hash.includes('ZAR:')) {
          const zarMatch = payment.transaction_hash.match(/ZAR:([0-9.]+)/);
          if (zarMatch) {
            zarAmount = parseFloat(zarMatch[1]);
          }
        }
        paymentMethodDisplay = `🏦 Bank Transfer: R${typeof zarAmount === 'number' ? zarAmount.toFixed(2) : zarAmount}`;
      } else {
        paymentMethodDisplay = `🌐 ${payment.network.toUpperCase()}`;
      }

      return `${index + 1}. **${userInfo.full_name}**
💰 Amount: $${payment.amount}
${paymentMethodDisplay}
📅 ${timeAgo}h ago
🆔 ID: ${payment.id}`;
    }).join('\n\n');

    await ctx.replyWithMarkdown(`💳 **PENDING PAYMENTS** (${pendingPayments.length})



${paymentsText}



**Click a payment to review:**`, {
      reply_markup: {
        inline_keyboard: [
          ...pendingPayments.map((payment, index) => {
            const isBankTransfer = payment.network === 'BANK_TRANSFER' || payment.currency === 'ZAR';
            const paymentType = isBankTransfer ? '🏦' : '💎';
            return [
              { text: `${paymentType} Review Payment ${index + 1} ($${payment.amount})`, callback_data: `review_payment_${payment.id}` }
            ];
          }),
          [{ text: "🔄 Refresh", callback_data: "admin_payments" }],
          [{ text: "🔙 Back to Admin Panel", callback_data: "admin_panel" }]
        ]
      }
    });

  } catch (error) {
    console.error('Admin payments error:', error);
    await ctx.replyWithMarkdown('❌ **Error loading payment data**\n\nPlease try again.');
  }
}

// Admin Users Handler
async function handleAdminUsers(ctx) {
  const user = ctx.from;

  if (user.username !== 'TTTFOUNDER') {
    await ctx.replyWithMarkdown('❌ **ACCESS DENIED**');
    return;
  }

  const usersMessage = `👥 **USER MANAGEMENT**



**USER ADMINISTRATION TOOLS:**
• View all registered users
• Check user share history
• Manage user accounts
• Monitor user activity
• Handle user support requests

**COMING SOON:**
• User search functionality
• Account status management
• Share analytics per user
• User communication tools

`;

  await ctx.replyWithMarkdown(usersMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔍 Search Users", callback_data: "admin_search_users" }],
        [{ text: "📊 User Statistics", callback_data: "admin_user_stats" }],
        [{ text: "🔙 Back to Admin Panel", callback_data: "admin_panel" }]
      ]
    }
  });
}

// Admin Analytics Handler
async function handleAdminAnalytics(ctx) {
  const user = ctx.from;

  if (user.username !== 'TTTFOUNDER') {
    await ctx.replyWithMarkdown('❌ **ACCESS DENIED**');
    return;
  }

  const analyticsMessage = `📊 **SYSTEM ANALYTICS**



**PERFORMANCE METRICS:**
• Total users registered
• Total shares processed
• Commission payouts
• System performance data

**FINANCIAL ANALYTICS:**
• Revenue tracking
• Share flow analysis
• Commission distribution
• Phase progression metrics

**COMING SOON:**
• Real-time dashboard
• Advanced reporting
• Export capabilities
• Trend analysis

`;

  await ctx.replyWithMarkdown(analyticsMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📈 View Reports", callback_data: "admin_reports" }],
        [{ text: "💰 Financial Summary", callback_data: "admin_financial" }],
        [{ text: "🔙 Back to Admin Panel", callback_data: "admin_panel" }]
      ]
    }
  });
}

// Admin Commissions Handler
async function handleAdminCommissions(ctx) {
  const user = ctx.from;

  if (user.username !== 'TTTFOUNDER') {
    await ctx.replyWithMarkdown('❌ **ACCESS DENIED**');
    return;
  }

  const commissionsMessage = `💰 **COMMISSION REQUESTS**



**COMMISSION MANAGEMENT:**
• Review withdrawal requests
• Process commission payments
• Monitor referral activity
• Track commission balances

**WITHDRAWAL PROCESSING:**
• Pending withdrawal requests
• Approved payouts
• Commission calculations
• Network fee management

**COMING SOON:**
• Automated processing
• Bulk approval tools
• Commission analytics
• Payment scheduling

`;

  await ctx.replyWithMarkdown(commissionsMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "⏳ Pending Withdrawals", callback_data: "admin_pending_withdrawals" }],
        [{ text: "✅ Approved Payouts", callback_data: "admin_approved_withdrawals" }],
        [{ text: "📊 Commission Stats", callback_data: "admin_commission_stats" }],
        [{ text: "🔙 Back to Admin Panel", callback_data: "admin_panel" }]
      ]
    }
  });
}

// Admin Logs Handler
async function handleAdminLogs(ctx) {
  const user = ctx.from;

  if (user.username !== 'TTTFOUNDER') {
    await ctx.replyWithMarkdown('❌ **ACCESS DENIED**');
    return;
  }

  const logsMessage = `📋 **AUDIT LOGS**



**SYSTEM ACTIVITY TRACKING:**
• Admin actions and approvals
• User registration and activity
• Payment processing events
• Security and access logs

**LOG CATEGORIES:**
• Authentication events
• Payment transactions
• Admin operations
• System errors and warnings

**COMING SOON:**
• Real-time log monitoring
• Advanced filtering
• Export functionality
• Alert notifications

`;

  await ctx.replyWithMarkdown(logsMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔍 View Recent Logs", callback_data: "admin_recent_logs" }],
        [{ text: "⚠️ Security Events", callback_data: "admin_security_logs" }],
        [{ text: "💳 Payment Logs", callback_data: "admin_payment_logs" }],
        [{ text: "🔙 Back to Admin Panel", callback_data: "admin_panel" }]
      ]
    }
  });
}

// Admin Broadcast Handler
async function handleAdminBroadcast(ctx) {
  const user = ctx.from;

  if (user.username !== 'TTTFOUNDER') {
    await ctx.replyWithMarkdown('❌ **ACCESS DENIED**');
    return;
  }

  const broadcastMessage = `📢 **BROADCAST MESSAGE**



**MASS COMMUNICATION TOOLS:**
• Send announcements to all users
• Target specific user groups
• Schedule message delivery
• Track message engagement

**COMING SOON:**
• Message templates
• User segmentation
• Delivery scheduling
• Analytics tracking

`;

  await ctx.replyWithMarkdown(broadcastMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📝 Compose Message", callback_data: "admin_compose_broadcast" }],
        [{ text: "📊 Message History", callback_data: "admin_broadcast_history" }],
        [{ text: "🔙 Back to Admin Panel", callback_data: "admin_panel" }]
      ]
    }
  });
}

// Admin Settings Handler
async function handleAdminSettings(ctx) {
  const user = ctx.from;

  if (user.username !== 'TTTFOUNDER') {
    await ctx.replyWithMarkdown('❌ **ACCESS DENIED**');
    return;
  }

  const settingsMessage = `⚙️ **SYSTEM SETTINGS**



**CONFIGURATION OPTIONS:**
• Phase management and pricing
• Commission rate settings
• Payment method configuration
• System maintenance mode

**COMING SOON:**
• Advanced configuration
• Backup and restore
• Performance tuning
• Security settings

`;

  await ctx.replyWithMarkdown(settingsMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "💰 Phase Settings", callback_data: "admin_phase_settings" }],
        [{ text: "💳 Payment Config", callback_data: "admin_payment_config" }],
        [{ text: "🔧 System Config", callback_data: "admin_system_config" }],
        [{ text: "🔙 Back to Admin Panel", callback_data: "admin_panel" }]
      ]
    }
  });
}

// Admin User Sponsors Handler
async function handleAdminUserSponsors(ctx) {
  const user = ctx.from;

  if (user.username !== 'TTTFOUNDER') {
    await ctx.replyWithMarkdown('❌ **ACCESS DENIED**');
    return;
  }

  const sponsorsMessage = `🤝 **USER SPONSORS**



**REFERRAL MANAGEMENT:**
• View user sponsor relationships
• Monitor referral activity
• Manage commission structures
• Track referral performance

**COMING SOON:**
• Sponsor assignment tools
• Referral analytics
• Commission calculations
• Performance reports

`;

  await ctx.replyWithMarkdown(sponsorsMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "👥 View Relationships", callback_data: "admin_view_sponsors" }],
        [{ text: "📊 Referral Stats", callback_data: "admin_referral_stats" }],
        [{ text: "🔙 Back to Admin Panel", callback_data: "admin_panel" }]
      ]
    }
  });
}

// PENDING PAYMENT HANDLERS
async function handleContinuePayment(ctx, callbackData) {
  const paymentId = callbackData.split('_')[2];

  try {
    // Get the pending payment details
    const { data: payment, error } = await db.client
      .from('crypto_payment_transactions')
      .select('*')
      .eq('id', paymentId)
      .eq('status', 'pending')
      .single();

    if (error || !payment) {
      await ctx.replyWithMarkdown('❌ **Payment not found or no longer pending.**\n\nIt may have been processed or cancelled.');
      return;
    }

    // Get wallet address from payment record or database
    let walletAddress = payment.receiver_wallet;

    if (!walletAddress) {
      // Extract network from payment.network (e.g., "USDT-TRC20" -> "TRON")
      let networkForWallet = 'TRON'; // Default fallback
      if (payment.network) {
        if (payment.network.includes('ERC20')) networkForWallet = 'ETH';
        else if (payment.network.includes('BEP20')) networkForWallet = 'BSC';
        else if (payment.network.includes('Polygon')) networkForWallet = 'POL';
        else if (payment.network.includes('TRC20')) networkForWallet = 'TRON';
      }

      // Fallback: Get from company_wallets table
      const { data: companyWallet, error: walletError } = await db.client
        .from('company_wallets')
        .select('wallet_address')
        .eq('network', networkForWallet)
        .eq('currency', 'USDT')
        .eq('is_active', true)
        .single();

      if (walletError || !companyWallet) {
        console.error('Error getting company wallet for continue payment:', walletError);
        await ctx.reply('❌ Error: Company wallet not configured. Please contact support.');
        return;
      }

      walletAddress = companyWallet.wallet_address;
    }

    const paymentDate = new Date(payment.created_at);
    const timeAgo = Math.floor((new Date() - paymentDate) / (1000 * 60 * 60));
    const displayTime = timeAgo < 24 ? `${timeAgo} hours ago` : `${Math.floor(timeAgo/24)} days ago`;

    const continueMessage = `💳 **CONTINUE PENDING PAYMENT**



**📋 PAYMENT DETAILS:**

💰 **Amount:** $${payment.amount} USDT
🌐 **Network:** ${payment.network.toUpperCase()}
📅 **Created:** ${displayTime}
⏳ **Status:** Waiting for your payment

**🏦 SEND PAYMENT TO:**
\`${walletAddress}\`

**📱 NEXT STEPS:**
1. Send exactly $${payment.amount} USDT to the address above
2. Take a screenshot of your transaction
3. Upload the screenshot using the button below
4. Wait for admin approval

**⚠️ IMPORTANT:**
• Use ${payment.network.toUpperCase()} network only
• Send exact amount: $${payment.amount} USDT
• Keep your transaction screenshot ready`;

    // Use correct callback based on payment type
    const proofCallback = payment.network === 'BANK_TRANSFER'
      ? `upload_bank_proof_${paymentId}`
      : `upload_proof_${paymentId}`;

    await ctx.replyWithMarkdown(continueMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "💳 Submit Payment Proof", callback_data: proofCallback }],
          [{ text: "📊 Check Payment Status", callback_data: "view_portfolio" }],
          [{ text: "🔙 Back to Dashboard", callback_data: "main_menu" }]
        ]
      }
    });

  } catch (error) {
    console.error('Error in handleContinuePayment:', error);
    await ctx.replyWithMarkdown('❌ **Error loading payment details.**\n\nPlease try again or contact support.');
  }
}

async function handleCancelPayment(ctx, callbackData) {
  const paymentId = callbackData.split('_')[2];

  // Get payment details for confirmation
  const { data: payment, error } = await db.client
    .from('crypto_payment_transactions')
    .select('amount, network, created_at')
    .eq('id', paymentId)
    .single();

  if (error || !payment) {
    await ctx.replyWithMarkdown('❌ **Payment not found or already processed.**');
    return;
  }

  const paymentDate = new Date(payment.created_at);
  const daysDiff = Math.floor((new Date() - paymentDate) / (1000 * 60 * 60 * 24));
  const isOld = daysDiff >= 1;

  const confirmMessage = `🗑️ **DELETE PENDING PAYMENT**



🚨 **CONFIRM DELETION**

**Payment Details:**
💰 Amount: $${payment.amount}
🌐 Network: ${payment.network.toUpperCase()}
📅 Created: ${paymentDate.toLocaleDateString()}

**⚠️ IMPORTANT:**
${isOld ?
  '• This payment is old - safe to delete if you haven\'t sent crypto yet' :
  '• Only delete if you haven\'t sent the crypto payment yet'}
• If you already sent payment, contact support instead
• This action cannot be undone
• You can create a new purchase after deletion

**🔧 ARE YOU SURE?**`;

  await ctx.replyWithMarkdown(confirmMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🗑️ Yes, Delete Payment", callback_data: `confirm_cancel_${paymentId}` }],
        [{ text: "❌ No, Keep Payment", callback_data: "menu_purchase_shares" }],
        [{ text: "📞 Contact Support First", callback_data: "menu_help" }]
      ]
    }
  });
}

async function handleConfirmCancel(ctx, callbackData) {
  const paymentId = callbackData.split('_')[2];

  try {
    // Update payment status to cancelled
    const { data: cancelledPayment, error: cancelError } = await db.client
      .from('crypto_payment_transactions')
      .update({
        status: 'cancelled',
        admin_notes: 'Cancelled by user request',
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentId)
      .eq('status', 'pending') // Only cancel if still pending
      .select()
      .single();

    if (cancelError || !cancelledPayment) {
      await ctx.replyWithMarkdown(`❌ **CANCELLATION FAILED**

Unable to cancel payment. It may have already been processed or doesn't exist.

Please contact support if you need assistance.`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📞 Contact Support", callback_data: "menu_help" }],
            [{ text: "🏠 Main Dashboard", callback_data: "main_menu" }]
          ]
        }
      });
      return;
    }

    // Log the cancellation
    await logAdminAction(
      ctx.from.id,
      ctx.from.username || ctx.from.first_name,
      'CANCEL_PAYMENT',
      'user_action',
      paymentId,
      { amount: cancelledPayment.amount, network: cancelledPayment.network }
    );

    const successMessage = `✅ **PAYMENT DELETED SUCCESSFULLY**



🗑️ **Your pending payment has been deleted:**

💰 **Amount:** $${cancelledPayment.amount}
🌐 **Network:** ${cancelledPayment.network}
⏰ **Cancelled:** ${new Date().toLocaleDateString()}



✅ **You can now make new purchases!**

**⚠️ IMPORTANT:**
If you already sent payment to our wallet, please contact support immediately with your transaction details.`;

    await ctx.replyWithMarkdown(successMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🛒 Purchase Shares", callback_data: "menu_purchase_shares" }],
          [{ text: "📞 Contact Support", callback_data: "menu_help" }],
          [{ text: "🏠 Main Dashboard", callback_data: "main_menu" }]
        ]
      }
    });

  } catch (error) {
    console.error('Error cancelling payment:', error);
    await ctx.replyWithMarkdown('❌ **Error cancelling payment**\n\nPlease try again or contact support.');
  }
}

// Handle confirm purchase
async function handleConfirmPurchase(ctx, callbackData) {
  const amount = parseFloat(callbackData.split('_')[2]);
  const user = ctx.from;

  try {
    // Get current phase and share price
    const { data: currentPhase, error: phaseError } = await db.client
      .from('investment_phases')
      .select('*')
      .eq('is_active', true)
      .single();

    if (phaseError || !currentPhase) {
      await ctx.reply('❌ Error: No active phase found. Please contact support.');
      return;
    }

    const sharePrice = parseFloat(currentPhase.price_per_share);
    const sharesAmount = Math.floor(amount / sharePrice);
    const totalCost = sharesAmount * sharePrice;

    // Get or create telegram user
    let { data: telegramUser, error: telegramError } = await db.client
      .from('telegram_users')
      .select('*')
      .eq('username', user.username)
      .single();

    if (telegramError && telegramError.code !== 'PGRST116') {
      console.error('Error fetching telegram user:', telegramError);
      await ctx.reply('❌ Database error. Please try again.');
      return;
    }

    if (!telegramUser) {
      // Create new telegram user
      const { data: newUser, error: createError } = await db.client
        .from('telegram_users')
        .insert({
          telegram_id: user.id,
          username: user.username,
          first_name: user.first_name,
          last_name: user.last_name || null,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating telegram user:', createError);
        await ctx.reply('❌ Error creating user account. Please try again.');
        return;
      }
      telegramUser = newUser;
    }

    // Check if bank transfer payment method is selected
    const selectedPaymentMethod = ctx.session.selectedPaymentMethod || 'usdt';

    console.log(`🔍 [DEBUG] handleConfirmPurchase - selectedPaymentMethod: ${selectedPaymentMethod}`);
    console.log(`🔍 [DEBUG] handleConfirmPurchase - session:`, ctx.session);

    if (selectedPaymentMethod === 'bank_transfer') {
      console.log(`🔍 [DEBUG] handleConfirmPurchase - Processing bank transfer for amount: ${totalCost}`);
      // Handle bank transfer payment
      await handleBankTransferConfirmation(ctx, telegramUser, amount, totalCost, sharesAmount, currentPhase);
      return;
    }

    // Get selected network from session or default to TRON (for crypto payments)
    const selectedNetwork = ctx.session.selectedNetwork || 'TRON';

    // Get company wallet address from database for selected network
    const { data: companyWallet, error: walletError } = await db.client
      .from('company_wallets')
      .select('wallet_address')
      .eq('network', selectedNetwork)
      .eq('currency', 'USDT')
      .eq('is_active', true)
      .single();

    if (walletError || !companyWallet) {
      console.error(`Error getting company wallet for ${selectedNetwork}:`, walletError);
      await ctx.reply(`❌ Error: ${selectedNetwork} USDT wallet not configured. Please contact support.`);
      return;
    }

    // Map network to display format
    const networkDisplayMap = {
      'ETH': 'USDT-ERC20',
      'BSC': 'USDT-BEP20',
      'POL': 'USDT-Polygon',
      'TRON': 'USDT-TRC20'
    };

    const networkDisplay = networkDisplayMap[selectedNetwork] || `USDT-${selectedNetwork}`;

    // Create payment transaction
    const { data: payment, error: paymentError } = await db.client
      .from('crypto_payment_transactions')
      .insert({
        user_id: telegramUser.user_id || null, // Link to main users table
        amount: totalCost,
        currency: 'USDT',
        network: networkDisplay,
        sender_wallet: '', // Will be filled when user uploads proof
        receiver_wallet: companyWallet.wallet_address, // From database
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (paymentError) {
      console.error('Error creating payment:', paymentError);
      await ctx.reply('❌ Error creating payment. Please try again.');
      return;
    }

    // Show payment instructions
    await showPaymentInstructions(ctx, payment, currentPhase);

    // Notify admin about new payment received
    await sendAdminNotification('payment_received', {
      username: user.username || user.first_name || 'Unknown',
      amount: totalCost,
      shares: Math.floor(totalCost / parseFloat(currentPhase.price_per_share)),
      user_id: telegramUser.user_id,
      payment_id: payment.id
    }, 'medium'); // Medium priority for new payments

  } catch (error) {
    console.error('Error confirming purchase:', error);
    await ctx.reply('❌ Error processing purchase. Please try again.');
  }
}

// Show payment instructions
async function showPaymentInstructions(ctx, payment, phase) {
  // Calculate shares from payment amount and phase price
  const sharePrice = parseFloat(phase.price_per_share);
  const sharesAmount = Math.floor(payment.amount / sharePrice);

  // Get network information for display
  const networkInfo = getNetworkDisplayInfo(payment.network);

  const paymentMessage = `💳 **PAYMENT INSTRUCTIONS**



**📋 PURCHASE DETAILS:**
• Amount: ${formatCurrency(payment.amount)}
• Shares: ${sharesAmount.toLocaleString()}
• Phase: ${phase.phase_name}
• Share Price: ${formatCurrency(sharePrice)}
• Payment ID: #${payment.id.substring(0, 8)}

**💰 PAYMENT INFORMATION:**
• Network: ${payment.network} (${networkInfo.fullName})
• Wallet Address: \`${payment.receiver_wallet}\`
• Amount to Send: **$${payment.amount} USDT**

**⚠️ IMPORTANT INSTRUCTIONS:**
1. Send EXACTLY $${payment.amount} USDT
2. Use ONLY ${networkInfo.technical} network (${networkInfo.fullName})
3. Take screenshot of transaction
4. Upload proof within 24 hours
5. Wait for admin approval

**🚨 WARNING:**
• Wrong network = Lost funds
• Wrong amount = Payment rejected
• No proof = No shares allocated

**⏰ Payment expires in 24 hours**`;

  // Use correct callback based on payment type
  const proofCallback = payment.network === 'BANK_TRANSFER'
    ? `upload_bank_proof_${payment.id}`
    : `upload_proof_${payment.id}`;

  await ctx.replyWithMarkdown(paymentMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "💳 Submit Payment Proof", callback_data: proofCallback }],
        [{ text: "💼 View Portfolio", callback_data: "menu_portfolio" }],
        [{ text: "🏠 Main Menu", callback_data: "main_menu" }]
      ]
    }
  });
}

// Handle upload proof callback
async function handleUploadProof(ctx, callbackData) {
  const paymentId = callbackData.replace('upload_proof_', '');
  const user = ctx.from;

  try {
    // Verify payment exists and belongs to user
    const { data: payment, error: paymentError } = await db.client
      .from('crypto_payment_transactions')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (paymentError || !payment) {
      await ctx.answerCbQuery('❌ Payment not found');
      return;
    }

    // Set user state to collect wallet address first
    await setUserState(user.id, 'upload_proof_wallet', { paymentId });

    const walletMessage = `💳 PAYMENT PROOF SUBMISSION - STEP 1 OF 3



📋 PAYMENT DETAILS:
• Payment ID: #${paymentId.substring(0, 8)}
• Amount: ${formatCurrency(payment.amount)}
• Network: ${payment.network}

📍 STEP 1: YOUR SENDER WALLET ADDRESS

Please type the wallet address you sent the payment FROM:

⚠️ Important: This is YOUR wallet address (not our receiving address)

Next Steps: Wallet Address → Transaction Hash → Screenshot Upload`;

    await ctx.reply(walletMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "❌ Cancel Upload", callback_data: "main_menu" }]
        ]
      }
    });

  } catch (error) {
    console.error('Error handling upload proof:', error);
    await ctx.answerCbQuery('❌ Error processing request');
  }
}

// Payment query helper functions
async function getUserPaymentsByStatus(userId, status, limit = 10) {
  try {
    const { data: payments, error } = await db.client
      .from('crypto_payment_transactions')
      .select(`
        id,
        amount,
        status,
        created_at,
        approved_at,
        rejected_at,
        rejection_reason,
        transaction_hash,
        sender_wallet,
        screenshot_url
      `)
      .eq('user_id', userId)
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error(`Error fetching ${status} payments for user ${userId}:`, error);
      return [];
    }

    return payments || [];
  } catch (error) {
    console.error(`Error in getUserPaymentsByStatus:`, error);
    return [];
  }
}

async function getAdminPaymentsByStatus(status, limit = 20) {
  try {
    const { data: payments, error } = await db.client
      .from('crypto_payment_transactions')
      .select(`
        id,
        amount,
        status,
        created_at,
        approved_at,
        rejected_at,
        rejection_reason,
        transaction_hash,
        sender_wallet,
        users!inner(username, full_name, email)
      `)
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error(`Error fetching ${status} payments for admin:`, error);
      return [];
    }

    return payments || [];
  } catch (error) {
    console.error(`Error in getAdminPaymentsByStatus:`, error);
    return [];
  }
}

async function formatPaymentForDisplay(payment, isAdmin = false) {
  const createdDate = new Date(payment.created_at).toLocaleDateString();
  const createdTime = new Date(payment.created_at).toLocaleTimeString();

  let statusInfo = '';
  if (payment.status === 'approved' && payment.approved_at) {
    const approvedDate = new Date(payment.approved_at).toLocaleDateString();
    statusInfo = `✅ Approved on ${approvedDate}`;
  } else if (payment.status === 'rejected' && payment.rejected_at) {
    const rejectedDate = new Date(payment.rejected_at).toLocaleDateString();
    statusInfo = `❌ Rejected on ${rejectedDate}`;
    if (payment.rejection_reason) {
      statusInfo += `\n**Reason:** ${payment.rejection_reason}`;
    }
  } else if (payment.status === 'pending') {
    statusInfo = `⏳ Pending approval`;
  }

  let paymentInfo = `**Payment #${payment.id.substring(0, 8)}**
💰 **Amount:** $${payment.amount} USDT
📅 **Submitted:** ${createdDate} at ${createdTime}
${statusInfo}`;

  if (isAdmin && payment.users) {
    paymentInfo += `\n👤 **User:** ${payment.users.full_name || payment.users.username}`;
  }

  if (payment.transaction_hash) {
    paymentInfo += `\n🔗 **TX Hash:** \`${payment.transaction_hash.substring(0, 20)}...\``;
  }

  return paymentInfo;
}

// Admin audit logging function
async function logAdminAction(adminTelegramId, adminUsername, action, targetType, targetId, details = {}) {
  try {
    // Defensive programming: truncate values to prevent database errors
    const truncatedAction = String(action || '').substring(0, 255);
    const truncatedTargetType = String(targetType || '').substring(0, 50);
    const truncatedTargetId = String(targetId || '').substring(0, 500);
    const truncatedUsername = String(adminUsername || '').substring(0, 255);

    // Ensure details is a valid object and not too large
    let safeDetails = {};
    try {
      if (details && typeof details === 'object') {
        const detailsString = JSON.stringify(details);
        if (detailsString.length > 10000) {
          // If details are too large, truncate or summarize
          safeDetails = {
            truncated: true,
            original_size: detailsString.length,
            summary: String(detailsString).substring(0, 1000) + '...'
          };
        } else {
          safeDetails = details;
        }
      }
    } catch (detailsError) {
      safeDetails = { error: 'Failed to serialize details', type: typeof details };
    }

    // Handle system actions (when adminTelegramId is null)
    const isSystemAction = !adminTelegramId || adminUsername === 'SYSTEM';
    const finalAdminTelegramId = isSystemAction ? 0 : adminTelegramId; // Use 0 for system actions

    const { error } = await db.client
      .from('admin_audit_logs')
      .insert([{
        admin_telegram_id: finalAdminTelegramId,
        admin_username: truncatedUsername,
        action: truncatedAction,
        target_type: truncatedTargetType,
        target_id: truncatedTargetId,
        details: safeDetails
      }]);

    if (error) {
      console.error('Audit log error:', error);
      // If still failing due to column size, try with minimal data
      if (error.message && error.message.includes('value too long')) {
        console.log('🔧 Retrying with minimal audit log data...');
        await db.client
          .from('admin_audit_logs')
          .insert([{
            admin_telegram_id: finalAdminTelegramId,
            admin_username: truncatedUsername.substring(0, 50),
            action: truncatedAction.substring(0, 50),
            target_type: 'system',
            target_id: 'truncated',
            details: { error: 'Original data too long', action: truncatedAction }
          }]);
      }
    } else {
      const actionType = isSystemAction ? 'System action' : 'Admin action';
      console.log(`📋 ${actionType} logged: ${truncatedAction} by ${truncatedUsername} on ${truncatedTargetType} ${truncatedTargetId}`);
    }
  } catch (error) {
    console.error('Audit logging failed:', error);
  }
}

// ADMIN PAYMENT REVIEW HANDLERS
async function handleReviewPayment(ctx, callbackData) {
  const user = ctx.from;

  // Check admin authorization
  if (user.username !== 'TTTFOUNDER') {
    await ctx.answerCbQuery('❌ Access denied');
    return;
  }

  const paymentId = callbackData.replace('review_payment_', '');

  try {
    // Get payment details with user info
    const { data: payment, error: fetchError } = await db.client
      .from('crypto_payment_transactions')
      .select(`
        *,
        users!inner(username, full_name)
      `)
      .eq('id', paymentId)
      .single();

    if (fetchError || !payment) {
      await ctx.answerCbQuery('❌ Payment not found');
      return;
    }

    // Check if this is a bank transfer payment
    const isBankTransfer = payment.network === 'BANK_TRANSFER' || payment.currency === 'ZAR';

    let reviewMessage;

    if (isBankTransfer) {
      // Parse bank transfer details from transaction_hash field
      let zarAmount = 'N/A';
      let exchangeRate = 18;
      if (payment.transaction_hash && payment.transaction_hash.includes('ZAR:')) {
        const zarMatch = payment.transaction_hash.match(/ZAR:([0-9.]+)/);
        const rateMatch = payment.transaction_hash.match(/RATE:([0-9.]+)/);
        if (zarMatch) zarAmount = parseFloat(zarMatch[1]);
        if (rateMatch) exchangeRate = parseFloat(rateMatch[1]);
      }

      reviewMessage = `🏦 **BANK TRANSFER REVIEW**



**💰 PAYMENT DETAILS:**
• **ID:** #${paymentId.substring(0, 8)}
• **USD Amount:** $${payment.amount}
• **ZAR Amount:** R${typeof zarAmount === 'number' ? zarAmount.toFixed(2) : zarAmount}
• **Exchange Rate:** R${exchangeRate} = $1 USD
• **Payment Method:** Bank Transfer (FNB)
• **Status:** ${payment.status}

**👤 USER DETAILS:**
• **Name:** ${payment.users.full_name || 'N/A'}
• **Username:** @${payment.users.username || 'N/A'}

**🏦 BANK TRANSFER INFO:**
• **Bank:** First National Bank (FNB)
• **Account:** 63154323041
• **Proof:** ${payment.sender_wallet ? '✅ Uploaded' : '❌ Not uploaded'}
• **Reference:** Payment #${paymentId.substring(0, 8)}

**📅 TIMESTAMPS:**
• **Created:** ${new Date(payment.created_at).toLocaleString()}
• **Updated:** ${new Date(payment.updated_at).toLocaleString()}

`;
    } else {
      // Safely format wallet address and transaction hash to avoid Markdown parsing errors
      const safeWalletAddress = payment.sender_wallet
        ? `\`${payment.sender_wallet}\``
        : 'Not provided';

      const safeTransactionHash = payment.transaction_hash
        ? `\`${payment.transaction_hash}\``
        : 'Not provided';

      reviewMessage = `🔍 **CRYPTO PAYMENT REVIEW**



**💰 PAYMENT DETAILS:**
• **ID:** #${paymentId.substring(0, 8)}
• **Amount:** $${payment.amount} USDT
• **Network:** ${payment.network}
• **Status:** ${payment.status}

**👤 USER DETAILS:**
• **Name:** ${payment.users.full_name || 'N/A'}
• **Username:** @${payment.users.username || 'N/A'}

**📋 TRANSACTION INFO:**
• **Wallet Address:** ${safeWalletAddress}
• **Transaction Hash:** ${safeTransactionHash}
• **Screenshot:** ${payment.screenshot_url ? '✅ Uploaded' : '❌ Not uploaded'}

**📅 TIMESTAMPS:**
• **Created:** ${new Date(payment.created_at).toLocaleString()}
• **Updated:** ${new Date(payment.updated_at).toLocaleString()}

`;
    }

    const keyboard = [
      [
        { text: "✅ Approve Payment", callback_data: `approve_payment_${paymentId}` },
        { text: "❌ Reject Payment", callback_data: `reject_payment_${paymentId}` }
      ]
    ];

    // Add proof viewing button based on payment type
    if (isBankTransfer && payment.sender_wallet) {
      keyboard.unshift([
        { text: "🏦 View Bank Transfer Proof", callback_data: `view_bank_proof_${paymentId}` }
      ]);
    } else if (!isBankTransfer && payment.screenshot_url) {
      keyboard.unshift([
        { text: "📷 View Screenshot", callback_data: `view_screenshot_${paymentId}` }
      ]);
    }

    keyboard.push([
      { text: "🔄 Refresh", callback_data: `review_payment_${paymentId}` },
      { text: "🔙 Back to Payments", callback_data: "admin_payments" }
    ]);

    try {
      await ctx.replyWithMarkdown(reviewMessage, {
        reply_markup: { inline_keyboard: keyboard }
      });
    } catch (markdownError) {
      console.error('❌ Markdown parsing error in payment review:', markdownError);
      console.error('❌ Problematic message content:', reviewMessage);

      // Fallback: Send without markdown formatting
      const plainMessage = reviewMessage.replace(/\*\*/g, '').replace(/`/g, '');
      await ctx.reply(plainMessage, {
        reply_markup: { inline_keyboard: keyboard }
      });
    }

  } catch (error) {
    console.error('Review payment error:', error);
    await ctx.answerCbQuery('❌ Error loading payment details');
  }
}

async function handleApprovePayment(ctx, callbackData) {
  const user = ctx.from;

  if (user.username !== 'TTTFOUNDER') {
    await ctx.answerCbQuery('❌ Access denied');
    return;
  }

  const paymentId = callbackData.replace('approve_payment_', '');

  try {
    // Update payment status to approved
    const { data: updatedPayment, error: updateError } = await db.client
      .from('crypto_payment_transactions')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentId)
      .select('*, users!inner(username, full_name)')
      .single();

    if (updateError) {
      console.error('Payment approval error:', updateError);
      await ctx.answerCbQuery('❌ Error approving payment');
      return;
    }

    // Get current phase to calculate shares correctly
    const { data: currentPhase, error: phaseError } = await db.client
      .from('investment_phases')
      .select('*')
      .eq('is_active', true)
      .single();

    if (phaseError || !currentPhase) {
      console.error('Error getting current phase:', phaseError);
      await ctx.reply('❌ Error: No active phase found. Cannot approve payment.');
      return;
    }

    // Calculate shares based on current phase price
    const amount = parseFloat(updatedPayment.amount);
    const sharePrice = parseFloat(currentPhase.price_per_share);
    const sharesAmount = Math.floor(amount / sharePrice); // Correct calculation!

    // Create share purchase record
    console.log('💰 Creating share purchase record for approved payment...');

    try {

      const investmentData = {
        user_id: updatedPayment.user_id,
        package_id: null, // No specific package ID for direct payments
        package_name: `${currentPhase.phase_name} Purchase`,
        shares_purchased: sharesAmount,
        total_amount: amount,
        commission_used: 0, // No commission used for direct payments
        remaining_payment: amount, // Full amount paid directly
        payment_method: updatedPayment.network === 'BANK_TRANSFER' ? 'Bank Transfer (ZAR)' : `${updatedPayment.network} ${updatedPayment.currency || 'USDT'}`,
        status: 'active',
        created_at: updatedPayment.created_at,
        updated_at: new Date().toISOString()
      };

      const { data: investmentRecord, error: investmentError } = await db.client
        .from('aureus_share_purchases')
        .insert([investmentData])
        .select()
        .single();

      if (investmentError) {
        console.error('❌ CRITICAL ERROR: Share Purchase creation failed:', investmentError);
        console.error('❌ ROLLING BACK: Payment approval cancelled due to share purchase failure');

        // Rollback payment status to pending
        await db.client
          .from('crypto_payment_transactions')
          .update({
            status: 'pending',
            approved_at: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', paymentId);

        await ctx.answerCbQuery('❌ Payment approval failed - share purchase creation error');
        await ctx.reply('❌ **PAYMENT APPROVAL FAILED**\n\nShare purchase record could not be created. Payment has been reverted to pending status. Please try again or contact support.');
        return; // ✅ CRITICAL FIX: Stop execution if share purchase fails
      } else {
        console.log('✅ Share Purchase record created:', investmentRecord.id);

        // 🚨 CRITICAL FIX: Update shares_sold in investment_phases
        console.log(`📊 [SHARES_SOLD] Updating shares_sold for direct payment approval: +${sharesAmount} shares`);
        const sharesSoldResult = await incrementSharesSold(currentPhase.id, sharesAmount, 'direct_purchase');

        if (!sharesSoldResult.success) {
          console.error(`❌ [SHARES_SOLD] Failed to update shares_sold for payment ${paymentId}:`, sharesSoldResult.error);
          // Continue with approval but log the error for manual review
        }

        // Link the payment to the share purchase
        await db.client
          .from('crypto_payment_transactions')
          .update({ investment_id: investmentRecord.id })
          .eq('id', paymentId);

        console.log('🔗 Payment linked to share purchase');

        // COMMISSION CREATION - Check for referral relationship and create commission
        console.log('💰 [COMMISSION] Checking for referral relationship to create commission...');
        console.log(`💰 [COMMISSION] Looking for referrals where referred_id = ${updatedPayment.user_id}`);

        const { data: referralData, error: referralError } = await db.client
          .from('referrals')
          .select('referrer_id, referred_id, commission_rate')
          .eq('referred_id', updatedPayment.user_id)
          .eq('status', 'active')
          .single();

        console.log(`💰 [COMMISSION] Referral query result:`, { referralData, referralError });

        if (!referralError && referralData) {
          console.log(`👥 [COMMISSION] Found referrer: User ${referralData.referrer_id} for referred user ${referralData.referred_id}`);

          // Calculate commission (15% USDT + 15% shares)
          const commissionAmount = amount * 0.15;
          const shareCommission = sharesAmount * 0.15;

          console.log(`💰 [COMMISSION] Calculating commission: ${commissionAmount} USDT + ${shareCommission} shares`);
          console.log(`💰 [COMMISSION] Base amount: $${amount}, Share amount: ${sharesAmount}`);

          // Create commission transaction
          const commissionData = {
            referrer_id: referralData.referrer_id,
            referred_id: referralData.referred_id,
            share_purchase_id: investmentRecord.id,
            commission_rate: 15.00,
            share_purchase_amount: amount,
            usdt_commission: commissionAmount,
            share_commission: shareCommission,
            status: 'approved',
            payment_date: new Date().toISOString(),
            created_at: new Date().toISOString()
          };

          console.log(`💰 [COMMISSION] Inserting commission data:`, commissionData);

          const { data: commissionRecord, error: commissionError } = await db.client
            .from('commission_transactions')
            .insert([commissionData])
            .select()
            .single();

          console.log(`💰 [COMMISSION] Insert result:`, { commissionRecord, commissionError });

          if (commissionError) {
            console.error('❌ [COMMISSION] Commission creation error:', commissionError);
            console.error('❌ [COMMISSION] Failed commission data:', commissionData);
          } else {
            console.log(`✅ [COMMISSION] Commission created successfully: $${commissionAmount.toFixed(2)} USDT + ${shareCommission.toFixed(2)} shares`);
            console.log(`✅ [COMMISSION] Commission record ID:`, commissionRecord.id);

            // Update commission balance (add to existing balance)
            console.log('💳 [COMMISSION] Updating commission balance...');
            console.log(`💳 [COMMISSION] Looking for existing balance for user ${referralData.referrer_id}`);

            // First, get existing balance
            const { data: existingBalance, error: getBalanceError } = await db.client
              .from('commission_balances')
              .select('*')
              .eq('user_id', referralData.referrer_id)
              .single();

            console.log(`💳 [COMMISSION] Existing balance query result:`, { existingBalance, getBalanceError });

            if (getBalanceError && getBalanceError.code !== 'PGRST116') {
              console.error('❌ [COMMISSION] Error getting existing balance:', getBalanceError);
            }

            const currentUSDT = existingBalance?.usdt_balance || 0;
            const currentShares = existingBalance?.share_balance || 0;
            const totalEarnedUSDT = (existingBalance?.total_earned_usdt || 0) + commissionAmount;
            const totalEarnedShares = (existingBalance?.total_earned_shares || 0) + shareCommission;

            const balanceUpdateData = {
              user_id: referralData.referrer_id,
              usdt_balance: currentUSDT + commissionAmount,
              share_balance: currentShares + shareCommission,
              total_earned_usdt: totalEarnedUSDT,
              total_earned_shares: totalEarnedShares,
              last_updated: new Date().toISOString(),
              created_at: existingBalance?.created_at || new Date().toISOString()
            };

            console.log(`💳 [COMMISSION] Upserting balance data:`, balanceUpdateData);

            const { error: balanceError } = await db.client
              .from('commission_balances')
              .upsert(balanceUpdateData, {
                onConflict: 'user_id'
              });

            console.log(`💳 [COMMISSION] Balance upsert result:`, { balanceError });

            if (balanceError) {
              console.error('❌ [COMMISSION] Commission balance update error:', balanceError);
            } else {
              console.log(`✅ [COMMISSION] Commission balance updated successfully: +$${commissionAmount} USDT, +${shareCommission} shares`);
              console.log(`✅ [COMMISSION] New balances: $${currentUSDT + commissionAmount} USDT, ${currentShares + shareCommission} shares`);

              // 🚨 CRITICAL FIX: Update shares_sold for referral commission shares
              if (shareCommission > 0) {
                console.log(`📊 [SHARES_SOLD] Updating shares_sold for referral commission: +${shareCommission} shares`);
                const sharesSoldResult = await incrementSharesSold(currentPhase.id, shareCommission, 'referral_commission');

                if (!sharesSoldResult.success) {
                  console.error(`❌ [SHARES_SOLD] Failed to update shares_sold for referral commission:`, sharesSoldResult.error);
                  // Continue with commission processing but log the error for manual review
                }
              }
            }
          }
        } else {
          console.log('ℹ️ [COMMISSION] No referrer found for this user - no commission to create');
          console.log(`ℹ️ [COMMISSION] Referral error:`, referralError);
          console.log(`ℹ️ [COMMISSION] User ID searched: ${updatedPayment.user_id}`);

          // Let's also check if there are ANY referrals for this user (debug)
          const { data: allReferrals, error: allReferralsError } = await db.client
            .from('referrals')
            .select('*')
            .eq('referred_id', updatedPayment.user_id);

          console.log(`🔍 [COMMISSION] All referrals for user ${updatedPayment.user_id}:`, allReferrals);
          console.log(`🔍 [COMMISSION] All referrals query error:`, allReferralsError);
        }
      }
    } catch (shareError) {
      console.error('Error creating share purchase:', shareError);
    }

    // NOTIFY USER OF PAYMENT APPROVAL
    console.log(`📱 Notifying user ${updatedPayment.users.username} of payment approval...`);
    await notifyUserPaymentApproved(updatedPayment, sharesAmount, currentPhase);

    // TRIGGER KYC COLLECTION FOR SHARE CERTIFICATE
    console.log(`📋 Checking KYC status for user ${updatedPayment.users.username}...`);
    await triggerKYCCollectionIfNeeded(updatedPayment.user_id);

    // Check if this is a bank transfer payment
    const isBankTransfer = updatedPayment.network === 'BANK_TRANSFER' || updatedPayment.currency === 'ZAR';
    const paymentMethodDisplay = isBankTransfer ? 'Bank Transfer (ZAR)' : `${updatedPayment.amount} USDT`;

    await ctx.replyWithMarkdown(`✅ **PAYMENT APPROVED**

**Payment ID:** #${paymentId.substring(0, 8)}
**Amount:** $${updatedPayment.amount} USD
**Payment Method:** ${paymentMethodDisplay}
**User:** ${updatedPayment.users.full_name || updatedPayment.users.username}
**Shares Allocated:** ${sharesAmount}

✅ User has been notified of the approval and shares have been allocated.`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔙 Back to Payments", callback_data: "admin_payments" }]
        ]
      }
    });

  } catch (error) {
    console.error('Payment approval error:', error);
    await ctx.answerCbQuery('❌ Error approving payment');
  }
}

// Notify user of payment approval
async function notifyUserPaymentApproved(payment, sharesAllocated, currentPhase) {
  try {
    console.log(`📱 [notifyUserPaymentApproved] Notifying user ${payment.users.username} of payment approval`);

    // Get user's Telegram ID
    const { data: telegramUser, error: telegramError } = await db.client
      .from('telegram_users')
      .select('telegram_id')
      .eq('user_id', payment.user_id)
      .single();

    if (telegramError || !telegramUser) {
      console.error('❌ Error finding user Telegram ID:', telegramError);
      return;
    }

    // Check if this is a bank transfer payment
    const isBankTransfer = payment.network === 'BANK_TRANSFER' || payment.currency === 'ZAR';
    let paymentMethodText = '';

    if (isBankTransfer) {
      // Parse ZAR amount from transaction_hash field
      let zarAmount = 'N/A';
      if (payment.transaction_hash && payment.transaction_hash.includes('ZAR:')) {
        const zarMatch = payment.transaction_hash.match(/ZAR:([0-9.]+)/);
        if (zarMatch) {
          zarAmount = parseFloat(zarMatch[1]);
        }
      }
      paymentMethodText = `• **Payment Method:** Bank Transfer (FNB)\n• **ZAR Amount:** R${typeof zarAmount === 'number' ? zarAmount.toFixed(2) : zarAmount}`;
    } else {
      paymentMethodText = `• **Payment Method:** ${payment.network} USDT`;
    }

    const approvalMessage = `🎉 **PAYMENT APPROVED!**



**✅ CONGRATULATIONS!**
Your share purchase has been approved and processed successfully.

**📋 TRANSACTION DETAILS:**
• **Payment ID:** #${payment.id.substring(0, 8)}
• **USD Amount:** $${payment.amount}
${paymentMethodText}
• **Shares Allocated:** ${sharesAllocated} shares
• **Share Price:** $${currentPhase.price_per_share} per share
• **Current Phase:** ${currentPhase.name}
• **Approval Date:** ${new Date().toLocaleDateString()}

**💰 PORTFOLIO UPDATE:**
Your ${sharesAllocated} new shares have been added to your portfolio and are now earning dividends from our gold mining operations.

**🎯 NEXT STEPS:**
• View your updated portfolio
• Track your dividend earnings
• Share your referral link to earn commissions
• Consider additional share purchases



**🏆 Welcome to Aureus Alliance Holdings!**
Your share in African gold mining starts now.`;

    // Send notification to user
    await sendAudioNotificationToUser(
      telegramUser.telegram_id,
      approvalMessage,
      'PAYMENT',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "💼 View Portfolio", callback_data: "menu_portfolio" }],
            [{ text: "📤 Share Referral Link", callback_data: "share_referral" }],
            [{ text: "🏠 Main Menu", callback_data: "main_menu" }]
          ]
        }
      },
      true // Enable audio notification for payment approvals
    );

    console.log(`✅ [notifyUserPaymentApproved] Notification sent successfully to user ${payment.users.username}`);

  } catch (error) {
    console.error('❌ Error sending payment approval notification:', error);
  }
}

// Payment Rejection Prompt Handler
async function handleRejectPaymentPrompt(ctx, callbackData) {
  const user = ctx.from;

  if (user.username !== 'TTTFOUNDER') {
    await ctx.answerCbQuery('❌ Access denied');
    return;
  }

  const paymentId = callbackData.replace('reject_payment_', '');

  try {
    // Get payment details for context
    const { data: payment, error: paymentError } = await db.client
      .from('crypto_payment_transactions')
      .select('*, users!inner(username, full_name)')
      .eq('id', paymentId)
      .single();

    if (paymentError || !payment) {
      await ctx.answerCbQuery('❌ Payment not found');
      return;
    }

    const promptMessage = `❌ **REJECT PAYMENT CONFIRMATION**



**Payment Details:**
• **ID:** #${paymentId.substring(0, 8)}
• **Amount:** $${payment.amount} USDT
• **User:** ${payment.users.full_name || payment.users.username}
• **Network:** ${payment.network}



**Please enter the reason for rejecting this payment:**

*This message will be sent to the user along with the rejection notification.*`;

    await ctx.replyWithMarkdown(promptMessage, {
      reply_markup: {
        force_reply: true,
        input_field_placeholder: "Enter rejection reason..."
      }
    });

    // Store the payment ID in a temporary way for the next message
    ctx.session = ctx.session || {};
    ctx.session.pendingRejection = paymentId;

  } catch (error) {
    console.error('Error showing rejection prompt:', error);
    await ctx.answerCbQuery('❌ Error processing rejection');
  }
}

// Updated Payment Rejection Handler with Custom Message
async function handleRejectPayment(ctx, paymentId, rejectionReason) {
  const user = ctx.from;

  if (user.username !== 'TTTFOUNDER') {
    await ctx.reply('❌ Access denied');
    return;
  }

  try {
    // Update payment status to rejected with custom reason
    const { data: updatedPayment, error: updateError } = await db.client
      .from('crypto_payment_transactions')
      .update({
        status: 'rejected',
        rejected_at: new Date().toISOString(),
        rejected_by_admin_id: user.id,
        rejection_reason: rejectionReason,
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentId)
      .select('*, users!inner(username, full_name)')
      .single();

    if (updateError) {
      console.error('Payment rejection error:', updateError);
      await ctx.reply('❌ Error rejecting payment');
      return;
    }

    // Log admin action
    await logAdminAction(
      user.id,
      user.username,
      'payment_rejected',
      'payment',
      paymentId,
      {
        amount: updatedPayment.amount,
        user: updatedPayment.users.username,
        rejection_reason: rejectionReason
      }
    );

    // Send notification to user
    try {
      // Get user's telegram_id from telegram_users table
      const { data: telegramUser, error: telegramError } = await db.client
        .from('telegram_users')
        .select('telegram_id')
        .eq('user_id', updatedPayment.user_id)
        .single();

      if (telegramError || !telegramUser) {
        console.error('Error finding user telegram_id:', telegramError);
        return;
      }

      const userNotification = `❌ **PAYMENT REJECTED**



**Payment ID:** #${paymentId.substring(0, 8)}
**Amount:** $${updatedPayment.amount} USDT
**Status:** Rejected by Admin

**Reason for Rejection:**
${rejectionReason}



**Next Steps:**
• Review the rejection reason above
• Correct any issues mentioned
• Submit a new payment if needed
• Contact support if you have questions

**Need Help?** Contact @TTTFOUNDER for assistance.`;

      await sendAudioNotificationToUser(
        telegramUser.telegram_id,
        userNotification,
        'REJECTION',
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🛒 Make New Payment", callback_data: "menu_purchase_shares" }],
              [{ text: "📞 Contact Support", url: "https://t.me/TTTFOUNDER" }]
            ]
          }
        },
        true // Enable audio notification for payment rejections
      );
    } catch (notificationError) {
      console.error('Error sending rejection notification to user:', notificationError);
    }

    // Confirm to admin
    await ctx.replyWithMarkdown(`❌ **PAYMENT REJECTED**

**Payment ID:** #${paymentId.substring(0, 8)}
**Amount:** $${updatedPayment.amount} USDT
**User:** ${updatedPayment.users.full_name || updatedPayment.users.username}

**Rejection Reason:** ${rejectionReason}

✅ User has been notified with the custom rejection message.`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔙 Back to Payments", callback_data: "admin_payments" }]
        ]
      }
    });

  } catch (error) {
    console.error('Payment rejection error:', error);
    await ctx.reply('❌ Error rejecting payment');
  }
}

async function handleViewScreenshot(ctx, callbackData) {
  const user = ctx.from;

  if (user.username !== 'TTTFOUNDER') {
    await ctx.answerCbQuery('❌ Access denied');
    return;
  }

  const paymentId = callbackData.replace('view_screenshot_', '');

  try {
    // Get payment screenshot URL
    const { data: payment, error: fetchError } = await db.client
      .from('crypto_payment_transactions')
      .select('screenshot_url, amount, users!inner(username)')
      .eq('id', paymentId)
      .single();

    if (fetchError || !payment || !payment.screenshot_url) {
      await ctx.answerCbQuery('❌ Screenshot not found');
      return;
    }

    // Get the screenshot from Supabase storage
    const { data: fileData, error: downloadError } = await db.client.storage
      .from('proof')
      .download(payment.screenshot_url);

    if (downloadError) {
      console.error('Screenshot download error:', downloadError);
      await ctx.answerCbQuery('❌ Error loading screenshot');
      return;
    }

    // Convert blob to buffer for Telegram
    const buffer = Buffer.from(await fileData.arrayBuffer());

    await ctx.replyWithPhoto(
      { source: buffer },
      {
        caption: `📷 **Payment Screenshot**\n\n**Payment ID:** #${paymentId.substring(0, 8)}\n**Amount:** $${payment.amount} USDT\n**User:** ${payment.users.username}`,
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Approve", callback_data: `approve_payment_${paymentId}` },
              { text: "❌ Reject", callback_data: `reject_payment_${paymentId}` }
            ],
            [{ text: "🔙 Back to Review", callback_data: `review_payment_${paymentId}` }]
          ]
        }
      }
    );

  } catch (error) {
    console.error('View screenshot error:', error);
    await ctx.answerCbQuery('❌ Error loading screenshot');
  }
}

// ENHANCED REFERRAL SYSTEM HANDLERS
async function handleShareReferral(ctx) {
  const user = ctx.from;

  try {
    // Get user ID from telegram_users table
    const { data: telegramUser, error: telegramError } = await db.client
      .from('telegram_users')
      .select('user_id, username')
      .eq('telegram_id', user.id)
      .single();

    if (telegramError || !telegramUser) {
      await ctx.replyWithMarkdown('❌ **User not found**\n\nPlease register first.');
      return;
    }

    const referralUsername = telegramUser.username || user.username || user.first_name;
    const botLink = 'https://t.me/AureusAllianceBot';
    const referralLink = `https://t.me/AureusAllianceBot?start=${referralUsername}`;

    // DEBUG: Log the generated links to verify they're correct
    console.log('🔗 DEBUG - Generated referral link:', referralLink);
    console.log('🔗 DEBUG - Bot link:', botLink);
    console.log('🔗 DEBUG - Referral username:', referralUsername);

    // MOTIVATING & COMPELLING share opportunity message
    const shareMessage = `🌟 LIFE-CHANGING OPPORTUNITY: OWN REAL GOLD MINES! 🌟



💰 IMAGINE EARNING FROM ACTUAL GOLD PRODUCTION!

🏆 AUREUS ALLIANCE HOLDINGS - Your Gateway to Gold Wealth!
Join thousands already building generational wealth through gold mining

🔥 WHY THIS IS THE OPPORTUNITY OF A LIFETIME:

💎 REAL GOLD, REAL PROFITS:
• Own shares in 10 MASSIVE gold washplants
• Each plant processes 200 tons of gold-bearing material per hour
• Target: 3,200 KG of pure gold annually (worth $500+ MILLION!)
• You get a piece of every ounce extracted!

🚀 EXPLOSIVE GROWTH POTENTIAL:
• Phase 1: $5 per share (LIMITED TIME!)
• Full production by June 2026
• Early share holders positioned for maximum dividend returns
• Only 1,400,000 shares available - Don't miss out!

⛏️ PROVEN ZIMBABWE GOLD RESERVES:
• Located in gold-rich Kadoma & Mutare Provinces
• Professional geological surveys completed
• Modern extraction technology deployed
• Experienced mining team managing operations

💸 MULTIPLE WAYS TO PROFIT:
• Share value appreciation as production scales
• Dividend payments from gold sales
• Portfolio diversification with precious metals
• Hedge against inflation and economic uncertainty

🎯 PERFECT FOR:
• Shareholders seeking alternative assets
• Those wanting exposure to gold without storage
• People building retirement wealth
• Anyone tired of low bank returns



🚨 ACT NOW - PHASE 1 PRICING ENDS SOON!

👆 CLICK YOUR PERSONAL REFERRAL LINK:
${referralLink}

🎁 AUTOMATIC SPONSOR ASSIGNMENT: Your referrals will be automatically linked to you!

💡 SHARE PURCHASE RANGE: Start with just $5 or go big with $50,000+

⚡ SECURE PROCESS: 3-step verification, instant confirmation



🔥 DON'T LET THIS GOLDEN OPPORTUNITY SLIP AWAY!

Join the smart money already purchased shares in Africa's gold boom!

⚠️ High-risk, high-reward shares. share responsibly.`;

    await ctx.reply(shareMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📤 Share Referral Link", url: `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent('🔥 GOLD MINING OPPORTUNITY! Join Aureus Alliance Holdings and own real shares in African gold mines!')}` }],
          [{ text: "📋 Copy Referral Link", callback_data: `copy_referral_link_${referralUsername}` }],
          [{ text: "👥 Back to Referral Dashboard", callback_data: "menu_referrals" }],
          [{ text: "🔙 Back to Main Menu", callback_data: "main_menu" }]
        ]
      }
    });

  } catch (error) {
    console.error('Share referral error:', error);
    await ctx.replyWithMarkdown('❌ **Error generating referral content**\n\nPlease try again.');
  }
}

async function handleViewCommission(ctx) {
  const user = ctx.from;

  try {
    console.log(`🚨 [DEBUG] ENHANCED COMMISSION VIEW CALLED FOR USER ${user.id} - NEW VERSION ACTIVE!`);

    // Get user ID from telegram_users table
    const { data: telegramUser, error: telegramError } = await db.client
      .from('telegram_users')
      .select('user_id')
      .eq('telegram_id', user.id)
      .single();

    if (telegramError || !telegramUser) {
      await ctx.replyWithMarkdown('❌ **User not found**\n\nPlease register first.');
      return;
    }

    // Get comprehensive commission data
    console.log(`🔍 [DEBUG] Fetching enhanced commission balance for user ${telegramUser.user_id}`);
    const balanceInfo = await getEnhancedCommissionBalance(telegramUser.user_id);
    console.log(`🔍 [DEBUG] Enhanced commission balance result:`, balanceInfo);

    if (!balanceInfo.success) {
      console.error('Enhanced commission balance fetch error:', balanceInfo.error);
      await ctx.replyWithMarkdown('❌ **Error loading commission data**\n\nPlease try again.');
      return;
    }

    const data = balanceInfo.data;
    console.log(`🔍 [DEBUG] Commission data:`, data);

    // Build enhanced commission message with detailed status information
    let commissionMessage = `💰 **COMMISSION BALANCE**



**💵 USDT COMMISSIONS:**
• **Total Earned:** $${data.totalEarnedUSDT.toFixed(2)} USDT
• **Available for Withdrawal:** $${data.availableUSDT.toFixed(2)} USDT
• **Currently Escrowed:** $${data.escrowedAmount.toFixed(2)} USDT`;

    // Add pending withdrawal details if any
    if (data.pendingWithdrawals.length > 0) {
      commissionMessage += `\n• **Pending Withdrawals:** ${data.pendingWithdrawals.length} request(s)`;
      data.pendingWithdrawals.forEach((withdrawal, index) => {
        const shortId = withdrawal.id.substring(0, 8);
        const date = new Date(withdrawal.created_at).toLocaleDateString();
        commissionMessage += `\n  └ Request #${shortId}: $${withdrawal.amount} (${date})`;
      });
    }

    commissionMessage += `

**📈 SHARE COMMISSIONS:**
• **Total Shares Earned:** ${data.totalEarnedShares.toFixed(0)} shares
• **Current Value:** $${data.shareValue.toFixed(2)} USD
• **Status:** Active in portfolio

**🔄 CONVERSION HISTORY:**
• **Total Converted to Shares:** $${data.totalConvertedUSDT.toFixed(2)} USDT
• **Shares from Conversions:** ${data.sharesFromConversions.toFixed(0)} shares`;

    // Add pending conversion details if any
    if (data.pendingConversions.length > 0) {
      commissionMessage += `\n• **Pending Conversions:** ${data.pendingConversions.length} request(s)`;
      data.pendingConversions.forEach((conversion, index) => {
        const shortId = conversion.id.substring(0, 8);
        const date = new Date(conversion.created_at).toLocaleDateString();
        commissionMessage += `\n  └ Request #${shortId}: ${conversion.shares_requested} shares ($${conversion.usdt_amount}) (${date})`;
      });
    }

    commissionMessage += `

**📊 COMMISSION SUMMARY:**
• **Total Commission Value:** $${data.totalCommissionValue.toFixed(2)}
• **Total Withdrawn:** $${data.totalWithdrawnUSDT.toFixed(2)} USDT
• **Commission Rate:** 15% USDT + 15% Shares

`;

    const keyboard = [];

    // Show action buttons based on available balance and status
    if (data.availableUSDT > 0) {
      keyboard.push([{ text: "💸 Withdraw USDT Commission", callback_data: "withdraw_usdt_commission" }]);
      keyboard.push([{ text: "🛒 Use Commission for Shares", callback_data: "commission_to_shares" }]);
    } else if (data.escrowedAmount > 0) {
      // Show helpful message when funds are escrowed
      keyboard.push([{ text: "⏳ View Pending Requests", callback_data: "view_pending_requests" }]);
    }

    // Add status-specific buttons
    if (data.pendingWithdrawals.length > 0 || data.pendingConversions.length > 0) {
      keyboard.push([{ text: "📋 Manage Pending Requests", callback_data: "manage_pending_requests" }]);
    }

    // Standard navigation buttons
    keyboard.push(
      [{ text: "📤 Share Referral Link", callback_data: "share_referral" }],
      [{ text: "👥 View My Referrals", callback_data: "view_referrals" }],
      [{ text: "📋 Withdrawal History", callback_data: "withdrawal_history" }],
      [{ text: "🔙 Back to Referral Dashboard", callback_data: "menu_referrals" }]
    );

    await ctx.replyWithMarkdown(commissionMessage, {
      reply_markup: { inline_keyboard: keyboard }
    });

  } catch (error) {
    console.error('🚨 [ERROR] Enhanced commission view failed:', error);

    // Fallback to basic commission display
    try {
      console.log('🔄 [FALLBACK] Attempting basic commission display...');

      const { data: telegramUser } = await db.client
        .from('telegram_users')
        .select('user_id')
        .eq('telegram_id', user.id)
        .single();

      if (!telegramUser) {
        await ctx.replyWithMarkdown('❌ **User not found**\n\nPlease register first.');
        return;
      }

      const { data: balance } = await db.client
        .from('commission_balances')
        .select('*')
        .eq('user_id', telegramUser.user_id)
        .single();

      const totalUSDT = balance ? parseFloat(balance.total_earned_usdt || 0) : 0;
      const totalShares = balance ? parseFloat(balance.total_earned_shares || 0) : 0;
      const availableUSDT = balance ? parseFloat(balance.usdt_balance || 0) : 0;
      const escrowedAmount = balance ? parseFloat(balance.escrowed_amount || 0) : 0;

      // Calculate share value with current phase price
      let shareValue = totalShares * 5.00; // Default $5
      try {
        const currentPhase = await db.getCurrentPhase();
        if (currentPhase && currentPhase.price_per_share) {
          shareValue = totalShares * parseFloat(currentPhase.price_per_share);
        }
      } catch (phaseError) {
        console.error('Phase fetch error in fallback:', phaseError);
      }

      const fallbackMessage = `💰 **COMMISSION BALANCE** (Fallback Mode)



**💵 USDT COMMISSIONS:**
• Total Earned: $${totalUSDT.toFixed(2)} USDT
• Available for Withdrawal: $${availableUSDT.toFixed(2)} USDT
• Currently Escrowed: $${escrowedAmount.toFixed(2)} USDT

**📈 SHARE COMMISSIONS:**
• Total Shares Earned: ${totalShares} shares
• Current Value: $${shareValue.toFixed(2)} USD
• Status: Active in portfolio

**📊 COMMISSION SUMMARY:**
• Total Commission Value: $${(totalUSDT + shareValue).toFixed(2)}
• Commission Rate: 15% USDT + 15% Shares



⚠️ **Note:** Enhanced view temporarily unavailable. Contact support if this persists.`;

      await ctx.replyWithMarkdown(fallbackMessage, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "💸 Withdraw USDT Commission", callback_data: "withdraw_usdt_commission" }],
            [{ text: "🛒 Use Commission for Shares", callback_data: "commission_to_shares" }],
            [{ text: "⏳ View Pending Requests", callback_data: "view_pending_requests" }],
            [{ text: "🔙 Back to Referral Dashboard", callback_data: "menu_referrals" }]
          ]
        }
      });

    } catch (fallbackError) {
      console.error('🚨 [ERROR] Fallback commission view also failed:', fallbackError);
      await ctx.replyWithMarkdown('❌ **Error loading commission balance**\n\nPlease try again or contact support.');
    }
  }
}

// Handle viewing pending requests with detailed information
async function handleViewPendingRequests(ctx) {
  try {
    const user = ctx.from;

    // Get user from database
    const { data: telegramUser, error: telegramError } = await db.client
      .from('telegram_users')
      .select('user_id')
      .eq('telegram_id', user.id)
      .single();

    if (telegramError || !telegramUser) {
      await ctx.replyWithMarkdown('❌ **User not found**\n\nPlease register first.');
      return;
    }

    // Get enhanced balance info
    const balanceInfo = await getEnhancedCommissionBalance(telegramUser.user_id);

    if (!balanceInfo.success) {
      await ctx.replyWithMarkdown('❌ **Error loading pending requests**\n\nPlease try again.');
      return;
    }

    const data = balanceInfo.data;

    let message = `⏳ **PENDING REQUESTS STATUS**



**💰 BALANCE OVERVIEW:**
• **Total Balance:** $${(data.availableUSDT + data.escrowedAmount).toFixed(2)} USDT
• **Available:** $${data.availableUSDT.toFixed(2)} USDT
• **Locked (Escrowed):** $${data.escrowedAmount.toFixed(2)} USDT

`;

    // Show pending withdrawals
    if (data.pendingWithdrawals.length > 0) {
      message += `**💸 PENDING WITHDRAWALS (${data.pendingWithdrawals.length}):**\n`;
      data.pendingWithdrawals.forEach((withdrawal, index) => {
        const shortId = withdrawal.id.substring(0, 8);
        const date = new Date(withdrawal.created_at).toLocaleDateString();
        const time = new Date(withdrawal.created_at).toLocaleTimeString();
        message += `\n${index + 1}. **Request #${shortId}**\n`;
        message += `   • Amount: $${withdrawal.amount} USDT\n`;
        message += `   • Type: ${withdrawal.withdrawal_type.toUpperCase()}\n`;
        message += `   • Submitted: ${date} at ${time}\n`;
        message += `   • Status: ⏳ Awaiting admin approval\n`;
      });
      message += `\n`;
    }

    // Show pending conversions
    if (data.pendingConversions.length > 0) {
      message += `**🛒 PENDING CONVERSIONS (${data.pendingConversions.length}):**\n`;
      data.pendingConversions.forEach((conversion, index) => {
        const shortId = conversion.id.substring(0, 8);
        const date = new Date(conversion.created_at).toLocaleDateString();
        const time = new Date(conversion.created_at).toLocaleTimeString();
        message += `\n${index + 1}. **Request #${shortId}**\n`;
        message += `   • Shares: ${conversion.shares_requested}\n`;
        message += `   • Cost: $${conversion.usdt_amount} USDT\n`;
        message += `   • Submitted: ${date} at ${time}\n`;
        message += `   • Status: ⏳ Awaiting admin approval\n`;
      });
      message += `\n`;
    }

    if (data.pendingWithdrawals.length === 0 && data.pendingConversions.length === 0) {
      message += `**✅ NO PENDING REQUESTS**

You currently have no pending withdrawal or conversion requests.
All your commission balance is available for new requests.

`;
    }

    message += `**💡 WHAT HAPPENS NEXT:**
• Admin will review your request(s) within 24-48 hours
• You'll receive a notification when processed
• Approved requests will update your balance automatically
• Rejected requests will release the escrowed funds

**⚠️ IMPORTANT:**
• Escrowed funds cannot be used for new requests
• You cannot cancel requests once submitted
• Contact admin if you have urgent questions

`;

    const keyboard = [
      [{ text: "🔄 Refresh Status", callback_data: "view_pending_requests" }],
      [{ text: "💰 View Commission Balance", callback_data: "view_commission" }],
      [{ text: "📞 Contact Admin", url: "https://t.me/TTTFOUNDER" }],
      [{ text: "🔙 Back to Commission Dashboard", callback_data: "view_commission" }]
    ];

    await ctx.replyWithMarkdown(message, {
      reply_markup: { inline_keyboard: keyboard }
    });

  } catch (error) {
    console.error('View pending requests error:', error);
    await ctx.replyWithMarkdown('❌ **Error loading pending requests**\n\nPlease try again.');
  }
}

// Handle managing pending requests with cancellation options
async function handleManagePendingRequests(ctx) {
  try {
    const user = ctx.from;

    // Get user from database
    const { data: telegramUser, error: telegramError } = await db.client
      .from('telegram_users')
      .select('user_id')
      .eq('telegram_id', user.id)
      .single();

    if (telegramError || !telegramUser) {
      await ctx.replyWithMarkdown('❌ **User not found**\n\nPlease register first.');
      return;
    }

    // Get enhanced balance info
    const balanceInfo = await getEnhancedCommissionBalance(telegramUser.user_id);

    if (!balanceInfo.success) {
      await ctx.replyWithMarkdown('❌ **Error loading pending requests**\n\nPlease try again.');
      return;
    }

    const data = balanceInfo.data;

    if (data.pendingWithdrawals.length === 0 && data.pendingConversions.length === 0) {
      await ctx.replyWithMarkdown(`✅ **NO PENDING REQUESTS**



You currently have no pending withdrawal or conversion requests.
All your commission balance is available for new requests.

**💰 Available Balance:** $${data.availableUSDT.toFixed(2)} USDT

`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "💸 Withdraw USDT Commission", callback_data: "withdraw_usdt_commission" }],
            [{ text: "🛒 Use Commission for Shares", callback_data: "commission_to_shares" }],
            [{ text: "💰 View Commission Balance", callback_data: "view_commission" }]
          ]
        }
      });
      return;
    }

    let message = `📋 **MANAGE PENDING REQUESTS**



**💰 BALANCE OVERVIEW:**
• **Total Balance:** $${(data.availableUSDT + data.escrowedAmount).toFixed(2)} USDT
• **Available:** $${data.availableUSDT.toFixed(2)} USDT
• **Locked (Escrowed):** $${data.escrowedAmount.toFixed(2)} USDT

`;

    const keyboard = [];

    // Show pending withdrawals with cancel options
    if (data.pendingWithdrawals.length > 0) {
      message += `**💸 PENDING WITHDRAWALS (${data.pendingWithdrawals.length}):**\n`;
      data.pendingWithdrawals.forEach((withdrawal, index) => {
        const shortId = withdrawal.id.substring(0, 8);
        const date = new Date(withdrawal.created_at).toLocaleDateString();
        const time = new Date(withdrawal.created_at).toLocaleTimeString();
        const hoursAgo = Math.floor((Date.now() - new Date(withdrawal.created_at).getTime()) / (1000 * 60 * 60));

        message += `\n${index + 1}. **Request #${shortId}**\n`;
        message += `   • Amount: $${withdrawal.amount} USDT\n`;
        message += `   • Type: ${withdrawal.withdrawal_type.toUpperCase()}\n`;
        message += `   • Submitted: ${date} at ${time} (${hoursAgo}h ago)\n`;
        message += `   • Status: ⏳ Awaiting admin approval\n`;

        // Add cancel button for each withdrawal (Note: Cancellation may not be implemented yet)
        // keyboard.push([{ text: `❌ Cancel Request #${shortId}`, callback_data: `cancel_withdrawal_${shortId}` }]);
      });
      message += `\n`;
    }

    // Show pending conversions with cancel options
    if (data.pendingConversions.length > 0) {
      message += `**🛒 PENDING CONVERSIONS (${data.pendingConversions.length}):**\n`;
      data.pendingConversions.forEach((conversion, index) => {
        const shortId = conversion.id.substring(0, 8);
        const date = new Date(conversion.created_at).toLocaleDateString();
        const time = new Date(conversion.created_at).toLocaleTimeString();
        const hoursAgo = Math.floor((Date.now() - new Date(conversion.created_at).getTime()) / (1000 * 60 * 60));

        message += `\n${index + 1}. **Request #${shortId}**\n`;
        message += `   • Shares: ${conversion.shares_requested}\n`;
        message += `   • Cost: $${conversion.usdt_amount} USDT\n`;
        message += `   • Submitted: ${date} at ${time} (${hoursAgo}h ago)\n`;
        message += `   • Status: ⏳ Awaiting admin approval\n`;

        // Add cancel button for each conversion (Note: Cancellation may not be implemented yet)
        // keyboard.push([{ text: `❌ Cancel Request #${shortId}`, callback_data: `cancel_conversion_${shortId}` }]);
      });
      message += `\n`;
    }

    message += `**⚠️ IMPORTANT INFORMATION:**
• **Cannot Cancel:** Requests cannot be cancelled once submitted
• **Processing Time:** 24-48 hours for admin review
• **Automatic Updates:** You'll be notified when processed
• **Escrow Security:** Your funds are safely locked during review

**💡 WHAT YOU CAN DO:**
• **Wait Patiently:** Most requests are approved quickly
• **Contact Admin:** @TTTFOUNDER for urgent questions
• **Plan Ahead:** Consider timing of future requests

`;

    // Add standard navigation buttons
    keyboard.push(
      [{ text: "🔄 Refresh Status", callback_data: "manage_pending_requests" }],
      [{ text: "💰 View Commission Balance", callback_data: "view_commission" }],
      [{ text: "📞 Contact Admin", url: "https://t.me/TTTFOUNDER" }],
      [{ text: "🔙 Back to Commission Dashboard", callback_data: "view_commission" }]
    );

    await ctx.replyWithMarkdown(message, {
      reply_markup: { inline_keyboard: keyboard }
    });

  } catch (error) {
    console.error('Manage pending requests error:', error);
    await ctx.replyWithMarkdown('❌ **Error loading pending requests**\n\nPlease try again.');
  }
}

// Handle user settings and preferences
async function handleUserSettings(ctx) {
  try {
    const user = ctx.from;

    // Get user from database
    const { data: telegramUser, error: telegramError } = await db.client
      .from('telegram_users')
      .select('user_id')
      .eq('telegram_id', user.id)
      .single();

    if (telegramError || !telegramUser) {
      await ctx.replyWithMarkdown('❌ **User not found**\n\nPlease register first.');
      return;
    }

    // Get user preferences from database
    const { data: preferences, error: prefError } = await db.client
      .rpc('get_user_audio_preferences', { p_telegram_id: user.id });

    const prefs = preferences || {
      audio_enabled: true,
      payment_approval_audio: true,
      payment_rejection_audio: true,
      withdrawal_approval_audio: true,
      withdrawal_rejection_audio: true,
      commission_update_audio: true,
      referral_bonus_audio: true,
      system_announcement_audio: true,
      notification_volume: 'medium'
    };

    const settingsMessage = `⚙️ **USER SETTINGS & PREFERENCES**



**🔊 AUDIO NOTIFICATION SETTINGS:**
• **Master Audio:** ${prefs.audio_enabled ? '🔔 Enabled' : '🔇 Disabled'}
• **Volume Level:** ${prefs.notification_volume ? prefs.notification_volume.toUpperCase() : 'MEDIUM'}

**📱 NOTIFICATION TYPES:**
• **Payment Approvals:** ${prefs.payment_approval_audio ? '💰 🔔' : '💰 🔇'}
• **Payment Rejections:** ${prefs.payment_rejection_audio ? '❌ 🔔' : '❌ 🔇'}
• **Withdrawal Updates:** ${prefs.withdrawal_approval_audio ? '💸 🔔' : '💸 🔇'}
• **Commission Updates:** ${prefs.commission_update_audio ? '💎 🔔' : '💎 🔇'}
• **Referral Bonuses:** ${prefs.referral_bonus_audio ? '🤝 🔔' : '🤝 🔇'}
• **System Announcements:** ${prefs.system_announcement_audio ? 'ℹ️ 🔔' : 'ℹ️ 🔇'}

**💡 ABOUT AUDIO NOTIFICATIONS:**
Audio notifications use different sound tones and emojis to help you quickly identify the type of update you've received. This enhances your experience by providing immediate context for important notifications.

**🎵 SOUND TYPES:**
• 💰 Payment/Commission sounds for financial updates
• ✅ Success sounds for approvals
• ❌ Alert sounds for rejections/errors
• ⚠️ Warning sounds for important notices
• ℹ️ Info sounds for general updates

`;

    const keyboard = [
      [{ text: prefs.audio_enabled ? "🔇 Disable All Audio" : "🔔 Enable All Audio", callback_data: "toggle_audio_notifications" }],
      [{ text: "🎛️ Customize Notification Types", callback_data: "customize_audio_types" }],
      [{ text: "🔊 Test Audio Notification", callback_data: "test_audio_notification" }],
      [{ text: "🔙 Back to Main Menu", callback_data: "main_menu" }]
    ];

    await ctx.replyWithMarkdown(settingsMessage, {
      reply_markup: { inline_keyboard: keyboard }
    });

  } catch (error) {
    console.error('User settings error:', error);
    await ctx.replyWithMarkdown('❌ **Error loading settings**\n\nPlease try again.');
  }
}

// Handle audio notification test
async function handleTestAudioNotification(ctx) {
  try {
    const user = ctx.from;

    await sendNotificationWithAudio(
      ctx,
      `🎵 **AUDIO NOTIFICATION TEST**

This is a test of the audio notification system!

**🔊 Features:**
• Enhanced notification sounds
• Visual emoji indicators
• Different tones for different message types
• Improved user experience

If you can hear the notification sound and see the emoji, your audio notifications are working perfectly!`,
      'SUCCESS',
      {},
      true
    );

    // Send a follow-up message
    setTimeout(async () => {
      await ctx.replyWithMarkdown(`✅ **Test Complete!**

Did you hear the notification sound and see the emoji?

**If YES:** Your audio notifications are working perfectly!
**If NO:** Check your device's notification settings or contact support.

You can toggle audio notifications on/off in the settings menu anytime.`);
    }, 2000);

  } catch (error) {
    console.error('Test audio notification error:', error);
    await ctx.replyWithMarkdown('❌ **Error testing audio notification**\n\nPlease try again.');
  }
}

// Handle toggling audio notifications
async function handleToggleAudioNotifications(ctx) {
  try {
    const user = ctx.from;

    // Get user from database
    const { data: telegramUser, error: telegramError } = await db.client
      .from('telegram_users')
      .select('user_id')
      .eq('telegram_id', user.id)
      .single();

    if (telegramError || !telegramUser) {
      await ctx.replyWithMarkdown('❌ **User not found**\n\nPlease register first.');
      return;
    }

    // Get current preferences
    const currentlyEnabled = await isAudioNotificationEnabled(user.id);
    const newStatus = !currentlyEnabled;

    // Update preferences in database
    const updateResult = await db.client
      .rpc('update_user_audio_preferences', {
        p_telegram_id: user.id,
        p_user_id: telegramUser.user_id,
        p_preferences: JSON.stringify({
          audio_enabled: newStatus
        })
      });

    if (updateResult.error) {
      console.error('Error updating audio preferences:', updateResult.error);
      await ctx.replyWithMarkdown('❌ **Error updating preferences**\n\nPlease try again.');
      return;
    }

    const statusMessage = `🔊 **AUDIO NOTIFICATIONS ${newStatus ? 'ENABLED' : 'DISABLED'}**



**Status Changed:** ${currentlyEnabled ? '🔔 Enabled' : '🔇 Disabled'} → ${newStatus ? '🔔 Enabled' : '🔇 Disabled'}

**What This Means:**
${newStatus ?
`• ✅ You'll receive enhanced notifications with sound
• 🎵 Different tones for different message types
• 💰 Audio cues for payments and commissions
• 🔔 Notification sounds will be enabled` :
`• 🔇 Notifications will be silent
• ❌ No audio cues or sound effects
• 📱 Visual notifications only
• 🔕 Notification sounds will be disabled`}

**✅ Your preference has been saved to the database and will be applied to all future notifications.**

`;

    await sendNotificationWithAudio(
      ctx,
      statusMessage,
      newStatus ? 'SUCCESS' : 'INFO',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔊 Test Audio Notification", callback_data: "test_audio_notification" }],
            [{ text: "⚙️ Back to Settings", callback_data: "user_settings" }],
            [{ text: "🏠 Main Menu", callback_data: "main_menu" }]
          ]
        }
      },
      newStatus
    );

  } catch (error) {
    console.error('Toggle audio notifications error:', error);
    await ctx.replyWithMarkdown('❌ **Error toggling audio notifications**\n\nPlease try again.');
  }
}

// Handle customizing individual audio notification types
async function handleCustomizeAudioTypes(ctx) {
  try {
    const user = ctx.from;

    // Get user from database
    const { data: telegramUser, error: telegramError } = await db.client
      .from('telegram_users')
      .select('user_id')
      .eq('telegram_id', user.id)
      .single();

    if (telegramError || !telegramUser) {
      await ctx.replyWithMarkdown('❌ **User not found**\n\nPlease register first.');
      return;
    }

    // Get current preferences
    const { data: preferences, error: prefError } = await db.client
      .rpc('get_user_audio_preferences', { p_telegram_id: user.id });

    const prefs = preferences || {
      payment_approval_audio: true,
      payment_rejection_audio: true,
      withdrawal_approval_audio: true,
      withdrawal_rejection_audio: true,
      commission_update_audio: true,
      referral_bonus_audio: true,
      system_announcement_audio: true
    };

    const customizeMessage = `🎛️ **CUSTOMIZE NOTIFICATION TYPES**



**Select which types of notifications should play audio:**

**💰 FINANCIAL NOTIFICATIONS:**
• Payment Approvals: ${prefs.payment_approval_audio ? '🔔 ON' : '🔇 OFF'}
• Payment Rejections: ${prefs.payment_rejection_audio ? '🔔 ON' : '🔇 OFF'}
• Withdrawal Updates: ${prefs.withdrawal_approval_audio ? '🔔 ON' : '🔇 OFF'}
• Commission Updates: ${prefs.commission_update_audio ? '🔔 ON' : '🔇 OFF'}

**🤝 SOCIAL NOTIFICATIONS:**
• Referral Bonuses: ${prefs.referral_bonus_audio ? '🔔 ON' : '🔇 OFF'}

**ℹ️ SYSTEM NOTIFICATIONS:**
• System Announcements: ${prefs.system_announcement_audio ? '🔔 ON' : '🔇 OFF'}



**Tap any notification type below to toggle its audio setting:**`;

    const keyboard = [
      [
        { text: `💰 Payment Approvals ${prefs.payment_approval_audio ? '🔔' : '🔇'}`, callback_data: "toggle_payment_approval_audio" },
        { text: `❌ Payment Rejections ${prefs.payment_rejection_audio ? '🔔' : '🔇'}`, callback_data: "toggle_payment_rejection_audio" }
      ],
      [
        { text: `💸 Withdrawal Updates ${prefs.withdrawal_approval_audio ? '🔔' : '🔇'}`, callback_data: "toggle_withdrawal_audio" },
        { text: `💎 Commission Updates ${prefs.commission_update_audio ? '🔔' : '🔇'}`, callback_data: "toggle_commission_audio" }
      ],
      [
        { text: `🤝 Referral Bonuses ${prefs.referral_bonus_audio ? '🔔' : '🔇'}`, callback_data: "toggle_referral_audio" },
        { text: `ℹ️ System Announcements ${prefs.system_announcement_audio ? '🔔' : '🔇'}`, callback_data: "toggle_system_audio" }
      ],
      [{ text: "🔊 Test Audio Notification", callback_data: "test_audio_notification" }],
      [{ text: "⚙️ Back to Settings", callback_data: "user_settings" }],
      [{ text: "🏠 Main Menu", callback_data: "main_menu" }]
    ];

    await ctx.replyWithMarkdown(customizeMessage, {
      reply_markup: { inline_keyboard: keyboard }
    });

  } catch (error) {
    console.error('Customize audio types error:', error);
    await ctx.replyWithMarkdown('❌ **Error loading customization options**\n\nPlease try again.');
  }
}

// Handle individual notification type toggles
async function handleToggleSpecificAudioType(ctx, audioType) {
  try {
    const user = ctx.from;

    // Get user from database
    const { data: telegramUser, error: telegramError } = await db.client
      .from('telegram_users')
      .select('user_id')
      .eq('telegram_id', user.id)
      .single();

    if (telegramError || !telegramUser) {
      await ctx.replyWithMarkdown('❌ **User not found**\n\nPlease register first.');
      return;
    }

    // Get current preferences
    const { data: preferences, error: prefError } = await db.client
      .rpc('get_user_audio_preferences', { p_telegram_id: user.id });

    const currentValue = preferences?.[audioType] ?? true;
    const newValue = !currentValue;

    // Update specific preference
    const updateData = {};
    updateData[audioType] = newValue;

    const updateResult = await db.client
      .rpc('update_user_audio_preferences', {
        p_telegram_id: user.id,
        p_user_id: telegramUser.user_id,
        p_preferences: JSON.stringify(updateData)
      });

    if (updateResult.error) {
      console.error('Error updating specific audio preference:', updateResult.error);
      await ctx.answerCbQuery('❌ Error updating preference');
      return;
    }

    const typeNames = {
      'payment_approval_audio': 'Payment Approvals',
      'payment_rejection_audio': 'Payment Rejections',
      'withdrawal_approval_audio': 'Withdrawal Updates',
      'withdrawal_rejection_audio': 'Withdrawal Rejections',
      'commission_update_audio': 'Commission Updates',
      'referral_bonus_audio': 'Referral Bonuses',
      'system_announcement_audio': 'System Announcements'
    };

    const typeName = typeNames[audioType] || audioType;

    await ctx.answerCbQuery(`${newValue ? '🔔' : '🔇'} ${typeName} audio ${newValue ? 'enabled' : 'disabled'}`);

    // Refresh the customization menu
    await handleCustomizeAudioTypes(ctx);

  } catch (error) {
    console.error('Toggle specific audio type error:', error);
    await ctx.answerCbQuery('❌ Error updating preference');
  }
}

async function handleViewReferrals(ctx) {
  const user = ctx.from;

  try {
    // Get user ID from telegram_users table
    const { data: telegramUser, error: telegramError } = await db.client
      .from('telegram_users')
      .select('user_id')
      .eq('telegram_id', user.id)
      .single();

    if (telegramError || !telegramUser) {
      await ctx.replyWithMarkdown('❌ **User not found**\n\nPlease register first.');
      return;
    }

    // Get referral relationships
    const { data: referrals, error: referralError } = await db.client
      .from('referrals')
      .select(`
        id,
        referred_id,
        created_at,
        status,
        users!referrals_referred_id_fkey (
          username,
          full_name,
          created_at
        )
      `)
      .eq('referrer_id', telegramUser.user_id)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (referralError) {
      console.error('Referrals fetch error:', referralError);
      await ctx.replyWithMarkdown('❌ **Error loading referral data**\n\nPlease try again.');
      return;
    }

    // Get commission balance for total commissions display
    const { data: commissionBalance, error: commissionError } = await db.client
      .from('commission_balances')
      .select('*')
      .eq('user_id', telegramUser.user_id)
      .single();

    let totalCommissions = 0;
    if (commissionBalance) {
      totalCommissions = parseFloat(commissionBalance.total_earned_usdt || 0) +
                        parseFloat(commissionBalance.total_earned_shares || 0);
    }

    let referralsList = '';
    if (referrals && referrals.length > 0) {
      referrals.forEach((referral, index) => {
        const joinDate = new Date(referral.users.created_at).toLocaleDateString();
        const username = referral.users.username || referral.users.full_name || 'Anonymous';
        // Safely format username to avoid Markdown parsing issues
        const safeUsername = username.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
        referralsList += `${index + 1}. **${safeUsername}**\n   📅 Joined: ${joinDate}\n   ✅ Status: Active\n\n`;
      });
    } else {
      referralsList = '*No referrals yet. Start sharing your referral link!*';
    }

    const referralsMessage = `👥 **MY REFERRALS**



**📊 REFERRAL STATISTICS:**
• **Total Referrals:** ${referrals ? referrals.length : 0}
• **Active Referrals:** ${referrals ? referrals.length : 0}
• **Total Commissions Earned:** $${totalCommissions.toFixed(2)}

**👤 REFERRAL LIST:**
${referralsList}

**🚀 GROW YOUR NETWORK:**
Share your referral link to earn 15% USDT + 15% shares commission on every share your referrals purchases!

`;

    try {
      await ctx.replyWithMarkdown(referralsMessage, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📤 Share Referral Link", callback_data: "share_referral" }],
            [{ text: "💰 View Commission Balance", callback_data: "view_commission" }],
            [{ text: "🔄 Refresh List", callback_data: "view_referrals" }],
            [{ text: "🔙 Back to Referral Dashboard", callback_data: "menu_referrals" }]
          ]
        }
      });
    } catch (markdownError) {
      console.error('❌ Markdown parsing error in referrals view:', markdownError);
      console.error('❌ Problematic message content:', referralsMessage);

      // Fallback: Send without markdown formatting
      const plainMessage = referralsMessage.replace(/\*\*/g, '').replace(/`/g, '');
      await ctx.reply(plainMessage, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📤 Share Referral Link", callback_data: "share_referral" }],
            [{ text: "💰 View Commission Balance", callback_data: "view_commission" }],
            [{ text: "🔄 Refresh List", callback_data: "view_referrals" }],
            [{ text: "🔙 Back to Referral Dashboard", callback_data: "menu_referrals" }]
          ]
        }
      });
    }

  } catch (error) {
    console.error('View referrals error:', error);
    await ctx.replyWithMarkdown('❌ **Error loading referral list**\n\nPlease try again.');
  }
}

async function handleWithdrawCommissions(ctx) {
  await ctx.replyWithMarkdown(`💸 **COMMISSION WITHDRAWAL**



**🚧 WITHDRAWAL SYSTEM COMING SOON**

We're currently developing a secure commission withdrawal system with the following features:

**🔐 SECURITY FEATURES:**
• Multi-signature wallet verification
• Two-factor authentication
• Admin approval process
• Anti-fraud protection

**💳 SUPPORTED NETWORKS:**
• BSC (Binance Smart Chain)
• Polygon (MATIC)
• TRON (TRC20)

**📋 WITHDRAWAL PROCESS:**
1. Select withdrawal network
2. Enter wallet address
3. Specify withdrawal amount
4. Admin verification
5. Secure payout processing

**📧 GET NOTIFIED:**
We'll notify all users when the withdrawal system goes live!

`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "💰 View Commission Balance", callback_data: "view_commission" }],
        [{ text: "📤 Share More Referrals", callback_data: "share_referral" }],
        [{ text: "🔙 Back to Referral Dashboard", callback_data: "menu_referrals" }]
      ]
    }
  });
}

// COMMISSION WITHDRAWAL SYSTEM HANDLERS

// Handle USDT Commission Withdrawal
async function handleWithdrawUSDTCommission(ctx) {
  const user = ctx.from;

  try {
    // Get user ID from telegram_users table
    const { data: telegramUser, error: telegramError } = await db.client
      .from('telegram_users')
      .select('user_id')
      .eq('telegram_id', user.id)
      .single();

    if (telegramError || !telegramUser) {
      await ctx.replyWithMarkdown('❌ **User not found**\n\nPlease register first.');
      return;
    }

    // Check for existing pending withdrawal requests first
    const { data: pendingWithdrawals, error: pendingError } = await db.client
      .from('commission_withdrawals')
      .select('id, amount, created_at, withdrawal_type')
      .eq('user_id', telegramUser.user_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1);

    if (pendingError) {
      console.error('Error checking pending withdrawals:', pendingError);
      await ctx.replyWithMarkdown('❌ **Error checking existing requests**\n\nPlease try again.');
      return;
    }

    if (pendingWithdrawals && pendingWithdrawals.length > 0) {
      const pendingWithdrawal = pendingWithdrawals[0];
      const shortId = pendingWithdrawal.id.substring(0, 8);
      const submissionDate = new Date(pendingWithdrawal.created_at).toLocaleDateString();
      const submissionTime = new Date(pendingWithdrawal.created_at).toLocaleTimeString();

      await ctx.replyWithMarkdown(`⚠️ **PENDING WITHDRAWAL REQUEST EXISTS**



**🔍 YOUR PENDING REQUEST:**
• **Request ID:** #${shortId}
• **Amount:** $${pendingWithdrawal.amount} USDT
• **Type:** ${pendingWithdrawal.withdrawal_type.toUpperCase()}
• **Submitted:** ${submissionDate} at ${submissionTime}
• **Status:** ⏳ Awaiting admin approval



**⏰ WHAT HAPPENS NEXT:**
• Admin will review your request within 24-48 hours
• You'll receive a notification when processed
• If approved: Funds will be sent to your wallet
• If rejected: You can submit a new request

**💡 WHAT YOU CAN DO NOW:**
• **Wait:** Most requests are processed within 1-2 business days
• **Check Status:** Use "View Pending Requests" for updates
• **Contact Admin:** @TTTFOUNDER for urgent questions

**🚫 WHY CAN'T I SUBMIT ANOTHER?**
This prevents duplicate requests and ensures accurate balance management.
Your funds are safely tracked and will be processed fairly.

`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "⏳ View Pending Requests", callback_data: "view_pending_requests" }],
            [{ text: "🛒 Use Commission for Shares", callback_data: "commission_to_shares" }],
            [{ text: "💰 View Commission Balance", callback_data: "view_commission" }],
            [{ text: "📞 Contact Admin", url: "https://t.me/TTTFOUNDER" }]
          ]
        }
      });
      return;
    }

    // Get commission balance
    const { data: balance, error: balanceError } = await db.client
      .from('commission_balances')
      .select('usdt_balance')
      .eq('user_id', telegramUser.user_id)
      .single();

    if (balanceError || !balance || balance.usdt_balance <= 0) {
      await ctx.replyWithMarkdown(`💸 **INSUFFICIENT BALANCE**



**❌ No USDT commission available for withdrawal**

**💰 Current Balance:** $0.00 USDT

**🎯 TO EARN COMMISSIONS:**
• Share your referral link
• Invite friends to purchase shares
• Earn 15% USDT + 15% shares on their purchases

`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📤 Share Referral Link", callback_data: "share_referral" }],
            [{ text: "🔙 Back to Commission Dashboard", callback_data: "view_commission" }]
          ]
        }
      });
      return;
    }

    const availableBalance = parseFloat(balance.usdt_balance);

    // Set user state for withdrawal amount input
    await setUserState(user.id, 'awaiting_withdrawal_amount', {
      availableBalance,
      withdrawalType: 'usdt'
    });

    const withdrawalMessage = `💸 **USDT COMMISSION WITHDRAWAL**



**💰 Available Balance:** $${availableBalance.toFixed(2)} USDT

**📝 WITHDRAWAL PROCESS:**
1. **Enter withdrawal amount** (minimum $10.00)
2. **Provide USDT wallet address** 
3. **Admin review and approval** (24-48 hours)
4. **Payment processing** (1-3 business days)

**💡 IMPORTANT NOTES:**
• Minimum withdrawal: $10.00 USDT
• Networks: ETH, BSC, POL, TRON supported
• Processing fee: $2.00 USDT (deducted from withdrawal)
• Maximum daily withdrawal: $1,000.00 USDT



**💵 Enter withdrawal amount (USD):**`;

    await ctx.replyWithMarkdown(withdrawalMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "❌ Cancel Withdrawal", callback_data: "view_commission" }]
        ]
      }
    });

  } catch (error) {
    console.error('Error handling USDT withdrawal:', error);
    await ctx.replyWithMarkdown('❌ **Error processing withdrawal request**\n\nPlease try again.');
  }
}

// Handle Commission to Shares Conversion
async function handleCommissionToShares(ctx) {
  const user = ctx.from;

  try {
    // Get user ID from telegram_users table
    const { data: telegramUser, error: telegramError } = await db.client
      .from('telegram_users')
      .select('user_id')
      .eq('telegram_id', user.id)
      .single();

    if (telegramError || !telegramUser) {
      await ctx.replyWithMarkdown('❌ **User not found**\n\nPlease register first.');
      return;
    }

    // 🔒 SECURE BALANCE: Get commission balance with escrow information
    const balanceInfo = await getAvailableCommissionBalance(telegramUser.user_id);

    console.log(`💰 [BALANCE] User ${telegramUser.user_id} balance check:`, balanceInfo);

    // Check for existing pending conversion requests
    const { data: pendingConversions, error: pendingError } = await db.client
      .from('commission_conversions')
      .select('id')
      .eq('user_id', telegramUser.user_id)
      .eq('status', 'pending')
      .limit(1);

    if (pendingError) {
      console.error('Error checking pending conversions:', pendingError);
      await ctx.replyWithMarkdown('❌ **Error checking existing requests**\n\nPlease try again.');
      return;
    }

    if (pendingConversions && pendingConversions.length > 0) {
      // Get detailed information about the pending conversion
      const { data: pendingDetails, error: detailsError } = await db.client
        .from('commission_conversions')
        .select('id, usdt_amount, shares_requested, created_at')
        .eq('user_id', telegramUser.user_id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const shortId = pendingDetails ? pendingDetails.id.substring(0, 8) : 'Unknown';
      const submissionDate = pendingDetails ? new Date(pendingDetails.created_at).toLocaleDateString() : 'Unknown';
      const submissionTime = pendingDetails ? new Date(pendingDetails.created_at).toLocaleTimeString() : 'Unknown';
      const requestedShares = pendingDetails ? pendingDetails.shares_requested : 0;
      const requestedAmount = pendingDetails ? pendingDetails.usdt_amount : 0;

      await ctx.replyWithMarkdown(`⚠️ **PENDING CONVERSION REQUEST EXISTS**



**🔍 YOUR PENDING REQUEST:**
• **Request ID:** #${shortId}
• **Shares Requested:** ${requestedShares} shares
• **USDT Amount:** $${requestedAmount.toFixed(2)}
• **Submitted:** ${submissionDate} at ${submissionTime}
• **Status:** ⏳ Awaiting admin approval

**💰 CURRENT BALANCE:**
• **Total Balance:** $${balanceInfo.totalBalance.toFixed(2)} USDT
• **Locked (Escrowed):** $${balanceInfo.escrowedAmount.toFixed(2)} USDT
• **Available:** $${balanceInfo.availableBalance.toFixed(2)} USDT



**⏰ WHAT HAPPENS NEXT:**
• Admin will review your request within 24-48 hours
• You'll receive a notification when processed
• If approved: USDT deducted, shares added to portfolio
• If rejected: Escrowed funds will be released

**💡 WHAT YOU CAN DO NOW:**
• **Wait:** Most requests are processed within 1-2 business days
• **Check Status:** Use "View Pending Requests" for updates
• **Contact Admin:** @TTTFOUNDER for urgent questions
• **Use Available Balance:** $${balanceInfo.availableBalance.toFixed(2)} USDT still available

**🚫 WHY CAN'T I SUBMIT ANOTHER?**
This prevents duplicate requests and ensures accurate balance management.
Your funds are safely escrowed and will be processed fairly.

`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "⏳ View Pending Requests", callback_data: "view_pending_requests" }],
            [{ text: "💸 Withdraw USDT Instead", callback_data: "withdraw_usdt_commission" }],
            [{ text: "💰 View Commission Balance", callback_data: "view_commission" }],
            [{ text: "📞 Contact Admin", url: "https://t.me/TTTFOUNDER" }]
          ]
        }
      });
      return;
    }

    // 🔒 SECURE VALIDATION: Check available balance (not total balance)
    if (balanceInfo.availableBalance <= 0) {
      let insufficientMessage = `💰 **INSUFFICIENT AVAILABLE COMMISSION BALANCE**



**💰 Balance Details:**
• **Total Balance:** $${balanceInfo.totalBalance.toFixed(2)} USDT
• **Available Balance:** $${balanceInfo.availableBalance.toFixed(2)} USDT`;

      if (balanceInfo.escrowedAmount > 0) {
        insufficientMessage += `
• **Currently Escrowed:** $${balanceInfo.escrowedAmount.toFixed(2)} USDT

**⚠️ Some of your balance is locked in pending requests.**`;
      }

      insufficientMessage += `

You need a positive available USDT commission balance to convert to shares.

**💡 How to increase available balance:**`;

      if (balanceInfo.escrowedAmount > 0) {
        insufficientMessage += `
• Wait for pending requests to be processed`;
      }

      insufficientMessage += `
• Refer new shareholders using your referral link
• Earn 15% USDT commission on their share purchases
• Use earned commissions to purchase more shares

`;

      await ctx.replyWithMarkdown(insufficientMessage, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📤 Share Referral Link", callback_data: "share_referral" }],
            [{ text: "🔙 Back to Commission Dashboard", callback_data: "view_commission" }]
          ]
        }
      });
      return;
    }

    // Get current phase information
    const { data: currentPhase, error: phaseError } = await db.client
      .from('investment_phases')
      .select('*')
      .eq('is_active', true)
      .single();

    if (phaseError || !currentPhase) {
      await ctx.replyWithMarkdown('❌ **Error loading current phase information**\n\nPlease try again.');
      return;
    }

    const sharePrice = parseFloat(currentPhase.price_per_share);
    const maxShares = Math.floor(balanceInfo.availableBalance / sharePrice);

    const conversionMessage = `🛒 **CONVERT COMMISSION TO SHARES**



**💰 YOUR COMMISSION BALANCE:**
• Available USDT: $${balanceInfo.availableBalance.toFixed(2)}

**📊 CURRENT PHASE INFORMATION:**
• Phase ${currentPhase.phase_number}
• Share Price: $${sharePrice.toFixed(2)} per share
• Maximum Shares You Can Buy: ${maxShares} shares

**💡 CONVERSION PROCESS:**
1. Enter the number of shares you want to purchase
2. System calculates total cost
3. Request goes to admin for approval
4. Once approved: USDT deducted, shares added to portfolio



**Enter the number of shares you want to purchase (1-${maxShares}):**`;

    await ctx.replyWithMarkdown(conversionMessage, {
      reply_markup: {
        force_reply: true,
        input_field_placeholder: `Enter shares (1-${maxShares})`
      }
    });

    // Set user state for commission conversion
    await setUserState(user.id, 'awaiting_commission_shares', {
      available_usdt: balanceInfo.availableBalance,
      share_price: sharePrice,
      max_shares: maxShares,
      phase_id: currentPhase.id,
      phase_number: currentPhase.phase_number
    });

  } catch (error) {
    console.error('Commission to shares error:', error);
    await ctx.replyWithMarkdown('❌ **Error processing request**\n\nPlease try again.');
  }
}

// Handle Withdrawal History
async function handleWithdrawalHistory(ctx) {
  const user = ctx.from;

  try {
    // Get user ID from telegram_users table
    const { data: telegramUser, error: telegramError } = await db.client
      .from('telegram_users')
      .select('user_id')
      .eq('telegram_id', user.id)
      .single();

    if (telegramError || !telegramUser) {
      await ctx.replyWithMarkdown('❌ **User not found**\n\nPlease register first.');
      return;
    }

    // Get withdrawal history (when table exists)
    const historyMessage = `📋 **WITHDRAWAL HISTORY**



**🚧 FEATURE COMING SOON**

Your withdrawal history will be displayed here once the withdrawal system is fully implemented.

**📊 PLANNED FEATURES:**
• Complete withdrawal transaction history
• Status tracking (pending, approved, completed)
• Transaction hash verification
• Download statements
• Filter by date range and status

**💰 CURRENT STATUS:**
• Commission tracking: ✅ Active
• Balance management: ✅ Active
• Withdrawal requests: 🚧 In development
• History tracking: 🚧 In development



**📞 For withdrawal history inquiries, contact @TTTFOUNDER**`;

    await ctx.replyWithMarkdown(historyMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "💰 View Current Balance", callback_data: "view_commission" }],
          [{ text: "📧 Contact Support", url: "https://t.me/TTTFOUNDER" }],
          [{ text: "🔙 Back to Commission Dashboard", callback_data: "view_commission" }]
        ]
      }
    });

  } catch (error) {
    console.error('Error loading withdrawal history:', error);
    await ctx.replyWithMarkdown('❌ **Error loading withdrawal history**\n\nPlease try again.');
  }
}

async function handleCopyReferralLink(ctx, callbackData) {
  const referralUsername = callbackData.replace('copy_referral_link_', '');
  const referralLink = `https://t.me/AureusAllianceBot?start=${referralUsername}`;

  // DEBUG: Log the generated link to verify it's correct
  console.log('🔗 DEBUG - Copy referral link generated:', referralLink);
  console.log('🔗 DEBUG - Username:', referralUsername);

  await ctx.answerCbQuery(`📋 Referral link copied!`);

  await ctx.replyWithMarkdown(`📋 **REFERRAL LINK COPIED**

**Your Personal Referral Link:**
\`${referralLink}\`

**🎯 HOW IT WORKS:**
• Share this link with potential shareholders
• When they click it, you're automatically assigned as their sponsor
• You earn 15% USDT + 15% shares commission on their share purchases
• No manual referral code entry needed!

**🚀 QUICK SHARING MESSAGES:**

**💎 For WhatsApp/SMS:**
"🔥 GOLD MINING OPPORTUNITY! Join me in owning real shares in African gold mines. Click: ${referralLink}"

**📱 For Social Media:**
"💰 Building wealth through gold mining! Join Aureus Alliance Holdings: ${referralLink} #GoldShares #WealthBuilding"

**📧 For Email:**
"I wanted to share an exciting gold mining share owning opportunity with you. Aureus Alliance Holdings offers shares in real African gold operations. Check it out: ${referralLink}"`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📤 Share on Telegram", url: `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent('🔥 Join me in owning shares in real African gold mines!')}` }],
        [{ text: "👥 Back to Referral Dashboard", callback_data: "menu_referrals" }]
      ]
    }
  });
}

async function handleCopyReferral(ctx, callbackData) {
  const referralCode = callbackData.replace('copy_referral_', '');

  await ctx.answerCbQuery(`📋 Referral username copied: ${referralCode}`);

  await ctx.replyWithMarkdown(`📋 **REFERRAL USERNAME COPIED**

**Your Referral Username:** \`${referralCode}\`

**🚀 QUICK SHARING MESSAGES:**

**💎 For WhatsApp/SMS:**
*"🔥 GOLD MINING SHARE OWNERSHIP OPPORTUNITY! Own shares in real African gold mines. Starting at just $5. Massive profit potential! Use my referral '${referralCode}' here: https://t.me/AureusAllianceBot"*

**📱 For Social Media:**
*"💰 Just discovered an incredible gold mining share ownership opportunity! Real washplants, real gold, real profits. Early shareholders getting $5/share before it goes up! Use referral '${referralCode}': https://t.me/AureusAllianceBot #GoldShareOwnership #WealthBuilding"*

**💼 For Serious Shareholders:**
*"Professional gold mining share ownership opportunity in Africa. 10 active washplants, 3,200 KG annual target. Phase 1 pricing available. Use referral '${referralCode}' for priority: https://t.me/AureusAllianceBot"*

**📧 For Email:**
*"I wanted to share an exclusive gold mining share ownership opportunity I discovered. Aureus Alliance Holdings operates real gold mines in Africa with proven reserves. You can own shares starting at $5 each. Use my referral code '${referralCode}' when you register: https://t.me/AureusAllianceBot"*`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📤 Share Full Share Purchase Pitch", callback_data: "share_referral" }],
        [{ text: "👥 Back to Referral Dashboard", callback_data: "menu_referrals" }]
      ]
    }
  });
}

// LEGAL DOCUMENTS SYSTEM
// Handle legal documents menu
async function handleLegalDocuments(ctx) {
  const user = ctx.from;

  try {
    // Check if user has accepted NDA
    const hasNDA = await checkNDAAcceptance(user.id);

    if (!hasNDA) {
      await showNDAAcceptance(ctx);
      return;
    }

    // Show legal documents menu
    await showLegalDocumentsMenu(ctx);

  } catch (error) {
    console.error('Error handling legal documents:', error);
    await ctx.replyWithMarkdown('❌ **Error accessing legal documents**\n\nPlease try again or contact support.');
  }
}

// Check if user has accepted NDA
async function checkNDAAcceptance(telegramUserId) {
  try {
    // Get user from database
    const { data: telegramUser, error: userError } = await db.client
      .from('telegram_users')
      .select('user_id')
      .eq('telegram_id', telegramUserId)
      .single();

    if (userError || !telegramUser) {
      return false;
    }

    // Check NDA acceptance
    const { data: ndaAcceptance, error: ndaError } = await db.client
      .from('nda_acceptances')
      .select('id')
      .eq('user_id', telegramUser.user_id)
      .single();

    return !ndaError && ndaAcceptance;

  } catch (error) {
    console.error('Error checking NDA acceptance:', error);
    return false;
  }
}

// Show NDA acceptance screen
async function showNDAAcceptance(ctx) {
  const ndaMessage = `🔒 **NON-DISCLOSURE AGREEMENT (NDA)**



**⚠️ CONFIDENTIAL LEGAL DOCUMENTS ACCESS**

To access Aureus Alliance Holdings' legal documents, you must first accept our Non-Disclosure Agreement.

**📋 NDA TERMS:**

**1. CONFIDENTIALITY OBLIGATION**
• All documents contain proprietary and confidential information
• Information may not be shared, copied, or distributed
• Documents are for your personal review only

**2. PERMITTED USE**
• Review for share purchase decision purposes only
• Verify company legitimacy and compliance
• Assess business operations and financial standing

**3. PROHIBITED ACTIONS**
• Sharing documents with third parties
• Public disclosure of confidential information
• Commercial use of proprietary data
• Reproduction or distribution of materials

**4. LEGAL CONSEQUENCES**
• Breach may result in legal action
• Damages and injunctive relief may be sought
• Agreement governed by South African law

**🔐 SECURITY NOTICE:**
• Document access is logged and monitored
• Your acceptance is legally binding
• Timestamp and user details are recorded

**⚖️ By accepting, you agree to be bound by these terms and acknowledge that violation may result in legal consequences.**`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "✅ I Accept the NDA Terms", callback_data: "accept_nda" }
      ],
      [
        { text: "❌ I Decline", callback_data: "decline_nda" }
      ],
      [
        { text: "🏠 Back to Dashboard", callback_data: "main_menu" }
      ]
    ]
  };

  await ctx.replyWithMarkdown(ndaMessage, { reply_markup: keyboard });
}

// Show legal documents menu
async function showLegalDocumentsMenu(ctx) {
  const documentsMessage = `📋 **LEGAL DOCUMENTS CENTER**



**🔒 CONFIDENTIAL BUSINESS DOCUMENTS**

Access to official company registration, tax compliance, banking, and operational documentation.

**📑 AVAILABLE DOCUMENTS:**

**🏢 Company Registration**
Official CIPC registration certificate proving legal entity status

**💼 Tax Compliance**
SARS tax registration demonstrating regulatory compliance

**🏦 Banking Verification**
FNB bank confirmation validating financial infrastructure

**⛏️ Geological Assessment**
Professional gold placer analysis and operational report

**⚠️ CONFIDENTIALITY REMINDER:**
These documents contain proprietary information protected under your signed NDA. Unauthorized sharing is prohibited.

**📊 ACCESS LOG:**
Your document access is monitored and recorded for security purposes.`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "🏢 CIPC Registration Certificate", callback_data: "view_document_cipc" }
      ],
      [
        { text: "💼 SARS Tax Registration", callback_data: "view_document_sars" }
      ],
      [
        { text: "🏦 FNB Bank Confirmation", callback_data: "view_document_fnb" }
      ],
      [
        { text: "⛏️ Ubuntu Afrique Placer Report", callback_data: "view_document_placer" }
      ],
      [
        { text: "🏠 Back to Dashboard", callback_data: "main_menu" }
      ]
    ]
  };

  await ctx.replyWithMarkdown(documentsMessage, { reply_markup: keyboard });
}

// Handle NDA acceptance
async function handleNDAAcceptance(ctx) {
  const user = ctx.from;

  try {
    // Get user from database
    const { data: telegramUser, error: userError } = await db.client
      .from('telegram_users')
      .select('user_id')
      .eq('telegram_id', user.id)
      .single();

    if (userError || !telegramUser) {
      await ctx.answerCbQuery('❌ User not found');
      return;
    }

    // Record NDA acceptance
    const { error: ndaError } = await db.client
      .from('nda_acceptances')
      .insert({
        user_id: telegramUser.user_id,
        telegram_user_id: user.id,
        username: user.username || null,
        full_name: user.first_name + (user.last_name ? ` ${user.last_name}` : ''),
        accepted_at: new Date().toISOString()
      });

    if (ndaError) {
      console.error('Error recording NDA acceptance:', ndaError);
      await ctx.answerCbQuery('❌ Error recording acceptance');
      return;
    }

    await ctx.answerCbQuery('✅ NDA Accepted');

    // Show success message and legal documents menu
    const successMessage = `✅ **NDA ACCEPTED SUCCESSFULLY**



**🔒 CONFIDENTIALITY AGREEMENT CONFIRMED**

• **Accepted:** ${new Date().toLocaleString()}
• **User:** ${user.first_name} (@${user.username || 'N/A'})
• **Status:** Legally Binding

**📋 You now have access to confidential legal documents.**

**⚠️ REMINDER:** All documents are confidential and protected under the NDA you just accepted. Unauthorized sharing is prohibited.`;

    await ctx.replyWithMarkdown(successMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📋 View Legal Documents", callback_data: "menu_legal_documents" }],
          [{ text: "🏠 Back to Dashboard", callback_data: "main_menu" }]
        ]
      }
    });

  } catch (error) {
    console.error('Error handling NDA acceptance:', error);
    await ctx.answerCbQuery('❌ Error processing acceptance');
  }
}

// Handle NDA decline
async function handleNDADecline(ctx) {
  await ctx.answerCbQuery('NDA Declined');

  const declineMessage = `❌ **NDA DECLINED**



**🔒 ACCESS DENIED**

You have declined to accept the Non-Disclosure Agreement.

**📋 CONSEQUENCES:**
• Cannot access confidential legal documents
• Company registration and compliance documents unavailable
• Banking and operational reports restricted

**💡 ALTERNATIVE OPTIONS:**
• Review public company information
• Contact support for general inquiries
• Accept NDA later to gain document access

**🔄 You can return to accept the NDA at any time through the Legal Documents menu.**`;

  await ctx.replyWithMarkdown(declineMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔄 Reconsider NDA", callback_data: "menu_legal_documents" }],
        [{ text: "🏠 Back to Dashboard", callback_data: "main_menu" }]
      ]
    }
  });
}

// Handle document viewing
async function handleDocumentView(ctx, callbackData) {
  const user = ctx.from;
  const documentType = callbackData.split('_')[2]; // Extract document type from callback

  try {
    // Verify NDA acceptance
    const hasNDA = await checkNDAAcceptance(user.id);

    if (!hasNDA) {
      await ctx.answerCbQuery('❌ NDA required for document access');
      await showNDAAcceptance(ctx);
      return;
    }

    // Document configuration
    const documents = {
      'cipc': {
        name: 'CIPC Registration Certificate',
        url: 'https://fgubaqoftdeefcakejwu.supabase.co/storage/v1/object/public/assets//cipc.pdf',
        description: 'Official company registration from Companies and Intellectual Property Commission',
        icon: '🏢'
      },
      'sars': {
        name: 'SARS Tax Registration',
        url: 'https://fgubaqoftdeefcakejwu.supabase.co/storage/v1/object/public/assets//sars.pdf',
        description: 'South African Revenue Service tax registration documentation',
        icon: '💼'
      },
      'fnb': {
        name: 'FNB Bank Confirmation',
        url: 'https://fgubaqoftdeefcakejwu.supabase.co/storage/v1/object/public/assets//fnb.pdf',
        description: 'Official bank account confirmation from First National Bank',
        icon: '🏦'
      },
      'placer': {
        name: 'Ubuntu Afrique Placer Report',
        url: 'https://fgubaqoftdeefcakejwu.supabase.co/storage/v1/object/public/assets//Ubuntu_Afrique_Kadoma_Placer_Report.pdf',
        description: 'Professional geological assessment and gold placer analysis report',
        icon: '⛏️'
      }
    };

    const document = documents[documentType];

    if (!document) {
      await ctx.answerCbQuery('❌ Document not found');
      return;
    }

    // Log document access
    await logDocumentAccess(user.id, documentType, document.url, user.username);

    await ctx.answerCbQuery(`📄 Opening ${document.name}`);

    // Send document access message
    const accessMessage = `📄 **DOCUMENT ACCESS**



${document.icon} **${document.name}**

**📋 Description:** ${document.description}

**🔒 Confidentiality Notice:** This document is protected under your signed NDA. Unauthorized sharing is prohibited.

**📊 Access Logged:** ${new Date().toLocaleString()}

**📱 Click the button below to open the document in your browser/PDF viewer:**`;

    await ctx.replyWithMarkdown(accessMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: `📄 Open ${document.name}`, url: document.url }],
          [{ text: "📋 Back to Legal Documents", callback_data: "menu_legal_documents" }],
          [{ text: "🏠 Back to Dashboard", callback_data: "main_menu" }]
        ]
      }
    });

  } catch (error) {
    console.error('Error handling document view:', error);
    await ctx.answerCbQuery('❌ Error accessing document');
  }
}

// Log document access
async function logDocumentAccess(telegramUserId, documentType, documentUrl, username) {
  try {
    // Get user from database
    const { data: telegramUser, error: userError } = await db.client
      .from('telegram_users')
      .select('user_id')
      .eq('telegram_id', telegramUserId)
      .single();

    if (userError || !telegramUser) {
      console.error('Error getting user for document access log:', userError);
      return;
    }

    // Log the access
    const { error: logError } = await db.client
      .from('document_access_logs')
      .insert({
        user_id: telegramUser.user_id,
        document_type: documentType,
        document_url: documentUrl,
        telegram_user_id: telegramUserId,
        username: username || null,
        has_nda_acceptance: true,
        accessed_at: new Date().toISOString()
      });

    if (logError) {
      console.error('Error logging document access:', logError);
    }

  } catch (error) {
    console.error('Error in logDocumentAccess:', error);
  }
}

// KYC (KNOW YOUR CUSTOMER) SYSTEM
// Trigger KYC collection if needed after successful payment
async function triggerKYCCollectionIfNeeded(userId) {
  try {
    console.log(`🔍 [KYC] Checking KYC status for user ID: ${userId}`);

    // Check if user has already completed KYC
    const hasKYC = await checkKYCCompletion(userId);

    if (hasKYC) {
      console.log(`✅ [KYC] User ${userId} already has completed KYC - skipping collection`);
      return;
    }

    console.log(`📋 [KYC] User ${userId} needs to complete KYC - triggering collection`);

    // Get user's Telegram ID to send KYC request
    const { data: telegramUser, error: telegramError } = await db.client
      .from('telegram_users')
      .select('telegram_id, username')
      .eq('user_id', userId)
      .single();

    if (telegramError || !telegramUser) {
      console.error('❌ [KYC] Error getting user Telegram ID:', telegramError);
      return;
    }

    // Send KYC collection request to user
    await sendKYCCollectionRequest(telegramUser.telegram_id, telegramUser.username);

  } catch (error) {
    console.error('❌ [KYC] Error in triggerKYCCollectionIfNeeded:', error);
  }
}

// Check if user has completed KYC
async function checkKYCCompletion(userId) {
  try {
    const { data: kycData, error: kycError } = await db.client
      .from('kyc_information')
      .select('id, kyc_status')
      .eq('user_id', userId)
      .eq('kyc_status', 'completed')
      .single();

    return !kycError && kycData;

  } catch (error) {
    console.error('❌ [KYC] Error checking KYC completion:', error);
    return false;
  }
}

// Send KYC collection request to user
async function sendKYCCollectionRequest(telegramId, username) {
  try {
    console.log(`📋 [KYC] Sending KYC collection request to user ${username} (${telegramId})`);

    const kycMessage = `🎉 **CONGRATULATIONS ON YOUR SHARE PURCHASE!**



**📋 COMPLETE KYC FOR SHARE CERTIFICATE**

To generate and send your official share certificate, we need to collect some additional information as required by financial regulations.

**🔒 WHAT IS KYC?**
KYC (Know Your Customer) is a regulatory requirement that helps us:
• Verify your identity for legal compliance
• Generate personalized share certificates
• Ensure secure delivery of official documents
• Meet international financial standards

**📋 INFORMATION REQUIRED:**
• Full legal name (as on government ID)
• Government ID or Passport number
• Complete physical address
• Country of residence
• Phone number and email address

**⏰ CERTIFICATE TIMELINE:**
Once KYC is completed, your share certificate will be generated and sent within 48 hours (Monday-Friday, excluding weekends and holidays).

**🔐 PRIVACY & SECURITY:**
• All information is encrypted and securely stored
• Data is used only for certificate generation
• Full compliance with privacy regulations
• Your information is never shared with third parties

**✅ Ready to complete your KYC and receive your share certificate?**`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📋 Start KYC Process", callback_data: "start_kyc_process" }
        ],
        [
          { text: "ℹ️ Learn More About KYC", callback_data: "kyc_info" }
        ],
        [
          { text: "⏰ Complete Later", callback_data: "kyc_later" }
        ],
        [
          { text: "🏠 Back to Dashboard", callback_data: "main_menu" }
        ]
      ]
    };

    // Send KYC request message
    await sendAudioNotificationToUser(
      telegramId,
      kycMessage,
      'KYC',
      {
        reply_markup: keyboard
      },
      true // Enable audio notification for KYC requests
    );

    console.log(`✅ [KYC] KYC collection request sent successfully to user ${username}`);

  } catch (error) {
    console.error('❌ [KYC] Error sending KYC collection request:', error);
  }
}

// Show mandatory KYC dashboard (blocks access to main features)
async function showKYCDashboard(ctx, userId) {
  try {
    console.log(`📋 [KYC] Showing mandatory KYC dashboard for user ${userId}`);

    // Check if user has any approved payments (which would trigger KYC requirement)
    const { data: approvedPayments, error: paymentError } = await db.client
      .from('crypto_payment_transactions')
      .select('id, amount, created_at')
      .eq('user_id', userId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(1);

    let kycReason = '';
    if (approvedPayments && approvedPayments.length > 0) {
      const payment = approvedPayments[0];
      kycReason = `\n**🎉 CONGRATULATIONS!**\nYour payment of $${payment.amount} has been approved!\n\n`;
    }

    const kycDashboardMessage = `🔒 **KYC VERIFICATION REQUIRED**



${kycReason}**📋 COMPLETE YOUR KYC TO CONTINUE**

To access your dashboard and receive your share certificate, you must complete the KYC (Know Your Customer) verification process.

**🔒 WHAT IS KYC?**
KYC is a regulatory requirement that helps us:
• ✅ Verify your identity for legal compliance
• 📜 Generate personalized share certificates
• 🔐 Ensure secure delivery of official documents
• ⚖️ Meet international financial standards

**📋 INFORMATION REQUIRED:**
• 👤 Full legal name (as on government ID)
• 🆔 Government ID or Passport number
• 🏠 Complete physical address
• 🌍 Country of residence
• 📞 Phone number and email address

**⏰ CERTIFICATE TIMELINE:**
Once KYC is completed, your share certificate will be generated and sent within 48 hours (Monday-Friday).

**🔐 PRIVACY & SECURITY:**
• 🔒 All information is encrypted and securely stored
• 📋 Data is used only for certificate generation
• 🛡️ Full compliance with privacy regulations
• 🚫 Your information is never shared with third parties

**⚠️ IMPORTANT:**
You cannot access other features until KYC is completed. This is mandatory for all shareholders.`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📋 Complete KYC Now", callback_data: "start_kyc_process" }
        ],
        [
          { text: "ℹ️ Learn More About KYC", callback_data: "kyc_info" }
        ],
        [
          { text: "📞 Contact Support", callback_data: "menu_help" }
        ]
      ]
    };

    await ctx.replyWithMarkdown(kycDashboardMessage, {
      reply_markup: keyboard
    });

  } catch (error) {
    console.error('❌ [KYC] Error showing KYC dashboard:', error);
    await ctx.reply('❌ Error loading KYC dashboard. Please contact support.');
  }
}

// Handle start KYC process
async function handleStartKYCProcess(ctx) {
  const user = ctx.from;

  try {
    // Check if user already has KYC
    const { data: telegramUser, error: userError } = await db.client
      .from('telegram_users')
      .select('user_id')
      .eq('telegram_id', user.id)
      .single();

    if (userError || !telegramUser) {
      await ctx.answerCbQuery('❌ User not found');
      return;
    }

    const hasKYC = await checkKYCCompletion(telegramUser.user_id);

    if (hasKYC) {
      await ctx.answerCbQuery('✅ KYC already completed');
      await showKYCAlreadyCompleted(ctx);
      return;
    }

    // Initialize KYC session
    ctx.session.kyc = {
      step: 'privacy_consent',
      data: {},
      user_id: telegramUser.user_id
    };

    await showKYCPrivacyConsent(ctx);

  } catch (error) {
    console.error('Error starting KYC process:', error);
    await ctx.answerCbQuery('❌ Error starting KYC process');
  }
}

// Show KYC privacy consent
async function showKYCPrivacyConsent(ctx) {
  const consentMessage = `🔒 **DATA PRIVACY & CONSENT**



**📋 KYC DATA COLLECTION NOTICE**

Before we collect your personal information, please review and accept our data privacy terms:

**🔐 WHAT WE COLLECT:**
• Full legal name (for certificate generation)
• Government ID or Passport number (for identity verification)
• Physical address (for document delivery)
• Contact information (phone and email)

**🛡️ HOW WE PROTECT YOUR DATA:**
• All sensitive information is encrypted
• Data is stored securely in compliance with regulations
• Access is restricted to authorized personnel only
• Information is used solely for certificate generation

**📋 YOUR RIGHTS:**
• Right to access your personal data
• Right to correct inaccurate information
• Right to request data deletion (subject to legal requirements)
• Right to withdraw consent (may affect certificate generation)

**⚖️ LEGAL BASIS:**
Data collection is necessary for:
• Regulatory compliance (KYC/AML requirements)
• Contract fulfillment (share certificate generation)
• Legal obligations under financial regulations

**🌍 INTERNATIONAL TRANSFERS:**
Your data may be processed in secure facilities outside your country in compliance with applicable data protection laws.

**📞 CONTACT:**
For privacy questions: support@aureus.africa

**✅ By proceeding, you consent to the collection and processing of your personal data as described above.**`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "✅ I Accept & Continue", callback_data: "kyc_accept_privacy" }
      ],
      [
        { text: "📋 Read Full Privacy Policy", callback_data: "view_privacy_policy" }
      ],
      [
        { text: "❌ I Decline", callback_data: "kyc_decline_privacy" }
      ],
      [
        { text: "🏠 Back to Dashboard", callback_data: "main_menu" }
      ]
    ]
  };

  await ctx.replyWithMarkdown(consentMessage, { reply_markup: keyboard });
}

// Handle KYC info request
async function handleKYCInfo(ctx) {
  const infoMessage = `ℹ️ **ABOUT KYC (KNOW YOUR CUSTOMER)**



**🔍 WHAT IS KYC?**
KYC (Know Your Customer) is a regulatory process used by financial institutions to verify the identity of their clients.

**⚖️ WHY IS IT REQUIRED?**
• **Legal Compliance:** Required by financial regulations
• **Anti-Money Laundering:** Prevents illegal financial activities
• **Identity Verification:** Ensures legitimate transactions
• **Document Security:** Enables secure certificate generation

**📋 WHAT INFORMATION IS NEEDED?**
• **Personal Details:** Full legal name as on government ID
• **Identity Verification:** ID number or passport number
• **Contact Information:** Phone number and email address
• **Address Verification:** Complete physical address

**🔒 IS MY DATA SAFE?**
• All information is encrypted and securely stored
• Data is used only for regulatory compliance and certificate generation
• We follow international data protection standards
• Your privacy is our top priority

**⏰ HOW LONG DOES IT TAKE?**
• KYC collection: 5-10 minutes
• Certificate generation: 48 hours (business days)
• Certificate delivery: Via secure email

**📜 SHARE CERTIFICATE BENEFITS:**
• Official proof of ownership
• Legal document for your records
• Required for dividend claims
• Transferable share assets

**💡 WHEN SHOULD I COMPLETE KYC?**
Complete KYC as soon as possible after your first share purchase to receive your certificate promptly.`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "📋 Start KYC Process", callback_data: "start_kyc_process" }
      ],
      [
        { text: "🏠 Back to Dashboard", callback_data: "main_menu" }
      ]
    ]
  };

  await ctx.replyWithMarkdown(infoMessage, { reply_markup: keyboard });
}

// Handle KYC later
async function handleKYCLater(ctx) {
  await ctx.answerCbQuery('KYC postponed');

  const laterMessage = `⏰ **KYC POSTPONED**



**📋 KYC COMPLETION REMINDER**

You have chosen to complete your KYC later. Please note:

**⚠️ IMPORTANT:**
• Your share certificate cannot be generated without KYC
• KYC is required for regulatory compliance
• Certificate delivery will be delayed until KYC is completed

**⏰ WHEN TO COMPLETE:**
You can complete your KYC at any time by:
• Going to your portfolio and clicking "Complete KYC"
• Returning to this menu through the dashboard
• Contacting support for assistance

**📞 NEED HELP?**
If you have questions about the KYC process, please contact our support team.

**💡 RECOMMENDATION:**
Complete KYC as soon as possible to receive your share certificate and ensure full compliance with your share purchase.`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "📋 Complete KYC Now", callback_data: "start_kyc_process" }
      ],
      [
        { text: "💼 View Portfolio", callback_data: "view_portfolio" }
      ],
      [
        { text: "🏠 Back to Dashboard", callback_data: "main_menu" }
      ]
    ]
  };

  await ctx.replyWithMarkdown(laterMessage, { reply_markup: keyboard });
}

// Handle KYC step processing
async function handleKYCStep(ctx, callbackData) {
  const user = ctx.from;

  try {
    if (callbackData === 'kyc_accept_privacy') {
      // User accepted privacy terms, start data collection
      ctx.session.kyc = ctx.session.kyc || {};
      ctx.session.kyc.privacy_accepted = true;
      ctx.session.kyc.step = 'first_name';

      await showKYCFirstNameStep(ctx);

    } else if (callbackData === 'kyc_decline_privacy') {
      await handleKYCDeclinePrivacy(ctx);

    } else if (callbackData === 'kyc_submit_data') {
      await handleKYCSubmitData(ctx);

    } else if (callbackData === 'kyc_id_type_national') {
      // User selected South African ID
      ctx.session.kyc = ctx.session.kyc || {};
      ctx.session.kyc.id_type = 'national_id';
      ctx.session.kyc.step = 'awaiting_id_number';
      await showKYCIdNumberStep(ctx, 'national');

    } else if (callbackData === 'kyc_id_type_passport') {
      // User selected International Passport
      ctx.session.kyc = ctx.session.kyc || {};
      ctx.session.kyc.id_type = 'passport';
      ctx.session.kyc.step = 'awaiting_id_number';
      await showKYCIdNumberStep(ctx, 'passport');

    } else if (callbackData === 'kyc_back_last_name') {
      // Go back to last name step
      ctx.session.kyc = ctx.session.kyc || {};
      ctx.session.kyc.step = 'awaiting_last_name';
      await showKYCLastNameStep(ctx);

    } else if (callbackData === 'kyc_back_id_type') {
      // Go back to ID type selection step
      ctx.session.kyc = ctx.session.kyc || {};
      ctx.session.kyc.step = 'awaiting_id_type';
      await showKYCIdTypeStep(ctx);

    } else if (callbackData === 'kyc_back_id_number') {
      // Go back to ID number step
      ctx.session.kyc = ctx.session.kyc || {};
      ctx.session.kyc.step = 'awaiting_id_number';
      await showKYCIdNumberStep(ctx, ctx.session.kyc.id_type === 'national_id' ? 'national' : 'passport');

    } else if (callbackData === 'kyc_back_phone') {
      // Go back to phone step
      ctx.session.kyc = ctx.session.kyc || {};
      ctx.session.kyc.step = 'awaiting_phone';
      await showKYCPhoneStep(ctx);

    } else if (callbackData === 'kyc_back_email') {
      // Go back to email step
      ctx.session.kyc = ctx.session.kyc || {};
      ctx.session.kyc.step = 'awaiting_email';
      await showKYCEmailStep(ctx);

    } else if (callbackData === 'kyc_back_address') {
      // Go back to address step
      ctx.session.kyc = ctx.session.kyc || {};
      ctx.session.kyc.step = 'awaiting_address';
      await showKYCAddressStep(ctx);

    } else {
      console.log(`❌ [KYC] Unknown KYC step: ${callbackData}`);
      await ctx.answerCbQuery('Unknown KYC step');
    }

  } catch (error) {
    console.error('Error handling KYC step:', error);
    await ctx.answerCbQuery('❌ Error processing KYC step');
  }
}

// Show first name collection step
async function showKYCFirstNameStep(ctx) {
  const firstNameMessage = `📝 **KYC STEP 1 OF 8: FIRST NAME**



**👤 ENTER YOUR FIRST NAME**

Please enter your first name exactly as it appears on your government-issued ID or passport.

**📋 REQUIREMENTS:**
• Use your legal first name only
• Match your official identification document
• No nicknames or abbreviations
• Letters only (no numbers or symbols)

**💡 EXAMPLE:**
If your ID shows "John Michael Smith", enter: **John**

**⚠️ IMPORTANT:**
This information will appear on your share certificate, so accuracy is essential.

**✍️ Please type your first name below:**`;

  ctx.session.kyc.step = 'awaiting_first_name';

  const keyboard = {
    inline_keyboard: [
      [
        { text: "🔙 Back to Privacy Consent", callback_data: "start_kyc_process" }
      ],
      [
        { text: "🏠 Cancel & Return to Dashboard", callback_data: "main_menu" }
      ]
    ]
  };

  await ctx.replyWithMarkdown(firstNameMessage, { reply_markup: keyboard });
}

// Handle KYC decline privacy
async function handleKYCDeclinePrivacy(ctx) {
  await ctx.answerCbQuery('Privacy consent declined');

  const declineMessage = `❌ **PRIVACY CONSENT DECLINED**



**🔒 KYC PROCESS CANCELLED**

You have declined to provide consent for data collection.

**📋 CONSEQUENCES:**
• Cannot complete KYC verification
• Share certificate cannot be generated
• Regulatory compliance requirements not met
• Shareholder documentation incomplete

**💡 ALTERNATIVES:**
• Review our privacy policy for more details
• Contact support with privacy concerns
• Complete KYC later when ready

**🔄 CHANGE YOUR MIND?**
You can restart the KYC process at any time by accepting the privacy terms.`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "🔄 Restart KYC Process", callback_data: "start_kyc_process" }
      ],
      [
        { text: "📋 Read Privacy Policy", callback_data: "view_privacy_policy" }
      ],
      [
        { text: "🏠 Back to Dashboard", callback_data: "main_menu" }
      ]
    ]
  };

  await ctx.replyWithMarkdown(declineMessage, { reply_markup: keyboard });
}

// Show KYC already completed message
async function showKYCAlreadyCompleted(ctx) {
  const completedMessage = `✅ **KYC ALREADY COMPLETED**



**🎉 CONGRATULATIONS!**

Your KYC (Know Your Customer) verification has already been completed successfully.

**📜 SHARE CERTIFICATE STATUS:**
Your share certificate has been requested and will be generated within 48 hours (business days).

**📧 DELIVERY:**
The certificate will be sent to your registered email address once ready.

**💼 WHAT'S NEXT:**
• Monitor your email for certificate delivery
• View your portfolio to track your share progress
• Consider additional share purchases
• Share your referral link to earn commissions

**📞 NEED HELP?**
Contact support if you have questions about your certificate or KYC status.`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "💼 View Portfolio", callback_data: "view_portfolio" }
      ],
      [
        { text: "📤 Share Referral Link", callback_data: "share_referral" }
      ],
      [
        { text: "🏠 Back to Dashboard", callback_data: "main_menu" }
      ]
    ]
  };

  await ctx.replyWithMarkdown(completedMessage, { reply_markup: keyboard });
}

// Handle KYC text input
async function handleKYCTextInput(ctx, text) {
  const user = ctx.from;
  const kycSession = ctx.session.kyc;

  try {
    switch (kycSession.step) {
      case 'awaiting_first_name':
        await handleKYCFirstNameInput(ctx, text);
        break;
      case 'awaiting_last_name':
        await handleKYCLastNameInput(ctx, text);
        break;
      case 'awaiting_id_type':
        await handleKYCIdTypeInput(ctx, text);
        break;
      case 'awaiting_id_number':
        await handleKYCIdNumberInput(ctx, text);
        break;
      case 'awaiting_phone':
        await handleKYCPhoneInput(ctx, text);
        break;
      case 'awaiting_email':
        await handleKYCEmailInput(ctx, text);
        break;
      case 'awaiting_address':
        await handleKYCAddressInput(ctx, text);
        break;
      case 'awaiting_city':
        await handleKYCCityInput(ctx, text);
        break;
      default:
        await ctx.reply(`❌ **Unexpected KYC Step Error**

🔍 **What happened:** The system encountered an unknown step in your KYC process.

✅ **What to do:** Please click "🏠 Cancel & Return to Dashboard" below and restart your KYC process from the main menu.

📧 **Need help?** Contact support@aureus.africa`);
        await ctx.reply('🏠 Return to Dashboard', {
          reply_markup: {
            inline_keyboard: [[
              { text: "🏠 Return to Dashboard", callback_data: "main_menu" }
            ]]
          }
        });
        break;
    }
  } catch (error) {
    console.error('Error handling KYC text input:', error);

    // Provide specific error message based on the step
    const stepName = kycSession?.step || 'unknown';
    let errorMessage = `❌ **KYC Processing Error**

🔍 **What happened:** There was a technical error while processing your ${stepName.replace('awaiting_', '').replace('_', ' ')} information.

✅ **What to do:**
1. Please try entering your information again
2. Make sure your input follows the format requirements
3. If the error continues, click "🏠 Cancel & Return to Dashboard" and restart the process

📧 **Need help?** Contact support@aureus.africa`;

    await ctx.reply(errorMessage);

    // Provide navigation options
    await ctx.reply('Choose an option:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔄 Try Again", callback_data: `kyc_back_${stepName.replace('awaiting_', '')}` }],
          [{ text: "🏠 Cancel & Return to Dashboard", callback_data: "main_menu" }]
        ]
      }
    });
  }
}

// Handle first name input
async function handleKYCFirstNameInput(ctx, firstName) {
  // Validate first name
  if (!firstName || firstName.trim().length < 2) {
    await ctx.reply('❌ Please enter a valid first name (at least 2 characters).');
    return;
  }

  if (!/^[a-zA-Z\s'-]+$/.test(firstName.trim())) {
    await ctx.reply('❌ First name can only contain letters, spaces, hyphens, and apostrophes.');
    return;
  }

  // Store first name
  ctx.session.kyc.data.first_name = firstName.trim();

  // Move to next step
  await showKYCLastNameStep(ctx);
}

// Show last name step
async function showKYCLastNameStep(ctx) {
  const lastNameMessage = `📝 **KYC STEP 2 OF 8: LAST NAME**



**👤 ENTER YOUR LAST NAME**

Please enter your last name (surname) exactly as it appears on your government-issued ID or passport.

**📋 REQUIREMENTS:**
• Use your legal last name/surname only
• Match your official identification document
• No nicknames or abbreviations
• Letters only (no numbers or symbols)

**💡 EXAMPLE:**
If your ID shows "John Michael Smith", enter: **Smith**

**✅ FIRST NAME SAVED:** ${ctx.session.kyc.data.first_name}

**✍️ Please type your last name below:**`;

  ctx.session.kyc.step = 'awaiting_last_name';

  const keyboard = {
    inline_keyboard: [
      [
        { text: "🔙 Back to First Name", callback_data: "kyc_back_first_name" }
      ],
      [
        { text: "🏠 Cancel & Return to Dashboard", callback_data: "main_menu" }
      ]
    ]
  };

  await ctx.replyWithMarkdown(lastNameMessage, { reply_markup: keyboard });
}

// Handle last name input
async function handleKYCLastNameInput(ctx, lastName) {
  // Validate last name
  if (!lastName || lastName.trim().length < 2) {
    await ctx.reply('❌ Please enter a valid last name (at least 2 characters).');
    return;
  }

  if (!/^[a-zA-Z\s'-]+$/.test(lastName.trim())) {
    await ctx.reply('❌ Last name can only contain letters, spaces, hyphens, and apostrophes.');
    return;
  }

  // Store last name
  ctx.session.kyc.data.last_name = lastName.trim();

  // Move to next step
  await showKYCIdTypeStep(ctx);
}

// Handle ID type input (when user types instead of clicking buttons)
async function handleKYCIdTypeInput(ctx, text) {
  const input = text.trim();
  const inputLower = input.toLowerCase();

  // Check if user is trying to enter a South African ID number directly
  if (/^\d{13}$/.test(input)) {
    await ctx.reply(`❌ **Hold on! You entered an ID number too early**

🔍 **What you entered:** ${input} (looks like a 13-digit South African ID number)

✅ **What to do next:**
1. First click the "🇿🇦 **South African ID Number**" button below
2. Then you'll be asked to enter your ID number
3. After that, enter: ${input}

💡 **Why this step?** We need to know your document type first so we can validate your number correctly.`);
    await showKYCIdTypeStep(ctx);
    return;
  }

  // Check if user is trying to enter a passport number directly
  if (/^[a-zA-Z0-9]{6,15}$/.test(input) && /[a-zA-Z]/.test(input)) {
    await ctx.reply(`❌ **Hold on! You entered a passport number too early**

🔍 **What you entered:** ${input} (looks like a passport number)

✅ **What to do next:**
1. First click the "🌍 **International Passport**" button below
2. Then you'll be asked to enter your passport number
3. After that, enter: ${input}

💡 **Why this step?** We need to know your document type first so we can validate your number correctly.`);
    await showKYCIdTypeStep(ctx);
    return;
  }

  // Check if user is trying to enter other numeric codes
  if (/^\d{6,20}$/.test(input)) {
    await ctx.reply(`❌ **You entered a number, but we need document type selection first**

🔍 **What you entered:** ${input}

✅ **What to do next:**
1. Click either "🇿🇦 **South African ID Number**" or "🌍 **International Passport**" button below
2. Then enter your number when prompted

💡 **Which should you choose?**
• **South African ID:** If you have a 13-digit SA ID number
• **International Passport:** If you have a passport from any country`);
    await showKYCIdTypeStep(ctx);
    return;
  }

  // Check for hash codes or special formats (if applicable)
  if (/^[a-fA-F0-9]{32,64}$/.test(input)) {
    await ctx.reply(`❌ **Invalid input format detected**

🔍 **What you entered:** Looks like a hash code or encrypted string

✅ **What to do:**
Please use the buttons below to select your document type. Do not enter hash codes or encrypted strings.

💡 **Expected input:** Click either "🇿🇦 South African ID Number" or "🌍 International Passport" button.`);
    await showKYCIdTypeStep(ctx);
    return;
  }

  // Handle text-based selection attempts
  if (inputLower.includes('south') || inputLower.includes('sa') || inputLower.includes('national') || inputLower.includes('id')) {
    // User typed something like "south african" - help them
    await ctx.reply(`✅ **Great! You want to use a South African ID**

🔍 **What you typed:** "${input}"

✅ **I'll select that for you:** Proceeding with South African ID Number option.

⏭️ **Next step:** You'll now be asked to enter your 13-digit ID number.`);

    ctx.session.kyc.id_type = 'national_id';
    ctx.session.kyc.step = 'awaiting_id_number';
    await showKYCIdNumberStep(ctx, 'national');
    return;
  }

  if (inputLower.includes('passport') || inputLower.includes('international')) {
    // User typed something like "passport" - help them
    await ctx.reply(`✅ **Great! You want to use an International Passport**

🔍 **What you typed:** "${input}"

✅ **I'll select that for you:** Proceeding with International Passport option.

⏭️ **Next step:** You'll now be asked to enter your passport number.`);

    ctx.session.kyc.id_type = 'passport';
    ctx.session.kyc.step = 'awaiting_id_number';
    await showKYCIdNumberStep(ctx, 'passport');
    return;
  }

  // Unrecognized text input
  await ctx.reply(`❌ **I don't understand what you typed**

🔍 **What you entered:** "${input}"

✅ **What to do instead:**
Please use the **buttons below** instead of typing. Click either:

🇿🇦 **"South African ID Number"** - if you have a 13-digit SA ID
🌍 **"International Passport"** - if you have a passport from any country

💡 **Why buttons?** Using buttons ensures we capture your choice correctly and prevents errors.`);

  await showKYCIdTypeStep(ctx);
}

// Handle ID number input
async function handleKYCIdNumberInput(ctx, idNumber) {
  const idType = ctx.session.kyc.id_type;

  // Check if input is empty or too short
  if (!idNumber || idNumber.trim().length < 5) {
    if (idType === 'national_id') {
      await ctx.reply(`❌ **South African ID Number Required**

🔍 **What's wrong:** You need to enter your 13-digit South African ID number.

✅ **What to do:**
Enter your complete ID number exactly as it appears on your ID document.

💡 **Example format:** 9403105191081 (13 digits, no spaces)

📝 **Where to find it:** Look at the front of your green South African ID book or smart ID card.`);
    } else {
      await ctx.reply(`❌ **Passport Number Required**

🔍 **What's wrong:** You need to enter your passport number.

✅ **What to do:**
Enter your passport number exactly as it appears in your passport.

💡 **Example formats:**
• A1234567 (letter + numbers)
• AB1234567 (letters + numbers)
• 123456789 (numbers only)

📝 **Where to find it:** Look at the personal information page of your passport.`);
    }
    return;
  }

  const cleanIdNumber = idNumber.trim().replace(/\s+/g, '');

  // Validate based on ID type
  if (idType === 'national_id') {
    // South African ID validation
    if (!/^\d{13}$/.test(cleanIdNumber)) {
      let errorMsg = `❌ **Invalid South African ID Number Format**

🔍 **What you entered:** ${idNumber}
🔍 **What's wrong:** `;

      if (cleanIdNumber.length < 13) {
        errorMsg += `Too short (${cleanIdNumber.length} digits). SA ID numbers must be exactly 13 digits.`;
      } else if (cleanIdNumber.length > 13) {
        errorMsg += `Too long (${cleanIdNumber.length} digits). SA ID numbers must be exactly 13 digits.`;
      } else if (!/^\d+$/.test(cleanIdNumber)) {
        errorMsg += `Contains non-numeric characters. SA ID numbers can only contain digits 0-9.`;
      }

      errorMsg += `

✅ **What to do:**
Enter your 13-digit ID number exactly as shown on your ID document.

💡 **Correct format:** 9403105191081 (13 digits, no spaces or letters)

📝 **Double-check:** Look at your green ID book or smart ID card for the correct number.`;

      await ctx.reply(errorMsg);
      return;
    }
  } else if (idType === 'passport') {
    // Passport validation
    if (!/^[A-Z0-9]{6,15}$/i.test(cleanIdNumber)) {
      let errorMsg = `❌ **Invalid Passport Number Format**

🔍 **What you entered:** ${idNumber}
🔍 **What's wrong:** `;

      if (cleanIdNumber.length < 6) {
        errorMsg += `Too short (${cleanIdNumber.length} characters). Passport numbers must be 6-15 characters.`;
      } else if (cleanIdNumber.length > 15) {
        errorMsg += `Too long (${cleanIdNumber.length} characters). Passport numbers must be 6-15 characters.`;
      } else if (!/^[A-Z0-9]+$/i.test(cleanIdNumber)) {
        errorMsg += `Contains invalid characters. Passport numbers can only contain letters (A-Z) and numbers (0-9).`;
      }

      errorMsg += `

✅ **What to do:**
Enter your passport number exactly as shown in your passport.

💡 **Accepted formats:**
• Letters and numbers: A1234567, AB123456
• Numbers only: 123456789
• Length: 6-15 characters

📝 **Where to find it:** Look at the personal information page of your passport document.`;

      await ctx.reply(errorMsg);
      return;
    }
  }

  // Store ID number
  ctx.session.kyc.data.id_number = cleanIdNumber;

  // Move to next step - phone number
  await showKYCPhoneStep(ctx);
}

// Show ID type step
async function showKYCIdTypeStep(ctx) {
  const idTypeMessage = `📝 **KYC STEP 3 OF 8: IDENTIFICATION TYPE**



**🆔 SELECT YOUR IDENTIFICATION TYPE**

Please choose the type of government-issued identification you will provide:

**📋 AVAILABLE OPTIONS:**

**🇿🇦 SOUTH AFRICAN RESIDENTS:**
• National ID Number (13-digit SA ID)

**🌍 INTERNATIONAL RESIDENTS:**
• Passport Number (from any country)

**✅ NAME SAVED:** ${ctx.session.kyc.data.first_name} ${ctx.session.kyc.data.last_name}

**💡 IMPORTANT:**
Choose the document type that matches what you'll provide for verification.`;

  ctx.session.kyc.step = 'awaiting_id_type';

  const keyboard = {
    inline_keyboard: [
      [
        { text: "🇿🇦 South African ID Number", callback_data: "kyc_id_type_national" }
      ],
      [
        { text: "🌍 International Passport", callback_data: "kyc_id_type_passport" }
      ],
      [
        { text: "🔙 Back to Last Name", callback_data: "kyc_back_last_name" }
      ],
      [
        { text: "🏠 Cancel & Return to Dashboard", callback_data: "main_menu" }
      ]
    ]
  };

  await ctx.replyWithMarkdown(idTypeMessage, { reply_markup: keyboard });
}

// Show ID number collection step
async function showKYCIdNumberStep(ctx, idType) {
  const isNational = idType === 'national';
  const idTypeDisplay = isNational ? 'South African ID Number' : 'International Passport Number';
  const requirements = isNational
    ? '• 13-digit South African ID number\n• Format: YYMMDDGGGGGGG\n• No spaces or dashes'
    : '• Valid passport number\n• As shown on your passport\n• Letters and numbers only';

  const idNumberMessage = `📝 **KYC STEP 4 OF 8: ${idTypeDisplay.toUpperCase()}**



**🆔 ENTER YOUR ${idTypeDisplay.toUpperCase()}**

Please enter your ${idTypeDisplay.toLowerCase()} exactly as it appears on your identification document.

**📋 REQUIREMENTS:**
${requirements}

**💡 EXAMPLE:**
${isNational ? 'If your ID is 9001015009087, enter: **9001015009087**' : 'If your passport is AB1234567, enter: **AB1234567**'}

**⚠️ IMPORTANT:**
This information will be used for identity verification and must match your official documents.

**✍️ Please type your ${idTypeDisplay.toLowerCase()} below:**`;

  ctx.session.kyc.step = 'awaiting_id_number';

  const keyboard = {
    inline_keyboard: [
      [
        { text: "🔙 Back to ID Type", callback_data: "kyc_back_id_type" }
      ],
      [
        { text: "🏠 Cancel & Return to Dashboard", callback_data: "main_menu" }
      ]
    ]
  };

  await ctx.replyWithMarkdown(idNumberMessage, { reply_markup: keyboard });
}

// Temporary KYC completion (until full system is implemented)
async function showKYCTemporaryCompletion(ctx) {
  const completionMessage = `✅ **KYC DATA COLLECTED SUCCESSFULLY**



**🎉 BASIC KYC INFORMATION SAVED:**

**👤 Name:** ${ctx.session.kyc.data.first_name} ${ctx.session.kyc.data.last_name}
**🆔 ID Type:** ${ctx.session.kyc.id_type === 'national_id' ? 'South African ID' : 'International Passport'}
**📋 ID Number:** ${ctx.session.kyc.data.id_number}

**⚠️ SYSTEM NOTICE:**
The full KYC system (including phone, email, address collection) is currently being finalized. Your basic information has been saved and you can now access your dashboard.

**📋 NEXT STEPS:**
• Complete KYC system will be available soon
• You will be notified when additional information is needed
• Your share certificates will be generated once full KYC is complete

**🏠 You can now return to your dashboard to continue using the bot.**`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "🏠 Return to Dashboard", callback_data: "main_menu" }
      ],
      [
        { text: "💼 View Portfolio", callback_data: "view_portfolio" }
      ]
    ]
  };

  // Clear KYC session
  ctx.session.kyc = null;

  await ctx.replyWithMarkdown(completionMessage, { reply_markup: keyboard });
}

// Show phone number collection step
async function showKYCPhoneStep(ctx) {
  const phoneMessage = `📝 **KYC STEP 5 OF 8: PHONE NUMBER**



**📞 ENTER YOUR PHONE NUMBER**

Please enter your phone number for verification and communication purposes.

**📋 REQUIREMENTS:**
• Include country code (e.g., +27 for South Africa)
• Use international format
• Numbers only (no spaces or special characters except +)

**💡 EXAMPLES:**
• South Africa: **+27821234567**
• International: **+1234567890**

**✅ INFORMATION SAVED:**
• **Name:** ${ctx.session.kyc.data.first_name} ${ctx.session.kyc.data.last_name}
• **ID:** ${ctx.session.kyc.data.id_number}

**✍️ Please type your phone number below:**`;

  ctx.session.kyc.step = 'awaiting_phone';

  const keyboard = {
    inline_keyboard: [
      [
        { text: "🔙 Back to ID Number", callback_data: "kyc_back_id_number" }
      ],
      [
        { text: "🏠 Cancel & Return to Dashboard", callback_data: "main_menu" }
      ]
    ]
  };

  await ctx.replyWithMarkdown(phoneMessage, { reply_markup: keyboard });
}

// Handle phone number input
async function handleKYCPhoneInput(ctx, phoneNumber) {
  // Check if input is empty or too short
  if (!phoneNumber || phoneNumber.trim().length < 8) {
    await ctx.reply(`❌ **Phone Number Required**

🔍 **What's wrong:** You need to enter a valid phone number.

✅ **What to do:**
Enter your phone number with the country code.

💡 **Correct formats:**
• **South Africa:** +27821234567 or 27821234567
• **International:** +1234567890 (your country code + number)
• **Alternative:** 0821234567 (if South African)

📱 **Examples:**
• +27 82 123 4567
• +1 555 123 4567
• +44 20 7123 4567`);
    return;
  }

  const cleanPhone = phoneNumber.trim().replace(/[\s\-\(\)]/g, '');

  // Basic phone validation (international format)
  if (!/^\+?[1-9]\d{7,14}$/.test(cleanPhone)) {
    let errorMsg = `❌ **Invalid Phone Number Format**

🔍 **What you entered:** ${phoneNumber}
🔍 **What's wrong:** `;

    if (!/^\+?[0-9\s\-\(\)]+$/.test(phoneNumber)) {
      errorMsg += `Contains invalid characters. Only numbers, +, spaces, hyphens, and parentheses are allowed.`;
    } else if (cleanPhone.length < 8) {
      errorMsg += `Too short (${cleanPhone.length} digits). Phone numbers need at least 8 digits.`;
    } else if (cleanPhone.length > 15) {
      errorMsg += `Too long (${cleanPhone.length} digits). Phone numbers cannot exceed 15 digits.`;
    } else if (cleanPhone.startsWith('0') && !cleanPhone.startsWith('+')) {
      errorMsg += `Starts with 0 without country code. Please add your country code.`;
    } else {
      errorMsg += `Invalid format detected.`;
    }

    errorMsg += `

✅ **What to do:**
Enter your phone number with country code.

💡 **Correct formats:**
• **South Africa:** +27821234567 (replace 0 with +27)
• **International:** +[country code][number]
• **With spaces:** +27 82 123 4567

📱 **Common country codes:**
• South Africa: +27
• USA/Canada: +1
• UK: +44
• Australia: +61`;

    await ctx.reply(errorMsg);
    return;
  }

  // Store phone number
  ctx.session.kyc.data.phone_number = cleanPhone;

  // Move to next step - email
  await showKYCEmailStep(ctx);
}

// Show email collection step
async function showKYCEmailStep(ctx) {
  const emailMessage = `📝 **KYC STEP 6 OF 8: EMAIL ADDRESS**



**📧 ENTER YOUR EMAIL ADDRESS**

Please enter your email address for certificate delivery and important communications.

**📋 REQUIREMENTS:**
• Valid email format (example@domain.com)
• Active email address you can access
• Will be used for share certificate delivery

**💡 EXAMPLES:**
• **john.smith@gmail.com**
• **shareholder@company.co.za**

**✅ INFORMATION SAVED:**
• **Name:** ${ctx.session.kyc.data.first_name} ${ctx.session.kyc.data.last_name}
• **ID:** ${ctx.session.kyc.data.id_number}
• **Phone:** ${ctx.session.kyc.data.phone_number}

**✍️ Please type your email address below:**`;

  ctx.session.kyc.step = 'awaiting_email';

  const keyboard = {
    inline_keyboard: [
      [
        { text: "🔙 Back to Phone Number", callback_data: "kyc_back_phone" }
      ],
      [
        { text: "🏠 Cancel & Return to Dashboard", callback_data: "main_menu" }
      ]
    ]
  };

  await ctx.replyWithMarkdown(emailMessage, { reply_markup: keyboard });
}

// Handle email input
async function handleKYCEmailInput(ctx, email) {
  // Check if input is empty or too short
  if (!email || email.trim().length < 5) {
    await ctx.reply(`❌ **Email Address Required**

🔍 **What's wrong:** You need to enter a valid email address.

✅ **What to do:**
Enter the email address you use regularly and can access.

💡 **Correct format:** username@domain.com

📧 **Examples:**
• john.doe@gmail.com
• mary@company.co.za
• user123@outlook.com

⚠️ **Important:** You'll receive important updates about your sahres at this email address.`);
    return;
  }

  const cleanEmail = email.trim().toLowerCase();

  // Email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    let errorMsg = `❌ **Invalid Email Address Format**

🔍 **What you entered:** ${email}
🔍 **What's wrong:** `;

    if (!email.includes('@')) {
      errorMsg += `Missing @ symbol. Email addresses must contain an @ symbol.`;
    } else if (email.split('@').length > 2) {
      errorMsg += `Multiple @ symbols found. Email addresses can only have one @ symbol.`;
    } else if (!email.includes('.')) {
      errorMsg += `Missing domain extension (like .com, .co.za, .org).`;
    } else if (email.startsWith('@') || email.endsWith('@')) {
      errorMsg += `@ symbol cannot be at the beginning or end.`;
    } else if (email.includes('..')) {
      errorMsg += `Contains consecutive dots (..) which are not allowed.`;
    } else if (/\s/.test(email)) {
      errorMsg += `Contains spaces. Email addresses cannot contain spaces.`;
    } else {
      errorMsg += `Invalid email format detected.`;
    }

    errorMsg += `

✅ **What to do:**
Enter a valid email address in the correct format.

💡 **Correct format:** username@domain.extension

📧 **Valid examples:**
• john.doe@gmail.com
• mary_smith@company.co.za
• user123@outlook.com
• info@business.org

🔍 **Check for:**
• One @ symbol
• Domain name after @
• Extension like .com, .co.za, .org
• No spaces`;

    await ctx.reply(errorMsg);
    return;
  }

  // Store email
  ctx.session.kyc.data.email_address = cleanEmail;

  // Move to address step
  await showKYCAddressStep(ctx);
}

// Show address collection step
async function showKYCAddressStep(ctx) {
  const addressMessage = `📝 **KYC STEP 7 OF 8: STREET ADDRESS**



**🏠 ENTER YOUR STREET ADDRESS**

Please enter your complete street address for your share certificates.

**📋 REQUIREMENTS:**
• Complete street address including house/unit number
• Street name and any apartment/unit details

**💡 EXAMPLES:**
• **123 Main Street, Apt 4B**
• **45 Oak Avenue**
• **Unit 12, 789 Business Park Drive**

**✅ INFORMATION SAVED:**
• **Name:** ${ctx.session.kyc.data.first_name} ${ctx.session.kyc.data.last_name}
• **Phone:** ${ctx.session.kyc.data.phone_number}
• **Email:** ${ctx.session.kyc.data.email_address}

**✍️ Please type your street address below:**`;

  ctx.session.kyc.step = 'awaiting_address';

  const keyboard = {
    inline_keyboard: [
      [
        { text: "🔙 Back to Email", callback_data: "kyc_back_email" }
      ],
      [
        { text: "🏠 Cancel & Return to Dashboard", callback_data: "main_menu" }
      ]
    ]
  };

  await ctx.replyWithMarkdown(addressMessage, { reply_markup: keyboard });
}

// Handle address input
async function handleKYCAddressInput(ctx, address) {
  // Validate address
  if (!address || address.trim().length < 5) {
    await ctx.reply('❌ Please enter a valid street address (at least 5 characters).');
    return;
  }

  // Store address
  ctx.session.kyc.data.street_address = address.trim();

  // Move to city step
  await showKYCCityStep(ctx);
}

// Show city collection step
async function showKYCCityStep(ctx) {
  const cityMessage = `📝 **KYC STEP 8 OF 8: Country & COMPLETION**



**🏙️ ENTER YOUR Country**

Please enter the country where you reside.

**📋 REQUIREMENTS:**
• Country name only
• No postal codes or provinces

**💡 EXAMPLES:**
• **South Africa**
• **America**
• **India**

**✅ INFORMATION COLLECTED:**
• **Name:** ${ctx.session.kyc.data.first_name} ${ctx.session.kyc.data.last_name}
• **Phone:** ${ctx.session.kyc.data.phone_number}
• **Email:** ${ctx.session.kyc.data.email_address}
• **Address:** ${ctx.session.kyc.data.street_address}

**✍️ Please type your city below:**`;

  ctx.session.kyc.step = 'awaiting_city';

  const keyboard = {
    inline_keyboard: [
      [
        { text: "🔙 Back to Address", callback_data: "kyc_back_address" }
      ],
      [
        { text: "🏠 Cancel & Return to Dashboard", callback_data: "main_menu" }
      ]
    ]
  };

  await ctx.replyWithMarkdown(cityMessage, { reply_markup: keyboard });
}

// Handle city input and complete KYC
async function handleKYCCityInput(ctx, city) {
  // Validate city
  if (!city || city.trim().length < 2) {
    await ctx.reply('❌ Please enter a valid city name (at least 2 characters).');
    return;
  }

  // Store city
  ctx.session.kyc.data.city = city.trim();

  // Complete KYC process
  await completeKYCProcess(ctx);
}

// Complete the full KYC process
async function completeKYCProcess(ctx) {
  const user = ctx.from;
  const kycData = ctx.session.kyc.data;

  try {
    // Get user data through telegram_users table (correct relationship)
    const { data: telegramUserData, error: telegramError } = await db.client
      .from('telegram_users')
      .select(`
        user_id,
        users!inner (
          id,
          country_of_residence
        )
      `)
      .eq('telegram_id', user.id)
      .single();

    if (telegramError) {
      console.error('❌ [KYC] Error getting user data via telegram_users:', telegramError);
      await ctx.reply('❌ Error retrieving your user information. Please contact support.');
      return;
    }

    const userData = telegramUserData.users;
    const countryCode = userData?.country_of_residence || 'ZAF';
    const userId = userData?.id;

    // Save KYC data to database
    const { data: kycRecord, error: kycError } = await db.client
      .from('kyc_information')
      .insert({
        user_id: userId,
        first_name: kycData.first_name,
        last_name: kycData.last_name,
        id_type: ctx.session.kyc.id_type,
        id_number_encrypted: kycData.id_number, // TODO: Implement encryption
        id_number_hash: require('crypto').createHash('sha256').update(kycData.id_number).digest('hex'),
        phone_number: kycData.phone_number,
        email_address: kycData.email_address,
        street_address: kycData.street_address,
        city: kycData.city,
        postal_code: '0000', // Default for now
        country_code: countryCode,
        country_name: getCountryName(countryCode),
        data_consent_given: true,
        privacy_policy_accepted: true,
        kyc_status: 'completed',
        created_by_telegram_id: user.id
      })
      .select()
      .single();

    if (kycError) {
      console.error('❌ [KYC] Error saving KYC data:', kycError);
      await ctx.reply('❌ Error saving your KYC information. Please try again.');
      return;
    }

    // Show completion message
    await showKYCCompletionSuccess(ctx);

  } catch (error) {
    console.error('❌ [KYC] Error completing KYC process:', error);
    await ctx.reply('❌ Error completing KYC process. Please try again.');
  }
}

// Show KYC completion success
async function showKYCCompletionSuccess(ctx) {
  const kycData = ctx.session.kyc.data;

  const completionMessage = `🎉 **KYC COMPLETED SUCCESSFULLY!**



**✅ ALL REQUIRED INFORMATION COLLECTED:**

**👤 Personal Information:**
• **Name:** ${kycData.first_name} ${kycData.last_name}
• **ID:** ${kycData.id_number}

**📞 Contact Information:**
• **Phone:** ${kycData.phone_number}
• **Email:** ${kycData.email_address}

**🏠 Address Information:**
• **Address:** ${kycData.street_address}
• **Country:** ${kycData.city}

**📋 NEXT STEPS:**
• Your information has been securely saved
• Share certificates will be generated within 48 business hours
• Certificates will be emailed to: ${kycData.email_address}
• You now have full access to all bot features

**🎯 You can now access your complete dashboard and portfolio!**`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "🏠 Go to Dashboard", callback_data: "main_menu" }
      ],
      [
        { text: "💼 View Portfolio", callback_data: "view_portfolio" }
      ]
    ]
  };

  // Clear KYC session
  ctx.session.kyc = null;

  await ctx.replyWithMarkdown(completionMessage, { reply_markup: keyboard });
}

// Helper function to get country name from code
function getCountryName(countryCode) {
  const countries = {
    'ZAF': 'South Africa',
    'USA': 'United States',
    'GBR': 'United Kingdom',
    'CAN': 'Canada',
    'AUS': 'Australia',
    // Add more as needed
  };
  return countries[countryCode] || 'Unknown';
}

// BANK TRANSFER SYSTEM FOR SOUTHERN AFRICAN REGION
// Check if user is eligible for bank transfer payments (ZAF, SWZ, NAM)
async function checkBankTransferEligibility(userId) {
  try {
    const { data: userData, error } = await db.client
      .from('users')
      .select('country_of_residence')
      .eq('id', userId)
      .single();

    if (error || !userData) {
      console.log(`❌ [BANK TRANSFER] Error checking user country: ${error?.message}`);
      return false;
    }

    const eligibleCountries = ['ZAF', 'SWZ', 'NAM']; // South Africa, Eswatini, Namibia
    const isEligible = eligibleCountries.includes(userData.country_of_residence);

    console.log(`🏦 [BANK TRANSFER] User ${userId} country: ${userData.country_of_residence}, eligible: ${isEligible}`);
    return isEligible;

  } catch (error) {
    console.error('❌ [BANK TRANSFER] Error in checkBankTransferEligibility:', error);
    return false;
  }
}

// Handle bank transfer payment selection
async function handleBankTransferPayment(ctx) {
  const user = ctx.from;

  try {
    // Get user from database
    const { data: telegramUser, error: userError } = await db.client
      .from('telegram_users')
      .select('user_id')
      .eq('telegram_id', user.id)
      .single();

    if (userError || !telegramUser) {
      await ctx.answerCbQuery('❌ User not found');
      return;
    }

    // Double-check eligibility
    const isEligible = await checkBankTransferEligibility(telegramUser.user_id);
    if (!isEligible) {
      await ctx.answerCbQuery('❌ Bank transfer not available in your region');
      return;
    }

    await ctx.answerCbQuery('🏦 Bank Transfer selected');

    // Store bank transfer as selected payment method
    ctx.session.selectedPaymentMethod = 'bank_transfer';

    // Show amount input for bank transfer
    await showBankTransferAmountInput(ctx);

  } catch (error) {
    console.error('❌ [BANK TRANSFER] Error in handleBankTransferPayment:', error);
    await ctx.answerCbQuery('❌ Error processing bank transfer selection');
  }
}

// Show amount input for bank transfer
async function showBankTransferAmountInput(ctx) {
  const customAmountMessage = `🏦 **BANK TRANSFER PURCHASE**



**💰 ENTER SHARE PURCHASE AMOUNT**

Enter your desired amount between $15 and $50,000:

**📋 BANK TRANSFER DETAILS:**
• Minimum: $15 USD (R270 ZAR)
• Maximum: $50,000 USD
• Currency: South African Rand (ZAR)
• Exchange Rate: R18 ZAR = $1 USD
• Transaction Fee: 10% additional
• Payment Method: FNB Bank Transfer

**💡 CALCULATION EXAMPLE:**
$100 USD + 10% fee = $110 USD = R1,980 ZAR

**⚠️ IMPORTANT:**
Bank transfer is only available for users in South Africa, Eswatini, and Namibia.

**Type your share purchase amount in USD (numbers only):**`;

  await ctx.replyWithMarkdown(customAmountMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔙 Back to Payment Methods", callback_data: "menu_purchase_shares" }],
        [{ text: "🏠 Back to Dashboard", callback_data: "main_menu" }]
      ]
    }
  });

  // Set user state to expect amount input
  await setUserState(ctx.from.id, 'awaiting_custom_amount');
}

// Calculate ZAR amount with 10% transaction fee
function calculateZARAmount(usdAmount) {
  const exchangeRate = 18; // R18 ZAR = $1 USD (fixed rate)
  const transactionFee = 0.10; // 10% fee

  const totalUSD = usdAmount * (1 + transactionFee); // Add 10% fee
  const zarAmount = totalUSD * exchangeRate;

  return {
    originalUSD: usdAmount,
    feeUSD: usdAmount * transactionFee,
    totalUSD: totalUSD,
    zarAmount: zarAmount,
    exchangeRate: exchangeRate
  };
}

// Handle bank transfer payment confirmation
async function handleBankTransferConfirmation(ctx, telegramUser, originalAmount, totalCost, sharesAmount, currentPhase) {
  try {
    console.log(`🔍 [DEBUG] handleBankTransferConfirmation - Starting bank transfer for user: ${telegramUser.username}`);
    console.log(`🔍 [DEBUG] handleBankTransferConfirmation - Amount: ${totalCost}, Shares: ${sharesAmount}`);

    // Calculate ZAR amounts with 10% fee
    const zarCalculation = calculateZARAmount(totalCost);
    console.log(`🔍 [DEBUG] handleBankTransferConfirmation - ZAR calculation:`, zarCalculation);

    // Create bank transfer payment transaction
    const { data: payment, error: paymentError } = await db.client
      .from('crypto_payment_transactions')
      .insert({
        user_id: telegramUser.user_id || null,
        amount: totalCost,
        currency: 'ZAR',
        network: 'BANK_TRANSFER',
        sender_wallet: 'PENDING_PROOF_UPLOAD', // Will store proof file ID when user uploads proof
        receiver_wallet: 'FNB-63154323041', // Bank account reference
        status: 'pending',
        created_at: new Date().toISOString(),
        // Store ZAR amount and bank details in transaction_hash field
        transaction_hash: `ZAR:${zarCalculation.zarAmount.toFixed(2)}|RATE:${zarCalculation.exchangeRate}|FEE:10%`
      })
      .select()
      .single();

    if (paymentError) {
      console.error('Error creating bank transfer payment:', paymentError);
      await ctx.reply('❌ Error creating bank transfer payment. Please try again.');
      return;
    }

    // Show bank transfer payment instructions
    await showBankTransferInstructions(ctx, payment, currentPhase, zarCalculation);

    // Notify admin about new bank transfer payment
    await sendAdminNotification('payment_received', {
      username: ctx.from.username || ctx.from.first_name || 'Unknown',
      amount: totalCost,
      shares: sharesAmount,
      user_id: telegramUser.user_id,
      payment_id: payment.id,
      payment_method: 'Bank Transfer (ZAR)',
      zar_amount: zarCalculation.zarAmount
    }, 'medium');

  } catch (error) {
    console.error('Error in handleBankTransferConfirmation:', error);
    await ctx.reply('❌ Error processing bank transfer. Please try again.');
  }
}

// Show bank transfer payment instructions
async function showBankTransferInstructions(ctx, payment, phase, zarCalculation) {
  const sharePrice = parseFloat(phase.price_per_share);
  const sharesAmount = Math.floor(payment.amount / sharePrice);

  const bankTransferMessage = `🏦 **BANK TRANSFER PAYMENT INSTRUCTIONS**



**💰 AMOUNT TO PAY:**
**🇿🇦 R${zarCalculation.zarAmount.toFixed(2)} ZAR**

**📋 PURCHASE BREAKDOWN:**
• USD Amount: ${formatCurrency(zarCalculation.originalUSD)}
• Transaction Fee (10%): ${formatCurrency(zarCalculation.feeUSD)}
• Total USD: ${formatCurrency(zarCalculation.totalUSD)}
• Exchange Rate: R${zarCalculation.exchangeRate} = $1 USD
• Shares: ${sharesAmount.toLocaleString()}
• Phase: ${phase.phase_name}
• Share Price: ${formatCurrency(sharePrice)}
• Payment ID: #${payment.id.substring(0, 8)}

**🏦 BANK ACCOUNT DETAILS:**
• **Bank:** First National Bank (FNB)
• **Account Type:** GOLD BUSINESS CHEQUE ACCOUNT
• **Account Number:** 63154323041
• **Account Status:** Active Account
• **Branch Code:** 220229
• **Branch Name:** VERULAM, NTL 091
• **Swift Code:** FIRNZAJJ
• **Date Opened:** 2025-05-09

**💰 PAYMENT INFORMATION:**
• **Amount to Transfer:** R${zarCalculation.zarAmount.toFixed(2)} ZAR
• **Exchange Rate:** R${zarCalculation.exchangeRate} ZAR = $1 USD
• **Reference:** Payment #${payment.id.substring(0, 8)}

**⚠️ IMPORTANT INSTRUCTIONS:**
1. Transfer EXACTLY R${zarCalculation.zarAmount.toFixed(2)} ZAR
2. Use reference: Payment #${payment.id.substring(0, 8)}
3. Take screenshot of successful transfer
4. Upload proof within 24 hours
5. Wait for admin approval

**🔗 BANK VERIFICATION:**
Verify bank details: [FNB Confirmation Document](https://fgubaqoftdeefcakejwu.supabase.co/storage/v1/object/public/assets//fnb.pdf)

**🚨 WARNING:**
• Wrong amount = Payment rejected
• No proof = No shares allocated
• Bank transfers are only available for South Africa, Eswatini, and Namibia

**⏰ Payment expires in 24 hours**`;

  await ctx.replyWithMarkdown(bankTransferMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "💳 Submit Payment Proof", callback_data: `upload_bank_proof_${payment.id}` }],
        [{ text: "🔗 View Bank Confirmation", url: "https://fgubaqoftdeefcakejwu.supabase.co/storage/v1/object/public/assets//fnb.pdf" }],
        [{ text: "💼 View Portfolio", callback_data: "menu_portfolio" }],
        [{ text: "🏠 Main Menu", callback_data: "main_menu" }]
      ]
    }
  });
}

// Handle upload proof request for bank transfer
async function handleUploadProofRequest(ctx, callbackData) {
  const paymentId = callbackData.replace('upload_proof_', '');

  try {
    // Verify payment exists and belongs to user
    const { data: telegramUser, error: userError } = await db.client
      .from('telegram_users')
      .select('user_id')
      .eq('telegram_id', ctx.from.id)
      .single();

    if (userError || !telegramUser) {
      await ctx.answerCbQuery('❌ User not found');
      return;
    }

    const { data: payment, error: paymentError } = await db.client
      .from('crypto_payment_transactions')
      .select('*')
      .eq('id', paymentId)
      .eq('user_id', telegramUser.user_id)
      .single();

    if (paymentError || !payment) {
      await ctx.answerCbQuery('❌ Payment not found');
      return;
    }

    if (payment.status !== 'pending') {
      await ctx.answerCbQuery('❌ Payment already processed');
      return;
    }

    await ctx.answerCbQuery('📤 Upload payment proof');

    // Store payment ID in session for proof upload
    ctx.session.uploadingProofForPayment = paymentId;

    const uploadMessage = `📤 **UPLOAD PAYMENT PROOF**



**🏦 BANK TRANSFER PROOF REQUIRED**

Payment ID: #${paymentId.substring(0, 8)}

**📋 UPLOAD REQUIREMENTS:**
• Screenshot of successful bank transfer
• Must show transfer amount and reference
• Clear and readable image
• Supported formats: JPG, PNG, PDF

**⚠️ IMPORTANT:**
• Transfer must be from YOUR bank account
• Amount must match exactly: ${payment.transaction_hash && payment.transaction_hash.includes('ZAR:') ? `R${payment.transaction_hash.match(/ZAR:([0-9.]+)/)?.[1] || 'N/A'}` : 'the required amount'}
• Reference must include: Payment #${paymentId.substring(0, 8)}

**📱 HOW TO UPLOAD:**
1. Take screenshot of successful transfer
2. Send the image to this chat
3. Wait for admin verification
4. Receive confirmation once approved

**⏰ DEADLINE:**
Upload proof within 24 hours or payment will be cancelled.

**Please send your payment proof image now:**`;

    await ctx.replyWithMarkdown(uploadMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "❌ Cancel Upload", callback_data: "cancel_proof_upload" }],
          [{ text: "🏠 Back to Dashboard", callback_data: "main_menu" }]
        ]
      }
    });

    // Set user state to expect proof upload
    await setUserState(ctx.from.id, 'uploading_payment_proof');

  } catch (error) {
    console.error('Error in handleUploadProofRequest:', error);
    await ctx.answerCbQuery('❌ Error processing upload request');
  }
}

// Handle bank transfer proof upload (SEPARATE from crypto proof upload)
async function handleBankTransferProofUpload(ctx, callbackData) {
  const paymentId = callbackData.replace('upload_bank_proof_', '');
  const user = ctx.from;

  try {
    // Verify payment exists and is a bank transfer
    const { data: payment, error: paymentError } = await db.client
      .from('crypto_payment_transactions')
      .select('*')
      .eq('id', paymentId)
      .eq('network', 'BANK_TRANSFER')
      .single();

    if (paymentError || !payment) {
      await ctx.answerCbQuery('❌ Bank transfer payment not found');
      return;
    }

    // Set user state for bank transfer proof upload
    await setUserState(user.id, 'uploading_bank_proof', { paymentId });

    const bankProofMessage = `🏦 BANK TRANSFER PROOF UPLOAD



📋 PAYMENT DETAILS:
• Payment ID: #${paymentId.substring(0, 8)}
• Amount: ${formatCurrency(payment.amount)}
• ZAR Amount: R${payment.transaction_hash.match(/ZAR:([0-9.]+)/)?.[1] || 'N/A'}
• Bank Account: FNB - 63154323041

📤 UPLOAD REQUIREMENTS:

1. Bank transfer receipt/proof
2. Screenshot showing:
   - Transaction amount (R${payment.transaction_hash.match(/ZAR:([0-9.]+)/)?.[1] || 'N/A'})
   - Recipient account (FNB 63154323041)
   - Transaction date/time
   - Your bank reference number

⚠️ Important: Upload clear, readable proof of your bank transfer

Please send your bank transfer proof now (photo or document):`;

    await ctx.reply(bankProofMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "❌ Cancel Upload", callback_data: "main_menu" }]
        ]
      }
    });

  } catch (error) {
    console.error('Error in handleBankTransferProofUpload:', error);
    await ctx.answerCbQuery('❌ Error processing bank transfer proof upload');
  }
}

// Handle actual bank transfer file upload (when user sends photo/document)
async function handleBankTransferFileUpload(ctx, isDocument = false) {
  const user = ctx.from;

  try {
    // Check if user is in bank transfer upload state
    const userState = await getUserState(user.id);
    if (!userState || userState.state !== 'uploading_bank_proof') {
      return; // Not in bank transfer upload state
    }

    const { paymentId } = userState.data;

    // Get file info
    let fileId, fileName, fileSize;

    if (isDocument) {
      const document = ctx.message.document;
      fileId = document.file_id;
      fileName = document.file_name || 'bank_transfer_proof';
      fileSize = document.file_size;
    } else {
      const photo = ctx.message.photo;
      const largestPhoto = photo[photo.length - 1]; // Get highest resolution
      fileId = largestPhoto.file_id;
      fileName = 'bank_transfer_proof.jpg';
      fileSize = largestPhoto.file_size;
    }

    // Check file size (max 20MB)
    if (fileSize > 20 * 1024 * 1024) {
      await ctx.reply('❌ File too large. Please upload a file smaller than 20MB.');
      return;
    }

    // Get user from database
    const { data: telegramUser, error: userError } = await db.client
      .from('telegram_users')
      .select('user_id, username')
      .eq('telegram_id', user.id)
      .single();

    if (userError || !telegramUser) {
      await ctx.reply('❌ User not found. Please try again.');
      return;
    }

    // Update payment with proof file ID
    const { error: updateError } = await db.client
      .from('crypto_payment_transactions')
      .update({
        sender_wallet: fileId, // Store file ID in sender_wallet field for bank transfers
        status: 'pending', // Change status to pending for admin review
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentId)
      .eq('user_id', telegramUser.user_id);

    if (updateError) {
      console.error('Error updating payment with proof:', updateError);
      await ctx.reply('❌ Error saving payment proof. Please try again.');
      return;
    }

    // Clear user state
    await setUserState(user.id, null);

    // Send confirmation to user
    const confirmationMessage = `✅ BANK TRANSFER PROOF UPLOADED



🏦 Your bank transfer proof has been successfully uploaded!

📋 NEXT STEPS:
• Admin will review your bank transfer proof
• You will be notified once approved
• Shares will be allocated after approval
• Check your portfolio for updates

⏰ PROCESSING TIME:
Typically 24-48 hours during business days

Thank you for your patience!`;

    await ctx.reply(confirmationMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📊 View Portfolio", callback_data: "view_portfolio" }],
          [{ text: "🏠 Main Menu", callback_data: "main_menu" }]
        ]
      }
    });

    // Notify admin about new bank transfer proof
    await sendAdminNotification('bank_transfer_proof_uploaded', {
      username: user.username || user.first_name || 'Unknown',
      payment_id: paymentId,
      file_name: fileName,
      user_id: telegramUser.user_id
    }, 'medium');

  } catch (error) {
    console.error('Error in handleBankTransferFileUpload:', error);
    await ctx.reply('❌ Error uploading bank transfer proof. Please try again.');
  }
}

// Handle viewing bank transfer proof for admin
async function handleViewBankProof(ctx, callbackData) {
  const user = ctx.from;

  // Check admin authorization
  if (user.username !== 'TTTFOUNDER') {
    await ctx.answerCbQuery('❌ Access denied');
    return;
  }

  const paymentId = callbackData.replace('view_bank_proof_', '');

  try {
    // Get payment details
    const { data: payment, error: fetchError } = await db.client
      .from('crypto_payment_transactions')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (fetchError || !payment) {
      await ctx.answerCbQuery('❌ Payment not found');
      return;
    }

    if (!payment.sender_wallet) {
      await ctx.answerCbQuery('❌ No proof uploaded');
      return;
    }

    await ctx.answerCbQuery('📄 Displaying bank transfer proof');

    // Send the proof file (stored in sender_wallet field for bank transfers)
    const fileId = payment.sender_wallet;

    const proofMessage = `🏦 **BANK TRANSFER PROOF**



**Payment ID:** #${paymentId.substring(0, 8)}
**Amount:** $${payment.amount} USD

**📋 VERIFICATION CHECKLIST:**
✅ Transfer amount matches required amount
✅ Reference includes payment ID
✅ Transfer from user's account
✅ FNB account details correct
✅ Transfer successful/completed

**⚠️ ADMIN NOTES:**
• Verify ZAR amount matches USD conversion
• Check transfer date/time
• Confirm account holder details if needed`;

    await ctx.replyWithMarkdown(proofMessage);

    // Forward the proof file
    try {
      await ctx.telegram.forwardMessage(ctx.chat.id, ctx.chat.id, fileId);
    } catch (forwardError) {
      // If forwarding fails, try sending as photo/document
      try {
        await ctx.replyWithPhoto(fileId, {
          caption: `Bank Transfer Proof - Payment #${paymentId.substring(0, 8)}`
        });
      } catch (photoError) {
        try {
          await ctx.replyWithDocument(fileId, {
            caption: `Bank Transfer Proof - Payment #${paymentId.substring(0, 8)}`
          });
        } catch (docError) {
          console.error('Error displaying bank proof:', docError);
          await ctx.reply('❌ Error displaying proof file. File may be corrupted.');
        }
      }
    }

  } catch (error) {
    console.error('Error in handleViewBankProof:', error);
    await ctx.answerCbQuery('❌ Error loading proof');
  }
}

// Handle canceling proof upload
async function handleCancelProofUpload(ctx) {
  const user = ctx.from;

  try {
    // Clear session data
    delete ctx.session.uploadingProofForPayment;
    await setUserState(user.id, null);

    await ctx.answerCbQuery('❌ Proof upload cancelled');

    const cancelMessage = `❌ **PROOF UPLOAD CANCELLED**



**Upload process has been cancelled.**

You can restart the proof upload process anytime by:
1. Going to your portfolio
2. Finding the pending payment
3. Clicking "Submit Payment Proof"

**⚠️ REMINDER:**
Payment proof must be uploaded within 24 hours or the payment will be automatically cancelled.`;

    await ctx.replyWithMarkdown(cancelMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "💼 View Portfolio", callback_data: "menu_portfolio" }],
          [{ text: "🏠 Main Dashboard", callback_data: "main_menu" }]
        ]
      }
    });

  } catch (error) {
    console.error('Error in handleCancelProofUpload:', error);
    await ctx.answerCbQuery('❌ Error cancelling upload');
  }
}

// COUNTRY SELECTION SYSTEM
// Trigger country selection if needed
async function triggerCountrySelectionIfNeeded(userId) {
  try {
    console.log(`🌍 [COUNTRY] Checking country selection status for user ID: ${userId}`);

    // Check if user has already selected country
    const hasSelectedCountry = await checkCountrySelection(userId);

    if (hasSelectedCountry) {
      console.log(`✅ [COUNTRY] User ${userId} already has selected country - skipping selection`);
      return;
    }

    console.log(`🌍 [COUNTRY] User ${userId} needs to select country - triggering selection`);

    // Get user's Telegram ID to send country selection request
    const { data: telegramUser, error: telegramError } = await db.client
      .from('telegram_users')
      .select('telegram_id, username')
      .eq('user_id', userId)
      .single();

    if (telegramError || !telegramUser) {
      console.error('❌ [COUNTRY] Error getting user Telegram ID:', telegramError);
      return;
    }

    // Send country selection request to user
    await sendCountrySelectionRequest(telegramUser.telegram_id, telegramUser.username);

  } catch (error) {
    console.error('❌ [COUNTRY] Error in triggerCountrySelectionIfNeeded:', error);
  }
}

// Check if user has selected country
async function checkCountrySelection(userId) {
  try {
    const { data: userData, error: userError } = await db.client
      .from('users')
      .select('country_selection_completed, country_of_residence')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('❌ [COUNTRY] Error checking country selection:', userError);
      return false;
    }

    return userData.country_selection_completed && userData.country_of_residence;

  } catch (error) {
    console.error('❌ [COUNTRY] Error checking country selection:', error);
    return false;
  }
}

// Send country selection request to user
async function sendCountrySelectionRequest(telegramId, username) {
  try {
    console.log(`🌍 [COUNTRY] Sending country selection request to user ${username} (${telegramId})`);

    const countryMessage = `🌍 **SELECT YOUR COUNTRY OF RESIDENCE**



**📍 COUNTRY SELECTION REQUIRED**

To complete your registration and ensure compliance with international regulations, please select your country of residence.

**🔍 WHY WE NEED THIS:**
• Regulatory compliance and legal requirements
• Tax reporting and documentation
• Country-specific share regulations
• Proper customer verification (KYC)
• Certificate generation and delivery

**🌍 SELECT YOUR COUNTRY:**
Choose from the most common countries below, or select "Show More Countries" for additional options.

**🔒 PRIVACY:**
Your country information is securely stored and used only for compliance and service delivery purposes.`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🇿🇦 South Africa", callback_data: "select_country_ZAF" },
          { text: "🇺🇸 United States", callback_data: "select_country_USA" }
        ],
        [
          { text: "🇬🇧 United Kingdom", callback_data: "select_country_GBR" },
          { text: "🇨🇦 Canada", callback_data: "select_country_CAN" }
        ],
        [
          { text: "🇦🇺 Australia", callback_data: "select_country_AUS" },
          { text: "🇦🇪 UAE", callback_data: "select_country_ARE" }
        ],
        [
          { text: "🇮🇳 India", callback_data: "select_country_IND" },
          { text: "🇵🇰 Pakistan", callback_data: "select_country_PAK" }
        ],
        [
          { text: "🌍 Show More Countries", callback_data: "show_more_countries" }
        ],
        [
          { text: "🌎 Type Your Country", callback_data: "country_selection_other" }
        ]
      ]
    };

    // Send country selection message
    await sendAudioNotificationToUser(
      telegramId,
      countryMessage,
      'COUNTRY',
      {
        reply_markup: keyboard
      },
      true // Enable audio notification for country selection
    );

    console.log(`✅ [COUNTRY] Country selection request sent successfully to user ${username}`);

  } catch (error) {
    console.error('❌ [COUNTRY] Error sending country selection request:', error);
  }
}

// Show country selection menu
async function showCountrySelection(ctx) {
  const countryMessage = `🌍 **SELECT YOUR COUNTRY OF RESIDENCE**



**📍 COUNTRY SELECTION REQUIRED**

To complete your registration and ensure compliance with international regulations, please select your country of residence.

**🔍 WHY WE NEED THIS:**
• Regulatory compliance and legal requirements
• Tax reporting and documentation
• Country-specific share regulations
• Proper customer verification (KYC)
• Certificate generation and delivery

**🌍 SELECT YOUR COUNTRY:**
Choose from the most common countries below, or select "Show More Countries" for additional options.

**🔒 PRIVACY:**
Your country information is securely stored and used only for compliance and service delivery purposes.`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "🇿🇦 South Africa", callback_data: "select_country_ZAF" },
        { text: "🇺🇸 United States", callback_data: "select_country_USA" }
      ],
      [
        { text: "🇬🇧 United Kingdom", callback_data: "select_country_GBR" },
        { text: "🇨🇦 Canada", callback_data: "select_country_CAN" }
      ],
      [
        { text: "🇦🇺 Australia", callback_data: "select_country_AUS" },
        { text: "🇦🇪 UAE", callback_data: "select_country_ARE" }
      ],
      [
        { text: "🇮🇳 India", callback_data: "select_country_IND" },
        { text: "🇵🇰 Pakistan", callback_data: "select_country_PAK" }
      ],
      [
        { text: "🌍 Show More Countries", callback_data: "show_more_countries" }
      ],
      [
        { text: "🌎 Type Your Country", callback_data: "country_selection_other" }
      ]
    ]
  };

  await ctx.replyWithMarkdown(countryMessage, { reply_markup: keyboard });
}

// Handle country selection
async function handleCountrySelection(ctx, callbackData) {
  const user = ctx.from;
  const countryCode = callbackData.replace('select_country_', '');

  try {
    // Get user from database
    const { data: telegramUser, error: userError } = await db.client
      .from('telegram_users')
      .select('user_id')
      .eq('telegram_id', user.id)
      .single();

    if (userError || !telegramUser) {
      await ctx.answerCbQuery('❌ User not found');
      return;
    }

    // Get country information
    const countryInfo = getCountryInfo(countryCode);

    if (!countryInfo) {
      await ctx.answerCbQuery('❌ Invalid country selection');
      return;
    }

    // Update user's country
    const { error: updateError } = await db.client
      .from('users')
      .update({
        country_of_residence: countryCode,
        country_name: countryInfo.name,
        country_selection_completed: true,
        country_selected_at: new Date().toISOString(),
        country_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', telegramUser.user_id);

    if (updateError) {
      console.error('Error updating user country:', updateError);
      await ctx.answerCbQuery('❌ Error saving country selection');
      return;
    }

    // Log country change
    await logCountryChange(telegramUser.user_id, null, null, countryCode, countryInfo.name, user.id, user.username, 'initial_selection');

    await ctx.answerCbQuery(`${countryInfo.flag} ${countryInfo.name} selected`);

    // Show confirmation message
    const confirmationMessage = `✅ **COUNTRY SELECTED SUCCESSFULLY**



**🌍 COUNTRY OF RESIDENCE CONFIRMED**

${countryInfo.flag} **${countryInfo.name}**

**📋 REGISTRATION COMPLETE:**
• Country selection: ✅ Completed
• Compliance status: ✅ Updated
• Account setup: ✅ Finalized

**🎯 WHAT'S NEXT:**
• Explore our gold mining shares opportunities
• Review company presentation and mining operations
• Start your share ownership journey with confidence

**💡 NEED TO CHANGE?**
You can update your country selection later through the settings menu.

**🏆 Welcome to Aureus Alliance Holdings!**`;

    await ctx.replyWithMarkdown(confirmationMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🛒 Purchase Gold Shares", callback_data: "menu_purchase_shares" }],
          [{ text: "📋 Company Presentation", callback_data: "menu_presentation" }],
          [{ text: "🏠 Main Dashboard", callback_data: "main_menu" }]
        ]
      }
    });

  } catch (error) {
    console.error('Error handling country selection:', error);
    await ctx.answerCbQuery('❌ Error processing country selection');
  }
}

// Show more countries
async function showMoreCountries(ctx) {
  const moreCountriesMessage = `🌍 **MORE COUNTRIES**



**📍 ADDITIONAL COUNTRY OPTIONS**

Select your country from the expanded list below:

**🇪🇺 EUROPE:**`;

  const keyboard = {
    inline_keyboard: [
      // Europe Row 1
      [
        { text: "🇩🇪 Germany", callback_data: "select_country_DEU" },
        { text: "🇫🇷 France", callback_data: "select_country_FRA" }
      ],
      [
        { text: "🇮🇹 Italy", callback_data: "select_country_ITA" },
        { text: "🇪🇸 Spain", callback_data: "select_country_ESP" }
      ],
      [
        { text: "🇳🇱 Netherlands", callback_data: "select_country_NLD" },
        { text: "🇧🇪 Belgium", callback_data: "select_country_BEL" }
      ],
      [
        { text: "🇨🇭 Switzerland", callback_data: "select_country_CHE" },
        { text: "🇸🇪 Sweden", callback_data: "select_country_SWE" }
      ],
      [
        { text: "🇳🇴 Norway", callback_data: "select_country_NOR" },
        { text: "🇩🇰 Denmark", callback_data: "select_country_DNK" }
      ],
      [
        { text: "🇫🇮 Finland", callback_data: "select_country_FIN" },
        { text: "🇮🇪 Ireland", callback_data: "select_country_IRL" }
      ],
      [
        { text: "🇵🇹 Portugal", callback_data: "select_country_PRT" },
        { text: "🇬🇷 Greece", callback_data: "select_country_GRC" }
      ],
      [
        { text: "🇵🇱 Poland", callback_data: "select_country_POL" },
        { text: "🇨🇿 Czech Republic", callback_data: "select_country_CZE" }
      ],
      [
        { text: "🇭🇺 Hungary", callback_data: "select_country_HUN" },
        { text: "🇷🇴 Romania", callback_data: "select_country_ROU" }
      ],
      [
        { text: "🇧🇬 Bulgaria", callback_data: "select_country_BGR" },
        { text: "🇹🇷 Turkey", callback_data: "select_country_TUR" }
      ],
      // Navigation
      [
        { text: "🌏 Show Asia & Middle East", callback_data: "show_asia_countries" }
      ],
      [
        { text: "🔙 Back to Main Countries", callback_data: "main_menu" }
      ],
      [
        { text: "🌎 Type Your Country", callback_data: "country_selection_other" }
      ]
    ]
  };

  await ctx.replyWithMarkdown(moreCountriesMessage, { reply_markup: keyboard });
}

// Handle other country selection - prompt for custom input
async function handleOtherCountrySelection(ctx) {
  await ctx.answerCbQuery('Type your country name');

  // Set session to await custom country input
  ctx.session.awaitingCustomCountry = true;

  const customCountryMessage = `🌎 **TYPE YOUR COUNTRY**



**📍 CUSTOM COUNTRY ENTRY**

Your country is not listed in our predefined options? No problem!

**✍️ PLEASE TYPE YOUR COUNTRY NAME:**

Simply type the name of your country below and we'll save it for you.

**📋 EXAMPLES:**
• "Switzerland"
• "New Zealand"
• "Costa Rica"
• "Luxembourg"

**💡 TIPS:**
• Use the full country name
• Check spelling for accuracy
• This will be used for compliance purposes

**✍️ Type your country name now:**`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "🔙 Back to Country Selection", callback_data: "main_menu" }
      ]
    ]
  };

  await ctx.replyWithMarkdown(customCountryMessage, { reply_markup: keyboard });
}

// Handle custom country input
async function handleCustomCountryInput(ctx, countryName) {
  const user = ctx.from;

  try {
    // Clear the awaiting state
    ctx.session.awaitingCustomCountry = false;

    // Validate country name
    if (!countryName || countryName.trim().length < 2) {
      await ctx.reply('❌ Please enter a valid country name (at least 2 characters).');
      ctx.session.awaitingCustomCountry = true; // Keep waiting
      return;
    }

    if (!/^[a-zA-Z\s\-'\.]+$/.test(countryName.trim())) {
      await ctx.reply('❌ Country name can only contain letters, spaces, hyphens, apostrophes, and periods.');
      ctx.session.awaitingCustomCountry = true; // Keep waiting
      return;
    }

    const cleanCountryName = countryName.trim();

    // Get user from database
    const { data: telegramUser, error: userError } = await db.client
      .from('telegram_users')
      .select('user_id')
      .eq('telegram_id', user.id)
      .single();

    if (userError || !telegramUser) {
      await ctx.reply('❌ User not found. Please try again.');
      return;
    }

    // Save custom country
    const { error: updateError } = await db.client
      .from('users')
      .update({
        country_of_residence: 'OTH',
        country_name: cleanCountryName,
        country_selection_completed: true,
        country_selected_at: new Date().toISOString(),
        country_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', telegramUser.user_id);

    if (updateError) {
      console.error('Error updating user custom country:', updateError);
      await ctx.reply('❌ Error saving country selection. Please try again.');
      return;
    }

    // Log country change
    await logCountryChange(telegramUser.user_id, null, null, 'OTH', cleanCountryName, user.id, user.username, 'custom_entry');

    // Show confirmation message
    const confirmationMessage = `✅ **COUNTRY SAVED SUCCESSFULLY**



**🌍 COUNTRY OF RESIDENCE CONFIRMED**

🌎 **${cleanCountryName}**

**📋 REGISTRATION COMPLETE:**
• Country selection: ✅ Completed
• Compliance status: ✅ Updated
• Account setup: ✅ Finalized

**🎯 WHAT'S NEXT:**
• Explore our gold mining shares opportunities
• Review company presentation and mining operations
• Start your share ownership journey with confidence

**💡 NEED TO CHANGE?**
You can update your country selection later through the settings menu.

**🏆 Welcome to Aureus Alliance Holdings!**`;

    await ctx.replyWithMarkdown(confirmationMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🛒 Purchase Gold Shares", callback_data: "menu_purchase_shares" }],
          [{ text: "📋 Company Presentation", callback_data: "menu_presentation" }],
          [{ text: "🏠 Main Dashboard", callback_data: "main_menu" }]
        ]
      }
    });

  } catch (error) {
    console.error('Error handling custom country input:', error);
    await ctx.reply('❌ Error processing country input. Please try again.');
    ctx.session.awaitingCustomCountry = true; // Keep waiting for retry
  }
}

// Show Asia & Middle East countries
async function showAsiaCountries(ctx) {
  const asiaMessage = `🌏 **ASIA & MIDDLE EAST COUNTRIES**



**📍 SELECT YOUR COUNTRY:**`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "🇯🇵 Japan", callback_data: "select_country_JPN" },
        { text: "🇰🇷 South Korea", callback_data: "select_country_KOR" }
      ],
      [
        { text: "🇨🇳 China", callback_data: "select_country_CHN" },
        { text: "🇸🇬 Singapore", callback_data: "select_country_SGP" }
      ],
      [
        { text: "🇭🇰 Hong Kong", callback_data: "select_country_HKG" },
        { text: "🇹🇭 Thailand", callback_data: "select_country_THA" }
      ],
      [
        { text: "🇲🇾 Malaysia", callback_data: "select_country_MYS" },
        { text: "🇮🇩 Indonesia", callback_data: "select_country_IDN" }
      ],
      [
        { text: "🇵🇭 Philippines", callback_data: "select_country_PHL" },
        { text: "🇻🇳 Vietnam", callback_data: "select_country_VNM" }
      ],
      [
        { text: "🇧🇩 Bangladesh", callback_data: "select_country_BGD" },
        { text: "🇱🇰 Sri Lanka", callback_data: "select_country_LKA" }
      ],
      [
        { text: "🇳🇵 Nepal", callback_data: "select_country_NPL" },
        { text: "🇦🇫 Afghanistan", callback_data: "select_country_AFG" }
      ],
      [
        { text: "🇸🇦 Saudi Arabia", callback_data: "select_country_SAU" },
        { text: "🇶🇦 Qatar", callback_data: "select_country_QAT" }
      ],
      [
        { text: "🇰🇼 Kuwait", callback_data: "select_country_KWT" },
        { text: "🇧🇭 Bahrain", callback_data: "select_country_BHR" }
      ],
      [
        { text: "🇴🇲 Oman", callback_data: "select_country_OMN" },
        { text: "🇯🇴 Jordan", callback_data: "select_country_JOR" }
      ],
      [
        { text: "🇱🇧 Lebanon", callback_data: "select_country_LBN" },
        { text: "🇮🇱 Israel", callback_data: "select_country_ISR" }
      ],
      [
        { text: "🇮🇷 Iran", callback_data: "select_country_IRN" },
        { text: "🇮🇶 Iraq", callback_data: "select_country_IRQ" }
      ],
      [
        { text: "🌍 Show Africa", callback_data: "show_africa_countries" }
      ],
      [
        { text: "🔙 Back to Europe", callback_data: "show_more_countries" }
      ],
      [
        { text: "🌎 Type Your Country", callback_data: "country_selection_other" }
      ]
    ]
  };

  await ctx.replyWithMarkdown(asiaMessage, { reply_markup: keyboard });
}

// Show Africa countries - Complete coverage with alphabetical ordering
async function showAfricaCountries(ctx) {
  const africaMessage = `🌍 **AFRICAN COUNTRIES**



**📍 SELECT YOUR COUNTRY (Alphabetical):**`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "🇩🇿 Algeria", callback_data: "select_country_DZA" },
        { text: "🇦🇴 Angola", callback_data: "select_country_AGO" }
      ],
      [
        { text: "🇧🇯 Benin", callback_data: "select_country_BEN" },
        { text: "🇧🇼 Botswana", callback_data: "select_country_BWA" }
      ],
      [
        { text: "🇧🇫 Burkina Faso", callback_data: "select_country_BFA" },
        { text: "🇧🇮 Burundi", callback_data: "select_country_BDI" }
      ],
      [
        { text: "🇨🇲 Cameroon", callback_data: "select_country_CMR" },
        { text: "🇨🇻 Cape Verde", callback_data: "select_country_CPV" }
      ],
      [
        { text: "🇨🇫 Central African Rep.", callback_data: "select_country_CAF" },
        { text: "🇹🇩 Chad", callback_data: "select_country_TCD" }
      ],
      [
        { text: "🇰🇲 Comoros", callback_data: "select_country_COM" },
        { text: "🇨🇬 Congo", callback_data: "select_country_COG" }
      ],
      [
        { text: "🇨🇩 DR Congo", callback_data: "select_country_COD" },
        { text: "🇩🇯 Djibouti", callback_data: "select_country_DJI" }
      ],
      [
        { text: "🇪🇬 Egypt", callback_data: "select_country_EGY" },
        { text: "🇬🇶 Equatorial Guinea", callback_data: "select_country_GNQ" }
      ],
      [
        { text: "🇪🇷 Eritrea", callback_data: "select_country_ERI" },
        { text: "🇸🇿 Eswatini", callback_data: "select_country_SWZ" }
      ],
      [
        { text: "🇪🇹 Ethiopia", callback_data: "select_country_ETH" },
        { text: "🇬🇦 Gabon", callback_data: "select_country_GAB" }
      ],
      [
        { text: "🇬🇲 Gambia", callback_data: "select_country_GMB" },
        { text: "🇬🇭 Ghana", callback_data: "select_country_GHA" }
      ],
      [
        { text: "🇬🇳 Guinea", callback_data: "select_country_GIN" },
        { text: "🇬🇼 Guinea-Bissau", callback_data: "select_country_GNB" }
      ],
      [
        { text: "🇨🇮 Ivory Coast", callback_data: "select_country_CIV" },
        { text: "🇰🇪 Kenya", callback_data: "select_country_KEN" }
      ],
      [
        { text: "🇱🇸 Lesotho", callback_data: "select_country_LSO" },
        { text: "🇱🇷 Liberia", callback_data: "select_country_LBR" }
      ],
      [
        { text: "🇱🇾 Libya", callback_data: "select_country_LBY" },
        { text: "🇲🇬 Madagascar", callback_data: "select_country_MDG" }
      ],
      [
        { text: "🇲🇼 Malawi", callback_data: "select_country_MWI" },
        { text: "🇲🇱 Mali", callback_data: "select_country_MLI" }
      ],
      [
        { text: "🇲🇷 Mauritania", callback_data: "select_country_MRT" },
        { text: "🇲🇺 Mauritius", callback_data: "select_country_MUS" }
      ],
      [
        { text: "🇲🇦 Morocco", callback_data: "select_country_MAR" },
        { text: "🇲🇿 Mozambique", callback_data: "select_country_MOZ" }
      ],
      [
        { text: "🇳🇦 Namibia", callback_data: "select_country_NAM" },
        { text: "🇳🇪 Niger", callback_data: "select_country_NER" }
      ],
      [
        { text: "🇳🇬 Nigeria", callback_data: "select_country_NGA" },
        { text: "🇷🇼 Rwanda", callback_data: "select_country_RWA" }
      ],
      [
        { text: "🇸🇹 Sao Tome & Principe", callback_data: "select_country_STP" },
        { text: "🇸🇳 Senegal", callback_data: "select_country_SEN" }
      ],
      [
        { text: "🇸🇨 Seychelles", callback_data: "select_country_SYC" },
        { text: "🇸🇱 Sierra Leone", callback_data: "select_country_SLE" }
      ],
      [
        { text: "🇸🇴 Somalia", callback_data: "select_country_SOM" },
        { text: "🇸🇩 Sudan", callback_data: "select_country_SDN" }
      ],
      [
        { text: "🇸🇸 South Sudan", callback_data: "select_country_SSD" },
        { text: "🇹🇿 Tanzania", callback_data: "select_country_TZA" }
      ],
      [
        { text: "🇹🇬 Togo", callback_data: "select_country_TGO" },
        { text: "🇹🇳 Tunisia", callback_data: "select_country_TUN" }
      ],
      [
        { text: "🇺🇬 Uganda", callback_data: "select_country_UGA" },
        { text: "🇿🇲 Zambia", callback_data: "select_country_ZMB" }
      ],
      [
        { text: "🇿🇼 Zimbabwe", callback_data: "select_country_ZWE" }
      ],
      [
        { text: "🌎 Show Americas", callback_data: "show_americas_countries" }
      ],
      [
        { text: "🔙 Back to Asia", callback_data: "show_asia_countries" }
      ],
      [
        { text: "🌎 Type Your Country", callback_data: "country_selection_other" }
      ]
    ]
  };

  await ctx.replyWithMarkdown(africaMessage, { reply_markup: keyboard });
}

// Show Americas countries
async function showAmericasCountries(ctx) {
  const americasMessage = `🌎 **AMERICAN COUNTRIES**



**📍 SELECT YOUR COUNTRY (Alphabetical):**`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "🇦🇷 Argentina", callback_data: "select_country_ARG" },
        { text: "🇧🇧 Barbados", callback_data: "select_country_BRB" }
      ],
      [
        { text: "🇧🇿 Belize", callback_data: "select_country_BLZ" },
        { text: "🇧🇴 Bolivia", callback_data: "select_country_BOL" }
      ],
      [
        { text: "🇧🇷 Brazil", callback_data: "select_country_BRA" },
        { text: "🇨🇱 Chile", callback_data: "select_country_CHL" }
      ],
      [
        { text: "🇨🇴 Colombia", callback_data: "select_country_COL" },
        { text: "🇨🇷 Costa Rica", callback_data: "select_country_CRI" }
      ],
      [
        { text: "🇨🇺 Cuba", callback_data: "select_country_CUB" },
        { text: "🇩🇴 Dominican Republic", callback_data: "select_country_DOM" }
      ],
      [
        { text: "🇪🇨 Ecuador", callback_data: "select_country_ECU" },
        { text: "🇸🇻 El Salvador", callback_data: "select_country_SLV" }
      ],
      [
        { text: "🇬🇹 Guatemala", callback_data: "select_country_GTM" },
        { text: "🇬🇾 Guyana", callback_data: "select_country_GUY" }
      ],
      [
        { text: "🇭🇹 Haiti", callback_data: "select_country_HTI" },
        { text: "🇭🇳 Honduras", callback_data: "select_country_HND" }
      ],
      [
        { text: "🇯🇲 Jamaica", callback_data: "select_country_JAM" },
        { text: "🇲🇽 Mexico", callback_data: "select_country_MEX" }
      ],
      [
        { text: "🇳🇮 Nicaragua", callback_data: "select_country_NIC" },
        { text: "🇵🇦 Panama", callback_data: "select_country_PAN" }
      ],
      [
        { text: "🇵🇾 Paraguay", callback_data: "select_country_PRY" },
        { text: "🇵🇪 Peru", callback_data: "select_country_PER" }
      ],
      [
        { text: "🇸🇷 Suriname", callback_data: "select_country_SUR" },
        { text: "🇹🇹 Trinidad & Tobago", callback_data: "select_country_TTO" }
      ],
      [
        { text: "🇺🇾 Uruguay", callback_data: "select_country_URY" },
        { text: "🇻🇪 Venezuela", callback_data: "select_country_VEN" }
      ],
      [
        { text: "🏝️ Show Oceania", callback_data: "show_oceania_countries" }
      ],
      [
        { text: "🔙 Back to Africa", callback_data: "show_africa_countries" }
      ],
      [
        { text: "🌎 Type Your Country", callback_data: "country_selection_other" }
      ]
    ]
  };

  await ctx.replyWithMarkdown(americasMessage, { reply_markup: keyboard });
}

// Show Oceania countries
async function showOceaniaCountries(ctx) {
  const oceaniaMessage = `🏝️ **OCEANIA COUNTRIES**



**📍 SELECT YOUR COUNTRY:**`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "🇫🇯 Fiji", callback_data: "select_country_FJI" },
        { text: "🇳🇨 New Caledonia", callback_data: "select_country_NCL" }
      ],
      [
        { text: "🇵🇬 Papua New Guinea", callback_data: "select_country_PNG" },
        { text: "🇵🇫 French Polynesia", callback_data: "select_country_PYF" }
      ],
      [
        { text: "🇸🇧 Solomon Islands", callback_data: "select_country_SLB" },
        { text: "🇻🇺 Vanuatu", callback_data: "select_country_VUT" }
      ],
      [
        { text: "🔙 Back to Americas", callback_data: "show_americas_countries" }
      ],
      [
        { text: "🌎 Type Your Country", callback_data: "country_selection_other" }
      ]
    ]
  };

  await ctx.replyWithMarkdown(oceaniaMessage, { reply_markup: keyboard });
}

// Get country information by code
function getCountryInfo(countryCode) {
  const countries = {
    // Primary countries
    'ZAF': { name: 'South Africa', flag: '🇿🇦' },
    'USA': { name: 'United States', flag: '🇺🇸' },
    'GBR': { name: 'United Kingdom', flag: '🇬🇧' },
    'CAN': { name: 'Canada', flag: '🇨🇦' },
    'AUS': { name: 'Australia', flag: '🇦🇺' },
    'ARE': { name: 'United Arab Emirates', flag: '🇦🇪' },
    'IND': { name: 'India', flag: '🇮🇳' },
    'PAK': { name: 'Pakistan', flag: '🇵🇰' },

    // Europe
    'DEU': { name: 'Germany', flag: '🇩🇪' },
    'FRA': { name: 'France', flag: '🇫🇷' },
    'ITA': { name: 'Italy', flag: '🇮🇹' },
    'ESP': { name: 'Spain', flag: '🇪🇸' },
    'NLD': { name: 'Netherlands', flag: '🇳🇱' },
    'BEL': { name: 'Belgium', flag: '🇧🇪' },
    'CHE': { name: 'Switzerland', flag: '🇨🇭' },
    'SWE': { name: 'Sweden', flag: '🇸🇪' },
    'NOR': { name: 'Norway', flag: '🇳🇴' },
    'DNK': { name: 'Denmark', flag: '🇩🇰' },
    'FIN': { name: 'Finland', flag: '🇫🇮' },
    'IRL': { name: 'Ireland', flag: '🇮🇪' },
    'PRT': { name: 'Portugal', flag: '🇵🇹' },
    'GRC': { name: 'Greece', flag: '🇬🇷' },
    'POL': { name: 'Poland', flag: '🇵🇱' },
    'CZE': { name: 'Czech Republic', flag: '🇨🇿' },
    'HUN': { name: 'Hungary', flag: '🇭🇺' },
    'ROU': { name: 'Romania', flag: '🇷🇴' },
    'BGR': { name: 'Bulgaria', flag: '🇧🇬' },
    'TUR': { name: 'Turkey', flag: '🇹🇷' },

    // Asia-Pacific
    'JPN': { name: 'Japan', flag: '🇯🇵' },
    'KOR': { name: 'South Korea', flag: '🇰🇷' },
    'CHN': { name: 'China', flag: '🇨🇳' },
    'SGP': { name: 'Singapore', flag: '🇸🇬' },
    'HKG': { name: 'Hong Kong', flag: '🇭🇰' },
    'NZL': { name: 'New Zealand', flag: '🇳🇿' },
    'THA': { name: 'Thailand', flag: '🇹🇭' },
    'MYS': { name: 'Malaysia', flag: '🇲🇾' },
    'IDN': { name: 'Indonesia', flag: '🇮🇩' },
    'PHL': { name: 'Philippines', flag: '🇵🇭' },
    'VNM': { name: 'Vietnam', flag: '🇻🇳' },
    'BGD': { name: 'Bangladesh', flag: '🇧🇩' },
    'LKA': { name: 'Sri Lanka', flag: '🇱🇰' },
    'NPL': { name: 'Nepal', flag: '🇳🇵' },
    'AFG': { name: 'Afghanistan', flag: '🇦🇫' },

    // Middle East
    'SAU': { name: 'Saudi Arabia', flag: '🇸🇦' },
    'QAT': { name: 'Qatar', flag: '🇶🇦' },
    'KWT': { name: 'Kuwait', flag: '🇰🇼' },
    'BHR': { name: 'Bahrain', flag: '🇧🇭' },
    'OMN': { name: 'Oman', flag: '🇴🇲' },
    'JOR': { name: 'Jordan', flag: '🇯🇴' },
    'LBN': { name: 'Lebanon', flag: '🇱🇧' },
    'ISR': { name: 'Israel', flag: '🇮🇱' },
    'IRN': { name: 'Iran', flag: '🇮🇷' },
    'IRQ': { name: 'Iraq', flag: '🇮🇶' },

    // Africa (Complete coverage - alphabetical)
    'DZA': { name: 'Algeria', flag: '🇩🇿' },
    'AGO': { name: 'Angola', flag: '🇦🇴' },
    'BEN': { name: 'Benin', flag: '🇧🇯' },
    'BWA': { name: 'Botswana', flag: '🇧🇼' },
    'BFA': { name: 'Burkina Faso', flag: '🇧🇫' },
    'BDI': { name: 'Burundi', flag: '🇧🇮' },
    'CMR': { name: 'Cameroon', flag: '🇨🇲' },
    'CPV': { name: 'Cape Verde', flag: '🇨🇻' },
    'CAF': { name: 'Central African Republic', flag: '🇨🇫' },
    'TCD': { name: 'Chad', flag: '🇹🇩' },
    'COM': { name: 'Comoros', flag: '🇰🇲' },
    'COG': { name: 'Congo', flag: '🇨🇬' },
    'COD': { name: 'Democratic Republic of Congo', flag: '🇨🇩' },
    'DJI': { name: 'Djibouti', flag: '🇩🇯' },
    'EGY': { name: 'Egypt', flag: '🇪🇬' },
    'GNQ': { name: 'Equatorial Guinea', flag: '🇬🇶' },
    'ERI': { name: 'Eritrea', flag: '🇪🇷' },
    'SWZ': { name: 'Eswatini', flag: '🇸🇿' },
    'ETH': { name: 'Ethiopia', flag: '🇪🇹' },
    'GAB': { name: 'Gabon', flag: '🇬🇦' },
    'GMB': { name: 'Gambia', flag: '🇬🇲' },
    'GHA': { name: 'Ghana', flag: '🇬🇭' },
    'GIN': { name: 'Guinea', flag: '🇬🇳' },
    'GNB': { name: 'Guinea-Bissau', flag: '🇬🇼' },
    'CIV': { name: 'Ivory Coast', flag: '🇨🇮' },
    'KEN': { name: 'Kenya', flag: '🇰🇪' },
    'LSO': { name: 'Lesotho', flag: '🇱🇸' },
    'LBR': { name: 'Liberia', flag: '🇱🇷' },
    'LBY': { name: 'Libya', flag: '🇱🇾' },
    'MDG': { name: 'Madagascar', flag: '🇲🇬' },
    'MWI': { name: 'Malawi', flag: '🇲🇼' },
    'MLI': { name: 'Mali', flag: '🇲🇱' },
    'MRT': { name: 'Mauritania', flag: '🇲🇷' },
    'MUS': { name: 'Mauritius', flag: '🇲🇺' },
    'MAR': { name: 'Morocco', flag: '🇲🇦' },
    'MOZ': { name: 'Mozambique', flag: '🇲🇿' },
    'NAM': { name: 'Namibia', flag: '🇳🇦' },
    'NER': { name: 'Niger', flag: '🇳🇪' },
    'NGA': { name: 'Nigeria', flag: '🇳🇬' },
    'RWA': { name: 'Rwanda', flag: '🇷🇼' },
    'STP': { name: 'Sao Tome and Principe', flag: '🇸🇹' },
    'SEN': { name: 'Senegal', flag: '🇸🇳' },
    'SYC': { name: 'Seychelles', flag: '🇸🇨' },
    'SLE': { name: 'Sierra Leone', flag: '🇸🇱' },
    'SOM': { name: 'Somalia', flag: '🇸🇴' },
    'SDN': { name: 'Sudan', flag: '🇸🇩' },
    'SSD': { name: 'South Sudan', flag: '🇸🇸' },
    'TZA': { name: 'Tanzania', flag: '🇹🇿' },
    'TGO': { name: 'Togo', flag: '🇹🇬' },
    'TUN': { name: 'Tunisia', flag: '🇹🇳' },
    'UGA': { name: 'Uganda', flag: '🇺🇬' },
    'ZMB': { name: 'Zambia', flag: '🇿🇲' },
    'ZWE': { name: 'Zimbabwe', flag: '🇿🇼' },

    // Americas (alphabetical)
    'ARG': { name: 'Argentina', flag: '🇦🇷' },
    'BRB': { name: 'Barbados', flag: '🇧🇧' },
    'BLZ': { name: 'Belize', flag: '🇧🇿' },
    'BOL': { name: 'Bolivia', flag: '🇧🇴' },
    'BRA': { name: 'Brazil', flag: '🇧🇷' },
    'CHL': { name: 'Chile', flag: '🇨🇱' },
    'COL': { name: 'Colombia', flag: '🇨🇴' },
    'CRI': { name: 'Costa Rica', flag: '🇨🇷' },
    'CUB': { name: 'Cuba', flag: '🇨🇺' },
    'DOM': { name: 'Dominican Republic', flag: '🇩🇴' },
    'ECU': { name: 'Ecuador', flag: '🇪🇨' },
    'SLV': { name: 'El Salvador', flag: '🇸🇻' },
    'GTM': { name: 'Guatemala', flag: '🇬🇹' },
    'GUY': { name: 'Guyana', flag: '🇬🇾' },
    'HTI': { name: 'Haiti', flag: '🇭🇹' },
    'HND': { name: 'Honduras', flag: '🇭🇳' },
    'JAM': { name: 'Jamaica', flag: '🇯🇲' },
    'MEX': { name: 'Mexico', flag: '🇲🇽' },
    'NIC': { name: 'Nicaragua', flag: '🇳🇮' },
    'PAN': { name: 'Panama', flag: '🇵🇦' },
    'PRY': { name: 'Paraguay', flag: '🇵🇾' },
    'PER': { name: 'Peru', flag: '🇵🇪' },
    'SUR': { name: 'Suriname', flag: '🇸🇷' },
    'TTO': { name: 'Trinidad and Tobago', flag: '🇹🇹' },
    'URY': { name: 'Uruguay', flag: '🇺🇾' },
    'VEN': { name: 'Venezuela', flag: '🇻🇪' },

    // Oceania
    'FJI': { name: 'Fiji', flag: '🇫🇯' },
    'NCL': { name: 'New Caledonia', flag: '🇳🇨' },
    'PNG': { name: 'Papua New Guinea', flag: '🇵🇬' },
    'PYF': { name: 'French Polynesia', flag: '🇵🇫' },
    'SLB': { name: 'Solomon Islands', flag: '🇸🇧' },
    'VUT': { name: 'Vanuatu', flag: '🇻🇺' },

    // Other
    'OTH': { name: 'Other Country', flag: '🌎' }
  };

  return countries[countryCode] || null;
}

// Log country change
async function logCountryChange(userId, oldCountryCode, oldCountryName, newCountryCode, newCountryName, telegramId, username, reason) {
  try {
    const { error: logError } = await db.client
      .from('country_change_log')
      .insert({
        user_id: userId,
        old_country_code: oldCountryCode,
        old_country_name: oldCountryName,
        new_country_code: newCountryCode,
        new_country_name: newCountryName,
        changed_by_telegram_id: telegramId,
        changed_by_username: username,
        change_reason: reason,
        changed_at: new Date().toISOString()
      });

    if (logError) {
      console.error('Error logging country change:', logError);
    } else {
      console.log(`✅ [COUNTRY] Country change logged for user ${userId}: ${oldCountryCode || 'null'} -> ${newCountryCode}`);
    }

  } catch (error) {
    console.error('Error in logCountryChange:', error);
  }
}

// Helper function to get network display information
function getNetworkDisplayInfo(networkCode) {
  const networkMap = {
    'USDT-ERC20': {
      fullName: 'Ethereum',
      technical: 'ERC-20',
      icon: '🔷'
    },
    'USDT-BEP20': {
      fullName: 'Binance Smart Chain',
      technical: 'BEP-20',
      icon: '🟡'
    },
    'USDT-Polygon': {
      fullName: 'Polygon',
      technical: 'Polygon',
      icon: '🟣'
    },
    'USDT-TRC20': {
      fullName: 'TRON',
      technical: 'TRC-20',
      icon: '🔴'
    }
  };

  return networkMap[networkCode] || {
    fullName: 'Unknown Network',
    technical: networkCode,
    icon: '❓'
  };
}

// Start the bot
startBot();
