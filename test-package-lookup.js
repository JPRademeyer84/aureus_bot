const mysql = require('mysql2/promise');

async function testPackageLookup() {
  try {
    const db = await mysql.createConnection({
      host: 'localhost',
      port: 3506,
      user: 'root',
      password: '',
      database: 'aureus_angels'
    });

    const testId = '34e5a032-4c6c-11f0-9d57-088fc31781b4';
    
    console.log('🔍 Testing package lookup...');
    console.log('Looking for package ID:', testId);
    
    // Test the exact query from getPackageById
    const [rows] = await db.execute(
      "SELECT * FROM investment_packages WHERE id = ? AND is_active = TRUE",
      [testId]
    );
    
    console.log('Query result:', rows.length, 'rows found');
    if (rows.length > 0) {
      console.log('Package found:', rows[0]);
    } else {
      console.log('❌ Package not found with that query');
      
      // Try without is_active check
      console.log('\n🔍 Trying without is_active check...');
      const [rows2] = await db.execute(
        "SELECT * FROM investment_packages WHERE id = ?",
        [testId]
      );
      console.log('Query result (no is_active):', rows2.length, 'rows found');
      if (rows2.length > 0) {
        console.log('Package found:', rows2[0]);
      }
      
      // Check if the ID format is correct
      console.log('\n🔍 Checking all package IDs...');
      const [allRows] = await db.execute("SELECT id, name FROM investment_packages");
      allRows.forEach(row => {
        console.log(`  ${row.id}: ${row.name}`);
      });
    }

    await db.end();
  } catch (error) {
    console.error('Error:', error);
  }
}

testPackageLookup();
