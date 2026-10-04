/**
 * AdjustmentService — B1
 *
 * Stock adjustments are ADMIN-only operations.
 * Every adjustment immediately creates a StockMovement (no DRAFT state).
 * DECREASE adjustments are validated against current stock.
 *
 * Stock effect of INCREASE:  +weightGrams  (ADJUSTMENT_INCREASE, positive)
 * Stock effect of DECREASE:  -weightGrams  (ADJUSTMENT_DECREASE, negative)
 * Cancellation creates a reversing movement.
 *
 * Financial precision: Decimal throughout.
 */

import Decimal from "decimal.js";
import {
  StockAdjustment,
  StockMovement,
  Metal,
  Purity,
  User,
  runTransaction,
} from "@/lib/db";
import { writeAudit } from "./audit-service";
import { assertMetalActive, assertPurityActive } from "./master-service";
import {
  assertSufficientStock,
  UnauthorizedError,
} from "./stock-service";
import type { Role, AdjustmentDirection } from "@/lib/db/types";

// ---------------------------------------------------------------------------
// Input Types
// ---------------------------------------------------------------------------

export interface CreateAdjustmentInput {
  date: Date;
  metalId: string;
  purityId: string;
  direction: AdjustmentDirection;
  /** Passed as string to preserve Decimal precision */
  weightGrams: string;
  reason: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Create & Post Adjustment (immediate — no DRAFT for adjustments)
// ---------------------------------------------------------------------------

export async function createAdjustment(
  actorId: string,
  actorRole: Role,
  input: CreateAdjustmentInput
) {
  // ADMIN-only
  if (actorRole !== "ADMIN") {
    throw new UnauthorizedError("create stock adjustment");
  }

  const weight = new Decimal(input.weightGrams);
  if (weight.lessThanOrEqualTo(0)) throw new Error("Weight must be positive.");
  if (!input.reason?.trim()) throw new Error("Reason is required.");

  return runTransaction(async (t) => {
    // Validate master data
    await assertMetalActive(t, input.metalId);
    await assertPurityActive(t, input.purityId, input.metalId);

    // For DECREASE: validate we have enough stock
    if (input.direction === "DECREASE") {
      await assertSufficientStock(t, input.metalId, input.purityId, weight);
    }

    // 1. Create adjustment record
    const adjustment = await StockAdjustment.create(
      {
        date: input.date,
        metalId: input.metalId,
        purityId: input.purityId,
        direction: input.direction,
        weightGrams: weight.toString(),
        reason: input.reason.trim(),
        notes: input.notes || null,
        status: "POSTED",
        createdById: actorId,
      },
      { transaction: t }
    );

    // 2. Create append-only StockMovement
    const movementType =
      input.direction === "INCREASE" ? "ADJUSTMENT_INCREASE" : "ADJUSTMENT_DECREASE";
    const signedWeight =
      input.direction === "INCREASE" ? weight : weight.negated();

    await StockMovement.create(
      {
        metalId: input.metalId,
        purityId: input.purityId,
        movementType,
        weightGrams: signedWeight.toString(),
        adjustmentId: adjustment.id,
        createdById: actorId,
        reference: `Adjustment ${input.direction}: ${input.reason}`,
      },
      { transaction: t }
    );

    // 3. Audit
    await writeAudit(t, {
      action: "CREATE",
      entityType: "StockAdjustment",
      entityId: adjustment.id,
      actorId,
      adjustmentId: adjustment.id,
      metalId: input.metalId,
      purityId: input.purityId,
      nextState: {
        status: "POSTED",
        direction: input.direction,
        weightGrams: weight.toFixed(4),
        reason: input.reason,
      },
      description: `Stock adjustment (${input.direction}) posted: ${signedWeight.toFixed(4)}g. Reason: ${input.reason}`,
    });

    return adjustment.get({ plain: true });
  });
}

// ---------------------------------------------------------------------------
// Cancel Adjustment (reversal)
// ---------------------------------------------------------------------------

export async function cancelAdjustment(
  actorId: string,
  actorRole: Role,
  adjustmentId: string,
  reason: string
) {
  if (actorRole !== "ADMIN") {
    throw new UnauthorizedError("cancel stock adjustment");
  }
  if (!reason?.trim()) throw new Error("Cancellation reason is required.");

  return runTransaction(async (t) => {
    const adj = await StockAdjustment.findByPk(adjustmentId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!adj) {
      throw new Error(`Stock adjustment ${adjustmentId} not found.`);
    }

    if (adj.status !== "POSTED") {
      throw new Error(
        `Only POSTED adjustments can be cancelled. Current status: ${adj.status}`
      );
    }

    const adjWeight = new Decimal(adj.weightGrams);

    // For a DECREASE reversal: stock goes back up — no negative check needed
    // For an INCREASE reversal: stock goes down — check we have enough
    if (adj.direction === "INCREASE") {
      await assertSufficientStock(t, adj.metalId, adj.purityId, adjWeight);
    }

    // 1. Mark CANCELLED
    adj.status = "CANCELLED";
    adj.cancelReason = reason.trim();
    adj.cancelledAt = new Date();
    await adj.save({ transaction: t });

    // 2. Reversing movement
    const reversalMovementType =
      adj.direction === "INCREASE" ? "ADJUSTMENT_DECREASE" : "ADJUSTMENT_INCREASE";
    const reversalWeight =
      adj.direction === "INCREASE" ? adjWeight.negated() : adjWeight;

    await StockMovement.create(
      {
        metalId: adj.metalId,
        purityId: adj.purityId,
        movementType: reversalMovementType,
        weightGrams: reversalWeight.toString(),
        adjustmentId: adj.id,
        createdById: actorId,
        reference: `Reversal of adjustment ${adj.id}: ${reason}`,
      },
      { transaction: t }
    );

    // 3. Audit
    await writeAudit(t, {
      action: "CANCEL",
      entityType: "StockAdjustment",
      entityId: adjustmentId,
      actorId,
      adjustmentId,
      metalId: adj.metalId,
      purityId: adj.purityId,
      prevState: { status: "POSTED" },
      nextState: { status: "CANCELLED", cancelReason: reason },
      description: `Adjustment cancelled and reversed: ${reason}`,
    });

    return adj.get({ plain: true });
  });
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getAdjustment(id: string) {
  const adj = await StockAdjustment.findByPk(id, {
    include: [
      { model: Metal, as: "metal" },
      { model: Purity, as: "purity" },
      { model: User, as: "createdBy" },
    ],
  });
  if (!adj) throw new Error(`Stock adjustment ${id} not found.`);
  return adj.get({ plain: true });
}

export async function listAdjustments(opts?: {
  metalId?: string;
  purityId?: string;
}) {
  const where: any = {};
  if (opts?.metalId) where.metalId = opts.metalId;
  if (opts?.purityId) where.purityId = opts.purityId;

  const adjs = await StockAdjustment.findAll({
    where,
    include: [
      { model: Metal, as: "metal" },
      { model: Purity, as: "purity" },
      { model: User, as: "createdBy", attributes: ["id", "name", "email"] },
    ],
    order: [["date", "DESC"]],
  });

  return adjs.map((a) => a.get({ plain: true }));
}
