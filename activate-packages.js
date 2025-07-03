const mysql = require('mysql2/promise');

async function activatePackages() {
  try {
    const db = await mysql.createConnection({
      host: 'localhost',
      port: 3506,
      user: 'root',
      password: '',
      database: 'aureus_angels'
    });

    console.log('🔄 Activating all investment packages...');
    const result = await db.execute('UPDATE investment_packages SET is_active = 1');
    console.log('✅ Updated', result[0].affectedRows, 'packages');

    console.log('\n📋 Verifying activation...');
    const [rows] = await db.execute('SELECT id, name, price, is_active FROM investment_packages ORDER BY price ASC');
    
    rows.forEach(row => {
      console.log(`  ${row.name}: $${row.price} (active: ${row.is_active})`);
    });

    console.log('\n✅ All packages are now active!');
    await db.end();
  } catch (error) {
    console.error('Error:', error);
  }
}

activatePackages();
