// Test script to verify share calculation logic
console.log("🧮 TESTING SHARE CALCULATION LOGIC");
console.log("=====================================");

// Test cases based on current phase price of $5.00
const phasePrice = 5.00;

const testCases = [
  { amount: 25, expected: 5 },
  { amount: 100, expected: 20 },
  { amount: 500, expected: 100 },
  { amount: 5000, expected: 1000 }
];

console.log(`📊 Current Phase Price: $${phasePrice} per share`);
console.log("");

testCases.forEach(test => {
  const calculatedShares = Math.floor(test.amount / phasePrice);
  const isCorrect = calculatedShares === test.expected;
  
  console.log(`💰 Payment: $${test.amount}`);
  console.log(`🎯 Expected Shares: ${test.expected}`);
  console.log(`🧮 Calculated Shares: ${calculatedShares}`);
  console.log(`✅ Result: ${isCorrect ? 'CORRECT' : 'WRONG'}`);
  console.log("---");
});

console.log("");
console.log("🔧 FORMULA USED: Math.floor(amount / phasePrice)");
console.log("📍 This should match line 2680 in aureus-bot-new.js");
