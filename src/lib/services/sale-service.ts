/**
 * SaleService — B1
 *
 * Handles DRAFT → POSTED lifecycle for sales.
 * Posting is atomic: Sale row + StockMovement row in one transaction.
 * Stock is checked INSIDE the transaction before committing.
 *
 * CRITICAL: Sale posting NEVER allows stock to go negative.
 * The stock check and the stock movement write are in the SAME transaction.
 *
 * Stock effect of POST:  -weightGrams  (SALE movement, negative)
 * Stock effect of CANCEL: +weightGrams (SALE_CANCEL movement, positive)
 *
 * Financial precision: all weight, rate, and amount fields use Decimal.
 * The totalAmount is always server-derived: weightGrams × ratePerGram.
 */

import Decimal from "decimal.js";
import {
  Sale,
  StockMovement,
  Metal,
  Purity,
  Counterparty,
  User,
  runTransaction,
} from "@/lib/db";
import { writeAudit } from "./audit-service";
import { assertMetalActive, assertPurityActive } from "./master-service";
import {
  assertSufficientStock,
  UnauthorizedError,
} from "./stock-service";
import type { Role, PaymentMode, TransactionStatus } from "@/lib/db/types";

// ---------------------------------------------------------------------------
// Input Types
// ---------------------------------------------------------------------------

export interface CreateSaleInput {
  invoiceNumber: string;
  date: Date;
  buyerName: string;
  buyerContact?: string;
  counterpartyId?: string;
  metalId: string;
  purityId: string;
  /** Passed as string to preserve Decimal precision */
  weightGrams: string;
  /** Passed as string to preserve Decimal precision */
  ratePerGram: string;
  paymentMode: PaymentMode;
  notes?: string;
  rateType?: "FIXED" | "UNFIXED";
  provisionalRate?: string;
}

// ---------------------------------------------------------------------------
// Create Sale (DRAFT)
// ---------------------------------------------------------------------------

export async function createSale(
  actorId: string,
  _actorRole: Role,
  input: CreateSaleInput
) {
  const isUnfixed = input.rateType === "UNFIXED";
  const weight = new Decimal(input.weightGrams);
  const rate = input.ratePerGram ? new Decimal(input.ratePerGram) : new Decimal(0);

  if (weight.lessThanOrEqualTo(0)) throw new Error("Weight must be positive.");
  if (!isUnfixed && rate.lessThanOrEqualTo(0)) throw new Error("Rate must be positive.");

  const total = weight.times(rate).toDecimalPlaces(2);

  return runTransaction(async (t) => {
    await assertMetalActive(t, input.metalId);
    await assertPurityActive(t, input.purityId, input.metalId);

    const sale = await Sale.create(
      {
        invoiceNumber: input.invoiceNumber,
        date: input.date,
        buyerName: input.buyerName,
        buyerContact: input.buyerContact || null,
        counterpartyId: input.counterpartyId || null,
        metalId: input.metalId,
        purityId: input.purityId,
        weightGrams: weight.toString(),
        ratePerGram: rate.toString(),
        totalAmount: total.toString(),
        paymentMode: input.paymentMode,
        notes: input.notes || null,
        status: "DRAFT",
        rateType: isUnfixed ? "UNFIXED" : "FIXED",
        rateStatus: isUnfixed ? "UNFIXED" : "FIXED",
        provisionalRate: isUnfixed && input.ratePerGram ? input.ratePerGram : null,
        createdById: actorId,
      },
      { transaction: t }
    );

    await writeAudit(t, {
      action: "CREATE",
      entityType: "Sale",
      entityId: sale.id,
      actorId,
      saleId: sale.id,
      metalId: input.metalId,
      purityId: input.purityId,
      nextState: { status: "DRAFT", invoiceNumber: sale.invoiceNumber },
      description: `Sale draft created: ${sale.invoiceNumber}`,
    });

    return sale.get({ plain: true });
  });
}

// ---------------------------------------------------------------------------
// Post Sale (DRAFT → POSTED)
// ---------------------------------------------------------------------------

export async function postSale(
  actorId: string,
  _actorRole: Role,
  saleId: string
) {
  return runTransaction(async (t) => {
    const sale = await Sale.findByPk(saleId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!sale) {
      throw new Error(`Sale ${saleId} not found.`);
    }

    if (sale.status !== "DRAFT") {
      throw new Error(
        `Sale ${saleId} is in status ${sale.status} and cannot be posted.`
      );
    }

    // Validate metal/purity still active
    await assertMetalActive(t, sale.metalId);
    await assertPurityActive(t, sale.purityId, sale.metalId);

    const saleWeight = new Decimal(sale.weightGrams);

    // CRITICAL: Stock check inside the same transaction
    await assertSufficientStock(t, sale.metalId, sale.purityId, saleWeight);

    // 1. Update Sale status
    sale.status = "POSTED";
    await sale.save({ transaction: t });

    // 2. Create append-only StockMovement (negative = stock out)
    await StockMovement.create(
      {
        metalId: sale.metalId,
        purityId: sale.purityId,
        movementType: "SALE",
        weightGrams: saleWeight.negated().toString(), // negative
        saleId: sale.id,
        createdById: actorId,
        reference: `Sale ${sale.invoiceNumber}`,
      },
      { transaction: t }
    );

    // 3. Audit
    await writeAudit(t, {
      action: "POST",
      entityType: "Sale",
      entityId: saleId,
      actorId,
      saleId,
      metalId: sale.metalId,
      purityId: sale.purityId,
      prevState: { status: "DRAFT" },
      nextState: { status: "POSTED" },
      description: `Sale posted: ${sale.invoiceNumber} -${saleWeight.toFixed(4)}g`,
    });

    const reloaded = await Sale.findByPk(saleId, {
      include: [
        { model: Metal, as: "metal" },
        { model: Purity, as: "purity" },
      ],
      transaction: t,
    });

    return reloaded!.get({ plain: true });
  });
}

// ---------------------------------------------------------------------------
// Cancel Sale (POSTED → CANCELLED)
// ---------------------------------------------------------------------------

export async function cancelSale(
  actorId: string,
  actorRole: Role,
  saleId: string,
  reason: string
) {
  if (actorRole !== "ADMIN") {
    throw new UnauthorizedError("cancel sale");
  }
  if (!reason?.trim()) throw new Error("Cancellation reason is required.");

  return runTransaction(async (t) => {
    const sale = await Sale.findByPk(saleId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!sale) {
      throw new Error(`Sale ${saleId} not found.`);
    }

    if (sale.status !== "POSTED") {
      throw new Error(
        `Only POSTED sales can be cancelled. Current status: ${sale.status}`
      );
    }

    // 1. Mark CANCELLED
    sale.status = "CANCELLED";
    sale.cancelReason = reason.trim();
    sale.cancelledAt = new Date();
    await sale.save({ transaction: t });

    // 2. Reversing movement (positive = stock in)
    await StockMovement.create(
      {
        metalId: sale.metalId,
        purityId: sale.purityId,
        movementType: "SALE_CANCEL",
        weightGrams: sale.weightGrams, // positive (returns to stock)
        saleId: sale.id,
        createdById: actorId,
        reference: `Cancel of sale ${sale.invoiceNumber}: ${reason}`,
      },
      { transaction: t }
    );

    // 3. Audit
    await writeAudit(t, {
      action: "CANCEL",
      entityType: "Sale",
      entityId: saleId,
      actorId,
      saleId,
      metalId: sale.metalId,
      purityId: sale.purityId,
      prevState: { status: "POSTED" },
      nextState: { status: "CANCELLED", cancelReason: reason },
      description: `Sale cancelled: ${sale.invoiceNumber}. Reason: ${reason}`,
    });

    return sale.get({ plain: true });
  });
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getSale(id: string) {
  const sale = await Sale.findByPk(id, {
    include: [
      { model: Metal, as: "metal" },
      { model: Purity, as: "purity" },
      { model: Counterparty, as: "counterparty" },
      { model: User, as: "createdBy" },
    ],
  });
  if (!sale) throw new Error(`Sale ${id} not found.`);
  return sale.get({ plain: true });
}

export async function listSales(opts?: {
  metalId?: string;
  purityId?: string;
  status?: TransactionStatus;
}) {
  const where: any = {};
  if (opts?.metalId) where.metalId = opts.metalId;
  if (opts?.purityId) where.purityId = opts.purityId;
  if (opts?.status) where.status = opts.status;

  const sales = await Sale.findAll({
    where,
    include: [
      { model: Metal, as: "metal" },
      { model: Purity, as: "purity" },
      { model: Counterparty, as: "counterparty" },
      { model: User, as: "createdBy", attributes: ["id", "name", "email"] },
      { model: User, as: "fixedBy", attributes: ["id", "name", "email"] },
    ],
    order: [["date", "DESC"]],
  });

  return sales.map((s) => s.get({ plain: true }));
}

// ---------------------------------------------------------------------------
// Fix Rate (UNFIXED → FIXED)
// ---------------------------------------------------------------------------

export async function fixSaleRate(
  actorId: string,
  _actorRole: Role,
  saleId: string,
  fixedRatePerGram: string,
  fixingNotes?: string
) {
  const rate = new Decimal(fixedRatePerGram);
  if (rate.lessThanOrEqualTo(0)) throw new Error("Fixed rate must be positive.");

  return runTransaction(async (t) => {
    const sale = await Sale.findByPk(saleId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!sale) throw new Error(`Sale ${saleId} not found.`);
    if (sale.status === "CANCELLED") {
      throw new Error("Cannot fix rate on a cancelled sale.");
    }
    if (sale.rateStatus === "FIXED") {
      throw new Error(`Rate is already fixed for sale ${sale.invoiceNumber}.`);
    }

    const weight = new Decimal(sale.weightGrams);
    const newTotal = weight.times(rate).toDecimalPlaces(2);
    const oldRate = sale.ratePerGram;

    sale.ratePerGram = rate.toString();
    sale.totalAmount = newTotal.toString();
    sale.rateStatus = "FIXED";
    sale.fixedAt = new Date();
    sale.fixedById = actorId;
    sale.fixingNotes = fixingNotes?.trim() || null;
    await sale.save({ transaction: t });

    await writeAudit(t, {
      action: "UPDATE",
      entityType: "Sale",
      entityId: sale.id,
      actorId,
      saleId: sale.id,
      metalId: sale.metalId,
      purityId: sale.purityId,
      prevState: { rateStatus: "UNFIXED", ratePerGram: oldRate },
      nextState: { rateStatus: "FIXED", ratePerGram: rate.toString(), totalAmount: newTotal.toString() },
      description: `Rate fixed for sale ${sale.invoiceNumber} @ ₹${rate.toFixed(2)}/g. Final Amount: ₹${newTotal.toFixed(2)}`,
    });

    return sale.get({ plain: true });
  });
}

