"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import {
  createSale,
  postSale,
  cancelSale,
} from "@/lib/services/sale-service";
import {
  CreateSaleSchema,
} from "@/lib/validations/sale";
import { CancelTransactionSchema } from "@/lib/validations/purchase";
import { sanitizeErrorMessage } from "@/lib/utils/errors";
import { serializeForClient } from "@/lib/utils/serialize";

export async function createSaleDraftAction(formData: unknown) {
  try {
    const user = await requireUser();
    const parsed = CreateSaleSchema.parse(formData);

    const sale = await createSale(user.id, user.role, {
      invoiceNumber: parsed.invoiceNumber,
      date: parsed.date,
      buyerName: parsed.buyerName,
      buyerContact: parsed.buyerContact,
      counterpartyId: parsed.counterpartyId || undefined,
      metalId: parsed.metalId,
      purityId: parsed.purityId,
      weightGrams: parsed.weightGrams,
      ratePerGram: parsed.ratePerGram || "0",
      paymentMode: parsed.paymentMode,
      notes: parsed.notes,
      rateType: parsed.rateType,
    });

    revalidatePath("/sales");
    revalidatePath("/stock");
    revalidatePath("/dashboard");
    revalidatePath("/payments");
    return { success: true, data: serializeForClient(sale) };
  } catch (err: unknown) {
    return { success: false, error: sanitizeErrorMessage(err, "Failed to create sale draft") };
  }
}

export async function postSaleAction(saleId: string) {
  try {
    const user = await requireUser();
    const sale = await postSale(user.id, user.role, saleId);

    revalidatePath("/sales");
    revalidatePath("/stock");
    revalidatePath("/transactions");
    revalidatePath("/dashboard");
    revalidatePath("/payments");
    return { success: true, data: serializeForClient(sale) };
  } catch (err: unknown) {
    return { success: false, error: sanitizeErrorMessage(err, "Failed to post sale") };
  }
}

export async function createAndPostSaleAction(formData: unknown) {
  try {
    const user = await requireUser();
    const parsed = CreateSaleSchema.parse(formData);

    // 1. Create draft
    const draft = await createSale(user.id, user.role, {
      invoiceNumber: parsed.invoiceNumber,
      date: parsed.date,
      buyerName: parsed.buyerName,
      buyerContact: parsed.buyerContact,
      counterpartyId: parsed.counterpartyId || undefined,
      metalId: parsed.metalId,
      purityId: parsed.purityId,
      weightGrams: parsed.weightGrams,
      ratePerGram: parsed.ratePerGram || "0",
      paymentMode: parsed.paymentMode,
      notes: parsed.notes,
      rateType: parsed.rateType,
    });

    // 2. Post immediately (atomic stock check and movement inside tx)
    const posted = await postSale(user.id, user.role, draft.id);

    revalidatePath("/sales");
    revalidatePath("/stock");
    revalidatePath("/transactions");
    revalidatePath("/dashboard");
    revalidatePath("/payments");
    return { success: true, data: serializeForClient(posted) };
  } catch (err: unknown) {
    return { success: false, error: sanitizeErrorMessage(err, "Failed to record sale") };
  }
}

export async function fixSaleRateAction(formData: unknown) {
  try {
    const user = await requireUser();
    const { FixSaleRateSchema } = await import("@/lib/validations/sale");
    const { fixSaleRate } = await import("@/lib/services/sale-service");
    const parsed = FixSaleRateSchema.parse(formData);

    const fixed = await fixSaleRate(
      user.id,
      user.role,
      parsed.id,
      parsed.fixedRatePerGram,
      parsed.fixingNotes
    );

    revalidatePath("/sales");
    revalidatePath("/stock");
    revalidatePath("/transactions");
    revalidatePath("/dashboard");
    revalidatePath("/payments");
    return { success: true, data: serializeForClient(fixed) };
  } catch (err: unknown) {
    return { success: false, error: sanitizeErrorMessage(err, "Failed to fix sale rate") };
  }
}

export async function cancelSaleAction(formData: unknown) {
  try {
    const user = await requireUser();
    const parsed = CancelTransactionSchema.parse(formData);

    const cancelled = await cancelSale(
      user.id,
      user.role,
      parsed.id,
      parsed.reason,
    );

    revalidatePath("/sales");
    revalidatePath("/stock");
    revalidatePath("/transactions");
    revalidatePath("/dashboard");
    revalidatePath("/payments");
    return { success: true, data: serializeForClient(cancelled) };
  } catch (err: unknown) {
    return { success: false, error: sanitizeErrorMessage(err, "Failed to cancel sale") };
  }
}
