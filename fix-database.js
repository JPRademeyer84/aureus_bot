const mysql = require("mysql2/promise");

async function fixDatabase() {
  const dbConnection = await mysql.createConnection({
    host: "localhost",
    port: 3506,
    user: "root", 
    password: "",
    database: "aureus_angels"
  });
  
  try {
    console.log(" Adding missing registration_mode column...");
    
    await dbConnection.execute(`
      ALTER TABLE telegram_users 
      ADD COLUMN registration_mode ENUM("login", "register") DEFAULT "login"
    `);
    
    console.log(" Column added successfully!");
    
  } catch (error) {
    if (error.code === "ER_DUP_FIELDNAME") {
      console.log(" Column already exists!");
    } else {
      console.error(" Error:", error.message);
    }
  } finally {
    await dbConnection.end();
  }
}

fixDatabase();
