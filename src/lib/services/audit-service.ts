/**
 * AuditService — B1
 *
 * Writes to the immutable AuditLog table.
 * Clean pure Sequelize implementation.
 */

import type { Transaction } from "sequelize";
import { AuditLog } from "@/lib/db/models/AuditLog";
import type { AuditAction } from "@/lib/db/types";

export async function writeAudit(
  t: Transaction | undefined,
  opts: {
    action: AuditAction;
    entityType: string;
    entityId: string;
    actorId: string;
    prevState?: Record<string, unknown> | null;
    nextState?: Record<string, unknown> | null;
    description?: string;
    metalId?: string;
    purityId?: string;
    purchaseId?: string;
    saleId?: string;
    adjustmentId?: string;
  }
) {
  await AuditLog.create(
    {
      action: opts.action,
      entityType: opts.entityType,
      entityId: opts.entityId,
      actorId: opts.actorId,
      prevState: opts.prevState ?? null,
      nextState: opts.nextState ?? null,
      description: opts.description ?? null,
      metalId: opts.metalId ?? null,
      purityId: opts.purityId ?? null,
      purchaseId: opts.purchaseId ?? null,
      saleId: opts.saleId ?? null,
      adjustmentId: opts.adjustmentId ?? null,
    },
    { transaction: t }
  );
}
