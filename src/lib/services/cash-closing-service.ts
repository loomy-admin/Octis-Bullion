import Decimal from "decimal.js";
import { Op } from "sequelize";
import {
  CashClosing,
  Payment,
  Sale,
  Purchase,
  User,
  runTransaction,
} from "@/lib/db";
import { writeAudit } from "./audit-service";
import type { Role } from "@/lib/db/types";

export interface CashDrawerSummary {
  closingDate: string;
  openingBalance: number;
  totalCashReceived: number;
  totalCashPaid: number;
  expectedBalance: number;
  paymentReceiptsCount: number;
  paymentDisbursementsCount: number;
  cashSalesCount: number;
  cashPurchasesCount: number;
}

export interface RecordCashClosingServiceInput {
  closingDate: string;
  shift: "MORNING" | "EVENING" | "FULL_DAY";
  openingBalance?: string | number;
  totalCashReceived: string | number;
  totalCashPaid: string | number;
  denominations: Record<string, number>;
  notes?: string;
}

/**
 * Calculates expected drawer cash for a specific date based on opening balance + transactions
 */
export async function getCashSummaryForDate(dateStr: string): Promise<CashDrawerSummary> {
  const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
  const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

  // Find most recent previous cash closing to default opening balance
  const previousClosing = await CashClosing.findOne({
    where: {
      closingDate: {
        [Op.lt]: dateStr,
      },
    },
    order: [["closingDate", "DESC"], ["createdAt", "DESC"]],
  });

  const openingBal = previousClosing
    ? new Decimal(previousClosing.physicalBalance).toNumber()
    : 0;

  // Query cash payments received
  const paymentsReceived = await Payment.findAll({
    where: {
      date: {
        [Op.between]: [startOfDay, endOfDay],
      },
      paymentMode: "CASH",
      type: "PAYMENT_RECEIVED",
      status: "POSTED",
    },
  });

  // Query cash payments made
  const paymentsMade = await Payment.findAll({
    where: {
      date: {
        [Op.between]: [startOfDay, endOfDay],
      },
      paymentMode: "CASH",
      type: "PAYMENT_MADE",
      status: "POSTED",
    },
  });

  const totalReceipts = paymentsReceived.reduce(
    (sum, p) => sum.plus(new Decimal(p.amount)),
    new Decimal(0)
  );

  const totalDisbursements = paymentsMade.reduce(
    (sum, p) => sum.plus(new Decimal(p.amount)),
    new Decimal(0)
  );

  // Check direct cash sales posted on that date that might not be recorded via Payment table
  const directCashSales = await Sale.findAll({
    where: {
      date: {
        [Op.between]: [startOfDay, endOfDay],
      },
      paymentMode: "CASH",
      status: "POSTED",
    },
  });

  // Check direct cash purchases posted on that date
  const directCashPurchases = await Purchase.findAll({
    where: {
      date: {
        [Op.between]: [startOfDay, endOfDay],
      },
      paymentMode: "CASH",
      status: "POSTED",
    },
  });

  const expected = new Decimal(openingBal)
    .plus(totalReceipts)
    .minus(totalDisbursements)
    .toNumber();

  return {
    closingDate: dateStr,
    openingBalance: openingBal,
    totalCashReceived: totalReceipts.toNumber(),
    totalCashPaid: totalDisbursements.toNumber(),
    expectedBalance: expected,
    paymentReceiptsCount: paymentsReceived.length,
    paymentDisbursementsCount: paymentsMade.length,
    cashSalesCount: directCashSales.length,
    cashPurchasesCount: directCashPurchases.length,
  };
}

/**
 * Computes physical balance from currency denomination count map
 */
export function calculatePhysicalBalance(denominations: Record<string, number>): Decimal {
  let total = new Decimal(0);

  for (const [key, count] of Object.entries(denominations)) {
    if (!count || count <= 0) continue;
    if (key.toLowerCase() === "coins") {
      total = total.plus(new Decimal(count));
      continue;
    }
    const faceValue = parseFloat(key);
    if (!isNaN(faceValue) && faceValue > 0) {
      total = total.plus(new Decimal(faceValue).times(count));
    }
  }

  return total;
}

/**
 * Record a cashier counter closing reconciliation
 */
export async function recordCashClosing(
  actorId: string,
  _actorRole: Role,
  input: RecordCashClosingServiceInput
): Promise<CashClosing> {
  const openingDec = new Decimal(input.openingBalance || 0);
  const receivedDec = new Decimal(input.totalCashReceived);
  const paidDec = new Decimal(input.totalCashPaid);

  const expectedDec = openingDec.plus(receivedDec).minus(paidDec);
  const physicalDec = calculatePhysicalBalance(input.denominations);
  const differenceDec = physicalDec.minus(expectedDec);

  let status: "BALANCED" | "EXCESS" | "SHORTAGE" = "BALANCED";
  if (differenceDec.gt(0)) {
    status = "EXCESS";
  } else if (differenceDec.lt(0)) {
    status = "SHORTAGE";
  }

  return runTransaction(async (t) => {
    const closing = await CashClosing.create(
      {
        closingDate: new Date(input.closingDate),
        shift: input.shift,
        openingBalance: openingDec.toFixed(2),
        totalCashReceived: receivedDec.toFixed(2),
        totalCashPaid: paidDec.toFixed(2),
        expectedBalance: expectedDec.toFixed(2),
        physicalBalance: physicalDec.toFixed(2),
        difference: differenceDec.toFixed(2),
        status,
        denominations: input.denominations,
        notes: input.notes?.trim() || null,
        closedById: actorId,
      },
      { transaction: t }
    );

    await writeAudit(t, {
      action: "CREATE",
      entityType: "CASH_CLOSING",
      entityId: closing.id,
      actorId,
      nextState: {
        closingDate: input.closingDate,
        shift: input.shift,
        expected: expectedDec.toFixed(2),
        physical: physicalDec.toFixed(2),
        difference: differenceDec.toFixed(2),
        status,
      },
      description: `Cash Closing recorded for ${input.closingDate} (${input.shift}): Expected ₹${expectedDec.toFixed(2)}, Physical ₹${physicalDec.toFixed(2)}, Difference ₹${differenceDec.toFixed(2)} [${status}]`,
    });

    return closing;
  });
}

/**
 * List recent cash closings
 */
export async function listCashClosings(limit = 30) {
  return CashClosing.findAll({
    order: [["closingDate", "DESC"], ["createdAt", "DESC"]],
    limit,
    include: [
      {
        model: User,
        as: "closedBy",
        attributes: ["id", "name", "email"],
      },
    ],
  });
}
