/**
 * CounterpartyService — B2
 *
 * Manages Suppliers, Customers, and Both (dual-role counterparties).
 * Enforces:
 *   - ADMIN can create, update, activate/deactivate
 *   - STAFF can read/list
 *   - Soft-deactivation (never destructive delete)
 *   - Full audit logging
 */

import { Op } from "sequelize";
import { Counterparty } from "@/lib/db/models/Counterparty";
import { Purchase } from "@/lib/db/models/Purchase";
import { Sale } from "@/lib/db/models/Sale";
import { runTransaction } from "@/lib/db";
import { writeAudit } from "./audit-service";
import { UnauthorizedError } from "./stock-service";
import type { Role, CounterpartyType } from "@/lib/db/types";

export interface CreateCounterpartyInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  type: CounterpartyType;
  notes?: string | null;
}

export interface UpdateCounterpartyInput {
  name?: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  type?: CounterpartyType;
  notes?: string | null;
}

export async function getCounterparty(id: string) {
  const cp = await Counterparty.findByPk(id);
  if (!cp) throw new Error(`Counterparty ${id} not found.`);

  const [purchases, sales] = await Promise.all([
    Purchase.count({ where: { counterpartyId: id } }),
    Sale.count({ where: { counterpartyId: id } }),
  ]);

  return {
    ...cp.get({ plain: true }),
    _count: {
      purchases,
      sales,
    },
  };
}

export async function listCounterparties(filters?: {
  type?: CounterpartyType;
  isActive?: boolean;
  search?: string;
}) {
  const where: any = {};

  if (filters?.type) {
    where.type = filters.type;
  }

  if (filters?.isActive !== undefined) {
    where.isActive = filters.isActive;
  }

  if (filters?.search) {
    const s = `%${filters.search.trim()}%`;
    where[Op.or] = [
      { name: { [Op.like]: s } },
      { phone: { [Op.like]: s } },
      { email: { [Op.like]: s } },
    ];
  }

  const counterparties = await Counterparty.findAll({
    where,
    order: [["name", "ASC"]],
  });

  return Promise.all(
    counterparties.map(async (cp) => {
      const [purchases, sales] = await Promise.all([
        Purchase.count({ where: { counterpartyId: cp.id } }),
        Sale.count({ where: { counterpartyId: cp.id } }),
      ]);
      return {
        ...cp.get({ plain: true }),
        _count: {
          purchases,
          sales,
        },
      };
    })
  );
}

export async function createCounterparty(
  actorId: string,
  actorRole: Role,
  input: CreateCounterpartyInput
) {
  if (actorRole !== "ADMIN") {
    throw new UnauthorizedError("create counterparty");
  }

  const name = input.name.trim();
  if (!name) throw new Error("Counterparty name is required.");

  return runTransaction(async (t) => {
    const counterparty = await Counterparty.create(
      {
        name,
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        address: input.address?.trim() || null,
        type: input.type,
        notes: input.notes?.trim() || null,
      },
      { transaction: t }
    );

    await writeAudit(t, {
      action: "CREATE",
      entityType: "Counterparty",
      entityId: counterparty.id,
      actorId,
      nextState: {
        name: counterparty.name,
        type: counterparty.type,
      },
      description: `Created counterparty ${counterparty.name} (${counterparty.type})`,
    });

    return counterparty.get({ plain: true });
  });
}

export async function updateCounterparty(
  actorId: string,
  actorRole: Role,
  id: string,
  input: UpdateCounterpartyInput
) {
  if (actorRole !== "ADMIN") {
    throw new UnauthorizedError("update counterparty");
  }

  return runTransaction(async (t) => {
    const prev = await Counterparty.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!prev) throw new Error(`Counterparty ${id} not found.`);

    const prevName = prev.name;
    const prevType = prev.type;

    if (input.name !== undefined) prev.name = input.name.trim();
    if (input.phone !== undefined) prev.phone = input.phone?.trim() || null;
    if (input.email !== undefined) prev.email = input.email?.trim() || null;
    if (input.address !== undefined) prev.address = input.address?.trim() || null;
    if (input.type !== undefined) prev.type = input.type;
    if (input.notes !== undefined) prev.notes = input.notes?.trim() || null;

    await prev.save({ transaction: t });

    await writeAudit(t, {
      action: "UPDATE",
      entityType: "Counterparty",
      entityId: id,
      actorId,
      prevState: { name: prevName, type: prevType },
      nextState: { name: prev.name, type: prev.type },
      description: `Updated counterparty ${prevName}`,
    });

    return prev.get({ plain: true });
  });
}

export async function setCounterpartyActive(
  actorId: string,
  actorRole: Role,
  id: string,
  isActive: boolean
) {
  if (actorRole !== "ADMIN") {
    throw new UnauthorizedError("activate/deactivate counterparty");
  }

  return runTransaction(async (t) => {
    const prev = await Counterparty.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!prev) throw new Error(`Counterparty ${id} not found.`);

    const prevActive = prev.isActive;
    prev.isActive = isActive;
    await prev.save({ transaction: t });

    await writeAudit(t, {
      action: isActive ? "ACTIVATE" : "DEACTIVATE",
      entityType: "Counterparty",
      entityId: id,
      actorId,
      prevState: { isActive: prevActive },
      nextState: { isActive },
      description: `Counterparty ${prev.name} ${isActive ? "activated" : "deactivated"}`,
    });

    return prev.get({ plain: true });
  });
}
