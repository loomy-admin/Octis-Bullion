"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireAdmin } from "@/lib/auth/session";
import {
  createPayment,
  cancelPayment,
  getPaymentsList,
  getPartyOutstanding,
  type PaymentFilterInput,
} from "@/lib/services/payment-service";
import { CreatePaymentSchema, CancelPaymentSchema } from "@/lib/validations/payment";
import { sanitizeErrorMessage } from "@/lib/utils/errors";
import { serializeForClient } from "@/lib/utils/serialize";

export async function createPaymentAction(formData: unknown) {
  try {
    const user = await requireUser();
    const parsed = CreatePaymentSchema.parse(formData);

    const payment = await createPayment({
      type: parsed.type,
      counterpartyId: parsed.counterpartyId,
      amount: parsed.amount,
      paymentMode: parsed.paymentMode,
      date: parsed.date,
      referenceNumber: parsed.referenceNumber,
      linkedPurchaseId: parsed.linkedPurchaseId,
      linkedSaleId: parsed.linkedSaleId,
      cashDenominations: parsed.cashDenominations,
      notes: parsed.notes,
      createdById: user.id,
    });

    revalidatePath("/payments");
    revalidatePath("/counterparties");
    revalidatePath("/dashboard");
    return { success: true, data: serializeForClient(payment) };
  } catch (err: unknown) {
    return { success: false, error: sanitizeErrorMessage(err, "Failed to record payment") };
  }
}

export async function cancelPaymentAction(formData: unknown) {
  try {
    const user = await requireAdmin();
    const parsed = CancelPaymentSchema.parse(formData);

    const payment = await cancelPayment(parsed.paymentId, user.id, parsed.reason);

    revalidatePath("/payments");
    revalidatePath("/counterparties");
    revalidatePath("/dashboard");
    return { success: true, data: serializeForClient(payment) };
  } catch (err: unknown) {
    return { success: false, error: sanitizeErrorMessage(err, "Failed to cancel payment") };
  }
}

export async function getPaymentsListAction(filters: PaymentFilterInput = {}) {
  try {
    await requireUser();
    const result = await getPaymentsList(filters);
    return { success: true, data: serializeForClient(result) };
  } catch (err: unknown) {
    return { success: false, error: sanitizeErrorMessage(err, "Failed to load payments") };
  }
}

export async function getPartyOutstandingAction(counterpartyId: string) {
  try {
    await requireUser();
    const result = await getPartyOutstanding(counterpartyId);
    return { success: true, data: serializeForClient(result) };
  } catch (err: unknown) {
    return { success: false, error: sanitizeErrorMessage(err, "Failed to load party outstanding balance") };
  }
}
