import "dotenv/config";
import { Payment } from "../src/lib/db/models/Payment";
import { sequelize } from "../src/lib/db/sequelize";

async function main() {
  console.log("Checking and syncing Payment table...");
  await sequelize.authenticate();
  await Payment.sync({ alter: true });
  console.log("Payment table created/synced successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to sync Payment table:", err);
  process.exit(1);
});
