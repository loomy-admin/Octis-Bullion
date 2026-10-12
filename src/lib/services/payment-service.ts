import Decimal from "decimal.js";
import {
  sequelize,
  runTransaction,
  Op,
  Payment,
  Counterparty,
  Purchase,
  Sale,
  AuditLog,
  User,
} from "../db";
import type { CashDenominationBreakdown } from "../db/models/Payment";

export interface CreatePaymentInput {
  type: "PAYMENT_MADE" | "PAYMENT_RECEIVED";
  counterpartyId: string;
  amount: number | string;
  paymentMode: "CASH" | "BANK_TRANSFER" | "UPI" | "CHEQUE" | "RTGS_NEFT" | "OTHER";
  date?: Date | string;
  referenceNumber?: string | null;
  linkedPurchaseId?: string | null;
  linkedSaleId?: string | null;
  cashDenominations?: CashDenominationBreakdown | null;
  notes?: string | null;
  createdById: string;
}

export interface PaymentFilterInput {
  counterpartyId?: string;
  type?: "ALL" | "PAYMENT_MADE" | "PAYMENT_RECEIVED";
  status?: "ALL" | "POSTED" | "CANCELLED";
  paymentMode?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface PartyOutstandingSummary {
  counterparty: {
    id: string;
    name: string;
    type: "SUPPLIER" | "CUSTOMER" | "BOTH";
    phone: string | null;
  };
  totalPurchasesAmount: Decimal;
  totalSalesAmount: Decimal;
  totalPaymentsMade: Decimal;
  totalPaymentsReceived: Decimal;
  supplierPayableOutstanding: Decimal; // Shop owes supplier
  customerReceivableOutstanding: Decimal; // Customer owes shop
  netOutstanding: Decimal; // Positive = Customer owes shop; Negative = Shop owes party
  recentTransactions: Array<{
    id: string;
    date: Date;
    type: "PURCHASE" | "SALE" | "PAYMENT_MADE" | "PAYMENT_RECEIVED";
    reference: string;
    amount: Decimal;
    status: string;
  }>;
}

/**
 * Validates that physical cash denomination breakdown matches total amount.
 */
export function calculateCashDenominationsTotal(denoms?: CashDenominationBreakdown | null): Decimal {
  if (!denoms) return new Decimal(0);
  let sum = new Decimal(0);
  if (denoms[500]) sum = sum.plus(new Decimal(denoms[500]).times(500));
  if (denoms[200]) sum = sum.plus(new Decimal(denoms[200]).times(200));
  if (denoms[100]) sum = sum.plus(new Decimal(denoms[100]).times(100));
  if (denoms[50]) sum = sum.plus(new Decimal(denoms[50]).times(50));
  if (denoms[20]) sum = sum.plus(new Decimal(denoms[20]).times(20));
  if (denoms[10]) sum = sum.plus(new Decimal(denoms[10]).times(10));
  if (denoms.coins) sum = sum.plus(new Decimal(denoms.coins));
  return sum;
}

/**
 * Generates sequential unique payment number
 */
async function generatePaymentNumber(type: "PAYMENT_MADE" | "PAYMENT_RECEIVED"): Promise<string> {
  const prefix = type === "PAYMENT_RECEIVED" ? "REC" : "PAY";
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const likePattern = `${prefix}-${dateStr}-%`;

  const count = await Payment.count({
    where: {
      paymentNumber: {
        [Op.like]: likePattern,
      },
    },
  });

  const seq = String(count + 1).padStart(4, "0");
  return `${prefix}-${dateStr}-${seq}`;
}

/**
 * Record a payment or receipt transaction
 */
export async function createPayment(input: CreatePaymentInput): Promise<Payment> {
  const amountDec = new Decimal(input.amount);
  if (amountDec.lessThanOrEqualTo(0)) {
    throw new Error("Payment amount must be greater than zero");
  }

  // Validate cash denomination if physical cash
  if (input.paymentMode === "CASH" && input.cashDenominations) {
    const denomTotal = calculateCashDenominationsTotal(input.cashDenominations);
    if (!denomTotal.equals(amountDec)) {
      throw new Error(
        `Physical cash denominations total (₹${denomTotal.toString()}) does not match payment amount (₹${amountDec.toString()})`
      );
    }
  }

  return await runTransaction(async (t) => {
    const counterparty = await Counterparty.findByPk(input.counterpartyId, { transaction: t });
    if (!counterparty) {
      throw new Error("Counterparty not found");
    }

    if (input.linkedPurchaseId) {
      const purchase = await Purchase.findByPk(input.linkedPurchaseId, { transaction: t });
      if (!purchase) throw new Error("Linked purchase invoice not found");
    }

    if (input.linkedSaleId) {
      const sale = await Sale.findByPk(input.linkedSaleId, { transaction: t });
      if (!sale) throw new Error("Linked sale invoice not found");
    }

    const paymentNumber = await generatePaymentNumber(input.type);

    const payment = await Payment.create(
      {
        paymentNumber,
        type: input.type,
        counterpartyId: input.counterpartyId,
        partyName: counterparty.name,
        date: input.date ? new Date(input.date) : new Date(),
        amount: amountDec.toFixed(2),
        paymentMode: input.paymentMode,
        referenceNumber: input.referenceNumber?.trim() || null,
        linkedPurchaseId: input.linkedPurchaseId || null,
        linkedSaleId: input.linkedSaleId || null,
        cashDenominations: input.cashDenominations || null,
        status: "POSTED",
        notes: input.notes?.trim() || null,
        createdById: input.createdById,
      },
      { transaction: t }
    );

    await AuditLog.create(
      {
        entityType: "PAYMENT",
        entityId: payment.id,
        action: "CREATE",
        actorId: input.createdById,
        nextState: payment.toJSON(),
      },
      { transaction: t }
    );

    return payment;
  });
}

/**
 * Reverses a posted payment non-destructively
 */
export async function cancelPayment(
  paymentId: string,
  cancelledById: string,
  reason: string
): Promise<Payment> {
  if (!reason || !reason.trim()) {
    throw new Error("Cancellation reason is mandatory");
  }

  return await runTransaction(async (t) => {
    const payment = await Payment.findByPk(paymentId, { transaction: t });
    if (!payment) throw new Error("Payment record not found");

    if (payment.status === "CANCELLED") {
      throw new Error("Payment is already cancelled");
    }

    const beforeState = payment.toJSON();
    const now = new Date();

    await payment.update(
      {
        status: "CANCELLED",
        cancelledAt: now,
        cancelledById,
        cancelReason: reason.trim(),
      },
      { transaction: t }
    );

    await AuditLog.create(
      {
        entityType: "PAYMENT",
        entityId: payment.id,
        action: "CANCEL",
        actorId: cancelledById,
        prevState: beforeState,
        nextState: payment.toJSON(),
      },
      { transaction: t }
    );

    return payment;
  });
}

/**
 * List payment records with filters
 */
export async function getPaymentsList(filters: PaymentFilterInput = {}) {
  const where: any = {};

  if (filters.counterpartyId) {
    where.counterpartyId = filters.counterpartyId;
  }

  if (filters.type && filters.type !== "ALL") {
    where.type = filters.type;
  }

  if (filters.status && filters.status !== "ALL") {
    where.status = filters.status;
  }

  if (filters.paymentMode) {
    where.paymentMode = filters.paymentMode;
  }

  if (filters.dateFrom || filters.dateTo) {
    where.date = {};
    if (filters.dateFrom) where.date[Op.gte] = new Date(`${filters.dateFrom}T00:00:00.000Z`);
    if (filters.dateTo) where.date[Op.lte] = new Date(`${filters.dateTo}T23:59:59.999Z`);
  }

  if (filters.search && filters.search.trim()) {
    const q = `%${filters.search.trim()}%`;
    where[Op.or] = [
      { paymentNumber: { [Op.like]: q } },
      { partyName: { [Op.like]: q } },
      { referenceNumber: { [Op.like]: q } },
      { notes: { [Op.like]: q } },
    ];
  }

  const { rows, count } = await Payment.findAndCountAll({
    where,
    include: [
      { model: Counterparty, as: "counterparty", attributes: ["id", "name", "phone", "type"] },
      { model: Purchase, as: "purchase", attributes: ["id", "invoiceNumber", "totalAmount"] },
      { model: Sale, as: "sale", attributes: ["id", "invoiceNumber", "totalAmount"] },
      { model: User, as: "createdBy", attributes: ["id", "name", "email"] },
    ],
    order: [["date", "DESC"], ["createdAt", "DESC"]],
    limit: filters.limit || 50,
    offset: filters.offset || 0,
  });

  return { payments: rows, totalCount: count };
}

/**
 * Calculates live party outstanding balance and chronological ledger
 */
export async function getPartyOutstanding(counterpartyId: string): Promise<PartyOutstandingSummary> {
  const counterparty = await Counterparty.findByPk(counterpartyId);
  if (!counterparty) {
    throw new Error("Counterparty not found");
  }

  // 1. Fetch all POSTED purchases for supplier
  const purchases = await Purchase.findAll({
    where: { counterpartyId, status: "POSTED" },
    attributes: ["id", "invoiceNumber", "date", "totalAmount", "status"],
    order: [["date", "ASC"]],
  });

  // 2. Fetch all POSTED sales for customer
  const sales = await Sale.findAll({
    where: { counterpartyId, status: "POSTED" },
    attributes: ["id", "invoiceNumber", "date", "totalAmount", "status"],
    order: [["date", "ASC"]],
  });

  // 3. Fetch all POSTED payments made to supplier
  const paymentsMade = await Payment.findAll({
    where: { counterpartyId, type: "PAYMENT_MADE", status: "POSTED" },
    attributes: ["id", "paymentNumber", "date", "amount", "status"],
    order: [["date", "ASC"]],
  });

  // 4. Fetch all POSTED payments received from customer
  const paymentsReceived = await Payment.findAll({
    where: { counterpartyId, type: "PAYMENT_RECEIVED", status: "POSTED" },
    attributes: ["id", "paymentNumber", "date", "amount", "status"],
    order: [["date", "ASC"]],
  });

  // Computations
  let totalPurchasesAmount = new Decimal(0);
  purchases.forEach((p) => {
    totalPurchasesAmount = totalPurchasesAmount.plus(new Decimal(p.totalAmount.toString()));
  });

  let totalSalesAmount = new Decimal(0);
  sales.forEach((s) => {
    totalSalesAmount = totalSalesAmount.plus(new Decimal(s.totalAmount.toString()));
  });

  let totalPaymentsMade = new Decimal(0);
  paymentsMade.forEach((p) => {
    totalPaymentsMade = totalPaymentsMade.plus(new Decimal(p.amount.toString()));
  });

  let totalPaymentsReceived = new Decimal(0);
  paymentsReceived.forEach((p) => {
    totalPaymentsReceived = totalPaymentsReceived.plus(new Decimal(p.amount.toString()));
  });

  const supplierPayableOutstanding = totalPurchasesAmount.minus(totalPaymentsMade);
  const customerReceivableOutstanding = totalSalesAmount.minus(totalPaymentsReceived);

  // Net: (Sales + Payments Made) - (Purchases + Payments Received)
  const netOutstanding = customerReceivableOutstanding.minus(supplierPayableOutstanding);

  // Combine chronological history
  const recentTransactions: Array<{
    id: string;
    date: Date;
    type: "PURCHASE" | "SALE" | "PAYMENT_MADE" | "PAYMENT_RECEIVED";
    reference: string;
    amount: Decimal;
    status: string;
  }> = [];

  purchases.forEach((p) => {
    recentTransactions.push({
      id: p.id,
      date: p.date,
      type: "PURCHASE",
      reference: p.invoiceNumber,
      amount: new Decimal(p.totalAmount.toString()),
      status: p.status,
    });
  });

  sales.forEach((s) => {
    recentTransactions.push({
      id: s.id,
      date: s.date,
      type: "SALE",
      reference: s.invoiceNumber,
      amount: new Decimal(s.totalAmount.toString()),
      status: s.status,
    });
  });

  paymentsMade.forEach((p) => {
    recentTransactions.push({
      id: p.id,
      date: p.date,
      type: "PAYMENT_MADE",
      reference: p.paymentNumber,
      amount: new Decimal(p.amount.toString()),
      status: p.status,
    });
  });

  paymentsReceived.forEach((p) => {
    recentTransactions.push({
      id: p.id,
      date: p.date,
      type: "PAYMENT_RECEIVED",
      reference: p.paymentNumber,
      amount: new Decimal(p.amount.toString()),
      status: p.status,
    });
  });

  // Sort descending by date
  recentTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    counterparty: {
      id: counterparty.id,
      name: counterparty.name,
      type: counterparty.type,
      phone: counterparty.phone,
    },
    totalPurchasesAmount,
    totalSalesAmount,
    totalPaymentsMade,
    totalPaymentsReceived,
    supplierPayableOutstanding,
    customerReceivableOutstanding,
    netOutstanding,
    recentTransactions,
  };
}
