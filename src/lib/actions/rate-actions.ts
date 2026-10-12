"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import {
  setMetalRate,
  getLiveRates,
  calculateLandedCost,
} from "@/lib/services/rate-service";
import {
  SetRateSchema,
  LandedCostCalculatorSchema,
} from "@/lib/validations/rate";
import { sanitizeErrorMessage } from "@/lib/utils/errors";
import { serializeForClient } from "@/lib/utils/serialize";

export async function setMetalRateAction(formData: unknown) {
  try {
    const user = await requireUser();
    const parsed = SetRateSchema.parse(formData);

    const rate = await setMetalRate(user.id, user.role, {
      metalId: parsed.metalId,
      purityId: parsed.purityId,
      buyRate: parsed.buyRate,
      sellRate: parsed.sellRate,
      mcxBenchmarkRate: parsed.mcxBenchmarkRate,
      usdOunceRate: parsed.usdOunceRate,
      usdInrRate: parsed.usdInrRate,
      customsDutyPct: parsed.customsDutyPct,
      gstPct: parsed.gstPct,
      marginPerGram: parsed.marginPerGram,
    });

    revalidatePath("/rates");
    revalidatePath("/dashboard");
    revalidatePath("/purchases");
    revalidatePath("/sales");
    return { success: true, data: serializeForClient(rate) };
  } catch (err: unknown) {
    return { success: false, error: sanitizeErrorMessage(err, "Failed to update metal rate") };
  }
}

export async function calculateLandedCostAction(formData: unknown) {
  try {
    const parsed = LandedCostCalculatorSchema.parse(formData);
    const result = calculateLandedCost(parsed);
    return { success: true, data: result };
  } catch (err: unknown) {
    return { success: false, error: sanitizeErrorMessage(err, "Calculation error") };
  }
}

export async function getLiveRatesAction() {
  try {
    const rates = await getLiveRates();
    return { success: true, data: serializeForClient(rates) };
  } catch (err: unknown) {
    return { success: false, error: sanitizeErrorMessage(err, "Failed to fetch rates") };
  }
}
