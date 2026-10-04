import "dotenv/config";
import {
  sequelize,
  syncDatabase,
  User,
  Account,
  Metal,
  Purity,
  Counterparty,
  AppSetting,
} from "../src/lib/db";
import { hashPassword } from "better-auth/crypto";

async function main() {
  console.log("🌱 Syncing Bullion MySQL database schema...");
  await syncDatabase();

  console.log("🌱 Seeding App Settings...");
  const settings = [
    { key: "company.name", value: "Bullion Trade Desk" },
    { key: "system.currency", value: "INR" },
    { key: "system.timezone", value: "Asia/Kolkata" },
  ];

  for (const s of settings) {
    await AppSetting.upsert(s);
  }

  console.log("🌱 Seeding Metals...");
  let gold = await Metal.findOne({ where: { code: "GOLD" } });
  if (!gold) {
    gold = await Metal.create({
      code: "GOLD",
      name: "Gold",
      type: "GOLD",
      isActive: true,
    });
  }

  let silver = await Metal.findOne({ where: { code: "SILVER" } });
  if (!silver) {
    silver = await Metal.create({
      code: "SILVER",
      name: "Silver",
      type: "SILVER",
      isActive: true,
    });
  }

  console.log("🌱 Seeding Purities...");
  const goldPurities = [
    { label: "24K", fineness: "0.9990", displayInfo: "99.9% Pure Gold", sortOrder: 1 },
    { label: "22K", fineness: "0.9160", displayInfo: "91.6% Standard Gold", sortOrder: 2 },
    { label: "18K", fineness: "0.7500", displayInfo: "75.0% Jewelry Gold", sortOrder: 3 },
  ];

  for (const p of goldPurities) {
    const existing = await Purity.findOne({
      where: { metalId: gold.id, label: p.label },
    });
    if (!existing) {
      await Purity.create({
        metalId: gold.id,
        label: p.label,
        fineness: p.fineness,
        displayInfo: p.displayInfo,
        sortOrder: p.sortOrder,
        isActive: true,
      });
    }
  }

  const silverPurities = [
    { label: "999 Fine Silver", fineness: "0.9990", displayInfo: "99.9% Pure Silver", sortOrder: 1 },
    { label: "925 Sterling Silver", fineness: "0.9250", displayInfo: "92.5% Sterling Silver", sortOrder: 2 },
  ];

  for (const p of silverPurities) {
    const existing = await Purity.findOne({
      where: { metalId: silver.id, label: p.label },
    });
    if (!existing) {
      await Purity.create({
        metalId: silver.id,
        label: p.label,
        fineness: p.fineness,
        displayInfo: p.displayInfo,
        sortOrder: p.sortOrder,
        isActive: true,
      });
    }
  }

  console.log("🌱 Seeding Users & Auth Accounts...");
  const passwordHash = await hashPassword("password123");

  const seedUsers = [
    {
      id: "usr_admin_001",
      name: "Bullion Administrator",
      email: "admin@bullion.com",
      emailVerified: true,
      role: "ADMIN" as const,
      isActive: true,
    },
    {
      id: "usr_staff_001",
      name: "Trade Desk Operator",
      email: "staff@bullion.com",
      emailVerified: true,
      role: "STAFF" as const,
      isActive: true,
    },
  ];

  for (const u of seedUsers) {
    await User.upsert(u);
    await Account.upsert({
      id: `acc_${u.id}`,
      accountId: u.id,
      providerId: "credential",
      userId: u.id,
      password: passwordHash,
    });
  }

  console.log("🌱 Seeding Counterparties...");
  const counterparties = [
    {
      name: "Apex Bullion Refiners",
      type: "SUPPLIER" as const,
      phone: "9876543210",
      email: "info@apexrefiners.com",
      address: "Zaveri Bazaar, Mumbai",
      notes: "Primary refinery partner for fine gold bars",
      isActive: true,
    },
    {
      name: "Royal Jewelers & Bullion",
      type: "CUSTOMER" as const,
      phone: "9876543211",
      email: "orders@royaljewelers.com",
      address: "MG Road, Bengaluru",
      notes: "Institutional buyer for casting grain and bars",
      isActive: true,
    },
    {
      name: "MMTC-PAMP India",
      type: "BOTH" as const,
      phone: "9876543212",
      email: "trading@mmtcpamp.com",
      address: "Connaught Place, New Delhi",
      notes: "Accredited mint & precious metals trading desk",
      isActive: true,
    },
  ];

  for (const c of counterparties) {
    const existing = await Counterparty.findOne({ where: { name: c.name } });
    if (!existing) {
      await Counterparty.create(c);
    }
  }

  console.log("\n🚀 Bullion MySQL seeding completed successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seed error:", err);
  process.exit(1);
});
