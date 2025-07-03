const mysql = require('mysql2/promise');

async function checkInvestmentsSchema() {
  try {
    const db = await mysql.createConnection({
      host: 'localhost',
      port: 3506,
      user: 'root',
      password: '',
      database: 'aureus_angels'
    });

    console.log('📋 Checking aureus_investments table structure...');
    const [rows] = await db.execute('DESCRIBE aureus_investments');
    
    console.log('Columns found:');
    rows.forEach(row => {
      console.log(`  ${row.Field}: ${row.Type} ${row.Key ? `(${row.Key})` : ''}`);
    });

    console.log('\n📋 Checking investment_packages table structure...');
    const [pkgRows] = await db.execute('DESCRIBE investment_packages');
    
    console.log('Columns found:');
    pkgRows.forEach(row => {
      console.log(`  ${row.Field}: ${row.Type} ${row.Key ? `(${row.Key})` : ''}`);
    });

    console.log('\n📋 Sample data from aureus_investments:');
    const [sampleData] = await db.execute('SELECT * FROM aureus_investments LIMIT 3');
    console.log('Sample investments:', sampleData);

    await db.end();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkInvestmentsSchema();
