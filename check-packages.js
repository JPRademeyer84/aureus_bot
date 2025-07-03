const mysql = require('mysql2/promise');

async function checkPackages() {
  try {
    const db = await mysql.createConnection({
      host: 'localhost',
      port: 3506,
      user: 'root',
      password: '',
      database: 'aureus_angels'
    });

    console.log('📋 Checking investment_packages data...');
    const [rows] = await db.execute('SELECT id, name, price, is_active FROM investment_packages ORDER BY price ASC');
    console.log('Total packages found:', rows.length);
    
    rows.forEach(row => {
      console.log(`  ${row.id}: ${row.name} - $${row.price} (active: ${row.is_active})`);
    });

    console.log('\n📋 Checking with is_active = TRUE...');
    const [activeRows] = await db.execute('SELECT id, name, price, is_active FROM investment_packages WHERE is_active = TRUE ORDER BY price ASC');
    console.log('Active packages found:', activeRows.length);
    
    activeRows.forEach(row => {
      console.log(`  ${row.id}: ${row.name} - $${row.price}`);
    });

    console.log('\n📋 Checking with is_active = 1...');
    const [activeRows2] = await db.execute('SELECT id, name, price, is_active FROM investment_packages WHERE is_active = 1 ORDER BY price ASC');
    console.log('Active packages (is_active = 1) found:', activeRows2.length);
    
    activeRows2.forEach(row => {
      console.log(`  ${row.id}: ${row.name} - $${row.price}`);
    });

    await db.end();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkPackages();
