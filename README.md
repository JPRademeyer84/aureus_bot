# Aureus Alliance Holdings Telegram Bot

A comprehensive Telegram bot for managing gold share investments, user authentication, payment processing, and commission tracking.

## Features

- **User Authentication**: Secure registration and login system
- **Share Purchase System**: Gold share investment packages with automated processing
- **Payment Verification**: Admin-approved payment system with proof upload
- **Commission System**: Dual commission structure (15% USDT + 15% shares)
- **Referral System**: Sponsor assignment and commission tracking
- **Admin Panel**: Comprehensive admin controls and audit logging
- **Portfolio Management**: User investment tracking and history

## Technology Stack

- **Runtime**: Node.js
- **Bot Framework**: Telegraf
- **Database**: Supabase (PostgreSQL)
- **Authentication**: JWT tokens
- **File Storage**: Supabase Storage

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd Aureus-Telegram-Bot
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file with the following variables:
   ```
   BOT_TOKEN=your_telegram_bot_token
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   JWT_SECRET=your_jwt_secret
   ```

4. Set up the database:
   ```bash
   node setup-database-supabase.js
   ```

## Usage

Start the bot:
```bash
npm start
```

For development with auto-restart:
```bash
npm run dev
```

## Project Structure

```
├── src/                    # Source code
│   ├── bot/               # Bot handlers and middleware
│   ├── config/            # Configuration files
│   ├── database/          # Database schemas and migrations
│   ├── services/          # Business logic services
│   └── utils/             # Utility functions
├── logs/                  # Application logs
├── uploads/               # File uploads
├── certificates/          # SSL certificates
└── *.js                  # Legacy and test files
```

## Key Files

- `aureus-bot-complete.js` - Main bot application
- `database-schema.sql` - Database schema definitions
- `telegram.md` - Bot specifications and requirements
- `package.json` - Project dependencies and scripts

## Admin Features

- Payment approval system
- User management
- Commission tracking
- Audit logging
- System monitoring

## Security Features

- JWT-based authentication
- Admin role management
- Payment verification workflow
- Secure file upload handling
- Comprehensive audit trails

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

Private project - All rights reserved

## Support

For support and questions, contact the development team.
