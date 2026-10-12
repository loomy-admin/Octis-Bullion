"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import {
  getCashSummaryForDate,
  recordCashClosing,
  listCashClosings,
} from "@/lib/services/cash-closing-service";
import { RecordCashClosingSchema } from "@/lib/validations/cash-closing";
import { sanitizeErrorMessage } from "@/lib/utils/errors";
import { serializeForClient } from "@/lib/utils/serialize";

export async function getCashSummaryForDateAction(dateStr: string) {
  try {
    await requireUser();
    const summary = await getCashSummaryForDate(dateStr);
    return { success: true, data: serializeForClient(summary) };
  } catch (err: unknown) {
    return { success: false, error: sanitizeErrorMessage(err, "Failed to get drawer summary") };
  }
}

export async function recordCashClosingAction(formData: unknown) {
  try {
    const user = await requireUser();
    const parsed = RecordCashClosingSchema.parse(formData);

    const closing = await recordCashClosing(user.id, user.role, {
      closingDate: parsed.closingDate,
      shift: parsed.shift,
      openingBalance: parsed.openingBalance,
      totalCashReceived: parsed.totalCashReceived,
      totalCashPaid: parsed.totalCashPaid,
      denominations: parsed.denominations,
      notes: parsed.notes,
    });

    revalidatePath("/payments");
    revalidatePath("/cash-closing");
    return { success: true, data: serializeForClient(closing) };
  } catch (err: unknown) {
    return { success: false, error: sanitizeErrorMessage(err, "Failed to record cash closing") };
  }
}

export async function listCashClosingsAction(limit = 30) {
  try {
    await requireUser();
    const closings = await listCashClosings(limit);
    return { success: true, data: serializeForClient(closings) };
  } catch (err: unknown) {
    return { success: false, error: sanitizeErrorMessage(err, "Failed to list cash closings") };
  }
}
