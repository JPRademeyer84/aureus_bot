const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

async function debugPassword() {
  const dbConnection = await mysql.createConnection({
    host: "localhost",
    port: 3506,
    user: "root", 
    password: "",
    database: "aureus_angels"
  });
  
  const email = "jp.rademeyer84+gold@gmail.com";
  
  try {
    // Check if user exists
    const [users] = await dbConnection.execute(
      "SELECT id, email, password_hash, created_at FROM users WHERE email = ?",
      [email]
    );
    
    if (users.length === 0) {
      console.log(" No user found with email:", email);
      return;
    }
    
    const user = users[0];
    console.log(" User found:");
    console.log("  ID:", user.id);
    console.log("  Email:", user.email);
    console.log("  Password Hash:", user.password_hash);
    console.log("  Created:", user.created_at);
    console.log("  Hash Length:", user.password_hash.length);
    console.log("  Hash starts with:", user.password_hash.substring(0, 10));
    
    // Test common passwords
    const testPasswords = ["password", "123456", "admin", "test", "aureus"];
    
    for (const testPass of testPasswords) {
      try {
        const isValid = await bcrypt.compare(testPass, user.password_hash);
        console.log(`  Testing "${testPass}": ${isValid ? " MATCH" : " No match"}`);
      } catch (error) {
        console.log(`  Testing "${testPass}":  Error - ${error.message}`);
      }
    }
    
    // Check if it is a bcrypt hash
    const isBcryptHash = user.password_hash.startsWith("$2a$") || user.password_hash.startsWith("$2b$") || user.password_hash.startsWith("$2y$");
    console.log("  Is bcrypt hash:", isBcryptHash);
    
    if (!isBcryptHash) {
      console.log(" Password is not bcrypt hashed! It might be plain text or different hash.");
      console.log("  Raw password value:", user.password_hash);
    }
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await dbConnection.end();
  }
}

debugPassword();
