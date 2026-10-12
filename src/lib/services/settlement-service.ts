import Decimal from "decimal.js";
import {
  sequelize,
  runTransaction,
  Op,
  PartySettlement,
  Counterparty,
  Metal,
  Purity,
  Payment,
  StockMovement,
  AuditLog,
  User,
  Sale,
  Purchase,
} from "../db";
import { getPartyOutstanding } from "./payment-service";
import { assertMetalActive, assertPurityActive } from "./master-service";
import { assertSufficientStock, UnauthorizedError } from "./stock-service";
import type { Role } from "../db/types";

export interface RecordSettlementInput {
  counterpartyId: string;
  date?: Date | string;
  metalId: string;
  purityId: string;
  metalSettledGrams: number | string;
  metalDirection: "DELIVER_TO_PARTY" | "RECEIVE_FROM_PARTY";
  cashSettledAmount: number | string;
  cashDirection: "PAY_TO_PARTY" | "RECEIVE_FROM_PARTY";
  paymentMode: "CASH" | "BANK_TRANSFER" | "UPI" | "CHEQUE" | "RTGS_NEFT" | "OTHER";
  referenceNumber?: string | null;
  currentMetalBalanceGrams?: number | string;
  currentCashBalance?: number | string;
  notes?: string | null;
}

export interface PartyDualBalanceResult {
  counterparty: {
    id: string;
    name: string;
    type: "SUPPLIER" | "CUSTOMER" | "BOTH";
    phone: string | null;
  };
  cashOutstanding: {
    totalSales: number;
    totalPurchases: number;
    totalReceived: number;
    totalPaid: number;
    customerReceivable: number;
    supplierPayable: number;
    netOutstanding: number;
  };
  metalBalances: Array<{
    metalId: string;
    metalName: string;
    metalCode: string;
    purityId: string;
    purityLabel: string;
    netWeightGrams: number;
  }>;
}

/**
 * Generate sequential settlement number (e.g. SET-20261012-0001)
 */
async function generateSettlementNumber(): Promise<string> {
  const prefix = "SET";
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const likePattern = `${prefix}-${dateStr}-%`;

  const count = await PartySettlement.count({
    where: {
      settlementNumber: {
        [Op.like]: likePattern,
      },
    },
  });

  const seq = String(count + 1).padStart(4, "0");
  return `${prefix}-${dateStr}-${seq}`;
}

/**
 * Derives live dual balances (Cash & Metal positions) for a party
 */
export async function getPartyDualBalance(counterpartyId: string): Promise<PartyDualBalanceResult> {
  const party = await Counterparty.findByPk(counterpartyId);
  if (!party) throw new Error("Counterparty not found");

  // 1. Fetch cash balances via payment service
  const cashSummary = await getPartyOutstanding(counterpartyId);

  // 2. Fetch all metals & purities
  const metals = await Metal.findAll({
    include: [{ model: Purity, as: "purities" }],
  });

  // 3. Compute net metal balances from Sales, Purchases, and Settlements
  const [sales, purchases, settlements] = await Promise.all([
    Sale.findAll({
      where: { counterpartyId, status: "POSTED" },
      attributes: ["metalId", "purityId", "weightGrams"],
    }),
    Purchase.findAll({
      where: { counterpartyId, status: "POSTED" },
      attributes: ["metalId", "purityId", "weightGrams"],
    }),
    PartySettlement.findAll({
      where: { counterpartyId, status: "POSTED" },
      attributes: ["metalId", "purityId", "metalSettledGrams", "metalDirection"],
    }),
  ]);

  const metalBalances: PartyDualBalanceResult["metalBalances"] = [];

  for (const m of metals) {
    const purities = (m as any).purities as Purity[] | undefined;
    if (!purities) continue;

    for (const p of purities) {
      let netMetal = new Decimal(0);

      // Add metal from sales (customer commitment/delivery)
      sales
        .filter((s) => s.metalId === m.id && s.purityId === p.id)
        .forEach((s) => {
          netMetal = netMetal.plus(new Decimal(s.weightGrams.toString()));
        });

      // Subtract metal from purchases (supplier supply)
      purchases
        .filter((pr) => pr.metalId === m.id && pr.purityId === p.id)
        .forEach((pr) => {
          netMetal = netMetal.minus(new Decimal(pr.weightGrams.toString()));
        });

      // Factor in dual settlements
      settlements
        .filter((st) => st.metalId === m.id && st.purityId === p.id)
        .forEach((st) => {
          const w = new Decimal(st.metalSettledGrams.toString());
          if (st.metalDirection === "DELIVER_TO_PARTY") {
            netMetal = netMetal.minus(w);
          } else {
            netMetal = netMetal.plus(w);
          }
        });

      // Include if non-zero or standard 24K gold / 999 silver
      const isDefaultPurity =
        (p.label && p.label.includes("24")) ||
        Number(p.fineness || 0) >= 0.99;

      if (!netMetal.isZero() || isDefaultPurity) {
        metalBalances.push({
          metalId: m.id,
          metalName: m.name,
          metalCode: m.code,
          purityId: p.id,
          purityLabel: p.label || "",
          netWeightGrams: netMetal.toNumber(),
        });
      }
    }
  }

  return {
    counterparty: {
      id: party.id,
      name: party.name,
      type: party.type,
      phone: party.phone || null,
    },
    cashOutstanding: {
      totalSales: cashSummary.totalSalesAmount.toNumber(),
      totalPurchases: cashSummary.totalPurchasesAmount.toNumber(),
      totalReceived: cashSummary.totalPaymentsReceived.toNumber(),
      totalPaid: cashSummary.totalPaymentsMade.toNumber(),
      customerReceivable: cashSummary.customerReceivableOutstanding.toNumber(),
      supplierPayable: cashSummary.supplierPayableOutstanding.toNumber(),
      netOutstanding: cashSummary.netOutstanding.toNumber(),
    },
    metalBalances,
  };
}

/**
 * Record a combined Metal + Cash Dual Settlement
 */
export async function recordPartySettlement(
  actorId: string,
  actorRole: Role,
  input: RecordSettlementInput
): Promise<PartySettlement> {
  const metalSettledDec = new Decimal(input.metalSettledGrams || 0);
  const cashSettledDec = new Decimal(input.cashSettledAmount || 0);

  if (metalSettledDec.lte(0) && cashSettledDec.lte(0)) {
    throw new Error("Settlement must include either metal weight or cash amount greater than zero");
  }

  return await runTransaction(async (t) => {
    // 1. Verify party, metal, and purity
    const party = await Counterparty.findByPk(input.counterpartyId, { transaction: t });
    if (!party) throw new Error("Counterparty not found");

    await assertMetalActive(t, input.metalId);
    await assertPurityActive(t, input.purityId, input.metalId);

    // 2. Compute pre-balances
    let preMetalDec: Decimal;
    if (input.currentMetalBalanceGrams !== undefined && input.currentMetalBalanceGrams !== "") {
      preMetalDec = new Decimal(input.currentMetalBalanceGrams);
    } else {
      // Derive current metal
      const currentDual = await getPartyDualBalance(input.counterpartyId);
      const match = currentDual.metalBalances.find(
        (b) => b.metalId === input.metalId && b.purityId === input.purityId
      );
      preMetalDec = new Decimal(match ? match.netWeightGrams : 0);
    }

    let preCashDec: Decimal;
    if (input.currentCashBalance !== undefined && input.currentCashBalance !== "") {
      preCashDec = new Decimal(input.currentCashBalance);
    } else {
      const currentCash = await getPartyOutstanding(input.counterpartyId);
      preCashDec = currentCash.netOutstanding;
    }

    // 3. Compute post-balances
    // Metal remaining = preMetal - metalSettled (if reducing party metal) or + metalSettled
    const postMetalDec =
      input.metalDirection === "DELIVER_TO_PARTY"
        ? preMetalDec.minus(metalSettledDec)
        : preMetalDec.plus(metalSettledDec);

    // Cash remaining = preCash - cashSettled (if receiving) or + cashSettled (if paying)
    const postCashDec =
      input.cashDirection === "RECEIVE_FROM_PARTY"
        ? preCashDec.minus(cashSettledDec)
        : preCashDec.plus(cashSettledDec);

    const settlementNumber = await generateSettlementNumber();

    // 4. If cash is settled, create linked Payment record
    let linkedPayment: Payment | null = null;
    if (cashSettledDec.gt(0)) {
      const paymentType =
        input.cashDirection === "RECEIVE_FROM_PARTY" ? "PAYMENT_RECEIVED" : "PAYMENT_MADE";

      linkedPayment = await Payment.create(
        {
          paymentNumber: `PAY-${settlementNumber}`,
          type: paymentType,
          counterpartyId: input.counterpartyId,
          partyName: party.name,
          date: input.date ? new Date(input.date) : new Date(),
          amount: cashSettledDec.toFixed(2),
          paymentMode: input.paymentMode,
          referenceNumber: input.referenceNumber?.trim() || `Settlement ${settlementNumber}`,
          status: "POSTED",
          notes: `Dual Settlement ${settlementNumber}: ${input.notes || ""}`.trim(),
          createdById: actorId,
        },
        { transaction: t }
      );
    }

    // 5. If metal is settled, update shop stock movement
    let linkedStockMovement: StockMovement | null = null;
    if (metalSettledDec.gt(0)) {
      if (input.metalDirection === "DELIVER_TO_PARTY") {
        // Vault delivers metal: verify sufficient shop vault stock
        await assertSufficientStock(t, input.metalId, input.purityId, metalSettledDec);

        linkedStockMovement = await StockMovement.create(
          {
            metalId: input.metalId,
            purityId: input.purityId,
            movementType: "ADJUSTMENT_DECREASE",
            weightGrams: metalSettledDec.negated().toFixed(4),
            createdById: actorId,
            reference: `Settlement ${settlementNumber} (Delivered ${metalSettledDec.toFixed(4)}g to ${party.name})`,
          },
          { transaction: t }
        );
      } else {
        // Vault receives metal from party: increases shop vault stock
        linkedStockMovement = await StockMovement.create(
          {
            metalId: input.metalId,
            purityId: input.purityId,
            movementType: "ADJUSTMENT_INCREASE",
            weightGrams: metalSettledDec.toFixed(4),
            createdById: actorId,
            reference: `Settlement ${settlementNumber} (Received ${metalSettledDec.toFixed(4)}g from ${party.name})`,
          },
          { transaction: t }
        );
      }
    }

    // 6. Create PartySettlement record
    const settlement = await PartySettlement.create(
      {
        settlementNumber,
        counterpartyId: input.counterpartyId,
        date: input.date ? new Date(input.date) : new Date(),
        metalId: input.metalId,
        purityId: input.purityId,
        metalSettledGrams: metalSettledDec.toFixed(4),
        metalDirection: input.metalDirection,
        cashSettledAmount: cashSettledDec.toFixed(2),
        cashDirection: input.cashDirection,
        paymentMode: input.paymentMode,
        referenceNumber: input.referenceNumber?.trim() || null,
        preMetalBalanceGrams: preMetalDec.toFixed(4),
        postMetalBalanceGrams: postMetalDec.toFixed(4),
        preCashBalance: preCashDec.toFixed(2),
        postCashBalance: postCashDec.toFixed(2),
        linkedPaymentId: linkedPayment ? linkedPayment.id : null,
        linkedStockMovementId: linkedStockMovement ? linkedStockMovement.id : null,
        status: "POSTED",
        notes: input.notes?.trim() || null,
        createdById: actorId,
      },
      { transaction: t }
    );

    // 7. Write audit log
    await AuditLog.create(
      {
        action: "CREATE",
        entityType: "PARTY_SETTLEMENT",
        entityId: settlement.id,
        actorId,
        metalId: input.metalId,
        purityId: input.purityId,
        nextState: {
          settlementNumber,
          party: party.name,
          metalSettled: metalSettledDec.toFixed(4),
          metalDirection: input.metalDirection,
          cashSettled: cashSettledDec.toFixed(2),
          cashDirection: input.cashDirection,
          postMetal: postMetalDec.toFixed(4),
          postCash: postCashDec.toFixed(2),
        },
        description: `Posted dual settlement ${settlementNumber} for ${party.name}: Settled ${metalSettledDec.toFixed(4)}g & ₹${cashSettledDec.toFixed(2)}`,
      },
      { transaction: t }
    );

    return settlement;
  });
}

/**
 * Cancel / Reverse a posted dual settlement
 */
export async function cancelPartySettlement(
  actorId: string,
  actorRole: Role,
  settlementId: string,
  reason: string
): Promise<PartySettlement> {
  if (actorRole !== "ADMIN") {
    throw new UnauthorizedError("cancel settlement");
  }

  return await runTransaction(async (t) => {
    const settlement = await PartySettlement.findByPk(settlementId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!settlement) throw new Error("Settlement not found");
    if (settlement.status === "CANCELLED") {
      throw new Error("Settlement is already cancelled");
    }

    const prevState = { ...settlement.toJSON() };

    // 1. Cancel linked payment if exists
    if (settlement.linkedPaymentId) {
      const payment = await Payment.findByPk(settlement.linkedPaymentId, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (payment && payment.status === "POSTED") {
        payment.status = "CANCELLED";
        payment.notes = `${payment.notes || ""} [Cancelled with Settlement reversal: ${reason}]`.trim();
        await payment.save({ transaction: t });
      }
    }

    // 2. Reverse linked stock movement if exists
    if (settlement.linkedStockMovementId) {
      const metalSettledDec = new Decimal(settlement.metalSettledGrams);
      if (settlement.metalDirection === "DELIVER_TO_PARTY") {
        // Was decreased (-); restore vault by increasing (+)
        await StockMovement.create(
          {
            metalId: settlement.metalId,
            purityId: settlement.purityId,
            movementType: "ADJUSTMENT_INCREASE",
            weightGrams: metalSettledDec.toFixed(4),
            createdById: actorId,
            reference: `Reversal of Settlement ${settlement.settlementNumber}: ${reason}`,
          },
          { transaction: t }
        );
      } else {
        // Was increased (+); reverse by decreasing (-)
        await assertSufficientStock(t, settlement.metalId, settlement.purityId, metalSettledDec);
        await StockMovement.create(
          {
            metalId: settlement.metalId,
            purityId: settlement.purityId,
            movementType: "ADJUSTMENT_DECREASE",
            weightGrams: metalSettledDec.negated().toFixed(4),
            createdById: actorId,
            reference: `Reversal of Settlement ${settlement.settlementNumber}: ${reason}`,
          },
          { transaction: t }
        );
      }
    }

    // 3. Mark settlement as CANCELLED
    settlement.status = "CANCELLED";
    settlement.notes = `${settlement.notes || ""} [Cancelled: ${reason}]`.trim();
    await settlement.save({ transaction: t });

    // 4. Audit Log
    await AuditLog.create(
      {
        action: "CANCEL",
        entityType: "PARTY_SETTLEMENT",
        entityId: settlement.id,
        actorId,
        metalId: settlement.metalId,
        purityId: settlement.purityId,
        prevState,
        nextState: { ...settlement.toJSON() },
        description: `Cancelled dual settlement ${settlement.settlementNumber}: ${reason}`,
      },
      { transaction: t }
    );

    return settlement;
  });
}

/**
 * List settlements with filtering and pagination
 */
export async function listPartySettlements(filters?: {
  counterpartyId?: string;
  status?: "ALL" | "POSTED" | "CANCELLED";
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const where: any = {};

  if (filters?.counterpartyId) where.counterpartyId = filters.counterpartyId;
  if (filters?.status && filters.status !== "ALL") where.status = filters.status;

  if (filters?.search && filters.search.trim()) {
    const q = `%${filters.search.trim()}%`;
    where[Op.or] = [
      { settlementNumber: { [Op.like]: q } },
      { referenceNumber: { [Op.like]: q } },
      { notes: { [Op.like]: q } },
    ];
  }

  const { rows, count } = await PartySettlement.findAndCountAll({
    where,
    include: [
      { model: Counterparty, as: "counterparty", attributes: ["id", "name", "phone", "type"] },
      { model: Metal, as: "metal", attributes: ["id", "name", "code"] },
      { model: Purity, as: "purity", attributes: ["id", "name", "label", "purityPercentage"] },
      { model: Payment, as: "payment", attributes: ["id", "paymentNumber", "amount", "status"] },
      { model: User, as: "createdBy", attributes: ["id", "name", "email"] },
    ],
    order: [["date", "DESC"], ["createdAt", "DESC"]],
    limit: filters?.limit || 50,
    offset: filters?.offset || 0,
  });

  return { settlements: rows, totalCount: count };
}
