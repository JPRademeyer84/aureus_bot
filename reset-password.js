const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

async function resetPassword() {
  const dbConnection = await mysql.createConnection({
    host: "localhost",
    port: 3506,
    user: "root", 
    password: "",
    database: "aureus_angels"
  });
  
  const email = "jp.rademeyer84+gold@gmail.com";
  const newPassword = "aureus123";
  
  try {
    console.log(" Resetting password for testing...");
    
    // Hash the new password
    const newHash = await bcrypt.hash(newPassword, 12);
    console.log("New hash created:", newHash);
    
    // Update the password
    const [result] = await dbConnection.execute(
      "UPDATE users SET password_hash = ? WHERE email = ?",
      [newHash, email]
    );
    
    console.log("Update result:", result);
    
    if (result.affectedRows > 0) {
      console.log(` Password updated successfully!`);
      console.log(` Email: ${email}`);
      console.log(` New Password: ${newPassword}`);
      console.log("");
      console.log(" Now try logging in to the Telegram bot with:");
      console.log(`   Email: ${email}`);
      console.log(`   Password: ${newPassword}`);
    } else {
      console.log(" No user updated. Email might not exist.");
    }
    
    // Verify the password works
    const [users] = await dbConnection.execute(
      "SELECT password_hash FROM users WHERE email = ?",
      [email]
    );
    
    if (users.length > 0) {
      const isValid = await bcrypt.compare(newPassword, users[0].password_hash);
      console.log(" Password verification:", isValid ? "SUCCESS" : "FAILED");
    }
    
  } catch (error) {
    console.error(" Error:", error);
  } finally {
    await dbConnection.end();
  }
}

resetPassword();
