const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

console.log('🔗 Initializing Supabase client...');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('❌ Missing Supabase environment variables. Please check your .env file.');
}

// Create Supabase client with service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('✅ Supabase client initialized');

// Database helper functions
class SupabaseDB {
  constructor() {
    this.client = supabase;
  }

  // Test database connection
  async testConnection() {
    try {
      const { data, error } = await this.client
        .from('test_connection')
        .select('*')
        .limit(1);
      
      if (error && error.code !== '42P01') {
        console.error('❌ Database connection test failed:', error);
        return false;
      }
      
      console.log('✅ Database connection successful!');
      return true;
    } catch (error) {
      console.error('❌ Database connection error:', error);
      return false;
    }
  }

  // User management functions
  async getTelegramUser(telegramId) {
    try {
      const { data, error } = await this.client
        .from('telegram_users')
        .select('*')
        .eq('telegram_id', telegramId)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error getting telegram user:', error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Error getting telegram user:', error);
      return null;
    }
  }

  async createTelegramUser(telegramId, userData) {
    try {
      const { data, error } = await this.client
        .from('telegram_users')
        .insert([{
          telegram_id: telegramId,
          username: userData.username,
          first_name: userData.first_name,
          last_name: userData.last_name
        }])
        .select()
        .single();
      
      if (error) {
        console.error('Error creating telegram user:', error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Error creating telegram user:', error);
      return null;
    }
  }

  async updateTelegramUser(telegramId, updates) {
    try {
      const { data, error } = await this.client
        .from('telegram_users')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('telegram_id', telegramId)
        .select()
        .single();

      if (error) {
        console.error('Error updating telegram user:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error updating telegram user:', error);
      return null;
    }
  }

  async checkEmailExists(email) {
    try {
      const { data, error } = await this.client
        .from('users')
        .select('id')
        .eq('email', email)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error checking email:', error);
        return false;
      }
      
      return !!data;
    } catch (error) {
      console.error('Error checking email:', error);
      return false;
    }
  }

  async getUserByEmail(email) {
    try {
      const { data, error } = await this.client
        .from('users')
        .select('*')
        .eq('email', email)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error getting user by email:', error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Error getting user by email:', error);
      return null;
    }
  }

  async createUser(userData) {
    try {
      const { data, error } = await this.client
        .from('users')
        .insert([userData])
        .select()
        .single();
      
      if (error) {
        console.error('Error creating user:', error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Error creating user:', error);
      return null;
    }
  }

  // Investment package functions
  async getInvestmentPackages() {
    try {
      const { data, error } = await this.client
        .from('investment_packages')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true });
      
      if (error) {
        console.error('Error getting investment packages:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('Error getting investment packages:', error);
      return [];
    }
  }

  async getPackageById(packageId) {
    try {
      const { data, error } = await this.client
        .from('investment_packages')
        .select('*')
        .eq('id', packageId)
        .eq('is_active', true)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error getting package by ID:', error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Error getting package by ID:', error);
      return null;
    }
  }

  // Investment functions
  async getUserInvestments(userId) {
    try {
      const { data, error } = await this.client
        .from('aureus_investments')
        .select(`
          *,
          investment_packages (
            name,
            price
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error getting user investments:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error getting user investments:', error);
      return [];
    }
  }

  // Investment phases functions
  async getCurrentPhase() {
    try {
      const { data, error } = await this.client
        .from('investment_phases')
        .select('*')
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error getting current phase:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error getting current phase:', error);
      return null;
    }
  }

  async getAllPhases() {
    try {
      const { data, error } = await this.client
        .from('investment_phases')
        .select('*')
        .order('phase_number', { ascending: true });

      if (error) {
        console.error('Error getting all phases:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error getting all phases:', error);
      return [];
    }
  }

  // Company wallets functions
  async getWalletByNetwork(network) {
    try {
      const { data, error } = await this.client
        .from('company_wallets')
        .select('*')
        .eq('network', network)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error getting wallet by network:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error getting wallet by network:', error);
      return null;
    }
  }

  // Terms acceptance functions
  async hasAcceptedTerms(userId, termsType) {
    try {
      const { data, error } = await this.client
        .from('terms_acceptance')
        .select('id')
        .eq('user_id', userId)
        .eq('terms_type', termsType)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking terms acceptance:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('Error checking terms acceptance:', error);
      return false;
    }
  }

  async acceptTerms(userId, termsType, version = '1.0') {
    try {
      const { data, error } = await this.client
        .from('terms_acceptance')
        .insert([{
          user_id: userId,
          terms_type: termsType,
          version: version
        }])
        .select()
        .single();

      if (error) {
        console.error('Error accepting terms:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error accepting terms:', error);
      return false;
    }
  }

  // User session functions
  async getUserSession(telegramId) {
    try {
      const { data, error } = await this.client
        .from('user_sessions')
        .select('*')
        .eq('telegram_id', telegramId)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error getting user session:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error getting user session:', error);
      return null;
    }
  }

  async createUserSession(telegramId, sessionState, sessionData = {}) {
    try {
      // First, clean up any expired sessions
      await this.client
        .from('user_sessions')
        .delete()
        .eq('telegram_id', telegramId);

      const { data, error } = await this.client
        .from('user_sessions')
        .insert([{
          telegram_id: telegramId,
          session_state: sessionState,
          session_data: sessionData
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating user session:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error creating user session:', error);
      return null;
    }
  }

  async updateUserSession(telegramId, updates) {
    try {
      const { data, error } = await this.client
        .from('user_sessions')
        .update(updates)
        .eq('telegram_id', telegramId)
        .select()
        .single();

      if (error) {
        console.error('Error updating user session:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error updating user session:', error);
      return null;
    }
  }



  // User management functions
  async getUserByEmail(email) {
    try {
      const { data, error } = await this.client
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error getting user by email:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error getting user by email:', error);
      return null;
    }
  }

  async createUser(userData) {
    try {
      const { data, error } = await this.client
        .from('users')
        .insert([userData])
        .select()
        .single();

      if (error) {
        console.error('Error creating user:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error creating user:', error);
      return null;
    }
  }

  async getUserById(userId) {
    try {
      const { data, error } = await this.client
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error getting user by ID:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error getting user by ID:', error);
      return null;
    }
  }

  async getUserInvestmentStats(userId) {
    try {
      const { data, error } = await this.client
        .from('aureus_investments')
        .select('amount, shares, status')
        .eq('user_id', userId);
      
      if (error) {
        console.error('Error getting investment stats:', error);
        return {
          total_investments: 0,
          total_amount: 0,
          total_shares: 0,
          active_investments: 0,
          completed_investments: 0,
          estimated_roi: 0
        };
      }
      
      const investments = data || [];
      const stats = {
        total_investments: investments.length,
        total_amount: investments.reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0),
        total_shares: investments.reduce((sum, inv) => sum + parseInt(inv.shares || 0), 0),
        active_investments: investments.filter(inv => inv.status === 'active').length,
        completed_investments: investments.filter(inv => inv.status === 'completed').length,
        estimated_roi: 0 // Will calculate this separately if needed
      };
      
      return stats;
    } catch (error) {
      console.error('Error getting investment stats:', error);
      return {
        total_investments: 0,
        total_amount: 0,
        total_shares: 0,
        active_investments: 0,
        completed_investments: 0,
        estimated_roi: 0
      };
    }
  }
}

// Export singleton instance
const db = new SupabaseDB();

module.exports = {
  supabase,
  db,
  SupabaseDB
};
