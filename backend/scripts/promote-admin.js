/**
 * Promote an existing user to an elevated role.
 *
 * Public registration only ever creates "customer" accounts, so use this
 * one-off script to grant admin access to a trusted account.
 *
 * Usage:
 *   node scripts/promote-admin.js <email> [admin|superadmin]
 *
 * Example:
 *   node scripts/promote-admin.js you@example.com admin
 */
require("dotenv").config();
const prisma = require("../src/config/db");

(async () => {
  const email = process.argv[2];
  const role = process.argv[3] || "admin";

  if (!email) {
    console.error("Usage: node scripts/promote-admin.js <email> [admin|superadmin]");
    process.exit(1);
  }
  if (!["admin", "superadmin"].includes(role)) {
    console.error(`Invalid role "${role}". Use "admin" or "superadmin".`);
    process.exit(1);
  }

  try {
    const user = await prisma.user.update({
      where: { email },
      data: { role },
      select: { id: true, email: true, role: true },
    });
    console.log(`✅ ${user.email} is now "${user.role}".`);
    process.exit(0);
  } catch (err) {
    console.error(`❌ Could not update user "${email}". Does the account exist?`);
    console.error(err.message);
    process.exit(1);
  }
})();
