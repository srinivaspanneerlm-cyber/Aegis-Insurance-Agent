const axios = require("axios");

const API_URL = "http://localhost:5000/api";

async function runVerification() {
  console.log("🔒 Starting Programmatic E2E API Verification...");
  
  const testEmail = `test_officer_${Date.now()}@aegis.com`;
  let authToken = "";

  try {
    // 1) Verify Authentication Registration
    console.log("\n1️⃣ Verifying User Registration...");
    const regRes = await axios.post(`${API_URL}/auth/register`, {
      name: "Officer Bob",
      email: testEmail,
      password: "SecurePassword123",
      role: "admin",
    });
    
    if (regRes.status === 201 && regRes.data.status === "success") {
      console.log("✅ Registration Successful!");
      authToken = regRes.data.token;
    } else {
      throw new Error(`Unexpected registration status: ${regRes.status}`);
    }

    // Configure axios instance with Bearer auth token
    const client = axios.create({
      baseURL: API_URL,
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    // 2) Verify Auth Session Check
    console.log("\n2️⃣ Verifying 'Get Me' Session Handler...");
    const meRes = await client.get("/auth/me");
    if (meRes.status === 200 && meRes.data.data.user.email === testEmail) {
      console.log(`✅ Session Active! Authorized as Role: "${meRes.data.data.user.role}"`);
    } else {
      throw new Error("Me session email mismatch.");
    }

    // 3) Verify Policy Cards Fetching
    console.log("\n3️⃣ Verifying Dynamic Policies Listing...");
    const policyRes = await client.get("/policies");
    if (policyRes.status === 200 && Array.isArray(policyRes.data.data.policies)) {
      console.log(`✅ Policies database synched. Loaded ${policyRes.data.data.policies.length} coverage products.`);
      policyRes.data.data.policies.forEach((p, idx) => {
        console.log(`   └─ Policy [${idx + 1}]: "${p.policyName}" | Cover: ${p.coverage} | Premium: ₹${p.premium}/mo`);
      });
    } else {
      throw new Error("Policies fetch returned invalid structure.");
    }

    // 4) Verify Lead Capture Form Submissions
    console.log("\n4️⃣ Verifying Underwriting Lead Capture...");
    const leadRes = await client.post("/leads", {
      customerName: "Alice Dev",
      email: "alice@corporate.com",
      phone: "9876543210",
      insuranceType: "Aegis Supreme Health Shield (Self + Spouse)",
      budget: "₹10,000 - ₹25,000",
    });
    if (leadRes.status === 201 && leadRes.data.status === "success") {
      console.log(`✅ Lead Qualified & Saved! SQLite Assigned ID: "${leadRes.data.data.lead.id}"`);
    } else {
      throw new Error("Lead submission failed.");
    }

    // 5) Verify Connected AI Advisor Chat
    console.log("\n5️⃣ Verifying Connected AI Underwriter Chat...");
    const chatRes = await client.post("/chat", {
      message: "I want to protect my kids under supreme health shield",
    });
    if (chatRes.status === 201 && chatRes.data.status === "success") {
      console.log("✅ AI Advisor replied successfully!");
      console.log(`   └─ Request: "I want to protect my kids under supreme health shield"`);
      console.log(`   └─ Reply: "${chatRes.data.data.advisorMessage.message.substring(0, 100)}..."`);
    } else {
      throw new Error("AI Advisor message submission failed.");
    }

    // 6) Verify Admin Security Dashboard Aggregates
    console.log("\n6️⃣ Verifying Admin Dashboard Analytics Widget...");
    const statsRes = await client.get("/admin/stats");
    if (statsRes.status === 200 && statsRes.data.status === "success") {
      console.log("✅ Analytics Aggregated Successfully!");
      console.log("   └─ Aggregates Map:", statsRes.data.data);
    } else {
      throw new Error("Admin stats collection failed.");
    }

    console.log("\n🌟 ALL CORE API INTEGRATIONS SECURED AND 100% OPERATIONAL! 🌟\n");
  } catch (err) {
    console.error("❌ E2E Verification failed:", err.message);
    if (err.response) {
      console.error("   └─ Server response error payload:", err.response.data);
    }
    process.exit(1);
  }
}

runVerification();
