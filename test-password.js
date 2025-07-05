const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

async function testSpecificPassword() {
  const dbConnection = await mysql.createConnection({
    host: "localhost",
    port: 3506,
    user: "root", 
    password: "",
    database: "aureus_angels"
  });
  
  const email = "jp.rademeyer84+gold@gmail.com";
  
  try {
    const [users] = await dbConnection.execute(
      "SELECT password_hash FROM users WHERE email = ?",
      [email]
    );
    
    if (users.length === 0) {
      console.log(" No user found");
      return;
    }
    
    const storedHash = users[0].password_hash;
    console.log("Stored hash:", storedHash);
    
    // Test the password you think you used
    const testPassword = await new Promise((resolve) => {
      const readline = require("readline");
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      rl.question("Enter the password you think you used: ", (answer) => {
        rl.close();
        resolve(answer);
      });
    });
    
    console.log("Testing password:", testPassword);
    const isValid = await bcrypt.compare(testPassword, storedHash);
    console.log("Password match:", isValid ? " YES" : " NO");
    
    if (!isValid) {
      console.log("\n Let me create a new password for testing...");
      const newPassword = "aureus123";
      const newHash = await bcrypt.hash(newPassword, 12);
      
      await dbConnection.execute(
        "UPDATE users SET password_hash = ? WHERE email = ?",
        [newHash, email]
      );
      
      console.log(` Password updated to: ${newPassword}`);
      console.log("Try logging in with this password now.");
    }
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await dbConnection.end();
  }
}

testSpecificPassword();
