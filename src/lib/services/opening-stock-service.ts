/**
 * OpeningStockService — B1
 *
 * Establishes the opening physical stock for a (Metal × Purity) bucket.
 * Opening stock is IMMUTABLE after creation — it cannot be edited or deleted.
 * It creates an OPENING StockMovement so the stock calculation invariant holds.
 *
 * Invariant:
 *   currentStock = OPENING + PURCHASES - SALES ± ADJUSTMENTS
 *
 * Can only be set ONCE per (metalId, purityId). If you need to correct it,
 * use a StockAdjustment (which creates an auditable record).
 */

import Decimal from "decimal.js";
import { OpeningStock, StockMovement, Metal, Purity, runTransaction } from "@/lib/db";
import { writeAudit } from "./audit-service";
import { assertMetalActive, assertPurityActive } from "./master-service";
import { UnauthorizedError } from "./stock-service";
import type { Role } from "@/lib/db/types";

export interface SetOpeningStockInput {
  metalId: string;
  purityId: string;
  /** Passed as string to preserve Decimal precision */
  weightGrams: string;
  effectiveDate: Date;
  notes?: string;
}

export async function setOpeningStock(
  actorId: string,
  actorRole: Role,
  input: SetOpeningStockInput
) {
  if (actorRole !== "ADMIN") {
    throw new UnauthorizedError("set opening stock");
  }

  const weight = new Decimal(input.weightGrams);
  if (weight.lessThan(0)) throw new Error("Opening stock weight cannot be negative.");

  return runTransaction(async (t) => {
    // Validate master data
    await assertMetalActive(t, input.metalId);
    await assertPurityActive(t, input.purityId, input.metalId);

    // Enforce uniqueness: only one opening stock per (metal, purity)
    const existing = await OpeningStock.findOne({
      where: { metalId: input.metalId, purityId: input.purityId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (existing) {
      throw new Error(
        `Opening stock already exists for metalId=${input.metalId}, purityId=${input.purityId}. ` +
          `Use a StockAdjustment to correct the balance.`
      );
    }

    // 1. Create OpeningStock record
    const opening = await OpeningStock.create(
      {
        metalId: input.metalId,
        purityId: input.purityId,
        weightGrams: weight.toString(),
        effectiveDate: input.effectiveDate,
        notes: input.notes || null,
        createdById: actorId,
      },
      { transaction: t }
    );

    // 2. Create append-only StockMovement (positive)
    await StockMovement.create(
      {
        metalId: input.metalId,
        purityId: input.purityId,
        movementType: "OPENING",
        weightGrams: weight.toString(),
        openingStockId: opening.id,
        createdById: actorId,
        reference: `Opening stock: ${weight.toFixed(4)}g`,
      },
      { transaction: t }
    );

    // 3. Audit
    await writeAudit(t, {
      action: "CREATE",
      entityType: "OpeningStock",
      entityId: opening.id,
      actorId,
      metalId: input.metalId,
      purityId: input.purityId,
      nextState: { weightGrams: weight.toFixed(4), effectiveDate: input.effectiveDate },
      description: `Opening stock set: ${weight.toFixed(4)}g`,
    });

    return opening.get({ plain: true });
  });
}

export async function getOpeningStock(metalId: string, purityId: string) {
  const opening = await OpeningStock.findOne({
    where: { metalId, purityId },
    include: [
      { model: Metal, as: "metal" },
      { model: Purity, as: "purity" },
    ],
  });
  return opening ? opening.get({ plain: true }) : null;
}
