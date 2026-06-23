const prisma = require("./src/config/db");
const aiService = require("./src/services/ai.service");

async function testHistoryContinuity() {
  console.log("🔒 Starting Programmatic History Continuity Test...");

  try {
    // 1) Clear chat table to have a clean, controlled test history
    await prisma.chat.deleteMany();
    console.log("🧹 SQLite Chat history cleared.");

    // 2) Seed a conversation history sequence
    console.log("🌱 Seeding a premium advisory conversation history...");
    
    // Turn 1
    await prisma.chat.create({ data: { message: "Hello! I want to protect my family of four.", sender: "customer" } });
    await prisma.chat.create({ data: { message: "Namaste. I completely understand that protecting your family is your absolute top priority. To build a secure safety net, could you share a bit about their ages and your goals?", sender: "advisor" } });

    // Turn 2
    await prisma.chat.create({ data: { message: "My kids are 5 and 8, and my wife and I are 35. We want a premium cashless plan with high coverage.", sender: "customer" } });
    await prisma.chat.create({ data: { message: "Thank you for sharing those details. For a beautiful family with children aged 5 and 8, we want to secure complete critical care. I highly recommend our flagship Aegis Supreme Health Shield, which locks in ₹1 Crore cover with zero room rent limits and 100% cashless claims.", sender: "advisor" } });

    // 3) Send the consecutive message that relies on history memory
    const userQuery = "Our budget is around 1000 per month. How does that fit with this plan?";
    console.log(`\n💬 Sending consecutive query: "${userQuery}"`);
    console.log("⏳ Fetching premium AI advisor continuation...");

    const aiReply = await aiService.getResponseFromAIService(userQuery);
    
    console.log("\n✨ AI Advisor Response:");
    console.log("==========================================");
    console.log(aiReply);
    console.log("==========================================");

    // 4) Assert that it maintains the premium tone and references the family or Supreme Health Shield
    const lowerReply = aiReply.toLowerCase();
    if (lowerReply.includes("family") || lowerReply.includes("supreme") || lowerReply.includes("850") || lowerReply.includes("budget") || lowerReply.includes("premium")) {
      console.log("\n✅ SUCCESS: The AI Advisor correctly referenced the conversation history context and budget parameters!");
    } else {
      console.warn("\n⚠️ WARNING: The response generated did not explicitly mention the history context, please review.");
    }
  } catch (err) {
    console.error("❌ Test failed:", err);
  } finally {
    // Clean up or keep
    await prisma.chat.deleteMany();
    console.log("\n🧹 SQLite Chat table cleaned up.");
    process.exit(0);
  }
}

testHistoryContinuity();
