import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Decimal from "decimal.js";
import {
  sequelize,
  Counterparty,
  Payment,
  Purchase,
  Sale,
  User,
  Metal,
  Purity,
} from "../../src/lib/db";
import {
  createPayment,
  cancelPayment,
  getPartyOutstanding,
  calculateCashDenominationsTotal,
} from "../../src/lib/services/payment-service";

describe("Bullion — Payment & Party Outstanding Engine (P0)", () => {
  let testUser: User;
  let supplier: Counterparty;
  let customer: Counterparty;
  let goldMetal: Metal;
  let gold24k: Purity;

  beforeAll(async () => {
    await sequelize.authenticate();

    // Setup or find test user
    testUser = (await User.findOne()) || (await User.create({
      id: `usr_${Date.now()}`,
      name: "Test Cashier",
      email: `cashier_${Date.now()}@bullion.test`,
      role: "ADMIN",
    }));

    // Setup Metal & Purity
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

    // Setup Supplier & Customer
    supplier = await Counterparty.create({
      name: `Supplier Apex ${Date.now()}`,
      type: "SUPPLIER",
      phone: "9876500001",
      isActive: true,
    });

    customer = await Counterparty.create({
      name: `Customer Rahul ${Date.now()}`,
      type: "CUSTOMER",
      phone: "9876500002",
      isActive: true,
    });
  });

  afterAll(async () => {
    // Clean test records
    await Payment.destroy({ where: { counterpartyId: [supplier.id, customer.id] } });
    await Purchase.destroy({ where: { counterpartyId: supplier.id } });
    await Sale.destroy({ where: { counterpartyId: customer.id } });
    await Counterparty.destroy({ where: { id: [supplier.id, customer.id] } });
  });

  it("1. Cash denomination breakdown math calculates correct total", () => {
    const total = calculateCashDenominationsTotal({
      500: 10, // 5000
      200: 5,  // 1000
      100: 8,  // 800
      50: 4,   // 200
      20: 5,   // 100
      10: 10,  // 100
      coins: 50, // 50
    });
    expect(total.toString()).toBe("7250");
  });

  it("2. Blocks cash payment when physical denominations mismatch amount", async () => {
    await expect(
      createPayment({
        type: "PAYMENT_RECEIVED",
        counterpartyId: customer.id,
        amount: "5000.00",
        paymentMode: "CASH",
        cashDenominations: { 500: 9 }, // 4500 != 5000
        createdById: testUser.id,
      })
    ).rejects.toThrow("Physical cash denominations total (₹4500) does not match payment amount (₹5000)");
  });

  it("3. Records a valid customer receipt with matching cash denominations", async () => {
    const receipt = await createPayment({
      type: "PAYMENT_RECEIVED",
      counterpartyId: customer.id,
      amount: "5000.00",
      paymentMode: "CASH",
      cashDenominations: { 500: 10 }, // 5000 == 5000
      notes: "Advance cash token",
      createdById: testUser.id,
    });

    expect(receipt.id).toBeDefined();
    expect(receipt.paymentNumber).toMatch(/^REC-\d{8}-\d{4}$/);
    expect(receipt.status).toBe("POSTED");
    expect(new Decimal(receipt.amount).toString()).toBe("5000");
  });

  it("4. Supports partial supplier payments against a ₹10,00,000 purchase until outstanding is ₹0", async () => {
    // Step 1: Create a purchase of ₹10,00,000
    const purchase = await Purchase.create({
      invoiceNumber: `INV-PUR-${Date.now()}`,
      date: new Date(),
      counterpartyId: supplier.id,
      supplierName: supplier.name,
      metalId: goldMetal.id,
      purityId: gold24k.id,
      weightGrams: "100.0000",
      ratePerGram: "10000.00",
      totalAmount: "1000000.00",
      paymentMode: "BANK_TRANSFER",
      status: "POSTED",
      createdById: testUser.id,
    });

    // Check initial outstanding
    let balance = await getPartyOutstanding(supplier.id);
    expect(balance.supplierPayableOutstanding.toString()).toBe("1000000");

    // Payment 1: ₹3,00,000
    await createPayment({
      type: "PAYMENT_MADE",
      counterpartyId: supplier.id,
      amount: "300000.00",
      paymentMode: "BANK_TRANSFER",
      referenceNumber: "UTR-PART-1",
      linkedPurchaseId: purchase.id,
      createdById: testUser.id,
    });

    balance = await getPartyOutstanding(supplier.id);
    expect(balance.supplierPayableOutstanding.toString()).toBe("700000");

    // Payment 2: ₹2,00,000
    await createPayment({
      type: "PAYMENT_MADE",
      counterpartyId: supplier.id,
      amount: "200000.00",
      paymentMode: "BANK_TRANSFER",
      referenceNumber: "UTR-PART-2",
      linkedPurchaseId: purchase.id,
      createdById: testUser.id,
    });

    balance = await getPartyOutstanding(supplier.id);
    expect(balance.supplierPayableOutstanding.toString()).toBe("500000");

    // Payment 3: ₹5,00,000 (Final installment)
    const p3 = await createPayment({
      type: "PAYMENT_MADE",
      counterpartyId: supplier.id,
      amount: "500000.00",
      paymentMode: "BANK_TRANSFER",
      referenceNumber: "UTR-PART-3",
      linkedPurchaseId: purchase.id,
      createdById: testUser.id,
    });

    balance = await getPartyOutstanding(supplier.id);
    // Verified user acceptance example: Purchase ₹10,00,000 → ₹3L + ₹2L + ₹5L payments → Outstanding ₹0!
    expect(balance.supplierPayableOutstanding.toString()).toBe("0");

    // Step 2: Cancel/Reverse Payment 3 non-destructively
    const cancelledP3 = await cancelPayment(p3.id, testUser.id, "Cheque bounced / UTR rejected");
    expect(cancelledP3.status).toBe("CANCELLED");
    expect(cancelledP3.cancelReason).toBe("Cheque bounced / UTR rejected");

    // Reversal immediately restores the outstanding balance back to ₹5,00,000
    balance = await getPartyOutstanding(supplier.id);
    expect(balance.supplierPayableOutstanding.toString()).toBe("500000");
  });

  it("5. Golden Rule: Reversing payment preserves record for audit and never deletes row", async () => {
    const payment = await createPayment({
      type: "PAYMENT_RECEIVED",
      counterpartyId: customer.id,
      amount: "15000.00",
      paymentMode: "UPI",
      referenceNumber: "UPI-TEST-001",
      createdById: testUser.id,
    });

    await cancelPayment(payment.id, testUser.id, "Customer transaction reversal requested");

    const found = await Payment.findByPk(payment.id);
    expect(found).not.toBeNull();
    expect(found!.status).toBe("CANCELLED");
    expect(found!.cancelledAt).toBeInstanceOf(Date);
  });
});
