-- Audio Notification System - Part 1: Create Tables
-- Run this first in Supabase SQL Editor

-- Create user_notification_preferences table
CREATE TABLE IF NOT EXISTS user_notification_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    telegram_id BIGINT NOT NULL,
    
    -- General audio settings
    audio_enabled BOOLEAN DEFAULT true,
    notification_volume VARCHAR(10) DEFAULT 'medium',
    
    -- User notification types
    payment_approval_audio BOOLEAN DEFAULT true,
    payment_rejection_audio BOOLEAN DEFAULT true,
    withdrawal_approval_audio BOOLEAN DEFAULT true,
    withdrawal_rejection_audio BOOLEAN DEFAULT true,
    commission_update_audio BOOLEAN DEFAULT true,
    referral_bonus_audio BOOLEAN DEFAULT true,
    system_announcement_audio BOOLEAN DEFAULT true,
    
    -- Notification timing preferences
    quiet_hours_enabled BOOLEAN DEFAULT false,
    quiet_hours_start TIME DEFAULT '22:00:00',
    quiet_hours_end TIME DEFAULT '08:00:00',
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    -- Advanced preferences
    custom_sound_enabled BOOLEAN DEFAULT false,
    notification_frequency VARCHAR(20) DEFAULT 'all',
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one preference record per user
    UNIQUE(user_id),
    UNIQUE(telegram_id)
);

-- Create admin_notification_preferences table
CREATE TABLE IF NOT EXISTS admin_notification_preferences (
    id SERIAL PRIMARY KEY,
    admin_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    telegram_id BIGINT NOT NULL,
    
    -- General admin audio settings
    audio_enabled BOOLEAN DEFAULT true,
    notification_volume VARCHAR(10) DEFAULT 'high',
    
    -- Admin-specific notification types
    new_payment_audio BOOLEAN DEFAULT true,
    new_withdrawal_request_audio BOOLEAN DEFAULT true,
    new_commission_conversion_audio BOOLEAN DEFAULT true,
    system_error_audio BOOLEAN DEFAULT true,
    user_registration_audio BOOLEAN DEFAULT false,
    high_value_transaction_audio BOOLEAN DEFAULT true,
    
    -- Priority levels
    critical_alerts_audio BOOLEAN DEFAULT true,
    high_priority_audio BOOLEAN DEFAULT true,
    medium_priority_audio BOOLEAN DEFAULT true,
    low_priority_audio BOOLEAN DEFAULT false,
    
    -- Threshold settings
    high_value_threshold DECIMAL(15,2) DEFAULT 1000.00,
    
    -- Timing preferences for admins
    quiet_hours_enabled BOOLEAN DEFAULT false,
    quiet_hours_start TIME DEFAULT '23:00:00',
    quiet_hours_end TIME DEFAULT '07:00:00',
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    -- Advanced admin preferences
    escalation_enabled BOOLEAN DEFAULT true,
    escalation_delay_minutes INTEGER DEFAULT 30,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one preference record per admin
    UNIQUE(admin_user_id),
    UNIQUE(telegram_id)
);

-- Create notification_log table
CREATE TABLE IF NOT EXISTS notification_log (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT NOT NULL,
    user_id INTEGER REFERENCES users(id),
    
    -- Notification details
    notification_type VARCHAR(50) NOT NULL,
    audio_type VARCHAR(20) NOT NULL,
    message_preview TEXT,
    
    -- Delivery details
    audio_enabled BOOLEAN NOT NULL,
    delivery_status VARCHAR(20) DEFAULT 'sent',
    error_message TEXT,
    
    -- Timing
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivered_at TIMESTAMP WITH TIME ZONE,
    
    -- User interaction
    user_read BOOLEAN DEFAULT false,
    user_interacted BOOLEAN DEFAULT false,
    
    -- Metadata for analytics
    is_admin_notification BOOLEAN DEFAULT false,
    priority_level VARCHAR(20) DEFAULT 'medium'
);

-- Create notification_sound_types table
CREATE TABLE IF NOT EXISTS notification_sound_types (
    id SERIAL PRIMARY KEY,
    sound_name VARCHAR(50) NOT NULL UNIQUE,
    sound_emoji VARCHAR(10) NOT NULL,
    sound_description TEXT,
    category VARCHAR(30) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Verify tables were created
SELECT 'Tables created successfully!' as status;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%notification%'
ORDER BY table_name;
