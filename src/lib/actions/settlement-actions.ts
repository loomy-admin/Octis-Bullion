"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireAdmin } from "@/lib/auth/session";
import {
  getPartyDualBalance,
  recordPartySettlement,
  cancelPartySettlement,
  listPartySettlements,
} from "@/lib/services/settlement-service";
import {
  RecordSettlementSchema,
  CancelSettlementSchema,
} from "@/lib/validations/settlement";
import { sanitizeErrorMessage } from "@/lib/utils/errors";
import { serializeForClient } from "@/lib/utils/serialize";

export async function getPartyDualBalanceAction(counterpartyId: string) {
  try {
    await requireUser();
    const result = await getPartyDualBalance(counterpartyId);
    return { success: true, data: serializeForClient(result) };
  } catch (err: unknown) {
    return { success: false, error: sanitizeErrorMessage(err, "Failed to get party dual balance") };
  }
}

export async function recordPartySettlementAction(formData: unknown) {
  try {
    const user = await requireUser();
    const parsed = RecordSettlementSchema.parse(formData);

    const settlement = await recordPartySettlement(user.id, user.role, {
      counterpartyId: parsed.counterpartyId,
      date: parsed.date,
      metalId: parsed.metalId,
      purityId: parsed.purityId,
      metalSettledGrams: parsed.metalSettledGrams,
      metalDirection: parsed.metalDirection,
      cashSettledAmount: parsed.cashSettledAmount,
      cashDirection: parsed.cashDirection,
      paymentMode: parsed.paymentMode,
      referenceNumber: parsed.referenceNumber,
      currentMetalBalanceGrams: parsed.currentMetalBalanceGrams ?? undefined,
      currentCashBalance: parsed.currentCashBalance ?? undefined,
      notes: parsed.notes,
    });

    revalidatePath("/settlements");
    revalidatePath("/counterparties");
    revalidatePath("/payments");
    revalidatePath("/stock");
    return { success: true, data: serializeForClient(settlement) };
  } catch (err: unknown) {
    return { success: false, error: sanitizeErrorMessage(err, "Failed to record settlement") };
  }
}

export async function cancelPartySettlementAction(formData: unknown) {
  try {
    const user = await requireAdmin();
    const parsed = CancelSettlementSchema.parse(formData);

    const settlement = await cancelPartySettlement(
      user.id,
      user.role,
      parsed.settlementId,
      parsed.reason
    );

    revalidatePath("/settlements");
    revalidatePath("/counterparties");
    revalidatePath("/payments");
    revalidatePath("/stock");
    return { success: true, data: serializeForClient(settlement) };
  } catch (err: unknown) {
    return { success: false, error: sanitizeErrorMessage(err, "Failed to cancel settlement") };
  }
}

export async function listPartySettlementsAction(filters?: {
  counterpartyId?: string;
  status?: "ALL" | "POSTED" | "CANCELLED";
  search?: string;
  limit?: number;
  offset?: number;
}) {
  try {
    await requireUser();
    const result = await listPartySettlements(filters);
    return { success: true, data: serializeForClient(result) };
  } catch (err: unknown) {
    return { success: false, error: sanitizeErrorMessage(err, "Failed to list settlements") };
  }
}
