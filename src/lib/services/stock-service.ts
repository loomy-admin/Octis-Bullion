/**
 * StockService — B1
 *
 * Authoritative service for all stock queries and calculations.
 * Stock is derived EXCLUSIVELY from the append-only StockMovement table.
 * Clean pure Sequelize implementation.
 */

import Decimal from "decimal.js";
import type { Transaction } from "sequelize";
import { Op, fn, col } from "sequelize";
import {
  StockMovement,
  Metal,
  Purity,
  Purchase,
  Sale,
  StockAdjustment,
  OpeningStock,
  User,
} from "@/lib/db";
import type { MovementType } from "@/lib/db/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StockPosition {
  metalId: string;
  metalCode: string;
  metalName: string;
  purityId: string;
  purityLabel: string;
  fineness: Decimal;
  openingWeightGrams: Decimal;
  purchasedWeightGrams: Decimal;
  soldWeightGrams: Decimal;
  adjustmentIncreaseGrams: Decimal;
  adjustmentDecreaseGrams: Decimal;
  currentWeightGrams: Decimal;
}

// ---------------------------------------------------------------------------
// Stock Calculation (Single Authoritative Source)
// ---------------------------------------------------------------------------

/**
 * Derive the current stock position for one (metalId, purityId) bucket.
 * All arithmetic uses Decimal to avoid floating-point loss.
 */
export async function getCurrentStock(
  metalId: string,
  purityId: string,
  t?: Transaction
): Promise<Decimal> {
  const sum = await StockMovement.sum("weightGrams", {
    where: { metalId, purityId },
    transaction: t,
  });
  return sum != null ? new Decimal(sum) : new Decimal(0);
}

/**
 * Derive a full breakdown for one (metalId, purityId) bucket.
 */
export async function getStockPosition(
  metalId: string,
  purityId: string
): Promise<StockPosition> {
  const [metalRow, purityRow, movements] = await Promise.all([
    Metal.findByPk(metalId, { raw: true }),
    Purity.findByPk(purityId, { raw: true }),
    StockMovement.findAll({ where: { metalId, purityId }, raw: true }),
  ]);

  if (!metalRow) throw new Error(`Metal ${metalId} not found.`);
  if (!purityRow) throw new Error(`Purity ${purityId} not found.`);

  const metal = metalRow as unknown as { id: string; code: string; name: string };
  const purity = purityRow as unknown as { id: string; label: string; fineness: string };

  let opening = new Decimal(0);
  let purchased = new Decimal(0);
  let sold = new Decimal(0);
  let adjIncrease = new Decimal(0);
  let adjDecrease = new Decimal(0);

  for (const m of movements as unknown as { weightGrams: string; movementType: string }[]) {
    const w = new Decimal(m.weightGrams);
    switch (m.movementType) {
      case "OPENING":
        opening = opening.plus(w);
        break;
      case "PURCHASE":
        purchased = purchased.plus(w);
        break;
      case "PURCHASE_CANCEL":
        purchased = purchased.plus(w); // w is negative
        break;
      case "SALE":
        sold = sold.plus(w.abs()); // w is negative; track absolute sold
        break;
      case "SALE_CANCEL":
        sold = sold.minus(w.abs()); // reversal reduces sold
        break;
      case "ADJUSTMENT_INCREASE":
        adjIncrease = adjIncrease.plus(w);
        break;
      case "ADJUSTMENT_DECREASE":
        adjDecrease = adjDecrease.plus(w.abs()); // w is negative; track absolute
        break;
    }
  }

  // current = opening + purchased - sold + adjIncrease - adjDecrease
  const current = opening
    .plus(purchased)
    .minus(sold)
    .plus(adjIncrease)
    .minus(adjDecrease);

  return {
    metalId,
    metalCode: metal.code,
    metalName: metal.name,
    purityId,
    purityLabel: purity.label,
    fineness: new Decimal(purity.fineness),
    openingWeightGrams: opening,
    purchasedWeightGrams: purchased,
    soldWeightGrams: sold,
    adjustmentIncreaseGrams: adjIncrease,
    adjustmentDecreaseGrams: adjDecrease,
    currentWeightGrams: current,
  };
}

export interface DetailedStockPosition extends StockPosition {
  averagePurchaseRate: Decimal;
  totalPurchaseValue: Decimal;
  averageSellingRate: Decimal;
  totalSalesValue: Decimal;
  hasOpeningStock: boolean;
}

/**
 * Get all stock positions across all active (Metal × Purity) pairs.
 */
export async function getAllStockPositions(): Promise<StockPosition[]> {
  const purities = await Purity.findAll({
    where: { isActive: true },
    attributes: ["metalId", "id"],
    raw: true,
  });

  const movementPairs = await StockMovement.findAll({
    attributes: ["metalId", "purityId"],
    group: ["metalId", "purityId"],
    raw: true,
  });

  const pairMap = new Map<string, { metalId: string; purityId: string }>();
  for (const p of purities as unknown as { metalId: string; id: string }[]) {
    pairMap.set(`${p.metalId}_${p.id}`, { metalId: p.metalId, purityId: p.id });
  }
  for (const p of movementPairs as unknown as { metalId: string; purityId: string }[]) {
    pairMap.set(`${p.metalId}_${p.purityId}`, { metalId: p.metalId, purityId: p.purityId });
  }

  return Promise.all(
    Array.from(pairMap.values()).map((p) => getStockPosition(p.metalId, p.purityId))
  );
}

/**
 * Get detailed stock positions with financial valuation for the /stock page.
 */
export async function getDetailedStockPositions(): Promise<DetailedStockPosition[]> {
  const basePositions = await getAllStockPositions();

  return Promise.all(
    basePositions.map(async (pos) => {
      const [purchaseAgg, saleAgg, opening] = await Promise.all([
        Purchase.findAll({
          attributes: [
            [fn("SUM", col("totalAmount")), "totalAmount"],
            [fn("SUM", col("weightGrams")), "weightGrams"],
          ],
          where: {
            metalId: pos.metalId,
            purityId: pos.purityId,
            status: "POSTED",
          },
          raw: true,
        }),
        Sale.findAll({
          attributes: [
            [fn("SUM", col("totalAmount")), "totalAmount"],
            [fn("SUM", col("weightGrams")), "weightGrams"],
          ],
          where: {
            metalId: pos.metalId,
            purityId: pos.purityId,
            status: "POSTED",
          },
          raw: true,
        }),
        OpeningStock.findOne({
          where: {
            metalId: pos.metalId,
            purityId: pos.purityId,
          },
        }),
      ]);

      const pRow = (purchaseAgg?.[0] as any) || {};
      const sRow = (saleAgg?.[0] as any) || {};

      const totalPurchaseValue = pRow.totalAmount != null
        ? new Decimal(pRow.totalAmount.toString())
        : new Decimal(0);
      const totalPurchasedWeight = pRow.weightGrams != null
        ? new Decimal(pRow.weightGrams.toString())
        : new Decimal(0);

      const totalSalesValue = sRow.totalAmount != null
        ? new Decimal(sRow.totalAmount.toString())
        : new Decimal(0);
      const totalSoldWeight = sRow.weightGrams != null
        ? new Decimal(sRow.weightGrams.toString())
        : new Decimal(0);

      const avgPurchaseRate = totalPurchasedWeight.greaterThan(0)
        ? totalPurchaseValue.dividedBy(totalPurchasedWeight).toDecimalPlaces(2)
        : new Decimal(0);

      const avgSellingRate = totalSoldWeight.greaterThan(0)
        ? totalSalesValue.dividedBy(totalSoldWeight).toDecimalPlaces(2)
        : new Decimal(0);

      return {
        ...pos,
        averagePurchaseRate: avgPurchaseRate,
        totalPurchaseValue,
        averageSellingRate: avgSellingRate,
        totalSalesValue,
        hasOpeningStock: !!opening,
      };
    })
  );
}

/**
 * Get movement history for a specific bucket.
 */
export async function getBucketMovements(metalId: string, purityId: string) {
  const movements = await StockMovement.findAll({
    where: { metalId, purityId },
    include: [
      { model: Metal, as: "metal" },
      { model: Purity, as: "purity" },
      { model: User, as: "createdBy", attributes: ["id", "name", "role"] },
    ],
    order: [["createdAt", "DESC"]],
  });
  return movements.map((m) => m.get({ plain: true }));
}

/**
 * List all stock movements with comprehensive metadata for transaction history.
 */
export async function listStockMovements(filters?: {
  metalId?: string;
  purityId?: string;
  movementType?: MovementType;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  skip?: number;
}) {
  const where: any = {};
  if (filters?.metalId) where.metalId = filters.metalId;
  if (filters?.purityId) where.purityId = filters.purityId;
  if (filters?.movementType) where.movementType = filters.movementType;
  if (filters?.startDate || filters?.endDate) {
    where.createdAt = {};
    if (filters.startDate) where.createdAt[Op.gte] = filters.startDate;
    if (filters.endDate) where.createdAt[Op.lte] = filters.endDate;
  }

  const movements = await StockMovement.findAll({
    where,
    include: [
      { model: Metal, as: "metal" },
      { model: Purity, as: "purity" },
      { model: User, as: "createdBy", attributes: ["id", "name", "role"] },
      { model: Purchase, as: "purchase", attributes: ["id", "invoiceNumber", "supplierName", "status"] },
      { model: Sale, as: "sale", attributes: ["id", "invoiceNumber", "buyerName", "status"] },
      { model: StockAdjustment, as: "adjustment", attributes: ["id", "reason", "direction", "status"] },
      { model: OpeningStock, as: "openingStock", attributes: ["id", "effectiveDate"] },
    ],
    order: [["createdAt", "DESC"]],
    limit: filters?.limit ?? 100,
    offset: filters?.skip ?? 0,
  });

  return movements.map((m) => m.get({ plain: true }));
}

/**
 * Validate that a given (metalId, purityId) has at least `requiredGrams`
 * available. Throws a descriptive error if not.
 * Must be called INSIDE a transaction to be safe.
 */
export async function assertSufficientStock(
  t: Transaction | undefined,
  metalId: string,
  purityId: string,
  requiredGrams: Decimal
): Promise<void> {
  // Concurrency Guard: Lock the bucket's purity record using SELECT ... FOR UPDATE.
  if (t) {
    await Purity.findByPk(purityId, { lock: t.LOCK.UPDATE, transaction: t });
  }

  const sum = await StockMovement.sum("weightGrams", {
    where: { metalId, purityId },
    transaction: t,
  });
  const available = sum != null ? new Decimal(sum) : new Decimal(0);
  if (available.lessThan(requiredGrams)) {
    throw new InsufficientStockError(
      metalId,
      purityId,
      available,
      requiredGrams
    );
  }
}

// ---------------------------------------------------------------------------
// Custom Errors
// ---------------------------------------------------------------------------

export class InsufficientStockError extends Error {
  constructor(
    public readonly metalId: string,
    public readonly purityId: string,
    public readonly available: Decimal,
    public readonly requested: Decimal
  ) {
    super(
      `Insufficient stock for metal=${metalId} purity=${purityId}. ` +
        `Available: ${available.toFixed(4)}g, Requested: ${requested.toFixed(4)}g`
    );
    this.name = "InsufficientStockError";
  }
}

export class InactiveEntityError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} with id=${id} is inactive and cannot be used for new transactions.`);
    this.name = "InactiveEntityError";
  }
}

export class UnauthorizedError extends Error {
  constructor(action: string) {
    super(`You are not authorized to perform: ${action}`);
    this.name = "UnauthorizedError";
  }
}