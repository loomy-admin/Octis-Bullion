import Decimal from "decimal.js";
import {
  MetalDenomination,
  Metal,
  Purity,
  runTransaction,
} from "@/lib/db";
import { writeAudit } from "./audit-service";
import type { Role } from "@/lib/db/types";

export interface CreateDenominationServiceInput {
  metalId: string;
  purityId: string;
  type: "BAR" | "COIN";
  name: string;
  weightGrams: string | number;
  premiumAmount?: string | number;
  isActive?: boolean;
}

export interface UpdateDenominationServiceInput {
  id: string;
  name?: string;
  premiumAmount?: string | number;
  isActive?: boolean;
}

export interface BreakdownResultItem {
  denominationId: string;
  name: string;
  type: "BAR" | "COIN";
  weightGrams: number;
  quantity: number;
  unitPremium: number;
  totalWeightGrams: number;
  totalPremium: number;
  metalAmount: number;
  totalAmount: number;
}

export interface DenominationBreakdownOptions {
  calculationMode?: "WEIGHT" | "BUDGET";
  budgetAmount?: number | string;
}

export interface DenominationBreakdownResult {
  calculationMode: "WEIGHT" | "BUDGET";
  budgetAmount?: number;
  targetWeightGrams: number;
  allocatedWeightGrams: number;
  unallocatedWeightGrams: number;
  ratePerGram: number;
  metalTotalAmount: number;
  totalPremiumAmount: number;
  grandTotalAmount: number;
  unallocatedBudgetAmount?: number;
  items: BreakdownResultItem[];
}

export interface DenominationRateBoardItem {
  id: string;
  name: string;
  type: "BAR" | "COIN";
  weightGrams: number;
  premiumAmount: number;
  metalAmount: number;
  totalAmount: number;
  effectiveRatePerGram: number;
}

export interface DenominationRateBoardResult {
  metalId: string;
  purityId: string;
  ratePerGram: number;
  items: DenominationRateBoardItem[];
}

/**
 * List all metal denominations with metal and purity details
 */
export async function listDenominations(filters?: {
  metalId?: string;
  purityId?: string;
  type?: "BAR" | "COIN";
  isActive?: boolean;
}) {
  const where: Record<string, unknown> = {};

  if (filters?.metalId) where.metalId = filters.metalId;
  if (filters?.purityId) where.purityId = filters.purityId;
  if (filters?.type) where.type = filters.type;
  if (filters?.isActive !== undefined) where.isActive = filters.isActive;

  return MetalDenomination.findAll({
    where,
    order: [["weightGrams", "DESC"]],
    include: [
      {
        model: Metal,
        as: "metal",
        attributes: ["id", "name", "code"],
      },
      {
        model: Purity,
        as: "purity",
        attributes: ["id", "name", "purityPercentage"],
      },
    ],
  });
}

/**
 * Create a new metal denomination (bar or coin)
 */
export async function createDenomination(
  actorId: string,
  _actorRole: Role,
  input: CreateDenominationServiceInput
): Promise<MetalDenomination> {
  const weight = new Decimal(input.weightGrams);
  const premium = input.premiumAmount ? new Decimal(input.premiumAmount) : new Decimal(0);

  return runTransaction(async (t) => {
    const denom = await MetalDenomination.create(
      {
        metalId: input.metalId,
        purityId: input.purityId,
        type: input.type,
        name: input.name.trim(),
        weightGrams: weight.toFixed(4),
        premiumAmount: premium.toFixed(2),
        isActive: input.isActive ?? true,
      },
      { transaction: t }
    );

    await writeAudit(t, {
      action: "CREATE",
      entityType: "METAL_DENOMINATION",
      entityId: denom.id,
      actorId,
      metalId: input.metalId,
      purityId: input.purityId,
      nextState: {
        name: denom.name,
        type: denom.type,
        weight: weight.toFixed(4),
        premium: premium.toFixed(2),
      },
      description: `Created ${input.type} denomination: ${denom.name} (${weight.toFixed(4)}g, Premium ₹${premium.toFixed(2)})`,
    });

    return denom;
  });
}

/**
 * Update an existing denomination
 */
export async function updateDenomination(
  actorId: string,
  _actorRole: Role,
  input: UpdateDenominationServiceInput
): Promise<MetalDenomination> {
  return runTransaction(async (t) => {
    const denom = await MetalDenomination.findByPk(input.id, { transaction: t });
    if (!denom) throw new Error("Denomination not found");

    const prevState = { ...denom.toJSON() };

    if (input.name !== undefined) denom.name = input.name.trim();
    if (input.premiumAmount !== undefined) {
      denom.premiumAmount = new Decimal(input.premiumAmount).toFixed(2);
    }
    if (input.isActive !== undefined) denom.isActive = input.isActive;

    await denom.save({ transaction: t });

    await writeAudit(t, {
      action: "UPDATE",
      entityType: "METAL_DENOMINATION",
      entityId: denom.id,
      actorId,
      metalId: denom.metalId,
      purityId: denom.purityId,
      prevState,
      nextState: { ...denom.toJSON() },
      description: `Updated denomination ${denom.name}`,
    });

    return denom;
  });
}

/**
 * Computes an optimal greedy physical breakdown of coins & bars for a target weight or customer budget
 */
export async function calculateDenominationBreakdown(
  targetWeightOrBudget: number | string,
  metalId: string,
  purityId: string,
  ratePerGramInput: number | string,
  options?: DenominationBreakdownOptions
): Promise<DenominationBreakdownResult> {
  const ratePerGramDec = new Decimal(ratePerGramInput);
  if (ratePerGramDec.lte(0)) {
    throw new Error("Rate per gram must be greater than zero");
  }

  const isBudgetMode = options?.calculationMode === "BUDGET";
  let targetWeightDec: Decimal;
  let budgetDec: Decimal | undefined;

  if (isBudgetMode) {
    budgetDec = new Decimal(options?.budgetAmount !== undefined ? options.budgetAmount : targetWeightOrBudget);
    if (budgetDec.lte(0)) {
      throw new Error("Budget amount must be greater than zero");
    }
    // Convert customer budget into theoretical target weight (grams)
    targetWeightDec = budgetDec.dividedBy(ratePerGramDec).toDecimalPlaces(4, Decimal.ROUND_DOWN);
  } else {
    targetWeightDec = new Decimal(targetWeightOrBudget);
    if (targetWeightDec.lte(0)) {
      throw new Error("Target weight must be greater than zero");
    }
  }

  // Get active denominations for this metal & purity, sorted largest weight first
  const denoms = await MetalDenomination.findAll({
    where: {
      metalId,
      purityId,
      isActive: true,
    },
    order: [["weightGrams", "DESC"]],
  });

  let remaining = new Decimal(targetWeightDec);
  const items: BreakdownResultItem[] = [];

  for (const d of denoms) {
    const dWeight = new Decimal(d.weightGrams);
    if (dWeight.lte(0)) continue;

    // How many of this denomination fit?
    const count = remaining.dividedToIntegerBy(dWeight).toNumber();
    if (count > 0) {
      const denomTotalWeight = dWeight.times(count);
      const unitPrem = new Decimal(d.premiumAmount);
      const totalPrem = unitPrem.times(count);
      const metalAmt = denomTotalWeight.times(ratePerGramDec);
      const totalAmt = metalAmt.plus(totalPrem);

      items.push({
        denominationId: d.id,
        name: d.name,
        type: d.type,
        weightGrams: dWeight.toNumber(),
        quantity: count,
        unitPremium: unitPrem.toNumber(),
        totalWeightGrams: denomTotalWeight.toNumber(),
        totalPremium: totalPrem.toNumber(),
        metalAmount: metalAmt.toNumber(),
        totalAmount: totalAmt.toNumber(),
      });

      remaining = remaining.minus(denomTotalWeight);
    }
  }

  const allocatedWeight = targetWeightDec.minus(remaining).toNumber();
  const unallocatedWeight = remaining.toNumber();

  const totalMetalAmount = new Decimal(allocatedWeight).times(ratePerGramDec).toNumber();
  const totalPremiumAmount = items.reduce((sum, it) => sum + it.totalPremium, 0);
  const grandTotalAmount = totalMetalAmount + totalPremiumAmount;

  const unallocatedBudgetAmount = isBudgetMode && budgetDec
    ? Math.max(0, budgetDec.minus(grandTotalAmount).toNumber())
    : undefined;

  return {
    calculationMode: isBudgetMode ? "BUDGET" : "WEIGHT",
    budgetAmount: budgetDec ? budgetDec.toNumber() : undefined,
    targetWeightGrams: targetWeightDec.toNumber(),
    allocatedWeightGrams: allocatedWeight,
    unallocatedWeightGrams: unallocatedWeight,
    ratePerGram: ratePerGramDec.toNumber(),
    metalTotalAmount: totalMetalAmount,
    totalPremiumAmount: totalPremiumAmount,
    grandTotalAmount: grandTotalAmount,
    unallocatedBudgetAmount,
    items,
  };
}

/**
 * Calculates live denomination rate board (retail pricing matrix for 1g, 5g, 10g, etc.)
 */
export async function getDenominationRateBoard(
  metalId: string,
  purityId: string,
  ratePerGramInput: number | string
): Promise<DenominationRateBoardResult> {
  const rateDec = new Decimal(ratePerGramInput);
  if (rateDec.lte(0)) {
    throw new Error("Rate per gram must be greater than zero");
  }

  const denoms = await MetalDenomination.findAll({
    where: {
      metalId,
      purityId,
      isActive: true,
    },
    order: [["weightGrams", "ASC"]],
  });

  const items: DenominationRateBoardItem[] = denoms.map((d) => {
    const weight = new Decimal(d.weightGrams);
    const premium = new Decimal(d.premiumAmount);
    const metalVal = weight.times(rateDec);
    const totalVal = metalVal.plus(premium);
    const effRate = weight.gt(0) ? totalVal.dividedBy(weight) : rateDec;

    return {
      id: d.id,
      name: d.name,
      type: d.type,
      weightGrams: weight.toNumber(),
      premiumAmount: premium.toNumber(),
      metalAmount: metalVal.toNumber(),
      totalAmount: totalVal.toNumber(),
      effectiveRatePerGram: effRate.toNumber(),
    };
  });

  return {
    metalId,
    purityId,
    ratePerGram: rateDec.toNumber(),
    items,
  };
}

/**
 * Seed default standard denominations if table is empty
 */
export async function seedStandardDenominations(actorId: string): Promise<number> {
  const count = await MetalDenomination.count();
  if (count > 0) return 0;

  const metals = await Metal.findAll({
    include: [{ model: Purity, as: "purities" }],
  });

  const gold = metals.find((m) => m.code.toUpperCase() === "AU" || m.name.toLowerCase().includes("gold"));
  const silver = metals.find((m) => m.code.toUpperCase() === "AG" || m.name.toLowerCase().includes("silver"));

  let createdCount = 0;

  if (gold) {
    const goldPurities = (gold as any).purities as any[] | undefined;
    const p24 = goldPurities?.find((p: any) => p.name?.includes("24") || Number(p.purityPercentage) >= 99);
    if (p24) {
      const goldDenoms = [
        { type: "COIN" as const, name: "1g Gold Coin", weight: "1.0000", premium: "150.00" },
        { type: "COIN" as const, name: "2g Gold Coin", weight: "2.0000", premium: "200.00" },
        { type: "COIN" as const, name: "5g Gold Coin", weight: "5.0000", premium: "350.00" },
        { type: "COIN" as const, name: "8g Guinea Coin", weight: "8.0000", premium: "450.00" },
        { type: "COIN" as const, name: "10g Gold Coin", weight: "10.0000", premium: "500.00" },
        { type: "COIN" as const, name: "20g Gold Coin", weight: "20.0000", premium: "800.00" },
        { type: "BAR" as const, name: "50g Gold Cast Bar", weight: "50.0000", premium: "1200.00" },
        { type: "BAR" as const, name: "100g Gold Minted Bar", weight: "100.0000", premium: "1800.00" },
        { type: "BAR" as const, name: "1kg (1000g) London Good Delivery Bar", weight: "1000.0000", premium: "5000.00" },
      ];

      for (const gd of goldDenoms) {
        await MetalDenomination.create({
          metalId: gold.id,
          purityId: p24.id,
          type: gd.type,
          name: gd.name,
          weightGrams: gd.weight,
          premiumAmount: gd.premium,
          isActive: true,
        });
        createdCount++;
      }
    }
  }

  if (silver) {
    const silverPurities = (silver as any).purities as any[] | undefined;
    const p999 = silverPurities?.find((p: any) => p.name?.includes("999") || Number(p.purityPercentage) >= 99);
    if (p999) {
      const silverDenoms = [
        { type: "COIN" as const, name: "10g Silver Coin", weight: "10.0000", premium: "40.00" },
        { type: "COIN" as const, name: "20g Silver Coin", weight: "20.0000", premium: "60.00" },
        { type: "COIN" as const, name: "50g Silver Coin", weight: "50.0000", premium: "100.00" },
        { type: "COIN" as const, name: "100g Silver Coin", weight: "100.0000", premium: "150.00" },
        { type: "BAR" as const, name: "250g Silver Bar", weight: "250.0000", premium: "300.00" },
        { type: "BAR" as const, name: "500g Silver Bar", weight: "500.0000", premium: "500.00" },
        { type: "BAR" as const, name: "1kg (1000g) Silver Bar", weight: "1000.0000", premium: "800.00" },
      ];

      for (const sd of silverDenoms) {
        await MetalDenomination.create({
          metalId: silver.id,
          purityId: p999.id,
          type: sd.type,
          name: sd.name,
          weightGrams: sd.weight,
          premiumAmount: sd.premium,
          isActive: true,
        });
        createdCount++;
      }
    }
  }

  return createdCount;
}
