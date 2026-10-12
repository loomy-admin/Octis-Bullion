import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Decimal from "decimal.js";
import {
  sequelize,
  Counterparty,
  Purchase,
  Sale,
  User,
  Metal,
  Purity,
  StockMovement,
} from "../../src/lib/db";
import {
  createPurchase,
  postPurchase,
  fixPurchaseRate,
} from "../../src/lib/services/purchase-service";
import {
  createSale,
  postSale,
  fixSaleRate,
} from "../../src/lib/services/sale-service";

describe("Bullion — Fixed vs Unfixed Rate Engine (P1)", () => {
  let testUser: User;
  let supplier: Counterparty;
  let customer: Counterparty;
  let goldMetal: Metal;
  let gold24k: Purity;

  beforeAll(async () => {
    await sequelize.authenticate();

    testUser = (await User.findOne()) || (await User.create({
      id: `usr_fx_${Date.now()}`,
      name: "Fixing Tester",
      email: `tester_${Date.now()}@bullion.test`,
      role: "ADMIN",
    }));

    goldMetal = (await Metal.findOne({ where: { code: "GOLD" } })) || (await Metal.create({
      code: "GOLD",
      name: "Gold",
      type: "GOLD",
      isActive: true,
    }));

    gold24k = (await Purity.findOne({ where: { metalId: goldMetal.id, label: "24K" } })) || (await Purity.create({
      metalId: goldMetal.id,
      label: "24K",
      fineness: "0.9990",
      isActive: true,
    }));

    supplier = await Counterparty.create({
      name: `Fix Supplier ${Date.now()}`,
      type: "SUPPLIER",
      isActive: true,
    });

    customer = await Counterparty.create({
      name: `Fix Customer ${Date.now()}`,
      type: "CUSTOMER",
      isActive: true,
    });
  });

  afterAll(async () => {
    await StockMovement.destroy({ where: { createdById: testUser.id } });
    await Purchase.destroy({ where: { counterpartyId: supplier.id } });
    await Sale.destroy({ where: { counterpartyId: customer.id } });
    await Counterparty.destroy({ where: { id: [supplier.id, customer.id] } });
  });

  it("1. Unfixed purchase creates deal with rateStatus UNFIXED, and posting immediately moves physical stock", async () => {
    const draft = await createPurchase(testUser.id, "ADMIN", {
      invoiceNumber: `PUR-UNFIX-${Date.now()}`,
      date: new Date(),
      supplierName: supplier.name,
      counterpartyId: supplier.id,
      metalId: goldMetal.id,
      purityId: gold24k.id,
      weightGrams: "150.0000",
      rateType: "UNFIXED",
      ratePerGram: "0",
      paymentMode: "CASH",
    });

    expect(draft.rateStatus).toBe("UNFIXED");
    expect(draft.rateType).toBe("UNFIXED");
    expect(new Decimal(draft.totalAmount).toNumber()).toBe(0);

    const posted = await postPurchase(testUser.id, "ADMIN", draft.id);
    expect(posted.status).toBe("POSTED");

    // Verify physical stock movement was created
    const movement = await StockMovement.findOne({ where: { purchaseId: posted.id } });
    expect(movement).toBeDefined();
    expect(new Decimal(movement!.weightGrams).toFixed(4)).toBe("150.0000");
  });

  it("2. fixPurchaseRate finalizes rate, updates totalAmount, sets status to FIXED, and records audit trail", async () => {
    const purchase = await Purchase.findOne({
      where: { counterpartyId: supplier.id, rateStatus: "UNFIXED" },
    });
    expect(purchase).toBeDefined();

    const fixed = await fixPurchaseRate(
      testUser.id,
      "ADMIN",
      purchase!.id,
      "7500.0000",
      "Fixed per evening market spot"
    );

    expect(fixed.rateStatus).toBe("FIXED");
    expect(new Decimal(fixed.ratePerGram).toFixed(2)).toBe("7500.00");
    // 150g * 7500 = 11,25,000
    expect(new Decimal(fixed.totalAmount).toNumber()).toBe(1125000);
    expect(fixed.fixedAt).toBeDefined();
    expect(fixed.fixedById).toBe(testUser.id);
    expect(fixed.fixingNotes).toBe("Fixed per evening market spot");
  });

  it("3. Reject re-fixing an already fixed purchase deal", async () => {
    const purchase = await Purchase.findOne({
      where: { counterpartyId: supplier.id, rateStatus: "FIXED" },
    });
    expect(purchase).toBeDefined();

    await expect(
      fixPurchaseRate(testUser.id, "ADMIN", purchase!.id, "7600.0000")
    ).rejects.toThrow(/Rate is already fixed/i);
  });

  it("4. Reject fixing deal with invalid non-positive rate", async () => {
    const unfixedDraft = await createPurchase(testUser.id, "ADMIN", {
      invoiceNumber: `PUR-UNFIX-NEG-${Date.now()}`,
      date: new Date(),
      supplierName: supplier.name,
      counterpartyId: supplier.id,
      metalId: goldMetal.id,
      purityId: gold24k.id,
      weightGrams: "25.0000",
      rateType: "UNFIXED",
      ratePerGram: "0",
      paymentMode: "CASH",
    });

    await expect(
      fixPurchaseRate(testUser.id, "ADMIN", unfixedDraft.id, "0")
    ).rejects.toThrow(/Fixed rate must be positive/i);
  });
});
