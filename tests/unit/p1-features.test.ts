import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Decimal from "decimal.js";
import {
  sequelize,
  Counterparty,
  Sale,
  User,
  Metal,
  Purity,
  MetalRate,
  RateBlock,
  MetalDenomination,
  CashClosing,
} from "../../src/lib/db";
import {
  calculateLandedCost,
  setMetalRate,
} from "../../src/lib/services/rate-service";
import {
  createRateBlock,
  fulfillRateBlock,
  cancelRateBlock,
  getRateBlocks,
} from "../../src/lib/services/rate-block-service";
import {
  createDenomination,
  calculateDenominationBreakdown,
  getDenominationRateBoard,
} from "../../src/lib/services/denomination-service";
import {
  calculatePhysicalBalance,
  recordCashClosing,
} from "../../src/lib/services/cash-closing-service";

describe("Bullion — P1 Advanced Trading & Operational Modules", () => {
  let testUser: User;
  let customer: Counterparty;
  let goldMetal: Metal;
  let gold24k: Purity;

  beforeAll(async () => {
    await sequelize.authenticate();

    testUser =
      (await User.findOne()) ||
      (await User.create({
        id: `usr_p1_${Date.now()}`,
        name: "P1 Tester",
        email: `p1_tester_${Date.now()}@bullion.test`,
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
      name: `P1 Client ${Date.now()}`,
      type: "CUSTOMER",
      isActive: true,
    });
  });

  describe("1. Landed Cost Calculator & Rates Desk", () => {
    it("accurately computes landed per-gram cost using international benchmark formula", () => {
      // Formula: (USD/oz * USD/INR * 1.15 * 1.03) / 31.1000
      const calc = calculateLandedCost({
        usdOuncePrice: 2600,
        usdInrRate: 84.0,
        customsDutyPct: 15.0,
        gstPct: 3.0,
        marginPerGram: 50.0,
      });

      // 2600 * 84 = 218400
      // 218400 * 1.15 = 251160
      // 251160 * 1.03 = 258694.8
      // 258694.8 / 31.1 = 8318.16077...
      expect(parseFloat(calc.landedCostPerGram)).toBeCloseTo(8318.16, 1);
      expect(parseFloat(calc.recommendedSellRate)).toBeCloseTo(8368.16, 1); // +50
      expect(parseFloat(calc.recommendedBuyRate)).toBeCloseTo(8268.16, 1); // -50
    });

    it("saves and updates metal rates with audit records", async () => {
      const rate = await setMetalRate(testUser.id, "ADMIN", {
        metalId: goldMetal.id,
        purityId: gold24k.id,
        buyRate: "8250",
        sellRate: "8350",
        marginPerGram: "50",
      });

      expect(new Decimal(rate.buyRate).toNumber()).toBe(8250);
      expect(new Decimal(rate.sellRate).toNumber()).toBe(8350);
      expect(rate.isLive).toBe(true);
    });
  });

  describe("2. Rate Booking & Price Reservations", () => {
    let rateBlock: RateBlock;

    it("books a rate block with advance deposit and validity window", async () => {
      rateBlock = await createRateBlock(testUser.id, "ADMIN", {
        counterpartyId: customer.id,
        metalId: goldMetal.id,
        purityId: gold24k.id,
        blockedWeightGrams: 50,
        blockedRatePerGram: 8300,
        advanceAmount: 25000,
        validHours: 4,
        notes: "Deposit collected at desk",
      });

      expect(rateBlock.status).toBe("ACTIVE");
      expect(rateBlock.blockNumber).toMatch(/^RB-\d{8}-\d{4}$/);
      expect(new Decimal(rateBlock.totalBlockedAmount).toNumber()).toBe(415000); // 50 * 8300
      expect(new Decimal(rateBlock.advanceAmount).toNumber()).toBe(25000);
      expect(new Date(rateBlock.validUntil).getTime()).toBeGreaterThan(Date.now());
    });

    it("fulfills a rate block by linking it to a sale invoice", async () => {
      // Create a dummy sale to link
      const sale = await Sale.create({
        invoiceNumber: `SAL-TEST-${Date.now()}`,
        date: new Date(),
        buyerName: customer.name,
        counterpartyId: customer.id,
        metalId: goldMetal.id,
        purityId: gold24k.id,
        weightGrams: "50.0000",
        ratePerGram: "8300.0000",
        totalAmount: "415000.00",
        paymentMode: "CASH",
        status: "DRAFT",
        createdById: testUser.id,
      });

      const fulfilled = await fulfillRateBlock(
        testUser.id,
        "ADMIN",
        rateBlock.id,
        sale.id
      );

      expect(fulfilled.status).toBe("FULFILLED");
      expect(fulfilled.fulfilledSaleId).toBe(sale.id);
    });

    it("cancels an active rate block with audit reason", async () => {
      const blockToCancel = await createRateBlock(testUser.id, "ADMIN", {
        counterpartyId: customer.id,
        metalId: goldMetal.id,
        purityId: gold24k.id,
        blockedWeightGrams: 10,
        blockedRatePerGram: 8300,
        advanceAmount: 5000,
        validHours: 2,
      });

      const cancelled = await cancelRateBlock(
        testUser.id,
        "ADMIN",
        blockToCancel.id,
        "Client decided not to proceed"
      );

      expect(cancelled.status).toBe("CANCELLED");
      expect(cancelled.notes).toContain("Client decided not to proceed");
    });
  });

  describe("3. Metal Denominations & Physical Decomposition Tool", () => {
    beforeAll(async () => {
      // Create standard denominations for test
      await createDenomination(testUser.id, "ADMIN", {
        metalId: goldMetal.id,
        purityId: gold24k.id,
        type: "BAR",
        name: "100g Cast Bar",
        weightGrams: 100,
        premiumAmount: 1800,
      });

      await createDenomination(testUser.id, "ADMIN", {
        metalId: goldMetal.id,
        purityId: gold24k.id,
        type: "COIN",
        name: "10g Minted Coin",
        weightGrams: 10,
        premiumAmount: 500,
      });

      await createDenomination(testUser.id, "ADMIN", {
        metalId: goldMetal.id,
        purityId: gold24k.id,
        type: "COIN",
        name: "8g Guinea Coin",
        weightGrams: 8,
        premiumAmount: 450,
      });
    });

    it("optimally breaks down 118g gold into 1x 100g Bar + 1x 10g Coin + 1x 8g Guinea Coin", async () => {
      const breakdown = await calculateDenominationBreakdown(
        118,
        goldMetal.id,
        gold24k.id,
        8000
      );

      expect(breakdown.targetWeightGrams).toBe(118);
      expect(breakdown.allocatedWeightGrams).toBe(118);
      expect(breakdown.unallocatedWeightGrams).toBe(0);

      // Verify lines
      expect(breakdown.items.length).toBe(3);
      const bar100 = breakdown.items.find((i) => i.weightGrams === 100);
      const coin10 = breakdown.items.find((i) => i.weightGrams === 10);
      const coin8 = breakdown.items.find((i) => i.weightGrams === 8);

      expect(bar100?.quantity).toBe(1);
      expect(coin10?.quantity).toBe(1);
      expect(coin8?.quantity).toBe(1);

      // Total premium: 1800 + 500 + 450 = 2750
      expect(breakdown.totalPremiumAmount).toBe(2750);
      // Pure metal: 118 * 8000 = 944,000
      expect(breakdown.metalTotalAmount).toBe(944000);
      // Grand total: 944,000 + 2750 = 946,750
      expect(breakdown.grandTotalAmount).toBe(946750);
    });

    it("converts customer budget (₹9,50,000) to required weight and allocates vault units with unspent change refund", async () => {
      // Customer has budget ₹9,50,000 at ₹8,000/g
      // Equivalent weight: 950000 / 8000 = 118.75g
      // Allocation: 100g Bar + 10g Coin + 8g Guinea = 118g allocated (remainder 0.75g)
      const res = await calculateDenominationBreakdown(
        950000,
        goldMetal.id,
        gold24k.id,
        8000,
        {
          calculationMode: "BUDGET",
          budgetAmount: 950000,
        }
      );

      expect(res.calculationMode).toBe("BUDGET");
      expect(res.budgetAmount).toBe(950000);
      expect(res.targetWeightGrams).toBeCloseTo(118.75, 2);
      expect(res.allocatedWeightGrams).toBe(118);
      expect(res.metalTotalAmount).toBe(944000);
      expect(res.totalPremiumAmount).toBe(2750);
      expect(res.grandTotalAmount).toBe(946750);
      // Unspent balance refund to customer: 950,000 - 946,750 = 3,250
      expect(res.unallocatedBudgetAmount).toBe(3250);
    });

    it("generates a live denomination rate board matrix with base metal + making premium retail values", async () => {
      const board = await getDenominationRateBoard(
        goldMetal.id,
        gold24k.id,
        8000
      );

      expect(board.ratePerGram).toBe(8000);
      expect(board.items.length).toBeGreaterThanOrEqual(3);

      // Check 10g Coin: metal = 10 * 8000 = 80,000, premium = 500, total = 80,500, effRate = 8,050/g
      const coin10 = board.items.find((i) => i.weightGrams === 10);
      expect(coin10).toBeDefined();
      expect(coin10?.metalAmount).toBe(80000);
      expect(coin10?.premiumAmount).toBe(500);
      expect(coin10?.totalAmount).toBe(80500);
      expect(coin10?.effectiveRatePerGram).toBe(8050);

      // Check 100g Bar: metal = 100 * 8000 = 800,000, premium = 1800, total = 801,800, effRate = 8,018/g
      const bar100 = board.items.find((i) => i.weightGrams === 100);
      expect(bar100).toBeDefined();
      expect(bar100?.metalAmount).toBe(800000);
      expect(bar100?.premiumAmount).toBe(1800);
      expect(bar100?.totalAmount).toBe(801800);
      expect(bar100?.effectiveRatePerGram).toBe(8018);
    });
  });

  describe("4. Cashier Counter Closing Reconciliation", () => {
    it("correctly calculates physical cash balance from denomination counts", () => {
      const counts = {
        "500": 10, // 5,000
        "200": 5,  // 1,000
        "100": 10, // 1,000
        "50": 4,   // 200
        "20": 5,   // 100
        "10": 10,  // 100
        coins: 50, // 50
      };

      const physical = calculatePhysicalBalance(counts);
      // 5000 + 1000 + 1000 + 200 + 100 + 100 + 50 = 7450
      expect(physical.toNumber()).toBe(7450);
    });

    it("records a balanced cash closing session", async () => {
      const today = new Date().toISOString().slice(0, 10);
      const counts = {
        "500": 20, // 10,000
        "200": 10, // 2,000
      };

      const closing = await recordCashClosing(testUser.id, "ADMIN", {
        closingDate: today,
        shift: "FULL_DAY",
        openingBalance: "2000.00",
        totalCashReceived: "15000.00",
        totalCashPaid: "5000.00",
        denominations: counts, // 12,000
        notes: "Perfect balance test",
      });

      // Expected = 2000 + 15000 - 5000 = 12000
      // Physical = 12000
      expect(new Decimal(closing.expectedBalance).toNumber()).toBe(12000);
      expect(new Decimal(closing.physicalBalance).toNumber()).toBe(12000);
      expect(new Decimal(closing.difference).toNumber()).toBe(0);
      expect(closing.status).toBe("BALANCED");
    });

    it("records cash closing with shortage variance when drawer is short", async () => {
      const today = new Date().toISOString().slice(0, 10);
      const counts = {
        "500": 18, // 9,000
      };

      const closing = await recordCashClosing(testUser.id, "ADMIN", {
        closingDate: today,
        shift: "EVENING",
        openingBalance: "0.00",
        totalCashReceived: "10000.00",
        totalCashPaid: "0.00",
        denominations: counts, // 9,000
        notes: "Missing 1,000 test",
      });

      // Expected = 10,000
      // Physical = 9,000
      // Difference = -1,000
      expect(new Decimal(closing.expectedBalance).toNumber()).toBe(10000);
      expect(new Decimal(closing.physicalBalance).toNumber()).toBe(9000);
      expect(new Decimal(closing.difference).toNumber()).toBe(-1000);
      expect(closing.status).toBe("SHORTAGE");
    });
  });
});
