import Decimal from "decimal.js";
import { Op } from "sequelize";
import {
  RateBlock,
  Counterparty,
  Metal,
  Purity,
  Sale,
  User,
  runTransaction,
} from "@/lib/db";
import { writeAudit } from "./audit-service";
import type { Role } from "@/lib/db/types";

export interface CreateRateBlockServiceInput {
  counterpartyId: string;
  metalId: string;
  purityId: string;
  blockedWeightGrams: string | number;
  blockedRatePerGram: string | number;
  advanceAmount?: string | number;
  validHours?: number;
  notes?: string;
}

/**
 * Generates sequential unique Rate Block number (RB-YYYYMMDD-XXXX)
 */
async function generateBlockNumber(): Promise<string> {
  const prefix = "RB";
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const likePattern = `${prefix}-${dateStr}-%`;

  const count = await RateBlock.count({
    where: {
      blockNumber: {
        [Op.like]: likePattern,
      },
    },
  });

  const seq = String(count + 1).padStart(4, "0");
  return `${prefix}-${dateStr}-${seq}`;
}

/**
 * Create a new active rate block reserving price for a customer/party
 */
export async function createRateBlock(
  actorId: string,
  _actorRole: Role,
  input: CreateRateBlockServiceInput
): Promise<RateBlock> {
  const weight = new Decimal(input.blockedWeightGrams);
  const rate = new Decimal(input.blockedRatePerGram);
  const totalAmount = weight.times(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const advance = input.advanceAmount
    ? new Decimal(input.advanceAmount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    : new Decimal(0);

  const hours = input.validHours && input.validHours > 0 ? input.validHours : 4;
  const validUntil = new Date(Date.now() + hours * 60 * 60 * 1000);

  return runTransaction(async (t) => {
    const blockNumber = await generateBlockNumber();

    const block = await RateBlock.create(
      {
        blockNumber,
        counterpartyId: input.counterpartyId,
        metalId: input.metalId,
        purityId: input.purityId,
        blockedWeightGrams: weight.toFixed(4),
        blockedRatePerGram: rate.toFixed(4),
        totalBlockedAmount: totalAmount.toFixed(2),
        advanceAmount: advance.toFixed(2),
        validUntil,
        status: "ACTIVE",
        notes: input.notes?.trim() || null,
        createdById: actorId,
      },
      { transaction: t }
    );

    await writeAudit(t, {
      action: "CREATE",
      entityType: "RATE_BLOCK",
      entityId: block.id,
      actorId,
      metalId: input.metalId,
      purityId: input.purityId,
      nextState: {
        blockNumber,
        counterpartyId: input.counterpartyId,
        weight: weight.toFixed(4),
        rate: rate.toFixed(4),
        total: totalAmount.toFixed(2),
        advance: advance.toFixed(2),
        validUntil,
      },
      description: `Rate Block ${blockNumber} booked: ${weight.toFixed(4)}g @ ₹${rate.toFixed(2)}/g (Total ₹${totalAmount.toFixed(2)}) valid until ${validUntil.toISOString()}`,
    });

    return block;
  });
}

/**
 * Fetch rate blocks with automatic expiry check
 */
export async function getRateBlocks(filters?: {
  status?: "ACTIVE" | "FULFILLED" | "EXPIRED" | "CANCELLED" | "ALL";
  counterpartyId?: string;
  metalId?: string;
  search?: string;
}) {
  const now = new Date();

  // Expire any ACTIVE rate blocks whose validUntil is in the past
  await RateBlock.update(
    { status: "EXPIRED" },
    {
      where: {
        status: "ACTIVE",
        validUntil: {
          [Op.lt]: now,
        },
      },
    }
  );

  const where: Record<string, unknown> = {};

  if (filters?.status && filters.status !== "ALL") {
    where.status = filters.status;
  }

  if (filters?.counterpartyId) {
    where.counterpartyId = filters.counterpartyId;
  }

  if (filters?.metalId) {
    where.metalId = filters.metalId;
  }

  if (filters?.search) {
    where[Op.or as unknown as string] = [
      { blockNumber: { [Op.like]: `%${filters.search}%` } },
      { notes: { [Op.like]: `%${filters.search}%` } },
    ];
  }

  return RateBlock.findAll({
    where,
    order: [["createdAt", "DESC"]],
    include: [
      {
        model: Counterparty,
        as: "counterparty",
        attributes: ["id", "name", "phone", "type"],
      },
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
      {
        model: Sale,
        as: "fulfilledSale",
        attributes: ["id", "invoiceNumber", "totalAmount", "status"],
      },
      {
        model: User,
        as: "createdBy",
        attributes: ["id", "name", "email"],
      },
    ],
  });
}

/**
 * Cancel an active rate block
 */
export async function cancelRateBlock(
  actorId: string,
  _actorRole: Role,
  blockId: string,
  reason: string
): Promise<RateBlock> {
  return runTransaction(async (t) => {
    const block = await RateBlock.findByPk(blockId, { transaction: t });
    if (!block) {
      throw new Error("Rate Block not found");
    }

    if (block.status !== "ACTIVE") {
      throw new Error(`Cannot cancel rate block in ${block.status} status`);
    }

    const prevState = { ...block.toJSON() };

    block.status = "CANCELLED";
    block.notes = block.notes ? `${block.notes} | Cancel Reason: ${reason}` : `Cancel Reason: ${reason}`;
    await block.save({ transaction: t });

    await writeAudit(t, {
      action: "CANCEL",
      entityType: "RATE_BLOCK",
      entityId: block.id,
      actorId,
      metalId: block.metalId,
      purityId: block.purityId,
      prevState,
      nextState: { status: block.status, notes: block.notes },
      description: `Rate Block ${block.blockNumber} cancelled: ${reason}`,
    });

    return block;
  });
}

/**
 * Fulfill a rate block by linking it to a completed/draft Sale
 */
export async function fulfillRateBlock(
  actorId: string,
  _actorRole: Role,
  blockId: string,
  saleId: string
): Promise<RateBlock> {
  return runTransaction(async (t) => {
    const block = await RateBlock.findByPk(blockId, { transaction: t });
    if (!block) {
      throw new Error("Rate Block not found");
    }

    if (block.status !== "ACTIVE") {
      throw new Error(`Cannot fulfill rate block in ${block.status} status`);
    }

    const sale = await Sale.findByPk(saleId, { transaction: t });
    if (!sale) {
      throw new Error("Target Sale invoice not found");
    }

    const prevState = { ...block.toJSON() };

    block.status = "FULFILLED";
    block.fulfilledSaleId = saleId;
    await block.save({ transaction: t });

    await writeAudit(t, {
      action: "UPDATE",
      entityType: "RATE_BLOCK",
      entityId: block.id,
      actorId,
      saleId,
      metalId: block.metalId,
      purityId: block.purityId,
      prevState,
      nextState: { status: "FULFILLED", fulfilledSaleId: saleId },
      description: `Rate Block ${block.blockNumber} fulfilled into Sale ${sale.invoiceNumber}`,
    });

    return block;
  });
}
