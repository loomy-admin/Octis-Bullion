import "dotenv/config";
import { describe, it, expect, beforeAll } from "vitest";
import Decimal from "decimal.js";
import {
  sequelize,
  Counterparty,
  User,
  Metal,
  Purity,
  StockMovement,
  Payment,
  PartySettlement,
} from "../../src/lib/db";
import {
  recordPartySettlement,
  cancelPartySettlement,
  getPartyDualBalance,
} from "../../src/lib/services/settlement-service";
import { getCurrentStock } from "../../src/lib/services/stock-service";

describe("Bullion — Metal + Cash Dual Settlement Module", () => {
  let testUser: User;
  let customer: Counterparty;
  let goldMetal: Metal;
  let gold24k: Purity;

  beforeAll(async () => {
    await sequelize.authenticate();
    await PartySettlement.sync({ alter: true });

    testUser =
      (await User.findOne()) ||
      (await User.create({
        id: `usr_settle_${Date.now()}`,
        name: "Settlement Tester",
        email: `settle_tester_${Date.now()}@bullion.test`,
        role: "ADMIN",
      }));

    goldMetal =
      (await Metal.findOne({ where: { code: "GOLD" } })) ||
      (await Metal.create({
        code: "GOLD",
        name: "Gold",
        type: "GOLD",
        isActive: true,
      }));

    gold24k =
      (await Purity.findOne({
        where: { metalId: goldMetal.id, label: "24K" },
      })) ||
      (await Purity.create({
        metalId: goldMetal.id,
        label: "24K",
        fineness: "0.9990",
        isActive: true,
      }));

    customer = await Counterparty.create({
      name: `Dual Settlement Client ${Date.now()}`,
      type: "CUSTOMER",
      isActive: true,
    });

    // Seed vault inventory with 200g Gold
    await StockMovement.create({
      metalId: goldMetal.id,
      purityId: gold24k.id,
      movementType: "OPENING",
      weightGrams: "200.0000",
      createdById: testUser.id,
      reference: "Settlement test vault seed",
    });
  });

  it("successfully posts a dual settlement: Customer balance = 100g Gold + ₹50,000 -> Settles 80g + ₹30,000 -> Remaining = 20g + ₹20,000", async () => {
    const initialVaultStock = await getCurrentStock(goldMetal.id, gold24k.id);
    expect(initialVaultStock.toNumber()).toBeGreaterThanOrEqual(80);

    // Record settlement:
    // Pre: 100g Gold, ₹50,000 Cash
    // Settle: 80g Gold (Delivered to customer), ₹30,000 Cash (Received from customer)
    const settlement = await recordPartySettlement(testUser.id, "ADMIN", {
      counterpartyId: customer.id,
      metalId: goldMetal.id,
      purityId: gold24k.id,
      metalSettledGrams: 80,
      metalDirection: "DELIVER_TO_PARTY",
      cashSettledAmount: 30000,
      cashDirection: "RECEIVE_FROM_PARTY",
      paymentMode: "CASH",
      referenceNumber: "DUAL-TEST-001",
      currentMetalBalanceGrams: 100,
      currentCashBalance: 50000,
      notes: "Dual settlement test match with Section 11 of scope document",
    });

    expect(settlement.status).toBe("POSTED");
    expect(settlement.settlementNumber).toMatch(/^SET-\d+-\d+$/);

    // Verify balances in record
    expect(parseFloat(settlement.preMetalBalanceGrams)).toBe(100);
    expect(parseFloat(settlement.metalSettledGrams)).toBe(80);
    expect(parseFloat(settlement.postMetalBalanceGrams)).toBe(20);

    expect(parseFloat(settlement.preCashBalance)).toBe(50000);
    expect(parseFloat(settlement.cashSettledAmount)).toBe(30000);
    expect(parseFloat(settlement.postCashBalance)).toBe(20000);

    // Verify linked payment
    expect(settlement.linkedPaymentId).toBeDefined();
    const payment = await Payment.findByPk(settlement.linkedPaymentId!);
    expect(payment).toBeDefined();
    expect(payment?.type).toBe("PAYMENT_RECEIVED");
    expect(parseFloat(payment!.amount.toString())).toBe(30000);
    expect(payment?.status).toBe("POSTED");

    // Verify linked stock movement
    expect(settlement.linkedStockMovementId).toBeDefined();
    const movement = await StockMovement.findByPk(settlement.linkedStockMovementId!);
    expect(movement).toBeDefined();
    expect(movement?.movementType).toBe("ADJUSTMENT_DECREASE");
    expect(parseFloat(movement!.weightGrams.toString())).toBe(-80);

    // Verify shop vault stock decreased by 80g
    const postVaultStock = await getCurrentStock(goldMetal.id, gold24k.id);
    expect(postVaultStock.toNumber()).toBe(initialVaultStock.minus(80).toNumber());
  });

  it("retrieves live dual balance accurately for counterparty", async () => {
    const dual = await getPartyDualBalance(customer.id);

    expect(dual.counterparty.id).toBe(customer.id);
    expect(dual.counterparty.name).toBe(customer.name);
    expect(dual.cashOutstanding).toBeDefined();
    expect(dual.metalBalances).toBeDefined();
    expect(dual.metalBalances.length).toBeGreaterThan(0);
  });

  it("successfully cancels/reverses dual settlement, restoring both metal vault stock and cancelling payment", async () => {
    // 1. Post a settlement to cancel
    const settlementToCancel = await recordPartySettlement(testUser.id, "ADMIN", {
      counterpartyId: customer.id,
      metalId: goldMetal.id,
      purityId: gold24k.id,
      metalSettledGrams: 20,
      metalDirection: "DELIVER_TO_PARTY",
      cashSettledAmount: 10000,
      cashDirection: "RECEIVE_FROM_PARTY",
      paymentMode: "BANK_TRANSFER",
      currentMetalBalanceGrams: 20,
      currentCashBalance: 20000,
      notes: "Settlement to be reversed",
    });

    const stockBeforeCancel = await getCurrentStock(goldMetal.id, gold24k.id);

    // 2. Cancel the settlement
    const cancelled = await cancelPartySettlement(
      testUser.id,
      "ADMIN",
      settlementToCancel.id,
      "Customer requested reversal"
    );

    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.notes).toContain("Customer requested reversal");

    // 3. Verify linked payment was cancelled
    const linkedPay = await Payment.findByPk(settlementToCancel.linkedPaymentId!);
    expect(linkedPay?.status).toBe("CANCELLED");

    // 4. Verify shop vault metal stock was restored (+20g)
    const stockAfterCancel = await getCurrentStock(goldMetal.id, gold24k.id);
    expect(stockAfterCancel.toNumber()).toBe(stockBeforeCancel.plus(20).toNumber());

    // 5. Verify cannot cancel twice
    await expect(
      cancelPartySettlement(testUser.id, "ADMIN", settlementToCancel.id, "Duplicate attempt")
    ).rejects.toThrow("Settlement is already cancelled");
  });
});
