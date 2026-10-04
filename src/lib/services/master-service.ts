/**
 * MasterService — B1
 *
 * Manages Metal and Purity master data.
 * Enforces:
 *   - No duplicate codes/names
 *   - No deletion of entities with transaction history
 *   - Inactive entities cannot be used for new transactions
 */

import type { Transaction } from "sequelize";
import { Metal } from "@/lib/db/models/Metal";
import { Purity } from "@/lib/db/models/Purity";
import { runTransaction } from "@/lib/db";
import { writeAudit } from "./audit-service";
import { InactiveEntityError, UnauthorizedError } from "./stock-service";
import type { Role } from "@/lib/db/types";
import Decimal from "decimal.js";

// ---------------------------------------------------------------------------
// Metal
// ---------------------------------------------------------------------------

export async function getMetal(id: string) {
  const metal = await Metal.findByPk(id);
  if (!metal) throw new Error(`Metal ${id} not found.`);
  return metal.get({ plain: true });
}

export async function getAllMetals(activeOnly = false) {
  const metals = await Metal.findAll({
    where: activeOnly ? { isActive: true } : undefined,
    include: [{ model: Purity, as: "purities" }],
    order: [
      ["name", "ASC"],
      [{ model: Purity, as: "purities" }, "sortOrder", "ASC"],
    ],
  });
  return metals.map((m) => m.get({ plain: true }));
}

/**
 * Validate that a metal is active; throw InactiveEntityError if not.
 * Must be called inside a transaction for atomicity.
 */
export async function assertMetalActive(t: Transaction | undefined, metalId: string) {
  const metal = await Metal.findByPk(metalId, { transaction: t });
  if (!metal) throw new Error(`Metal ${metalId} not found.`);
  if (!metal.isActive) throw new InactiveEntityError("Metal", metalId);
  return metal;
}

/**
 * Validate that a purity is active and belongs to the expected metal.
 */
export async function assertPurityActive(
  t: Transaction | undefined,
  purityId: string,
  metalId: string
) {
  const purity = await Purity.findByPk(purityId, { transaction: t });
  if (!purity) throw new Error(`Purity ${purityId} not found.`);
  if (purity.metalId !== metalId) {
    throw new Error(`Purity ${purityId} does not belong to metal ${metalId}.`);
  }
  if (!purity.isActive) throw new InactiveEntityError("Purity", purityId);
  return purity;
}

/**
 * Activate or deactivate a metal. ADMIN only.
 */
export async function setMetalActive(
  actorId: string,
  actorRole: Role,
  metalId: string,
  isActive: boolean
) {
  if (actorRole !== "ADMIN") {
    throw new UnauthorizedError("manage metal master");
  }
  return runTransaction(async (t) => {
    const metal = await Metal.findByPk(metalId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!metal) throw new Error(`Metal ${metalId} not found.`);
    const prevActive = metal.isActive;
    metal.isActive = isActive;
    await metal.save({ transaction: t });

    await writeAudit(t, {
      action: isActive ? "ACTIVATE" : "DEACTIVATE",
      entityType: "Metal",
      entityId: metalId,
      actorId,
      metalId,
      prevState: { isActive: prevActive },
      nextState: { isActive },
      description: `Metal ${metal.name} ${isActive ? "activated" : "deactivated"}.`,
    });
    return metal.get({ plain: true });
  });
}

/**
 * Activate or deactivate a purity. ADMIN only.
 */
export async function setPurityActive(
  actorId: string,
  actorRole: Role,
  purityId: string,
  isActive: boolean
) {
  if (actorRole !== "ADMIN") {
    throw new UnauthorizedError("manage purity master");
  }
  return runTransaction(async (t) => {
    const purity = await Purity.findByPk(purityId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!purity) throw new Error(`Purity ${purityId} not found.`);
    const prevActive = purity.isActive;
    purity.isActive = isActive;
    await purity.save({ transaction: t });

    await writeAudit(t, {
      action: isActive ? "ACTIVATE" : "DEACTIVATE",
      entityType: "Purity",
      entityId: purityId,
      actorId,
      purityId,
      prevState: { isActive: prevActive },
      nextState: { isActive },
      description: `Purity ${purity.label} ${isActive ? "activated" : "deactivated"}.`,
    });
    return purity.get({ plain: true });
  });
}

// ---------------------------------------------------------------------------
// Purity
// ---------------------------------------------------------------------------

export async function getPuritiesByMetal(metalId: string, activeOnly = false) {
  const purities = await Purity.findAll({
    where: { metalId, ...(activeOnly ? { isActive: true } : {}) },
    order: [["sortOrder", "ASC"]],
  });
  return purities.map((p) => p.get({ plain: true }));
}

export async function getAllPurities(activeOnly = false) {
  const purities = await Purity.findAll({
    where: activeOnly ? { isActive: true } : undefined,
    include: [{ model: Metal, as: "metal" }],
    order: [
      [{ model: Metal, as: "metal" }, "name", "ASC"],
      ["sortOrder", "ASC"],
    ],
  });
  return purities.map((p) => p.get({ plain: true }));
}

export async function createMetal(
  actorId: string,
  actorRole: Role,
  data: {
    code: string;
    name: string;
    type: "GOLD" | "SILVER";
  }
) {
  if (actorRole !== "ADMIN") {
    throw new UnauthorizedError("create metal");
  }

  const code = data.code.trim().toUpperCase();
  const name = data.name.trim();

  return runTransaction(async (t) => {
    const metal = await Metal.create(
      {
        code,
        name,
        type: data.type,
      },
      { transaction: t }
    );

    await writeAudit(t, {
      action: "CREATE",
      entityType: "Metal",
      entityId: metal.id,
      actorId,
      metalId: metal.id,
      nextState: { code, name, type: data.type },
      description: `Created metal: ${name} (${code})`,
    });

    return metal.get({ plain: true });
  });
}

export async function updateMetal(
  actorId: string,
  actorRole: Role,
  metalId: string,
  data: {
    name?: string;
  }
) {
  if (actorRole !== "ADMIN") {
    throw new UnauthorizedError("update metal");
  }

  return runTransaction(async (t) => {
    const metal = await Metal.findByPk(metalId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!metal) throw new Error(`Metal ${metalId} not found.`);
    const prevName = metal.name;
    if (data.name) {
      metal.name = data.name.trim();
      await metal.save({ transaction: t });
    }

    await writeAudit(t, {
      action: "UPDATE",
      entityType: "Metal",
      entityId: metalId,
      actorId,
      metalId,
      prevState: { name: prevName },
      nextState: { name: metal.name },
      description: `Updated metal ${prevName}`,
    });

    return metal.get({ plain: true });
  });
}

export async function createPurity(
  actorId: string,
  actorRole: Role,
  data: {
    metalId: string;
    label: string;
    fineness: string | number;
    displayInfo?: string;
    sortOrder?: number;
  }
) {
  if (actorRole !== "ADMIN") {
    throw new UnauthorizedError("create purity");
  }

  const finenessDecimal = new Decimal(data.fineness);
  if (finenessDecimal.lessThanOrEqualTo(0) || finenessDecimal.greaterThan(1)) {
    throw new Error("Fineness must be greater than 0 and less than or equal to 1.0000");
  }

  return runTransaction(async (t) => {
    await assertMetalActive(t, data.metalId);

    const purity = await Purity.create(
      {
        metalId: data.metalId,
        label: data.label.trim(),
        fineness: finenessDecimal.toString(),
        displayInfo: data.displayInfo?.trim() || null,
        sortOrder: data.sortOrder ?? 0,
      },
      { transaction: t }
    );

    await writeAudit(t, {
      action: "CREATE",
      entityType: "Purity",
      entityId: purity.id,
      actorId,
      metalId: data.metalId,
      purityId: purity.id,
      nextState: { label: purity.label, fineness: finenessDecimal.toString() },
      description: `Created purity: ${purity.label} for metalId ${data.metalId}`,
    });

    return purity.get({ plain: true });
  });
}

export async function updatePurity(
  actorId: string,
  actorRole: Role,
  purityId: string,
  data: {
    label?: string;
    fineness?: string | number;
    displayInfo?: string;
    sortOrder?: number;
  }
) {
  if (actorRole !== "ADMIN") {
    throw new UnauthorizedError("update purity");
  }

  return runTransaction(async (t) => {
    const purity = await Purity.findByPk(purityId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!purity) throw new Error(`Purity ${purityId} not found.`);
    const prevLabel = purity.label;
    const prevFineness = purity.fineness;

    if (data.label) purity.label = data.label.trim();
    if (data.displayInfo !== undefined) purity.displayInfo = data.displayInfo?.trim() || null;
    if (data.sortOrder !== undefined) purity.sortOrder = data.sortOrder;
    if (data.fineness !== undefined) {
      const f = new Decimal(data.fineness);
      if (f.lessThanOrEqualTo(0) || f.greaterThan(1)) {
        throw new Error("Fineness must be between 0 and 1.0000");
      }
      purity.fineness = f.toString();
    }

    await purity.save({ transaction: t });

    await writeAudit(t, {
      action: "UPDATE",
      entityType: "Purity",
      entityId: purityId,
      actorId,
      purityId,
      prevState: { label: prevLabel, fineness: String(prevFineness) },
      nextState: { label: purity.label, fineness: String(purity.fineness) },
      description: `Updated purity ${prevLabel}`,
    });

    return purity.get({ plain: true });
  });
}
