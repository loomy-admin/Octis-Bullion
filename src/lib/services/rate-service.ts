import Decimal from "decimal.js";
import {
  MetalRate,
  Metal,
  Purity,
  User,
  runTransaction,
} from "@/lib/db";
import { writeAudit } from "./audit-service";
import type { Role } from "@/lib/db/types";

export interface LandedCostInput {
  usdOuncePrice: string | number;
  usdInrRate: string | number;
  customsDutyPct?: string | number; // default 15.00
  gstPct?: string | number;          // default 3.00
  marginPerGram?: string | number;   // default 50.00
}

export interface LandedCostResult {
  baseInrPerOz: string;
  dutyAmountPerOz: string;
  gstAmountPerOz: string;
  totalLandedPerOz: string;
  landedCostPerGram: string;
  recommendedSellRate: string;
  recommendedBuyRate: string;
}

/**
 * Pure domain calculation for Bullion Landed Per-Gram Cost:
 * Base INR = USD/oz * USD/INR
 * Duty = Base INR * 15% (default)
 * GST = (Base INR + Duty) * 3% (default)
 * Total Landed = Base + Duty + GST
 * Landed / Gram = Total Landed / 31.1000g (Troy Ounce)
 */
export function calculateLandedCost(input: LandedCostInput): LandedCostResult {
  const ozPrice = new Decimal(input.usdOuncePrice || 0);
  const usdInr = new Decimal(input.usdInrRate || 0);
  const dutyPct = new Decimal(input.customsDutyPct ?? 15).dividedBy(100);
  const gstPct = new Decimal(input.gstPct ?? 3).dividedBy(100);
  const margin = new Decimal(input.marginPerGram ?? 50);

  if (ozPrice.lessThanOrEqualTo(0) || usdInr.lessThanOrEqualTo(0)) {
    return {
      baseInrPerOz: "0.00",
      dutyAmountPerOz: "0.00",
      gstAmountPerOz: "0.00",
      totalLandedPerOz: "0.00",
      landedCostPerGram: "0.00",
      recommendedSellRate: "0.00",
      recommendedBuyRate: "0.00",
    };
  }

  const baseInrPerOz = ozPrice.times(usdInr);
  const dutyAmountPerOz = baseInrPerOz.times(dutyPct);
  const landedWithDuty = baseInrPerOz.plus(dutyAmountPerOz);
  const gstAmountPerOz = landedWithDuty.times(gstPct);
  const totalLandedPerOz = landedWithDuty.plus(gstAmountPerOz);

  // 1 Troy Ounce = 31.1034768 grams, standard Indian bullion convention uses 31.1000g
  const landedCostPerGram = totalLandedPerOz.dividedBy(31.1).toDecimalPlaces(2);
  const recommendedSellRate = landedCostPerGram.plus(margin).toDecimalPlaces(2);
  const recommendedBuyRate = landedCostPerGram.minus(margin).toDecimalPlaces(2);

  return {
    baseInrPerOz: baseInrPerOz.toFixed(2),
    dutyAmountPerOz: dutyAmountPerOz.toFixed(2),
    gstAmountPerOz: gstAmountPerOz.toFixed(2),
    totalLandedPerOz: totalLandedPerOz.toFixed(2),
    landedCostPerGram: landedCostPerGram.toFixed(2),
    recommendedSellRate: recommendedSellRate.toFixed(2),
    recommendedBuyRate: recommendedBuyRate.toFixed(2),
  };
}

export interface SetRateInput {
  metalId: string;
  purityId: string;
  buyRate: string;
  sellRate: string;
  mcxBenchmarkRate?: string;
  usdOunceRate?: string;
  usdInrRate?: string;
  customsDutyPct?: string;
  gstPct?: string;
  marginPerGram?: string;
}

export async function setMetalRate(
  actorId: string,
  actorRole: Role,
  input: SetRateInput
) {
  const buy = new Decimal(input.buyRate);
  const sell = new Decimal(input.sellRate);
  if (buy.lessThanOrEqualTo(0)) throw new Error("Buy rate must be positive.");
  if (sell.lessThanOrEqualTo(0)) throw new Error("Sell rate must be positive.");
  if (sell.lessThan(buy)) throw new Error("Selling rate cannot be lower than buying rate.");

  let landedCost: string | null = null;
  if (input.usdOunceRate && input.usdInrRate) {
    const calc = calculateLandedCost({
      usdOuncePrice: input.usdOunceRate,
      usdInrRate: input.usdInrRate,
      customsDutyPct: input.customsDutyPct,
      gstPct: input.gstPct,
      marginPerGram: input.marginPerGram,
    });
    landedCost = calc.landedCostPerGram;
  }

  return runTransaction(async (t) => {
    let rate = await MetalRate.findOne({
      where: { metalId: input.metalId, purityId: input.purityId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    const isNew = !rate;
    const prevRates = rate ? { buy: rate.buyRate, sell: rate.sellRate } : null;

    if (!rate) {
      rate = await MetalRate.create(
        {
          metalId: input.metalId,
          purityId: input.purityId,
          buyRate: buy.toString(),
          sellRate: sell.toString(),
          mcxBenchmarkRate: input.mcxBenchmarkRate || null,
          usdOunceRate: input.usdOunceRate || null,
          usdInrRate: input.usdInrRate || null,
          customsDutyPct: input.customsDutyPct || "15.00",
          gstPct: input.gstPct || "3.00",
          marginPerGram: input.marginPerGram || "50.00",
          landedCostPerGram: landedCost,
          isLive: true,
          updatedById: actorId,
        },
        { transaction: t }
      );
    } else {
      rate.buyRate = buy.toString();
      rate.sellRate = sell.toString();
      if (input.mcxBenchmarkRate !== undefined) rate.mcxBenchmarkRate = input.mcxBenchmarkRate || null;
      if (input.usdOunceRate !== undefined) rate.usdOunceRate = input.usdOunceRate || null;
      if (input.usdInrRate !== undefined) rate.usdInrRate = input.usdInrRate || null;
      if (input.customsDutyPct !== undefined) rate.customsDutyPct = input.customsDutyPct || "15.00";
      if (input.gstPct !== undefined) rate.gstPct = input.gstPct || "3.00";
      if (input.marginPerGram !== undefined) rate.marginPerGram = input.marginPerGram || "50.00";
      if (landedCost) rate.landedCostPerGram = landedCost;
      rate.updatedById = actorId;
      await rate.save({ transaction: t });
    }

    await writeAudit(t, {
      action: isNew ? "CREATE" : "UPDATE",
      entityType: "MetalRate",
      entityId: rate.id,
      actorId,
      metalId: input.metalId,
      purityId: input.purityId,
      prevState: prevRates,
      nextState: { buyRate: buy.toString(), sellRate: sell.toString() },
      description: `Rate updated: Buy ₹${buy.toFixed(2)}/g, Sell ₹${sell.toFixed(2)}/g`,
    });

    return rate.get({ plain: true });
  });
}

export async function getLiveRates() {
  const rates = await MetalRate.findAll({
    where: { isLive: true },
    include: [
      { model: Metal, as: "metal" },
      { model: Purity, as: "purity" },
      { model: User, as: "updatedBy", attributes: ["id", "name", "email"] },
    ],
    order: [["updatedAt", "DESC"]],
  });

  return rates.map((r) => r.get({ plain: true }));
}
