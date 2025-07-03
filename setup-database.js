const { createDatabaseSchema } = require('./src/database/setup');

async function main() {
  try {
    console.log('🎯 Starting database setup...\n');
    await createDatabaseSchema();
    console.log('\n✅ Database setup completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Database setup failed:', error);
    process.exit(1);
  }
}

main();
