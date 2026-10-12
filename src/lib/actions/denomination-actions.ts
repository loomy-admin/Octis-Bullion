"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireAdmin } from "@/lib/auth/session";
import {
  listDenominations,
  createDenomination,
  updateDenomination,
  calculateDenominationBreakdown,
  getDenominationRateBoard,
  seedStandardDenominations,
  type DenominationBreakdownOptions,
} from "@/lib/services/denomination-service";
import {
  CreateDenominationSchema,
  UpdateDenominationSchema,
} from "@/lib/validations/denomination";
import { sanitizeErrorMessage } from "@/lib/utils/errors";
import { serializeForClient } from "@/lib/utils/serialize";

export async function listDenominationsAction(filters?: {
  metalId?: string;
  purityId?: string;
  type?: "BAR" | "COIN";
  isActive?: boolean;
}) {
  try {
    await requireUser();
    const denoms = await listDenominations(filters);
    return { success: true, data: serializeForClient(denoms) };
  } catch (err: unknown) {
    return { success: false, error: sanitizeErrorMessage(err, "Failed to list denominations") };
  }
}

export async function createDenominationAction(formData: unknown) {
  try {
    const user = await requireAdmin();
    const parsed = CreateDenominationSchema.parse(formData);

    const denom = await createDenomination(user.id, user.role, {
      metalId: parsed.metalId,
      purityId: parsed.purityId,
      type: parsed.type,
      name: parsed.name,
      weightGrams: parsed.weightGrams,
      premiumAmount: parsed.premiumAmount,
      isActive: parsed.isActive,
    });

    revalidatePath("/denominations");
    revalidatePath("/rates");
    return { success: true, data: serializeForClient(denom) };
  } catch (err: unknown) {
    return { success: false, error: sanitizeErrorMessage(err, "Failed to create denomination") };
  }
}

export async function updateDenominationAction(formData: unknown) {
  try {
    const user = await requireAdmin();
    const parsed = UpdateDenominationSchema.parse(formData);

    const denom = await updateDenomination(user.id, user.role, {
      id: parsed.id,
      name: parsed.name,
      premiumAmount: parsed.premiumAmount,
      isActive: parsed.isActive,
    });

    revalidatePath("/denominations");
    return { success: true, data: serializeForClient(denom) };
  } catch (err: unknown) {
    return { success: false, error: sanitizeErrorMessage(err, "Failed to update denomination") };
  }
}

export async function calculateDenominationBreakdownAction(
  targetWeightOrBudget: number | string,
  metalId: string,
  purityId: string,
  ratePerGram: number | string,
  options?: DenominationBreakdownOptions
) {
  try {
    await requireUser();
    const result = await calculateDenominationBreakdown(
      targetWeightOrBudget,
      metalId,
      purityId,
      ratePerGram,
      options
    );
    return { success: true, data: serializeForClient(result) };
  } catch (err: unknown) {
    return { success: false, error: sanitizeErrorMessage(err, "Failed to calculate breakdown") };
  }
}

export async function getDenominationRateBoardAction(
  metalId: string,
  purityId: string,
  ratePerGram: number | string
) {
  try {
    await requireUser();
    const result = await getDenominationRateBoard(
      metalId,
      purityId,
      ratePerGram
    );
    return { success: true, data: serializeForClient(result) };
  } catch (err: unknown) {
    return { success: false, error: sanitizeErrorMessage(err, "Failed to get denomination rate board") };
  }
}

export async function seedStandardDenominationsAction() {
  try {
    const user = await requireAdmin();
    const count = await seedStandardDenominations(user.id);
    revalidatePath("/denominations");
    return { success: true, count };
  } catch (err: unknown) {
    return { success: false, error: sanitizeErrorMessage(err, "Failed to seed denominations") };
  }
}
