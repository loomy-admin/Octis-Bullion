"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireAdmin } from "@/lib/auth/session";
import {
  createRateBlock,
  getRateBlocks,
  cancelRateBlock,
  fulfillRateBlock,
} from "@/lib/services/rate-block-service";
import {
  CreateRateBlockSchema,
  CancelRateBlockSchema,
} from "@/lib/validations/rate-block";
import { sanitizeErrorMessage } from "@/lib/utils/errors";
import { serializeForClient } from "@/lib/utils/serialize";

export async function createRateBlockAction(formData: unknown) {
  try {
    const user = await requireUser();
    const parsed = CreateRateBlockSchema.parse(formData);

    const block = await createRateBlock(user.id, user.role, {
      counterpartyId: parsed.counterpartyId,
      metalId: parsed.metalId,
      purityId: parsed.purityId,
      blockedWeightGrams: parsed.blockedWeightGrams,
      blockedRatePerGram: parsed.blockedRatePerGram,
      advanceAmount: parsed.advanceAmount,
      validHours: parsed.validHours,
      notes: parsed.notes,
    });

    revalidatePath("/rate-blocks");
    revalidatePath("/dashboard");
    return { success: true, data: serializeForClient(block) };
  } catch (err: unknown) {
    return { success: false, error: sanitizeErrorMessage(err, "Failed to book rate block") };
  }
}

export async function cancelRateBlockAction(formData: unknown) {
  try {
    const user = await requireUser();
    const parsed = CancelRateBlockSchema.parse(formData);

    const block = await cancelRateBlock(user.id, user.role, parsed.blockId, parsed.reason);

    revalidatePath("/rate-blocks");
    return { success: true, data: serializeForClient(block) };
  } catch (err: unknown) {
    return { success: false, error: sanitizeErrorMessage(err, "Failed to cancel rate block") };
  }
}

export async function fulfillRateBlockAction(blockId: string, saleId: string) {
  try {
    const user = await requireUser();
    const block = await fulfillRateBlock(user.id, user.role, blockId, saleId);

    revalidatePath("/rate-blocks");
    revalidatePath("/sales");
    return { success: true, data: serializeForClient(block) };
  } catch (err: unknown) {
    return { success: false, error: sanitizeErrorMessage(err, "Failed to fulfill rate block") };
  }
}

export async function getRateBlocksAction(filters?: {
  status?: "ACTIVE" | "FULFILLED" | "EXPIRED" | "CANCELLED" | "ALL";
  counterpartyId?: string;
  metalId?: string;
  search?: string;
}) {
  try {
    await requireUser();
    const blocks = await getRateBlocks(filters);
    return { success: true, data: serializeForClient(blocks) };
  } catch (err: unknown) {
    return { success: false, error: sanitizeErrorMessage(err, "Failed to fetch rate blocks") };
  }
}
