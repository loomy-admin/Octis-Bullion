import { Op, fn, col, where } from "sequelize";
import { sequelize, runTransaction } from "./sequelize";
import { User } from "./models/User";
import { Session } from "./models/Session";
import { Account } from "./models/Account";
import { Verification } from "./models/Verification";
import { Metal } from "./models/Metal";
import { Purity } from "./models/Purity";
import { Counterparty } from "./models/Counterparty";
import { OpeningStock } from "./models/OpeningStock";
import { StockMovement } from "./models/StockMovement";
import { Purchase } from "./models/Purchase";
import { Sale } from "./models/Sale";
import { StockAdjustment } from "./models/StockAdjustment";
import { AuditLog } from "./models/AuditLog";
import { AppSetting } from "./models/AppSetting";

export * from "./types";

let associationsInitialized = false;

export function initAssociations() {
  if (associationsInitialized) return;

  // User relations
  User.hasMany(Session, { foreignKey: "userId", as: "sessions", onDelete: "CASCADE" });
  Session.belongsTo(User, { foreignKey: "userId", as: "user" });

  User.hasMany(Account, { foreignKey: "userId", as: "accounts", onDelete: "CASCADE" });
  Account.belongsTo(User, { foreignKey: "userId", as: "user" });

  User.hasMany(Purchase, { foreignKey: "createdById", as: "purchases" });
  Purchase.belongsTo(User, { foreignKey: "createdById", as: "createdBy" });

  User.hasMany(Sale, { foreignKey: "createdById", as: "sales" });
  Sale.belongsTo(User, { foreignKey: "createdById", as: "createdBy" });

  User.hasMany(StockAdjustment, { foreignKey: "createdById", as: "adjustments" });
  StockAdjustment.belongsTo(User, { foreignKey: "createdById", as: "createdBy" });

  User.hasMany(StockMovement, { foreignKey: "createdById", as: "stockMovements" });
  StockMovement.belongsTo(User, { foreignKey: "createdById", as: "createdBy" });

  User.hasMany(AuditLog, { foreignKey: "actorId", as: "auditLogs" });
  AuditLog.belongsTo(User, { foreignKey: "actorId", as: "actor" });

  User.hasMany(OpeningStock, { foreignKey: "createdById", as: "openingStocks" });
  OpeningStock.belongsTo(User, { foreignKey: "createdById", as: "createdBy" });

  // Metal relations
  Metal.hasMany(Purity, { foreignKey: "metalId", as: "purities" });
  Purity.belongsTo(Metal, { foreignKey: "metalId", as: "metal" });

  Metal.hasMany(Purchase, { foreignKey: "metalId", as: "purchases" });
  Purchase.belongsTo(Metal, { foreignKey: "metalId", as: "metal" });

  Metal.hasMany(Sale, { foreignKey: "metalId", as: "sales" });
  Sale.belongsTo(Metal, { foreignKey: "metalId", as: "metal" });

  Metal.hasMany(StockAdjustment, { foreignKey: "metalId", as: "adjustments" });
  StockAdjustment.belongsTo(Metal, { foreignKey: "metalId", as: "metal" });

  Metal.hasMany(StockMovement, { foreignKey: "metalId", as: "stockMovements" });
  StockMovement.belongsTo(Metal, { foreignKey: "metalId", as: "metal" });

  Metal.hasMany(OpeningStock, { foreignKey: "metalId", as: "openingStocks" });
  OpeningStock.belongsTo(Metal, { foreignKey: "metalId", as: "metal" });

  // Purity relations
  Purity.hasMany(Purchase, { foreignKey: "purityId", as: "purchases" });
  Purchase.belongsTo(Purity, { foreignKey: "purityId", as: "purity" });

  Purity.hasMany(Sale, { foreignKey: "purityId", as: "sales" });
  Sale.belongsTo(Purity, { foreignKey: "purityId", as: "purity" });

  Purity.hasMany(StockAdjustment, { foreignKey: "purityId", as: "adjustments" });
  StockAdjustment.belongsTo(Purity, { foreignKey: "purityId", as: "purity" });

  Purity.hasMany(StockMovement, { foreignKey: "purityId", as: "stockMovements" });
  StockMovement.belongsTo(Purity, { foreignKey: "purityId", as: "purity" });

  Purity.hasMany(OpeningStock, { foreignKey: "purityId", as: "openingStocks" });
  OpeningStock.belongsTo(Purity, { foreignKey: "purityId", as: "purity" });

  // Counterparty relations
  Counterparty.hasMany(Purchase, { foreignKey: "counterpartyId", as: "purchases" });
  Purchase.belongsTo(Counterparty, { foreignKey: "counterpartyId", as: "counterparty" });

  Counterparty.hasMany(Sale, { foreignKey: "counterpartyId", as: "sales" });
  Sale.belongsTo(Counterparty, { foreignKey: "counterpartyId", as: "counterparty" });

  // StockMovement relations
  Purchase.hasMany(StockMovement, { foreignKey: "purchaseId", as: "stockMovements" });
  StockMovement.belongsTo(Purchase, { foreignKey: "purchaseId", as: "purchase" });

  Sale.hasMany(StockMovement, { foreignKey: "saleId", as: "stockMovements" });
  StockMovement.belongsTo(Sale, { foreignKey: "saleId", as: "sale" });

  StockAdjustment.hasMany(StockMovement, { foreignKey: "adjustmentId", as: "stockMovements" });
  StockMovement.belongsTo(StockAdjustment, { foreignKey: "adjustmentId", as: "adjustment" });

  OpeningStock.hasOne(StockMovement, { foreignKey: "openingStockId", as: "stockMovement" });
  StockMovement.belongsTo(OpeningStock, { foreignKey: "openingStockId", as: "openingStock" });

  associationsInitialized = true;
}

// Ensure associations are registered on module load
initAssociations();

/**
 * Standard MySQL database table synchronization without CLI migrations.
 */
export async function syncDatabase(options?: { alter?: boolean; force?: boolean }) {
  initAssociations();
  await sequelize.authenticate();
  await sequelize.sync({ alter: options?.alter ?? true, force: options?.force ?? false });
}

export {
  sequelize,
  runTransaction,
  Op,
  fn,
  col,
  where,
  User,
  Session,
  Account,
  Verification,
  Metal,
  Purity,
  Counterparty,
  OpeningStock,
  StockMovement,
  Purchase,
  Sale,
  StockAdjustment,
  AuditLog,
  AppSetting,
};

export default sequelize;
