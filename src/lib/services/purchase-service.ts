/**
 * PurchaseService — B1
 *
 * Handles DRAFT → POSTED lifecycle for purchases.
 * Posting is atomic: Purchase row + StockMovement row in one transaction.
 * Cancellation is atomic: status CANCELLED + reversing StockMovement.
 *
 * Stock effect of POST:  +weightGrams  (PURCHASE movement, positive)
 * Stock effect of CANCEL: -weightGrams (PURCHASE_CANCEL movement, negative)
 *
 * Financial precision: all weight, rate, and amount fields use Decimal.
 * The totalAmount is always server-derived: weightGrams × ratePerGram.
 */

import Decimal from "decimal.js";
import {
  Purchase,
  StockMovement,
  Metal,
  Purity,
  Counterparty,
  User,
  runTransaction,
} from "@/lib/db";
import { writeAudit } from "./audit-service";
import { assertMetalActive, assertPurityActive } from "./master-service";
import { UnauthorizedError } from "./stock-service";
import type { Role, PaymentMode, TransactionStatus } from "@/lib/db/types";

// ---------------------------------------------------------------------------
// Input Types
// ---------------------------------------------------------------------------

export interface CreatePurchaseInput {
  invoiceNumber: string;
  date: Date;
  supplierName: string;
  supplierContact?: string;
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
// Create Purchase (DRAFT)
// ---------------------------------------------------------------------------

export async function createPurchase(
  actorId: string,
  _actorRole: Role,
  input: CreatePurchaseInput
) {
  const isUnfixed = input.rateType === "UNFIXED";
  const weight = new Decimal(input.weightGrams);
  const rate = input.ratePerGram ? new Decimal(input.ratePerGram) : new Decimal(0);

  if (weight.lessThanOrEqualTo(0)) throw new Error("Weight must be positive.");
  if (!isUnfixed && rate.lessThanOrEqualTo(0)) throw new Error("Rate must be positive.");

  // Server-derived total — never trust client-supplied total
  const total = weight.times(rate).toDecimalPlaces(2);

  return runTransaction(async (t) => {
    // Validate metal/purity are active (must hold for new transactions)
    await assertMetalActive(t, input.metalId);
    await assertPurityActive(t, input.purityId, input.metalId);

    const purchase = await Purchase.create(
      {
        invoiceNumber: input.invoiceNumber,
        date: input.date,
        supplierName: input.supplierName,
        supplierContact: input.supplierContact || null,
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
      entityType: "Purchase",
      entityId: purchase.id,
      actorId,
      purchaseId: purchase.id,
      metalId: input.metalId,
      purityId: input.purityId,
      nextState: { status: "DRAFT", invoiceNumber: purchase.invoiceNumber },
      description: `Purchase draft created: ${purchase.invoiceNumber}`,
    });

    return purchase.get({ plain: true });
  });
}

// ---------------------------------------------------------------------------
// Post Purchase (DRAFT → POSTED)
// ---------------------------------------------------------------------------

export async function postPurchase(
  actorId: string,
  _actorRole: Role,
  purchaseId: string
) {
  return runTransaction(async (t) => {
    const purchase = await Purchase.findByPk(purchaseId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!purchase) {
      throw new Error(`Purchase ${purchaseId} not found.`);
    }

    if (purchase.status !== "DRAFT") {
      throw new Error(
        `Purchase ${purchaseId} is in status ${purchase.status} and cannot be posted.`
      );
    }

    // Validate metal/purity still active at posting time
    await assertMetalActive(t, purchase.metalId);
    await assertPurityActive(t, purchase.purityId, purchase.metalId);

    // 1. Update Purchase status
    purchase.status = "POSTED";
    await purchase.save({ transaction: t });

    // 2. Create append-only StockMovement (positive = stock in)
    await StockMovement.create(
      {
        metalId: purchase.metalId,
        purityId: purchase.purityId,
        movementType: "PURCHASE",
        weightGrams: purchase.weightGrams, // positive
        purchaseId: purchase.id,
        createdById: actorId,
        reference: `Purchase ${purchase.invoiceNumber}`,
      },
      { transaction: t }
    );

    // 3. Audit
    await writeAudit(t, {
      action: "POST",
      entityType: "Purchase",
      entityId: purchaseId,
      actorId,
      purchaseId,
      metalId: purchase.metalId,
      purityId: purchase.purityId,
      prevState: { status: "DRAFT" },
      nextState: { status: "POSTED" },
      description: `Purchase posted: ${purchase.invoiceNumber} +${new Decimal(purchase.weightGrams).toFixed(4)}g`,
    });

    const reloaded = await Purchase.findByPk(purchaseId, {
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
// Cancel Purchase (POSTED → CANCELLED)
// ---------------------------------------------------------------------------

export async function cancelPurchase(
  actorId: string,
  actorRole: Role,
  purchaseId: string,
  reason: string
) {
  if (actorRole !== "ADMIN") {
    throw new UnauthorizedError("cancel purchase");
  }
  if (!reason?.trim()) throw new Error("Cancellation reason is required.");

  return runTransaction(async (t) => {
    const purchase = await Purchase.findByPk(purchaseId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!purchase) {
      throw new Error(`Purchase ${purchaseId} not found.`);
    }

    if (purchase.status !== "POSTED") {
      throw new Error(
        `Only POSTED purchases can be cancelled. Current status: ${purchase.status}`
      );
    }

    const cancelWeight = new Decimal(purchase.weightGrams).negated();

    // 1. Mark CANCELLED
    purchase.status = "CANCELLED";
    purchase.cancelReason = reason.trim();
    purchase.cancelledAt = new Date();
    await purchase.save({ transaction: t });

    // 2. Reversing movement (negative = stock out)
    await StockMovement.create(
      {
        metalId: purchase.metalId,
        purityId: purchase.purityId,
        movementType: "PURCHASE_CANCEL",
        weightGrams: cancelWeight.toString(), // negative
        purchaseId: purchase.id,
        createdById: actorId,
        reference: `Cancel of purchase ${purchase.invoiceNumber}: ${reason}`,
      },
      { transaction: t }
    );

    // 3. Audit
    await writeAudit(t, {
      action: "CANCEL",
      entityType: "Purchase",
      entityId: purchaseId,
      actorId,
      purchaseId,
      metalId: purchase.metalId,
      purityId: purchase.purityId,
      prevState: { status: "POSTED" },
      nextState: { status: "CANCELLED", cancelReason: reason },
      description: `Purchase cancelled: ${purchase.invoiceNumber}. Reason: ${reason}`,
    });

    return purchase.get({ plain: true });
  });
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getPurchase(id: string) {
  const purchase = await Purchase.findByPk(id, {
    include: [
      { model: Metal, as: "metal" },
      { model: Purity, as: "purity" },
      { model: Counterparty, as: "counterparty" },
      { model: User, as: "createdBy" },
    ],
  });
  if (!purchase) throw new Error(`Purchase ${id} not found.`);
  return purchase.get({ plain: true });
}

export async function listPurchases(opts?: {
  metalId?: string;
  purityId?: string;
  status?: TransactionStatus;
}) {
  const where: any = {};
  if (opts?.metalId) where.metalId = opts.metalId;
  if (opts?.purityId) where.purityId = opts.purityId;
  if (opts?.status) where.status = opts.status;

  const purchases = await Purchase.findAll({
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

  return purchases.map((p) => p.get({ plain: true }));
}

// ---------------------------------------------------------------------------
// Fix Rate (UNFIXED → FIXED)
// ---------------------------------------------------------------------------

export async function fixPurchaseRate(
  actorId: string,
  _actorRole: Role,
  purchaseId: string,
  fixedRatePerGram: string,
  fixingNotes?: string
) {
  const rate = new Decimal(fixedRatePerGram);
  if (rate.lessThanOrEqualTo(0)) throw new Error("Fixed rate must be positive.");

  return runTransaction(async (t) => {
    const purchase = await Purchase.findByPk(purchaseId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!purchase) throw new Error(`Purchase ${purchaseId} not found.`);
    if (purchase.status === "CANCELLED") {
      throw new Error("Cannot fix rate on a cancelled purchase.");
    }
    if (purchase.rateStatus === "FIXED") {
      throw new Error(`Rate is already fixed for purchase ${purchase.invoiceNumber}.`);
    }

    const weight = new Decimal(purchase.weightGrams);
    const newTotal = weight.times(rate).toDecimalPlaces(2);
    const oldRate = purchase.ratePerGram;

    purchase.ratePerGram = rate.toString();
    purchase.totalAmount = newTotal.toString();
    purchase.rateStatus = "FIXED";
    purchase.fixedAt = new Date();
    purchase.fixedById = actorId;
    purchase.fixingNotes = fixingNotes?.trim() || null;
    await purchase.save({ transaction: t });

    await writeAudit(t, {
      action: "UPDATE",
      entityType: "Purchase",
      entityId: purchase.id,
      actorId,
      purchaseId: purchase.id,
      metalId: purchase.metalId,
      purityId: purchase.purityId,
      prevState: { rateStatus: "UNFIXED", ratePerGram: oldRate },
      nextState: { rateStatus: "FIXED", ratePerGram: rate.toString(), totalAmount: newTotal.toString() },
      description: `Rate fixed for purchase ${purchase.invoiceNumber} @ ₹${rate.toFixed(2)}/g. Final Amount: ₹${newTotal.toFixed(2)}`,
    });

    return purchase.get({ plain: true });
  });
}

